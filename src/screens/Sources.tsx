import { useEffect, useState } from 'react';
import { CATEGORY_LABELS, type Source } from '../../shared/types.ts';
import { Icon } from '../components/Icon.tsx';
import { formatDate, Notice, PageTitle } from '../components/ui.tsx';
import { getSources } from '../lib/api.ts';

export function Sources() {
  const [sources, setSources] = useState<Source[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    getSources()
      .then(setSources)
      .catch(() => setError(true));
  }, []);

  return (
    <div className="stack">
      <PageTitle>Sources LabelLens checks against</PageTitle>
      <p className="muted">
        A statement is marked “Source-checked” only when it matches one of the specific points below. The AI can’t add
        its own links. Each page was opened and read on the date shown. Coverage is limited, mostly to US, EU and Canadian
        guidance, so many statements will honestly show as “Not verified”.
      </p>
      {error && <Notice tone="danger">Couldn’t load the source list.</Notice>}
      {!sources && !error && <p className="muted">Loading…</p>}
      {sources?.map((s) => (
        <article className="source-card" key={s.id}>
          <a href={s.url} target="_blank" rel="noreferrer">
            <strong>{s.title}</strong> <Icon name="external" size={14} />
          </a>
          <span className="meta-line">
            {s.publisher} · {s.jurisdiction} · page date {formatDate(s.updated)} · checked {formatDate(s.checked)} ·{' '}
            {s.categories.map((c) => CATEGORY_LABELS[c]).join(', ')}
          </span>
          <ul>
            {s.points.map((p) => (
              <li key={p.id}>{p.text}</li>
            ))}
          </ul>
        </article>
      ))}
    </div>
  );
}
