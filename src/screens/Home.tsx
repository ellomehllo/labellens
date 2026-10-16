import { useRef, useState } from 'react';
import type { ServiceStatus } from '../../shared/types.ts';
import { Icon } from '../components/Icon.tsx';
import { Notice } from '../components/ui.tsx';
import { prepareImage, type PreparedImage } from '../lib/image.ts';
import { LIMITS } from '../../shared/types.ts';

interface Props {
  status: ServiceStatus | 'offline' | null;
  onPhotos: (images: PreparedImage[]) => void;
  onCamera: () => void;
  onTyped: () => void;
  onExample: () => void;
}

export function Home({ status, onPhotos, onCamera, onTyped, onExample }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    setError(null);
    setBusy(true);
    try {
      const list = [...files].slice(0, LIMITS.maxImages);
      const images = await Promise.all(list.map((f, i) => prepareImage(f, `Photo ${i + 1}`)));
      onPhotos(images);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Couldn’t open that photo.');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  return (
    <div className="stack">
      <section className="hero" aria-labelledby="hero-title">
        <span className="eyebrow">Label companion</span>
        <h1 id="hero-title">Read the label. Understand the product.</h1>
        <p className="lead">
          Photograph the packaging of food, skincare, toothpaste, cleaners or supplements. LabelLens reads the text,
          explains it in plain language, and shows which statements a reliable source backs up, and which it can’t.
        </p>

        {status === 'offline' && (
          <Notice tone="danger" title="Can’t reach the LabelLens server">
            The page loaded, but the server isn’t answering. Try again in a moment.
          </Notice>
        )}
        {status && status !== 'offline' && !status.ai && (
          <Notice tone="warn" title="Label analysis isn’t switched on yet">
            This server has no AI key configured, so reading and explaining labels won’t work. You can still look
            around; the site owner needs to add <code>ANTHROPIC_API_KEY</code> on the server.
          </Notice>
        )}
        {error && <Notice tone="danger">{error}</Notice>}

        <div className="hero-actions">
          <button className="btn btn-primary" onClick={onCamera} disabled={busy}>
            <Icon name="camera" />
            Scan a label
          </button>
          <button className="btn" onClick={() => fileRef.current?.click()} disabled={busy}>
            <Icon name="upload" />
            {busy ? 'Preparing photos…' : 'Upload photos'}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
            multiple
            hidden
            onChange={(e) => handleFiles(e.target.files)}
          />
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
          Photos are sent to LabelLens’s server and to Anthropic’s AI service to read the text. LabelLens doesn’t keep
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
