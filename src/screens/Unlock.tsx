import { useState } from 'react';
import type { VaultFile } from '../../core/vault.ts';
import { Icon } from '../components/Icon.tsx';
import { Mochi, SpeechBubble } from '../components/Mochi.tsx';
import { Notice } from '../components/ui.tsx';
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

  if (gate.state === 'loading') return <div className="unlock" aria-busy="true" />;

  if (gate.state === 'missing') {
    return (
      <div className="unlock">
        <SpeechBubble>I’m not set up yet.</SpeechBubble>
        <Mochi size={150} mood="sleep" />
        <h1 className="visually-hidden">LabelLens isn’t set up yet</h1>
        <Notice tone="warn" title="No AI key has been added to this site">
          The site owner needs to add the <code>AI_API_KEY</code> and <code>APP_PASSWORD</code> secrets in the GitHub
          repository, then re-run the Pages deployment.
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
      setError(
        err instanceof Error && 'code' in err && err.code === 'wrong_password'
          ? 'That password didn’t work. Try again.'
          : 'Couldn’t unlock. Please try again.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="unlock">
      <span className="wordmark">LabelLens</span>
      <SpeechBubble>{error ? 'Hmm, that’s not it.' : 'Hi! What’s the password?'}</SpeechBubble>
      <Mochi size={140} />
      <h1 className="visually-hidden">Unlock LabelLens</h1>
      <form onSubmit={submit}>
        <label className="visually-hidden" htmlFor="site-password">
          Password
        </label>
        <input
          id="site-password"
          type="password"
          placeholder="Password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? 'unlock-error' : undefined}
          disabled={busy}
          autoFocus
        />
        <label className="check">
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
          Stay unlocked on this device
        </label>
        {error && (
          <p id="unlock-error" role="alert" className="small error-text">
            {error}
          </p>
        )}
        <button className="btn-primary" type="submit" disabled={busy || !password}>
          <Icon name="lock" />
          {busy ? 'Unlocking…' : 'Unlock'}
        </button>
      </form>
      <p className="fineprint">
        The password unlocks this site’s AI key in your browser. <a href="#/privacy">Privacy</a>
      </p>
    </div>
  );
}
