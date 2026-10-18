import { useState } from 'react';
import {
  CATEGORIES,
  CATEGORY_LABELS,
  MARKETS,
  SECTION_KINDS,
  SECTION_LABELS,
  type LabelSection,
  type SectionKind,
} from '../../shared/types.ts';
import type { Flow } from '../App.tsx';
import { Icon } from '../components/Icon.tsx';
import { MochiTips } from '../components/Mochi.tsx';
import { Notice, TopBar } from '../components/ui.tsx';

interface Props {
  flow: Flow;
  onChange: (patch: Partial<Flow>) => void;
  onAnalyze: () => void;
  onRetake: () => void;
  onBack: () => void;
}

const READABILITY = {
  good: { chip: 'chip-green', icon: 'check', label: 'Clear photo', stat: 'Clear' },
  fair: { chip: 'chip-amber', icon: 'alert', label: 'Parts unclear', stat: 'Partly clear' },
  poor: { chip: 'chip-amber', icon: 'alert', label: 'Hard to read', stat: 'Hard to read' },
} as const;

/** Splits an ingredient list on commas that aren't inside brackets. */
export function countIngredients(text: string): number {
  const body = text.replace(/^\s*ingredients?\s*[:.-]?/i, '');
  let depth = 0;
  let parts = 1;
  let any = false;
  for (const ch of body) {
    if ('([{'.includes(ch)) depth++;
    else if (')]}'.includes(ch)) depth = Math.max(0, depth - 1);
    else if ((ch === ',' || ch === ';') && depth === 0) parts++;
    if (/\w/.test(ch)) any = true;
  }
  return any ? parts : 0;
}

function countSentences(text: string): number {
  return text.split(/[.!?]+\s+|\n+/).filter((s) => s.trim().length > 3).length;
}

