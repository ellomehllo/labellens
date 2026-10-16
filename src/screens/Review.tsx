import { useState } from 'react';
import {
  CATEGORIES,
  CATEGORY_LABELS,
  CRITICAL_KINDS,
  MARKETS,
  SECTION_KINDS,
  SECTION_LABELS,
  type LabelSection,
  type SectionKind,
} from '../../shared/types.ts';
import type { Flow } from '../App.tsx';
import { Icon } from '../components/Icon.tsx';
import { Notice, PageTitle } from '../components/ui.tsx';

interface Props {
  flow: Flow;
  onChange: (patch: Partial<Flow>) => void;
  onAnalyze: () => void;
  onRetake: () => void;
}

const READ_TEXT = { high: 'Read clearly', medium: 'Some parts unclear', low: 'Hard to read' } as const;

export function Review({ flow, onChange, onAnalyze, onRetake }: Props) {
  const { extraction, sections, input } = flow;
  const [newKind, setNewKind] = useState<SectionKind>('ingredients');
  const hasText = sections.some((s) => s.text.trim().length > 0);
  const lowConfidenceCategory = extraction && extraction.category_confidence !== 'high';

  const update = (id: string, patch: Partial<LabelSection>) =>
    onChange({ sections: sections.map((s) => (s.id === id ? { ...s, ...patch } : s)) });

  return (
    <div className="stack">
      <PageTitle eyebrow="Step 2 of 3">
        {input === 'photo' ? 'Check what was read' : input === 'example' ? 'Example label text' : 'Type the label text'}
      </PageTitle>

      {input === 'photo' && (
        <p className="muted">
          This is the text LabelLens could see. Correct anything misread, especially the highlighted fields, before it’s
          explained. Don’t add text that isn’t on the label.
        </p>
      )}
      {input === 'typed' && (
        <p className="muted">Copy the text exactly as it appears on the packaging. Leave a box empty if the label doesn’t have it.</p>
      )}
      {input === 'example' && (
        <Notice tone="info" title="This is example text, not a real product">
          It’s a made-up cereal label so you can see how LabelLens works. The explanation on the next screen is a real
          analysis of this text.
        </Notice>
      )}

      {extraction?.not_a_label && (
        <Notice tone="warn" title="This doesn’t look like a product label">
          The photos don’t seem to show packaging text. Retake them with the label filling the frame.
        </Notice>
      )}
      {extraction && !extraction.not_a_label && extraction.readability !== 'good' && (
        <Notice tone="warn" title={extraction.readability === 'poor' ? 'The photos were hard to read' : 'Parts were hard to read'}>
          {extraction.image_issues.length > 0 && (
            <ul>
              {extraction.image_issues.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          )}
          <span>
            {extraction.readability === 'poor' ? 'A clearer photo will give a more reliable result. ' : ''}
            <button className="link-btn" onClick={onRetake}>
              Retake or add photos
            </button>
          </span>
        </Notice>
      )}
      {extraction?.notes.length ? (
        <Notice tone="plain" title="Notes from reading the label">
          <ul>
            {extraction.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </Notice>
      ) : null}

      {flow.images.length > 0 && (
        <div className="thumbs" aria-label="Photos used">
          {flow.images.map((img, i) => (
            <a key={img.id} className="thumb" href={img.previewUrl} target="_blank" rel="noreferrer">
              <img src={img.previewUrl} alt={`Photo ${i + 1}: open full size to compare`} />
            </a>
          ))}
        </div>
      )}

      <div className="panel grid-2">
        <label className="field">
          Product type
          <select value={flow.category} onChange={(e) => onChange({ category: e.target.value as Flow['category'] })}>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
          <span className="field-hint">
            {extraction
              ? lowConfidenceCategory
                ? `Best guess: ${CATEGORY_LABELS[extraction.category]}. Please confirm.`
                : `Detected from the label: ${CATEGORY_LABELS[extraction.category]}.`
              : 'Choose what kind of product this is.'}
          </span>
        </label>
        <label className="field">
          <span>
            Where it was bought <span className="field-hint">(optional)</span>
          </span>
          <select value={flow.market ?? ''} onChange={(e) => onChange({ market: e.target.value || null })}>
            <option value="">Not sure</option>
            {MARKETS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
          <span className="field-hint">
            {extraction?.market
              ? `The label suggests ${extraction.market}${extraction.market_basis ? ` (${extraction.market_basis})` : ''}.`
              : 'Labelling rules differ by country, so this helps match the right sources.'}
          </span>
        </label>
      </div>

      {sections.map((section) => {
        const critical = CRITICAL_KINDS.has(section.kind);
        const fieldId = `section-${section.id}`;
        return (
          <section key={section.id} className={`section-card${critical ? ' critical' : ''}`} aria-labelledby={`${fieldId}-label`}>
            <header>
              <div className="row">
                <label htmlFor={`${fieldId}-kind`} className="visually-hidden">
                  Section type
                </label>
                <select
                  id={`${fieldId}-kind`}
                  value={section.kind}
                  onChange={(e) => update(section.id, { kind: e.target.value as SectionKind })}
                >
                  {SECTION_KINDS.map((k) => (
                    <option key={k} value={k}>
                      {SECTION_LABELS[k]}
                    </option>
                  ))}
                </select>
                {critical && input === 'photo' && <span className="chip accent">Please check</span>}
                {section.confidence && !section.edited && (
                  <span className={`chip${section.confidence === 'high' ? '' : ' warn'}`}>{READ_TEXT[section.confidence]}</span>
                )}
                {section.edited && input === 'photo' && (
                  <span className="chip info">
                    <Icon name="pencil" />
                    Corrected
                  </span>
                )}
              </div>
              <button
                className="btn btn-ghost btn-small"
                onClick={() => onChange({ sections: sections.filter((s) => s.id !== section.id) })}
                aria-label={`Remove ${SECTION_LABELS[section.kind]} section`}
              >
                <Icon name="trash" size={16} />
              </button>
            </header>
            <span id={`${fieldId}-label`} className="visually-hidden">
              {SECTION_LABELS[section.kind]} text
            </span>
            <textarea
              id={fieldId}
              aria-labelledby={`${fieldId}-label`}
              value={section.text}
              rows={Math.min(10, Math.max(2, Math.ceil(section.text.length / 60)))}
              placeholder={`${SECTION_LABELS[section.kind]} as printed on the label`}
              onChange={(e) => update(section.id, { text: e.target.value, edited: true })}
            />
            {section.uncertain.length > 0 && !section.edited && (
              <p className="uncertain">
                Unsure about:{' '}
                {section.uncertain.map((u, i) => (
                  <span key={`${i}-${u}`}>
                    {i > 0 && ', '}
                    <code>{u}</code>
                  </span>
                ))}
                . [?] marks characters that couldn’t be read.
              </p>
            )}
          </section>
        );
      })}

      {sections.length === 0 && (
        <Notice tone="warn" title="No text was found">
          Nothing readable came through. Retake the photos, or add the text yourself below.
        </Notice>
      )}

      <div className="row">
        <label htmlFor="new-kind" className="visually-hidden">
          Section to add
        </label>
        <select id="new-kind" value={newKind} onChange={(e) => setNewKind(e.target.value as SectionKind)}>
          {SECTION_KINDS.map((k) => (
            <option key={k} value={k}>
              {SECTION_LABELS[k]}
            </option>
          ))}
        </select>
        <button
          className="btn btn-small"
          onClick={() =>
            onChange({
              sections: [
                ...sections,
                { id: crypto.randomUUID(), kind: newKind, text: '', confidence: null, uncertain: [], edited: true },
              ],
            })
          }
        >
          <Icon name="plus" size={16} />
          Add section
        </button>
      </div>

      <div className="sticky-actions">
        <button className="btn btn-primary" onClick={onAnalyze} disabled={!hasText}>
          Explain this label
        </button>
        {input === 'photo' && (
          <button className="btn" onClick={onRetake}>
            Retake photos
          </button>
        )}
      </div>
    </div>
  );
}
