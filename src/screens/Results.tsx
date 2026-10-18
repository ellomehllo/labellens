import { useEffect, useState } from 'react';
import {
  CATEGORY_LABELS,
  MARKETS,
  SECTION_LABELS,
  type Analysis,
  type AskMochi,
  type Evidence,
  type Finding,
  type LabelSection,
} from '../../shared/types.ts';
import { Icon, type IconName } from '../components/Icon.tsx';
import { Mochi } from '../components/Mochi.tsx';
import { Chip, ConfidenceText, DISCLAIMER, formatDate, Notice, TopBar, TypeBadge } from '../components/ui.tsx';
import { sendFeedback } from '../lib/api.ts';
import { FEEDBACK_URL, STATIC_SITE } from '../lib/mode.ts';

interface Props {
  analysis: Analysis;
  sections: LabelSection[];
  onBack: () => void;
  onNew: () => void;
  onHistory: () => void;
  onSettings: () => void;
}

type Tab = 'summary' | 'ingredients' | 'sources';

export function Results({ analysis, sections, onBack, onNew, onHistory, onSettings }: Props) {
  const [tab, setTab] = useState<Tab>('summary');
  const { product, meta } = analysis;
  const inputTag = meta.input === 'example' ? ' · Sample' : meta.input === 'typed' ? ' · Typed' : '';

  return (
    <>
      <TopBar
        title="Your label"
        onBack={onBack}
        action={
          <button className="icon-btn" onClick={onSettings} aria-label="Settings">
            <Icon name="gear" size={20} />
          </button>
        }
      />
      <div className="screen">
        <section className="hero-card" aria-label="Product">
          <span className="eyebrow">
            {CATEGORY_LABELS[product.category]}
            {inputTag}
          </span>
          <h2>{product.name ?? (product.brand ? `${product.brand} product` : 'Your label')}</h2>
          {analysis.headline && <p className="headline">{analysis.headline}</p>}
          <Mochi size={80} />
          {analysis.highlights.length > 0 && (
            <div className="chips">
              {analysis.highlights.map((h) => (
                <Chip key={h.text} kind={h.kind}>
                  {h.text}
                </Chip>
              ))}
            </div>
          )}
        </section>

        {analysis.category_note && (
          <Notice tone="info" title="Product type">
            {analysis.category_note}
          </Notice>
        )}

        <div className="tabs" role="tablist" aria-label="Result sections">
          {(['summary', 'ingredients', 'sources'] as const).map((t) => (
            <button
              key={t}
              role="tab"
              id={`tab-${t}`}
              aria-selected={tab === t}
              aria-controls={`panel-${t}`}
              onClick={() => setTab(t)}
            >
              {t === 'summary' ? 'Summary' : t === 'ingredients' ? 'Ingredients' : 'Sources'}
            </button>
          ))}
        </div>

        <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="stack">
          {tab === 'summary' && <SummaryTab analysis={analysis} />}
          {tab === 'ingredients' && <IngredientsTab analysis={analysis} sections={sections} />}
          {tab === 'sources' && <SourcesTab analysis={analysis} />}
        </div>

        <p className="disclaimer">
          {DISCLAIMER}
          <br />
          {formatDate(meta.analyzed_at, true)} · {meta.provider ? `${meta.provider} · ` : ''}
          {meta.model}
        </p>
      </div>
      <div className="bottom-bar">
        <button className="btn-primary" onClick={onNew}>
          <Icon name="camera" />
          Scan another
        </button>
        <button className="btn-round" onClick={onHistory} aria-label="History">
          <Icon name="history" size={22} />
        </button>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

function SummaryTab({ analysis }: { analysis: Analysis }) {
  const urgent = analysis.findings.filter((f) => f.relevance === 'urgent_label_warning');
  const care = analysis.findings.filter((f) => f.relevance === 'precaution');
  const rest = analysis.findings.filter((f) => f.relevance === 'informational');
  const showPoisonHelp = urgent.length > 0 || analysis.product.category === 'cleaner';

  return (
    <>
      {showPoisonHelp && <PoisonHelp market={analysis.product.market} />}
      {urgent.map((f) => (
        <CareCard key={f.id} finding={f} urgent />
      ))}
      {care.map((f) => (
        <CareCard key={f.id} finding={f} />
      ))}

      <p className="summary-text">{analysis.summary}</p>

      {analysis.questions.length > 0 && <AskMochiCard questions={analysis.questions} />}

      {rest.length > 0 && (
        <>
          <h3 className="section-label">Good to know</h3>
          {rest.map((f) => (
            <FindingCard key={f.id} finding={f} />
          ))}
        </>
      )}

      {analysis.next_steps.length > 0 && (
        <section className="card">
          <h3 className="card-title">Worth checking</h3>
          <ul className="muted small mt-8">
            {analysis.next_steps.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

function careIcon(f: Finding): IconName {
  const text = `${f.title} ${f.explanation}`;
  if (/cold|refrigerat|chill|fridge|freez/i.test(text)) return 'snowflake';
  if (/shake|stir|mix well|use|apply|direction|dilut/i.test(text)) return 'info';
  return 'alert';
}

function CareCard({ finding, urgent }: { finding: Finding; urgent?: boolean }) {
  return (
    <section className={`care-card${urgent ? ' urgent' : ''}`}>
      <span className="care-icon">
        <Icon name={urgent ? 'alert' : careIcon(finding)} size={20} />
      </span>
      <div className="stack tight">
        <h3>{finding.title}</h3>
        <p>{finding.explanation}</p>
        {finding.label_quote && <p className="quote">On the label: “{finding.label_quote}”</p>}
        <div className="row">
          <TypeBadge type={finding.type} />
        </div>
        <SourceDetails finding={finding} />
      </div>
    </section>
  );
}

function AskMochiCard({ questions }: { questions: AskMochi[] }) {
  const [selected, setSelected] = useState<number | null>(null);
  const [thinking, setThinking] = useState(false);

  // The answers already came back with the analysis; a short pause keeps the chat feel.
  useEffect(() => {
    if (selected === null) return;
    setThinking(true);
    const timer = setTimeout(() => setThinking(false), 650);
    return () => clearTimeout(timer);
  }, [selected]);

  const q = selected === null ? null : questions[selected];
  return (
    <section className="card" aria-labelledby="ask-title">
      <div className="ask-head">
        <Mochi size={46} mood={thinking ? 'search' : 'neutral'} />
        <div>
          <h3 id="ask-title">Ask Mochi</h3>
          <p className="muted small">Tap a question. No typing needed.</p>
        </div>
      </div>
      <div className="ask-chips">
        {questions.map((item, i) => (
          <button key={item.question} className="ask-chip" aria-pressed={selected === i} onClick={() => setSelected(i)}>
            {item.question}
          </button>
        ))}
      </div>
      {q && (
        <div className="answer" aria-live="polite">
          {thinking ? (
            <div className="typing" aria-label="Mochi is answering">
              <span />
              <span />
              <span />
            </div>
          ) : (
            <>
              <p>{q.answer}</p>
              <TypeBadge type={q.type} />
              {q.evidence.length > 0 && (
                <details className="more">
                  <summary>
                    Source <Icon name="chevronRight" size={14} />
                  </summary>
                  <div className="more-body">
                    {q.evidence.map((e) => (
                      <EvidenceCard key={`${e.source_id}-${e.supports_claim}`} evidence={e} />
                    ))}
                  </div>
                </details>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}

function FindingCard({ finding }: { finding: Finding }) {
  return (
    <article className="card finding">
      <div className="finding-head">
        <h3>{finding.title}</h3>
        <TypeBadge type={finding.type} />
      </div>
      <p>{finding.explanation}</p>
      {finding.label_quote && <p className="quote">On the label: “{finding.label_quote}”</p>}
      {finding.type === 'unverified' && finding.why_unverified && (
        <p className="meta-line">Why not verified: {finding.why_unverified}</p>
      )}
      <ConfidenceText value={finding.confidence} />
      <SourceDetails finding={finding} />
    </article>
  );
}

function SourceDetails({ finding }: { finding: Finding }) {
  if (finding.evidence.length === 0 && finding.limitations.length === 0) return null;
  return (
    <details className="more">
      <summary>
        {finding.evidence.length > 0 ? 'Sources and limits' : 'Limits'} <Icon name="chevronRight" size={14} />
      </summary>
      <div className="more-body">
        {finding.evidence.map((e) => (
          <EvidenceCard key={`${e.source_id}-${e.supports_claim}`} evidence={e} />
        ))}
        {finding.limitations.length > 0 && (
          <ul className="muted">
            {finding.limitations.map((l, i) => (
              <li key={i}>{l}</li>
            ))}
          </ul>
        )}
      </div>
    </details>
  );
}

function EvidenceCard({ evidence }: { evidence: Evidence }) {
  return (
    <div className="evidence">
      <a href={evidence.url} target="_blank" rel="noreferrer">
        {evidence.title}
        <Icon name="external" size={13} />
        <span className="visually-hidden">(opens in a new tab)</span>
      </a>
      <span className="meta-line">
        {evidence.publisher} · {evidence.jurisdiction} · page date {formatDate(evidence.published_or_updated_at)} · checked{' '}
        {formatDate(evidence.retrieved_at)}
      </span>
      <span>
        <strong>The source says:</strong> {evidence.supports_claim}
      </span>
    </div>
  );
}

function PoisonHelp({ market }: { market: string | null }) {
  return (
    <section className="care-card urgent">
      <span className="care-icon">
        <Icon name="phone" size={20} />
      </span>
      <div className="stack tight">
        <h3>If it’s swallowed, inhaled or splashed</h3>
        <p>
          Contact local emergency services or a poison information service now, with the container to hand.
          {market === 'US' && ' In the US, Poison Help is 1-800-222-1222.'}
        </p>
        <a
          href="https://www.who.int/data/gho/data/themes/topics/indicator-groups/poison-control-and-unintentional-poisoning"
          target="_blank"
          rel="noreferrer"
          className="small"
        >
          Find a poison centre (WHO directory)
        </a>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Ingredients
// ---------------------------------------------------------------------------

const ROLE_TONES = ['blue', 'amber', 'rose', 'green'] as const;

function roleTone(role: string): (typeof ROLE_TONES)[number] {
  const r = role.toLowerCase();
  if (/base|solvent|liquid/.test(r)) return 'blue';
  if (/main|star|active|key/.test(r)) return 'amber';
  if (/texture|thicken|emulsif|oil|fat/.test(r)) return 'rose';
  if (/taste|flavou?r|sweet|salt/.test(r)) return 'green';
  let h = 0;
  for (const ch of r) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return ROLE_TONES[h % ROLE_TONES.length];
}

function IngredientsTab({ analysis, sections }: { analysis: Analysis; sections: LabelSection[] }) {
  const [open, setOpen] = useState<number | null>(0);
  const fullText = sections.filter((s) => s.text.trim());

  return (
    <>
      {analysis.ingredients.length > 0 ? (
        <>
          <p className="list-intro">Listed from most to least. Tap one to learn what it does.</p>
          {analysis.ingredients.map((ing, i) => (
            <button
              key={`${i}-${ing.name}`}
              className="ingredient"
              aria-expanded={open === i}
              onClick={() => setOpen(open === i ? null : i)}
            >
              <span className="num">{i + 1}</span>
              <span className="name">
                {ing.name}
                {ing.percent && <span className="badge badge-blue">{ing.percent}</span>}
                {ing.confidence === 'low' && <span className="badge badge-dashed">unsure</span>}
              </span>
              <span className={`badge badge-${roleTone(ing.role)}`}>{ing.role}</span>
              {open === i && <span className="why">{ing.explanation}</span>}
            </button>
          ))}
        </>
      ) : (
        <Notice tone="plain" icon="list" title="No ingredient list">
          Mochi didn’t find an ingredient list in the text. If the label has one, retake the photo of that side.
        </Notice>
      )}

      {fullText.length > 0 && (
        <details className="card read-card">
          <summary>
            <Icon name="list" size={18} />
            <span className="grow">Full label text</span>
            <Icon name="chevronRight" size={18} />
          </summary>
          <div className="read-text">
            {fullText.map((s) => (
              <p key={s.id}>
                <b>{SECTION_LABELS[s.kind]}:</b> {s.text}
              </p>
            ))}
          </div>
        </details>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Sources
// ---------------------------------------------------------------------------

const CLARITY = {
  good: { label: 'Clear', text: 'The text was sharp and easy to read.' },
  fair: { label: 'Partly clear', text: 'Some parts were hard to read, so a few details may be missing.' },
  poor: { label: 'Hard to read', text: 'Much of the photo was hard to read. A clearer photo would help.' },
} as const;

function SourcesTab({ analysis }: { analysis: Analysis }) {
  const { meta } = analysis;
  const checked = [...analysis.findings, ...analysis.questions.map((q) => ({ ...q, title: q.question }))].filter(
    (f) => f.type === 'verified_claim',
  );
  const sources = uniqueSources([...analysis.findings.flatMap((f) => f.evidence), ...analysis.questions.flatMap((q) => q.evidence)]);
  const unverified = [
    ...analysis.findings.filter((f) => f.type === 'unverified').map((f) => ({ title: f.title, why: f.why_unverified })),
    ...analysis.questions.filter((q) => q.type === 'unverified').map((q) => ({ title: q.question, why: null })),
  ];
  const clarity = meta.readability ? CLARITY[meta.readability] : null;
  const market = MARKETS.find((m) => m.id === analysis.product.market)?.label;

  return (
    <>
      <section className="source-hero">
        <span className="icon-tile">
          <Icon name={checked.length ? 'checkCircle' : 'camera'} size={20} />
        </span>
        <div>
          <h3>{checked.length ? 'Checked against trusted sources' : 'Everything here comes from your label'}</h3>
          <p>
            {checked.length
              ? `${checked.length} statement${checked.length === 1 ? '' : 's'} matched a specific point from an official source. Each is listed below.`
              : 'No trusted source directly backed a statement, so nothing is marked source-checked. Explanations are Mochi’s reading of the label.'}
          </p>
        </div>
      </section>

      <section className="card">
        <div className="finding-head">
          <h3 className="card-title">Read clarity</h3>
          <strong className={clarity ? '' : 'muted'}>
            {clarity ? clarity.label : meta.input === 'example' ? 'Sample text' : 'Typed text'}
          </strong>
        </div>
        {clarity && (
          <div className={`clarity-bar ${meta.readability}`} aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
        )}
        <p className="muted small">{clarity ? clarity.text : 'This text wasn’t read from a photo, so there’s no photo quality to report.'}</p>
      </section>

      {sources.map((s) => (
        <EvidenceCard key={s.source_id} evidence={s} />
      ))}

      {unverified.length > 0 && (
        <section className="card">
          <div className="row">
            <span className="icon-tile">
              <Icon name="help" size={20} />
            </span>
            <h3 className="card-title">Couldn’t verify</h3>
          </div>
          <ul className="muted small mt-10">
            {unverified.map((u) => (
              <li key={u.title}>
                <strong>{u.title}</strong>
                {u.why ? ` · ${u.why}` : ''}
              </li>
            ))}
          </ul>
          <p className="meta-line mt-8">
            Not verified doesn’t mean false, only that no trusted source in Mochi’s list directly supports it.
          </p>
        </section>
      )}

      {(analysis.unreadable_or_missing.length > 0 || analysis.overall_limitations.length > 0) && (
        <section className="card">
          <div className="row">
            <span className="icon-tile">
              <Icon name="shield" size={20} />
            </span>
            <h3 className="card-title">Limits of this result</h3>
          </div>
          <ul className="muted small mt-10">
            {[...analysis.unreadable_or_missing, ...analysis.overall_limitations].map((x, i) => (
              <li key={i}>{x}</li>
            ))}
          </ul>
          <p className="meta-line mt-8">
            Market: {market ?? 'not specified'}. Labelling rules differ by country.
          </p>
        </section>
      )}

      <Feedback analysis={analysis} />
    </>
  );
}

function uniqueSources(evidence: Evidence[]): Evidence[] {
  const map = new Map<string, Evidence>();
  for (const e of evidence) if (!map.has(e.source_id)) map.set(e.source_id, e);
  return [...map.values()];
}

const FEEDBACK_REASONS = [
  { id: 'wrong', label: 'Looks wrong' },
  { id: 'unclear', label: 'Unclear' },
  { id: 'source_mismatch', label: 'Source doesn’t match' },
  { id: 'too_alarming', label: 'Too alarming' },
] as const;

function Feedback({ analysis }: { analysis: Analysis }) {
  const [state, setState] = useState<'idle' | 'open' | 'sent' | 'failed'>('idle');
  if (STATIC_SITE && !FEEDBACK_URL) return null;
  if (state === 'sent') {
    return (
      <p className="meta-line">
        {STATIC_SITE ? 'A draft GitHub issue opened in a new tab. Submit it there to send the report.' : 'Thanks. Your report helps improve Mochi.'}
      </p>
    );
  }
  if (state === 'failed') return <p className="meta-line">Couldn’t send the report. Please try later.</p>;
  if (state === 'idle') {
    return (
      <button className="link-btn small" onClick={() => setState('open')}>
        <Icon name="flag" size={15} />
        Something look wrong?
      </button>
    );
  }
  return (
    <div className="ask-chips" role="group" aria-label="What’s wrong?">
      {FEEDBACK_REASONS.map((r) => (
        <button
          key={r.id}
          className="ask-chip"
          onClick={async () => {
            const ok = await sendFeedback({
              reason: r.id,
              category: analysis.product.category,
              finding_type: 'interpretation',
              finding_title: analysis.product.name ?? 'whole result',
            });
            setState(ok ? 'sent' : 'failed');
          }}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}
