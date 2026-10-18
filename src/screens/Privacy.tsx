import type { ServiceStatus } from '../../shared/types.ts';
import { TopBar } from '../components/ui.tsx';
import { aiName } from '../lib/api.ts';
import { STATIC_SITE } from '../lib/mode.ts';

export function Privacy({ status, onBack }: { status: ServiceStatus | 'offline' | null; onBack: () => void }) {
  const provider = status && status !== 'offline' ? status.provider : null;
  return (
    <>
    <TopBar title="Privacy" onBack={onBack} />
    <div className="screen prose">
      <p className="lead">The short version: photos are used once to read the text, then discarded. Scan history stays in this browser tab for the session, and you can turn it off.</p>

      <h2>When you scan a label</h2>
      <ul>
        {STATIC_SITE ? (
          <li>
            Your browser shrinks the photos and sends them straight to {aiName(status)}
            {provider ? '' : ' (the AI provider this site is set up with)'} to read the text. This version of LabelLens is
            static files on GitHub Pages: there is no LabelLens server, so nothing passes through or is stored by one.
          </li>
        ) : (
          <>
            <li>Your browser shrinks the photos and sends them to the LabelLens server.</li>
            <li>
              The server forwards them to {aiName(status)}
              {provider ? '' : ' (whichever provider the site owner has configured: Anthropic, OpenAI, Google or OpenRouter)'}{' '}
              to read the text. LabelLens holds the photos in memory for that one request and doesn’t write them to disk
              or a database.
            </li>
          </>
        )}
        <li>{provider ?? 'That provider'} processes the request under its own API data policies.</li>
        <li>Avoid photographing anything personal, such as prescription labels with your name or address.</li>
      </ul>

      <h2>When you ask for an explanation</h2>
      <ul>
        <li>Only the label text you checked on the review screen is sent, not the photos.</li>
        <li>Statements are matched against a fixed list of curated sources. Nothing browses the web.</li>
      </ul>

      <h2>What is stored</h2>
      <ul>
        <li>
          <strong>On your device:</strong> scan results (text only, never photos) in this browser tab’s storage. Kept for
          this session only, and you can turn it off or clear it in <a href="#/settings">Settings</a>.
        </li>
        {STATIC_SITE ? (
          <>
            <li>
              <strong>The site password:</strong> unlocks the AI key in your browser. It’s kept for this tab only, or on
              this device if you choose “stay unlocked”. “Lock” forgets it.
            </li>
            <li>
              <strong>Reports:</strong> “Report a problem” opens a draft GitHub issue. Nothing is sent unless you submit it
              there, and it will be public.
            </li>
          </>
        ) : (
          <li>
            <strong>On the server:</strong> if you use “Report a problem”, the reason, product type and finding title are
            saved for quality review. No photos, label text or identifiers are included.
          </li>
        )}
        <li>No accounts, no advertising, no tracking cookies.</li>
      </ul>

      <h2>Limits</h2>
      <p>
        LabelLens is an informational prototype. It is not a certified product-safety or regulatory compliance tool, and it
        doesn’t replace the product label, a doctor, pharmacist, poison service or regulator.
      </p>
    </div>
    </>
  );
}
