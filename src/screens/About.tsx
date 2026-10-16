import { LIMITS, type ServiceStatus } from '../../shared/types.ts';
import { Icon } from '../components/Icon.tsx';
import { Notice } from '../components/ui.tsx';
import { aiName } from '../lib/api.ts';
import { STATIC_SITE } from '../lib/mode.ts';

interface Props {
  status: ServiceStatus | 'offline' | null;
  onScan: () => void;
  onTyped: () => void;
  onExample: () => void;
}

/** What LabelLens is and isn't. The app itself opens on the scanner; this page is linked from it. */
export function About({ status, onScan, onTyped, onExample }: Props) {
  return (
    <div className="stack">
      <section className="hero" aria-labelledby="hero-title">
        <span className="eyebrow">About LabelLens</span>
        <h1 id="hero-title">Read the label. Understand the product.</h1>
        <p className="lead">
          Photograph the packaging of food, skincare, toothpaste, cleaners or supplements. LabelLens reads the text,
          explains it in plain language, and shows which statements a reliable source backs up, and which it can’t.
        </p>

        <div className="hero-actions">
          <button className="btn btn-primary" onClick={onScan}>
            <Icon name="camera" />
            Start scanning
          </button>
        </div>
        <div className="text-links">
          <button className="link-btn" onClick={onTyped}>
            Type the label text instead
          </button>
          <button className="link-btn" onClick={onExample}>
            Try it with an example label
          </button>
        </div>

        <Notice tone="plain" icon="shield">
          Photos are sent {STATIC_SITE ? 'straight from your browser' : 'to LabelLens’s server and'} to {aiName(status)} to
          read the text. LabelLens doesn’t keep
          them. Results are saved only on this device, and only if you choose to. <a href="#/privacy">How data is handled</a>
        </Notice>
      </section>

      <section className="section" aria-labelledby="how-title">
        <h2 id="how-title">How it works</h2>
        <ol className="steps-list">
          <li>
            <span className="step-num">1</span>
            <span>
              <strong>Photograph the label.</strong> Up to {LIMITS.maxImages} photos, for example the front and the
              ingredients panel.
            </span>
          </li>
          <li>
            <span className="step-num">2</span>
            <span>
              <strong>Check what was read.</strong> Fix any misread ingredients, amounts, warnings or dates before
              anything is explained.
            </span>
          </li>
          <li>
            <span className="step-num">3</span>
            <span>
              <strong>Get a clear explanation.</strong> Label facts, interpretation and source-checked statements are
              kept visibly separate, with what couldn’t be verified listed too.
            </span>
          </li>
        </ol>
      </section>

      <section className="section" aria-labelledby="not-title">
        <h2 id="not-title">What LabelLens isn’t</h2>
        <ul className="not-list">
          <li>Not a safety rating. It won’t call a product safe or unsafe from a label alone.</li>
          <li>Not medical, pharmacy or poison advice. For urgent exposure, contact emergency services or a poison centre.</li>
          <li>Not complete coverage. It checks against a short, curated list of official sources and says when it can’t.</li>
        </ul>
      </section>
    </div>
  );
}
