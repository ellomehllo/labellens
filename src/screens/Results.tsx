import { useState } from 'react';
import { CATEGORY_LABELS, FINDING_TYPES, MARKETS, type Analysis, type Evidence, type Finding } from '../../shared/types.ts';
import { Icon } from '../components/Icon.tsx';
import { ConfidenceText, formatDate, Notice, PageTitle, TypeBadge, TYPE_EXPLANATIONS } from '../components/ui.tsx';
import { sendFeedback } from '../lib/api.ts';
import { deleteScan } from '../lib/history.ts';
import { go } from '../lib/router.ts';

interface Props {
  analysis: Analysis;
  savedId: string | null;
  fromHistory?: boolean;
  /** Saves the current result on this device; returns false if the browser refused. */
  onSave: () => boolean;
  onUnsave: () => void;
  onCorrect: () => void;
  onNew: () => void;
}

export function Results({ analysis, savedId, fromHistory, onSave, onUnsave, onCorrect, onNew }: Props) {
  const { product, findings } = analysis;
  const urgent = findings.filter((f) => f.relevance === 'urgent_label_warning');
  const precautions = findings.filter((f) => f.relevance === 'precaution');
  const informational = findings.filter((f) => f.relevance === 'informational');
  const context = informational.filter((f) => f.type === 'label_fact' || f.type === 'interpretation');
  const verified = informational.filter((f) => f.type === 'verified_claim');
  const unverified = informational.filter((f) => f.type === 'unverified');
  const market = MARKETS.find((m) => m.id === product.market)?.label ?? null;
  const showPoisonHelp = urgent.length > 0 || product.category === 'cleaner';
  const citedSources = uniqueSources(findings);
  const [saveError, setSaveError] = useState(false);

  const title = product.name ?? (product.brand ? `${product.brand} product` : `${CATEGORY_LABELS[product.category]} label`);

  return (
    <div className="stack">
      <div className="result-head">
        <PageTitle eyebrow={fromHistory ? `Saved ${formatDate(analysis.meta.analyzed_at, true)}` : 'Your label, explained'}>
          {title}
        </PageTitle>
        <div className="row">
          <span className="chip">{CATEGORY_LABELS[product.category]}</span>
          {product.brand && product.name && <span className="chip">{product.brand}</span>}
          <span className="chip">{market ? `Bought in: ${market}` : 'Market: not specified'}</span>
          {analysis.meta.input === 'example' && <span className="chip warn">Example text, not a real product</span>}
          {analysis.meta.input === 'typed' && <span className="chip">From typed text</span>}
          {analysis.meta.input === 'photo' && analysis.meta.readability && analysis.meta.readability !== 'good' && (
            <span className="chip warn">Photo readability: {analysis.meta.readability}</span>
          )}
        </div>
      </div>

      <p className="summary">{analysis.summary}</p>
      {analysis.category_note && (
        <Notice tone="info" title="Product type">
          {analysis.category_note}{' '}
          <button className="link-btn" onClick={onCorrect}>
            Change it and re-run
          </button>
        </Notice>
      )}

      {showPoisonHelp && <PoisonHelp market={product.market} />}

      <div className="legend" aria-label="How to read these results">
        {FINDING_TYPES.map((t) => (
          <span key={t} title={TYPE_EXPLANATIONS[t]}>
            <TypeBadge type={t} />
          </span>
        ))}
      </div>
      <details className="more">
        <summary>
          What these labels mean <Icon name="chevron" size={16} />
        </summary>
        <div className="more-body">
          <ul>
            {FINDING_TYPES.map((t) => (
              <li key={t}>
                <TypeBadge type={t} /> {TYPE_EXPLANATIONS[t]}
              </li>
            ))}
          </ul>
        </div>
      </details>

      {urgent.length > 0 && (
        <FindingSection title="Warnings printed on the label" intro="Quoted from the packaging. Follow the label." findings={urgent} analysis={analysis} urgent />
      )}

      {analysis.label_facts.length > 0 && (
        <section className="section" aria-labelledby="facts-title">
          <h2 id="facts-title">What the label says</h2>
          <p className="section-intro">Taken from the label text, not interpreted.</p>
          <dl className="facts">
            {analysis.label_facts.map((f, i) => (
              <div key={i} className="fact-row">
                <dt>{f.field}</dt>
                <dd>{f.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {precautions.length > 0 && (
        <FindingSection title="Directions and precautions" findings={precautions} analysis={analysis} />
      )}

      {analysis.ingredient_groups.length > 0 && (
        <section className="section" aria-labelledby="ingredients-title">
          <h2 id="ingredients-title">Ingredients, grouped by purpose</h2>
          <p className="section-intro">
            What each ingredient is usually used for. This isn’t a good-or-bad list: effects depend on amount, use and the
            person.
          </p>
          {analysis.ingredient_groups.map((group, gi) => (
            <details className="ingredient-group" key={gi} open={gi === 0}>
              <summary>
                <span>
                  {group.group} <span className="muted small">({group.items.length})</span>
                </span>
                <Icon name="chevron" size={18} />
              </summary>
              <ul className="ingredient-list">
                {group.items.map((item, ii) => (
                  <li key={ii}>
                    <span className="ingredient-name">{item.name}</span>
                    {item.confidence === 'low' && <span className="chip warn chip-inline">Uncertain</span>}
                    <br />
                    <span className="muted">{item.explanation}</span>
                  </li>
                ))}
              </ul>
            </details>
          ))}
        </section>
      )}

      {context.length > 0 && <FindingSection title="What it means" findings={context} analysis={analysis} />}
      {verified.length > 0 && (
        <FindingSection
          title="Checked against sources"
          intro="Each is backed by a specific statement from an official source. Open the details to see it."
          findings={verified}
          analysis={analysis}
        />
      )}
      {unverified.length > 0 && (
        <FindingSection
          title="Couldn’t be verified"
          intro="LabelLens found no reliable source that directly supports these. That doesn’t mean they’re false."
          findings={unverified}
          analysis={analysis}
        />
      )}

      <section className="section" aria-labelledby="limits-title">
        <h2 id="limits-title">Limits of this result</h2>
        <div className="stack">
          {analysis.unreadable_or_missing.length > 0 && (
            <Notice tone="warn" title="Missing or unreadable">
              <ul>
                {analysis.unreadable_or_missing.map((x, i) => (
                  <li key={i}>{x}</li>
                ))}
              </ul>
            </Notice>
          )}
          {analysis.overall_limitations.length > 0 && (
            <ul className="muted">
              {analysis.overall_limitations.map((x, i) => (
                <li key={i}>{x}</li>
              ))}
            </ul>
          )}
          <p className="muted small">
            How sure LabelLens was about reading the text is shown on the review screen; the confidence on each finding is
            about the explanation. Both can be wrong, so compare with the packaging.
          </p>
          <div>
            <button className="btn" onClick={onCorrect}>
              <Icon name="pencil" />
              Correct the text and re-run
            </button>
          </div>
        </div>
      </section>

      {analysis.next_steps.length > 0 && (
        <section className="section" aria-labelledby="next-title">
          <h2 id="next-title">Next steps</h2>
          <ul>
            {analysis.next_steps.map((x, i) => (
              <li key={i}>{x}</li>
            ))}
          </ul>
        </section>
      )}

      {citedSources.length > 0 && (
        <section className="section" aria-labelledby="sources-title">
          <h2 id="sources-title">Sources used</h2>
          <ul>
            {citedSources.map((s) => (
              <li key={s.source_id}>
                <a href={s.url} target="_blank" rel="noreferrer">
                  {s.title}
                </a>{' '}
                <span className="muted small">
                  {s.publisher} · {s.jurisdiction} · page date {formatDate(s.published_or_updated_at)} · checked{' '}
                  {formatDate(s.retrieved_at)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <hr className="divider" />
      <Notice tone="plain" icon="info">
        This explanation is for general information. It isn’t medical, legal or safety advice and doesn’t replace the
        product’s own instructions or a qualified professional. Generated {formatDate(analysis.meta.analyzed_at, true)} by{' '}
        {analysis.meta.model}.
      </Notice>

      <div className="result-actions">
        {fromHistory ? (
          <button
            className="btn btn-danger"
            onClick={() => {
              if (savedId && confirm('Delete this saved result from this device?')) {
                deleteScan(savedId);
                go('/history', { replace: true });
              }
            }}
          >
            <Icon name="trash" />
            Delete from this device
          </button>
        ) : savedId ? (
          <button
            className="btn"
            onClick={onUnsave}
          >
            <Icon name="check" />
            Saved on this device · Remove
          </button>
        ) : (
          <button
            className="btn"
            onClick={() => setSaveError(!onSave())}
          >
            <Icon name="history" />
            Save on this device
          </button>
        )}
        <button className="btn btn-primary" onClick={onNew}>
          Scan another label
        </button>
      </div>
      {saveError && <Notice tone="warn">This browser blocked saving (storage may be full or disabled).</Notice>}
    </div>
  );
}

function FindingSection({
  title,
  intro,
  findings,
  analysis,
  urgent,
}: {
  title: string;
  intro?: string;
  findings: Finding[];
  analysis: Analysis;
  urgent?: boolean;
}) {
  const id = title.toLowerCase().replace(/[^a-z]+/g, '-');
  return (
    <section className="section" aria-labelledby={id}>
      <h2 id={id}>{title}</h2>
      {intro && <p className="section-intro">{intro}</p>}
      <div className="stack">
        {findings.map((f) => (
          <FindingCard key={f.id} finding={f} analysis={analysis} urgent={urgent} />
        ))}
      </div>
    </section>
  );
}

function FindingCard({ finding, analysis, urgent }: { finding: Finding; analysis: Analysis; urgent?: boolean }) {
  const hasMore = finding.evidence.length > 0 || finding.limitations.length > 0;
  return (
    <article className={`finding${urgent ? ' urgent' : ''}`}>
      <div className="finding-head">
        <h3>{finding.title}</h3>
        <TypeBadge type={finding.type} />
      </div>
      <p>{finding.explanation}</p>
      {finding.label_quote && (
        <blockquote className="label-quote">
          <span className="eyebrow">On the label</span>“{finding.label_quote}”
        </blockquote>
      )}
      {finding.type === 'unverified' && finding.why_unverified && (
        <p className="muted small">
          <strong>Why not verified:</strong> {finding.why_unverified}
        </p>
      )}
      <ConfidenceText value={finding.confidence} />
      {hasMore && (
        <details className="more">
          <summary>
            {finding.evidence.length > 0
              ? `Source${finding.evidence.length > 1 ? 's' : ''} and limits`
              : 'Limits'}
            <Icon name="chevron" size={16} />
          </summary>
          <div className="more-body">
            {finding.evidence.map((e) => (
              <EvidenceCard key={`${e.source_id}-${e.supports_claim}`} evidence={e} />
            ))}
            {finding.limitations.length > 0 && (
              <div>
                <strong className="small">Limits</strong>
                <ul className="muted">
                  {finding.limitations.map((l, i) => (
                    <li key={i}>{l}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </details>
      )}
      <FeedbackRow finding={finding} analysis={analysis} />
    </article>
  );
}

function EvidenceCard({ evidence }: { evidence: Evidence }) {
  return (
    <div className="evidence">
      <a href={evidence.url} target="_blank" rel="noreferrer">
        {evidence.title}
        <Icon name="external" size={14} />
        <span className="visually-hidden">(opens in a new tab)</span>
      </a>
      <span className="meta-line">
        {evidence.publisher} · {evidence.jurisdiction} · page date {formatDate(evidence.published_or_updated_at)} · checked by
        LabelLens {formatDate(evidence.retrieved_at)}
      </span>
      <span>
        <strong>The source says:</strong> {evidence.supports_claim}
      </span>
    </div>
  );
}

const FEEDBACK_REASONS = [
  { id: 'wrong', label: 'Looks wrong' },
  { id: 'unclear', label: 'Unclear' },
  { id: 'source_mismatch', label: 'Source doesn’t match' },
  { id: 'too_alarming', label: 'Too alarming' },
] as const;

function FeedbackRow({ finding, analysis }: { finding: Finding; analysis: Analysis }) {
  const [state, setState] = useState<'idle' | 'open' | 'sent' | 'failed'>('idle');
  if (state === 'sent') return <p className="meta-line">Thanks. Your report helps review LabelLens’s quality.</p>;
  if (state === 'failed') return <p className="meta-line">Couldn’t send the report. Please try later.</p>;
  if (state === 'idle') {
    return (
      <div>
        <button className="btn btn-ghost btn-small" onClick={() => setState('open')}>
          <Icon name="flag" size={16} />
          Report a problem
        </button>
      </div>
    );
  }
  return (
    <div className="feedback" role="group" aria-label="What’s the problem?">
      <span className="muted">What’s wrong?</span>
      {FEEDBACK_REASONS.map((r) => (
        <button
          key={r.id}
          className="btn btn-small"
          onClick={async () => {
            const ok = await sendFeedback({
              reason: r.id,
              category: analysis.product.category,
              finding_type: finding.type,
              finding_title: finding.title,
            });
            setState(ok ? 'sent' : 'failed');
          }}
        >
          {r.label}
        </button>
      ))}
      <button className="btn btn-ghost btn-small" onClick={() => setState('idle')}>
        Cancel
      </button>
    </div>
  );
}

function PoisonHelp({ market }: { market: string | null }) {
  return (
    <Notice tone="warn" icon="phone" title="If someone has swallowed, inhaled or been splashed by a product">
      <span>
        Contact local emergency services or a poison information service now, and have the container with you.
        {market === 'US' && ' In the US, Poison Help is 1-800-222-1222.'}
      </span>
      <a
        href="https://www.who.int/data/gho/data/themes/topics/indicator-groups/poison-control-and-unintentional-poisoning"
        target="_blank"
        rel="noreferrer"
      >
        Find a poison centre (WHO directory)
      </a>
    </Notice>
  );
}

function uniqueSources(findings: Finding[]): Evidence[] {
  const map = new Map<string, Evidence>();
  for (const f of findings) for (const e of f.evidence) if (!map.has(e.source_id)) map.set(e.source_id, e);
  return [...map.values()];
}
