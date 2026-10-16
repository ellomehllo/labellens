import { useEffect, useRef, type ReactNode } from 'react';
import type { Confidence, FindingType } from '../../shared/types.ts';
import { Icon, type IconName } from './Icon.tsx';

export function Notice({
  tone = 'info',
  icon,
  title,
  children,
}: {
  tone?: 'info' | 'warn' | 'danger' | 'ok' | 'plain';
  icon?: IconName;
  title?: string;
  children?: ReactNode;
}) {
  const fallback: IconName = tone === 'warn' || tone === 'danger' ? 'alert' : tone === 'ok' ? 'checkCircle' : 'info';
  return (
    <div className={`notice ${tone}`} role={tone === 'danger' ? 'alert' : undefined}>
      <Icon name={icon ?? fallback} />
      <div className="notice-body">
        {title && <strong>{title}</strong>}
        {children}
      </div>
    </div>
  );
}

const TYPE_BADGES: Record<FindingType, { label: string; icon: IconName; tone: string }> = {
  label_fact: { label: 'On the label', icon: 'tag', tone: '' },
  interpretation: { label: 'Interpretation', icon: 'bulb', tone: 'info' },
  verified_claim: { label: 'Source-checked', icon: 'checkCircle', tone: 'accent' },
  unverified: { label: 'Not verified', icon: 'help', tone: 'dashed' },
};

export function TypeBadge({ type }: { type: FindingType }) {
  const badge = TYPE_BADGES[type];
  return (
    <span className={`chip ${badge.tone}`}>
      <Icon name={badge.icon} />
      {badge.label}
    </span>
  );
}

export const TYPE_EXPLANATIONS: Record<FindingType, string> = {
  label_fact: 'Text the label itself states.',
  interpretation: 'LabelLens’s plain-language reading, from general knowledge.',
  verified_claim: 'Backed by a specific statement from a curated official source.',
  unverified: 'Couldn’t be checked against a reliable source.',
};

const CONFIDENCE_TEXT: Record<Confidence, string> = {
  high: 'High confidence',
  medium: 'Medium confidence',
  low: 'Low confidence',
};

export function ConfidenceText({ value }: { value: Confidence | null }) {
  if (!value) return null;
  return <span className="meta-line">{CONFIDENCE_TEXT[value]}</span>;
}

export interface Stage {
  id: string;
  label: string;
}

/** Steps only advance when the server reports that work has actually started. */
export function Progress({ stages, current }: { stages: Stage[]; current: string | null }) {
  const index = current ? stages.findIndex((s) => s.id === current) : 0;
  return (
    <ol className="progress" aria-live="polite">
      {stages.map((stage, i) => {
        const state = i < index ? 'done' : i === index ? 'active' : 'pending';
        return (
          <li key={stage.id} data-state={state}>
            <span className="progress-dot">{state === 'done' && <Icon name="check" size={14} />}</span>
            <span>
              {stage.label}
              <span className="visually-hidden">{state === 'done' ? ' (done)' : state === 'active' ? ' (in progress)' : ''}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** Moves focus to a page heading on mount so screen readers announce the new screen. */
export function PageTitle({ children, eyebrow }: { children: ReactNode; eyebrow?: string }) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
  }, []);
  return (
    <div className="stack tight">
      {eyebrow && <span className="eyebrow">{eyebrow}</span>}
      <h1 ref={ref} tabIndex={-1}>
        {children}
      </h1>
    </div>
  );
}

export function formatDate(iso: string | null, withTime = false): string {
  if (!iso) return 'not shown';
  const date = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...(withTime ? { hour: 'numeric', minute: '2-digit' } : {}),
  });
}
