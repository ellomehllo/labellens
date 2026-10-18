import { useState, type ReactNode } from 'react';
import type { ServiceStatus } from '../../shared/types.ts';
import { Icon, type IconName } from '../components/Icon.tsx';
import { Mochi } from '../components/Mochi.tsx';
import { TopBar } from '../components/ui.tsx';
import { aiName } from '../lib/api.ts';
import { deleteAllScans, listScans } from '../lib/history.ts';
import { STATIC_SITE } from '../lib/mode.ts';
import { updateSettings, useSettings } from '../lib/settings.ts';

interface Props {
  status: ServiceStatus | 'offline' | null;
  onBack: () => void;
  onReplayIntro: () => void;
  onLock: (() => void) | null;
}

export function Settings({ status, onBack, onReplayIntro, onLock }: Props) {
  const settings = useSettings();
  const [count, setCount] = useState(() => listScans().length);

  return (
    <>
      <TopBar title="Settings" onBack={onBack} />
      <div className="screen">
        <section className="settings-hero">
          <Mochi size={64} />
          <div>
            <h2>Your data stays with you.</h2>
            <p>
              Photos go {STATIC_SITE ? 'straight from your browser ' : ''}to {aiName(status)} only to read the text. Photos
              and label text aren’t stored on any server, and history stays on this device.
            </p>
          </div>
        </section>

        <h3 className="section-label">Mochi</h3>
        <div className="card group">
          <SwitchRow
            icon="chat"
            title="Show Mochi’s tips"
            text="Little hints on each screen."
            checked={settings.showTips}
            onChange={(v) => updateSettings({ showTips: v })}
          />
          <LinkRow icon="sparkles" title="Say hi again" text="Replay the introduction." onClick={onReplayIntro} />
        </div>

        <h3 className="section-label">Privacy</h3>
        <div className="card group">
          <SwitchRow
            icon="history"
            title="Save scan history"
            text="Keep scans during this session."
            checked={settings.saveHistory}
            onChange={(v) => {
              updateSettings({ saveHistory: v });
              if (!v) {
                deleteAllScans();
                setCount(0);
              }
            }}
          />
          <LinkRow
            icon="trash"
            title="Clear history"
            text={count ? `${count} scan${count === 1 ? '' : 's'} saved.` : 'Nothing to clear.'}
            disabled={count === 0}
            onClick={() => {
              deleteAllScans();
              setCount(0);
            }}
          />
          {onLock && <LinkRow icon="lock" title="Lock LabelLens" text="Forget the unlocked key on this device." onClick={onLock} />}
        </div>

        <h3 className="section-label">About</h3>
        <div className="card group">
          <LinkRow icon="shield" title="Privacy and data" text="What’s sent where, and what’s kept." href="#/privacy" />
          <LinkRow icon="book" title="Trusted sources" text="The official pages Mochi checks against." href="#/sources" />
        </div>

        <p className="version">LabelLens prototype · v1.1</p>
      </div>
    </>
  );
}

function RowBody({ icon, title, text, end }: { icon: IconName; title: string; text: string; end: ReactNode }) {
  return (
    <>
      <span className="icon-tile">
        <Icon name={icon} size={20} />
      </span>
      <span className="grow">
        <strong>{title}</strong>
        <small>{text}</small>
      </span>
      {end}
    </>
  );
}

function SwitchRow({
  icon,
  title,
  text,
  checked,
  onChange,
}: {
  icon: IconName;
  title: string;
  text: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="setting">
      <RowBody
        icon={icon}
        title={title}
        text={text}
        end={
          <span className="switch">
            <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
          </span>
        }
      />
    </label>
  );
}

function LinkRow({
  icon,
  title,
  text,
  onClick,
  href,
  disabled,
}: {
  icon: IconName;
  title: string;
  text: string;
  onClick?: () => void;
  href?: string;
  disabled?: boolean;
}) {
  const body = <RowBody icon={icon} title={title} text={text} end={<Icon name="chevronRight" size={18} />} />;
  if (href) {
    return (
      <a className="setting" href={href}>
        {body}
      </a>
    );
  }
  return (
    <button className="setting" onClick={disabled ? undefined : onClick} aria-disabled={disabled || undefined}>
      {body}
    </button>
  );
}