export function Review({ flow, onChange, onAnalyze, onRetake, onBack }: Props) {
  const { extraction, sections, input } = flow;
  const [editing, setEditing] = useState(input === 'typed');
  const [newKind, setNewKind] = useState<SectionKind>('ingredients');

  const textOf = (kind: SectionKind) => sections.filter((s) => s.kind === kind).map((s) => s.text).join('\n');
  const productName = textOf('product_name').split('\n')[0].trim() || textOf('brand').split('\n')[0].trim() || null;
  const ingredientCount = countIngredients(textOf('ingredients'));
  const careCount = countSentences([textOf('directions'), textOf('storage'), textOf('warnings')].join('\n'));
  const unsure = sections.filter((s) => !s.edited).flatMap((s) => s.uncertain);
  const hasText = sections.some((s) => s.text.trim().length > 0);
  const readability = extraction ? READABILITY[extraction.readability] : null;

  const update = (id: string, patch: Partial<LabelSection>) =>
    onChange({ sections: sections.map((s) => (s.id === id ? { ...s, ...patch } : s)) });

  const tips =
    input === 'typed'
      ? ['Type or paste the label text below.', 'Pick the product type so I know what to look for.']
      : [
          ...(input === 'example' ? ['This is a sample label, not a real product.'] : []),
          ...(unsure.length ? ['I wasn’t sure about a few words. Check them in “What Mochi read”.'] : []),
          `I found ${productName ?? 'a label'}${ingredientCount ? ` with ${ingredientCount} ingredient${ingredientCount === 1 ? '' : 's'}` : ''}. Look right?`,
          'Wrong product type? Tap it to change.',
          'If I misread anything, you can fix it below.',
        ];

  return (
    <>
      <TopBar
        title={input === 'typed' ? 'Type the label' : 'Quick check'}
        onBack={onBack}
        action={input === 'example' ? <span className="badge badge-amber">Sample</span> : undefined}
      />
      <div className="screen">
        <div className="photo-card">
          {flow.images.length > 0 ? (
            <img src={flow.images[0].previewUrl} alt="Your label photo" />
          ) : (
            <div className="paper" aria-hidden="true">
              <strong>{(productName ?? 'Label').split(' ')[0]}</strong>
              <em>{productName?.split(' ').slice(1).join(' ') || (input === 'typed' ? 'typed text' : '')}</em>
              <i />
              <i />
              <i />
            </div>
          )}
          {readability && (
            <span className={`chip ${readability.chip}`}>
              <Icon name={readability.icon} size={14} />
              {readability.label}
            </span>
          )}
          {flow.images.length > 1 && <span className="photo-count">{flow.images.length} photos</span>}
          {input === 'photo' && (
            <button className="retake" onClick={onRetake}>
              <Icon name="camera" size={16} />
              Retake
            </button>
          )}
        </div>

        {extraction?.not_a_label && (
          <Notice tone="warn" title="This doesn’t look like a label">
            The photo doesn’t seem to show packaging text. Retake it with the label filling the frame.
          </Notice>
        )}
        {extraction && !extraction.not_a_label && extraction.readability !== 'good' && extraction.image_issues.length > 0 && (
          <Notice tone="warn" title={extraction.readability === 'poor' ? 'The photo was hard to read' : 'Parts were hard to read'}>
            <ul>
              {extraction.image_issues.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          </Notice>
        )}

        <MochiTips tips={tips} />

        <section className="card product-card" aria-label="Product">
          <div className="product-top">
            <div>
              <span className="label-sm">Product</span>
              <p className="product-name">{productName ?? 'Unnamed product'}</p>
            </div>
            <label>
              <span className="visually-hidden">Product type</span>
              <select
                className="select-pill"
                value={flow.category}
                onChange={(e) => onChange({ category: e.target.value as Flow['category'] })}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {CATEGORY_LABELS[c]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="stats">
            <div className="stat">
              <strong>{ingredientCount}</strong>
              <span>ingredient{ingredientCount === 1 ? '' : 's'}</span>
            </div>
            <div className="stat">
              <strong>{careCount}</strong>
              <span>{careCount === 1 ? 'care tip' : 'care tips'}</span>
            </div>
            <div className="stat">
              <strong>{readability ? readability.stat : input === 'example' ? 'Sample' : 'Typed'}</strong>
              <span>{readability ? 'photo quality' : 'source'}</span>
            </div>
          </div>
          <label className="market-row">
            Bought in
            <select value={flow.market ?? ''} onChange={(e) => onChange({ market: e.target.value || null })}>
              <option value="">Not sure</option>
              {MARKETS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
        </section>

        <details className="card read-card" open={editing || unsure.length > 0 || undefined}>
          <summary>
            <Icon name="list" size={18} />
            <span className="grow">What Mochi read</span>
            {unsure.length > 0 && <span className="badge badge-amber">{unsure.length} unsure</span>}
            <Icon name="chevronRight" size={18} />
          </summary>

          {!editing ? (
            <>
              <div className="read-text">
                {sections.filter((s) => s.text.trim()).length === 0 ? (
                  <span className="muted">Nothing readable came through. Retake the photo or type the text.</span>
                ) : (
                  sections
                    .filter((s) => s.text.trim())
                    .map((s) => (
                      <p key={s.id}>
                        <b>{SECTION_LABELS[s.kind]}:</b> {s.text}
                      </p>
                    ))
                )}
              </div>
              {unsure.length > 0 && (
                <p className="unsure">
                  Unsure about:{' '}
                  {unsure.map((u, i) => (
                    <span key={`${i}-${u}`}>
                      {i > 0 && ', '}
                      <code>{u}</code>
                    </span>
                  ))}
                  . [?] marks characters Mochi couldn’t read.
                </p>
              )}
              <div className="fix-row">
                <button className="link-btn" onClick={() => setEditing(true)}>
                  <Icon name="pencil" size={16} />
                  Fix text
                </button>
              </div>
            </>
          ) : (
            <div>
              {sections.map((section) => (
                <div className="edit-section" key={section.id}>
                  <header>
                    <label>
                      <span className="visually-hidden">Section type</span>
                      <select value={section.kind} onChange={(e) => update(section.id, { kind: e.target.value as SectionKind })}>
                        {SECTION_KINDS.map((k) => (
                          <option key={k} value={k}>
                            {SECTION_LABELS[k]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      className="icon-btn"
                      onClick={() => onChange({ sections: sections.filter((s) => s.id !== section.id) })}
                      aria-label={`Remove ${SECTION_LABELS[section.kind]}`}
                    >
                      <Icon name="trash" size={18} />
                    </button>
                  </header>
                  <textarea
                    aria-label={`${SECTION_LABELS[section.kind]} text`}
                    value={section.text}
                    rows={Math.min(8, Math.max(2, Math.ceil(section.text.length / 42)))}
                    placeholder={`${SECTION_LABELS[section.kind]} as printed on the label`}
                    onChange={(e) => update(section.id, { text: e.target.value, edited: true })}
                  />
                </div>
              ))}
              <div className="add-row">
                <label>
                  <span className="visually-hidden">Section to add</span>
                  <select value={newKind} onChange={(e) => setNewKind(e.target.value as SectionKind)}>
                    {SECTION_KINDS.map((k) => (
                      <option key={k} value={k}>
                        {SECTION_LABELS[k]}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  className="link-btn"
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
                {input !== 'typed' && (
                  <button className="link-btn push-right" onClick={() => setEditing(false)}>
                    <Icon name="check" size={16} />
                    Done
                  </button>
                )}
              </div>
            </div>
          )}
        </details>
      </div>
      <div className="bottom-bar">
        <button className="btn-primary" onClick={onAnalyze} disabled={!hasText}>
          {input === 'typed' ? 'Explain this label' : 'Yes, show me'}
          <Icon name="chevronRight" size={20} />
        </button>
      </div>
    </>
  );
}
