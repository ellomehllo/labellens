import { useState } from 'react';
import type { VaultFile } from '../../core/vault.ts';
import { Icon } from '../components/Icon.tsx';
import { Notice, PageTitle } from '../components/ui.tsx';
import { unlock } from '../lib/unlock.ts';

export type Gate =
  | { state: 'loading' }
  | { state: 'missing' }
  | { state: 'locked'; vault: VaultFile }
  | { state: 'open'; vault?: VaultFile };

export function Unlock({ gate, onUnlocked }: { gate: Gate; onUnlocked: () => void }) {
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (gate.state === 'loading') return <p className="muted">Loading…</p>;

  if (gate.state === 'missing') {
    return (
      <div className="unlock stack">
        <PageTitle>LabelLens isn’t set up yet</PageTitle>
        <Notice tone="warn" title="No AI key has been added to this site">
          The site owner needs to add the <code>AI_API_KEY</code> and <code>APP_PASSWORD</code> secrets in the GitHub
          repository settings, then re-run the Pages deployment.
        </Notice>
      </div>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (gate.state !== 'locked' || !password) return;
    setBusy(true);
    setError(null);
    try {
      await unlock(gate.vault, password, remember);
      setPassword('');
      onUnlocked();
    } catch (err) {
      setError(err instanceof Error && 'code' in err && err.code === 'wrong_password' ? 'That password didn’t work. Try again.' : 'Couldn’t unlock. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="unlock stack">
      <PageTitle eyebrow="Password protected">Unlock LabelLens</PageTitle>
      <p className="muted">
        Enter the password you were given. It unlocks the AI key this site uses, right here in your browser.
      </p>
      <form onSubmit={submit}>
        <label className="field" htmlFor="site-password">
          Password
        </label>
        <input
          id="site-password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? 'unlock-error' : undefined}
          disabled={busy}
          autoFocus
        />
        <label className="switch">
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
          Stay unlocked on this device
        </label>
        {error && (
          <div id="unlock-error">
            <Notice tone="danger">{error}</Notice>
          </div>
        )}
        <button className="btn btn-primary" type="submit" disabled={busy || !password}>
          <Icon name="shield" />
          {busy ? 'Unlocking…' : 'Unlock'}
        </button>
      </form>
      <p className="muted small">
        Without “stay unlocked”, the key is forgotten when you close this tab. Use “Lock” in the header to forget it
        sooner. <a href="#/privacy">Privacy</a>
      </p>
    </div>
  );
}
