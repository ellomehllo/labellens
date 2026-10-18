import { useEffect, useRef, type ReactNode } from 'react';
import type { Category, Confidence, FindingType, HighlightKind } from '../../shared/types.ts';
import { Icon, type IconName } from './Icon.tsx';

/** Back arrow, centred title and an optional action, as on every inner screen of the design. */
export function TopBar({ title, onBack, action }: { title: string; onBack?: () => void; action?: ReactNode }) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
  }, []);
  return (
    <header className="topbar">
      {onBack ? (
        <button className="icon-btn" onClick={onBack} aria-label="Back">
          <Icon name="back" size={22} />
        </button>
      ) : (
        <span />
      )}
      <h1 ref={ref} tabIndex={-1}>
        {title}
      </h1>
      <span className="topbar-action">{action}</span>
    </header>
  );
}

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
      <span className="notice-icon">
        <Icon name={icon ?? fallback} size={18} />
      </span>
      <div className="notice-body">
        {title && <strong>{title}</strong>}
        {children}
      </div>
    </div>
  );
}

const HIGHLIGHT_STYLE: Record<HighlightKind, { tone: string; icon: IconName }> = {
  count: { tone: 'blue', icon: 'check' },
  diet: { tone: 'green', icon: 'leaf' },
  storage: { tone: 'amber', icon: 'snowflake' },
  allergen: { tone: 'amber', icon: 'alert' },
  warning: { tone: 'amber', icon: 'alert' },
  claim: { tone: 'plain', icon: 'tag' },
  other: { tone: 'plain', icon: 'info' },
};

export function Chip({ kind, children }: { kind: HighlightKind; children: ReactNode }) {
  const style = HIGHLIGHT_STYLE[kind];
  return (
    <span className={`chip chip-${style.tone}`}>
      <Icon name={style.icon} size={14} />
      {children}
    </span>
  );
}

const TYPE_BADGES: Record<FindingType, { label: string; icon: IconName; tone: string }> = {
  label_fact: { label: 'On the label', icon: 'tag', tone: 'plain' },
  interpretation: { label: 'Mochi’s reading', icon: 'bulb', tone: 'blue' },
  verified_claim: { label: 'Source-checked', icon: 'checkCircle', tone: 'green' },
  unverified: { label: 'Not verified', icon: 'help', tone: 'dashed' },
};

export function TypeBadge({ type }: { type: FindingType }) {
  const badge = TYPE_BADGES[type];
  return (
    <span className={`badge badge-${badge.tone}`}>
      <Icon name={badge.icon} size={13} />
      {badge.label}
    </span>
  );
}

export const TYPE_EXPLANATIONS: Record<FindingType, string> = {
  label_fact: 'Text the label itself states.',
  interpretation: 'Mochi’s plain-language reading, from general knowledge.',
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

export const CATEGORY_ICONS: Record<Category, IconName> = {
  food: 'leaf',
  cosmetics: 'sparkles',
  oral_care: 'smile',
  cleaner: 'droplet',
  supplement: 'pill',
  other: 'tag',
};

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

export function timeAgo(iso: string): string {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return formatDate(iso);
}

export const DISCLAIMER = 'Mochi helps you understand labels. It doesn’t replace the label itself or professional advice.';
