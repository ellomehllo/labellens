import { useEffect, useRef, useState } from 'react';
import { LIMITS, type ServiceStatus } from '../../shared/types.ts';
import { Icon } from '../components/Icon.tsx';
import { Notice, PageTitle } from '../components/ui.tsx';
import { aiName } from '../lib/api.ts';
import { prepareImage, type PreparedImage } from '../lib/image.ts';
import { STATIC_SITE } from '../lib/mode.ts';

// The landing screen: the camera opens straight away so the main action is pointing it at a label.
// Uploading, typing the text and the example are secondary options below.

interface Props {
  images: PreparedImage[];
  status: ServiceStatus | 'offline' | null;
  onChange: (images: PreparedImage[]) => void;
  onContinue: () => void;
  onTyped: () => void;
  onExample: () => void;
}

type CameraState = 'off' | 'starting' | 'live' | 'denied' | 'unavailable' | 'error';

const ACCEPT = 'image/jpeg,image/png,image/webp,image/heic,image/heif';

export function Capture({ images, status, onChange, onContinue, onTyped, onExample }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const full = images.length >= LIMITS.maxImages;
  const [camera, setCamera] = useState<CameraState>(full ? 'off' : 'starting');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState(0);
  const [dragging, setDragging] = useState(false);

  // Each start gets a ticket; a stream that arrives after a newer start or unmount is stopped at once.
  const ticketRef = useRef(0);

  useEffect(() => {
    if (!full) void startCamera();
    return () => {
      ticketRef.current++;
      stopCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function startCamera() {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setCamera('unavailable');
      return;
    }
    const ticket = ++ticketRef.current;
    setCamera('starting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1440 } },
        audio: false,
      });
      if (ticket !== ticketRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      streamRef.current = stream;
      setCamera('live');
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play().catch(() => {});
        }
      });
    } catch (e) {
      if (ticket !== ticketRef.current) return;
      const name = e instanceof DOMException ? e.name : '';
      setCamera(
        name === 'NotAllowedError' || name === 'SecurityError'
          ? 'denied'
          : name === 'NotFoundError' || name === 'OverconstrainedError'
            ? 'unavailable'
            : 'error',
      );
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  function closeCamera() {
    ticketRef.current++;
    stopCamera();
    setCamera('off');
  }

  async function capture() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')?.drawImage(video, 0, 0);
    setFlash((n) => n + 1);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.92));
    if (!blob) return;
    await addBlobs([blob]);
  }

  async function addBlobs(blobs: Blob[]): Promise<boolean> {
    setError(null);
    const room = LIMITS.maxImages - images.length;
    if (room <= 0) {
      setError(`You can add up to ${LIMITS.maxImages} photos.`);
      return false;
    }
    if (blobs.length > room) {
      setError(`Only the first ${room} photo${room === 1 ? '' : 's'} were added (limit ${LIMITS.maxImages}).`);
    }
    setBusy(true);
    try {
      const prepared: PreparedImage[] = [];
      for (const [i, blob] of blobs.slice(0, room).entries()) {
        prepared.push(await prepareImage(blob, `Photo ${images.length + i + 1}`));
      }
      onChange([...images, ...prepared]);
      if (images.length + prepared.length >= LIMITS.maxImages) closeCamera();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Couldn’t add that photo.');
      return false;
    } finally {
      setBusy(false);
    }
  }

  function remove(id: string) {
    const img = images.find((i) => i.id === id);
    if (img) URL.revokeObjectURL(img.previewUrl);
    onChange(images.filter((i) => i.id !== id));
    if (camera === 'off' && images.length - 1 < LIMITS.maxImages) void startCamera();
  }

  const upload = () => fileRef.current?.click();
  const cameraOn = camera === 'live' || camera === 'starting';
  const warnings = images.flatMap((img, i) => img.warnings.map((w) => `Photo ${i + 1}: ${w}`));

  return (
    <div className="stack scanner">
      <div className="scan-head">
        <PageTitle>Scan a label</PageTitle>
        <p className="muted">
          {images.length === 0
            ? 'Point at the ingredients, directions or warnings and fill the frame.'
            : full
              ? `That’s ${LIMITS.maxImages} photos, the most for one label.`
              : 'Add another side of the pack, or read the label now.'}
        </p>
      </div>

      {status === 'offline' && (
        <Notice tone="danger" title="Can’t reach the LabelLens server">
          The page loaded, but the server isn’t answering. Try again in a moment.
        </Notice>
      )}
      {status && status !== 'offline' && !status.ai && (
        <Notice tone="warn" title="Label analysis isn’t switched on yet">
          {status.problem === 'unknown_key'
            ? 'The server has an AI key, but LabelLens can’t tell which provider it belongs to. '
            : 'This server has no AI key configured, so reading labels won’t work yet. '}
          The site owner needs to set <code>AI_API_KEY</code>
          {status.problem === 'unknown_key' ? <> and <code>AI_PROVIDER</code></> : null}.
        </Notice>
      )}

      {cameraOn ? (
        <div className="camera">
          <video ref={videoRef} playsInline muted aria-label="Camera preview" />
          <div className="camera-frame" />
          {camera === 'starting' && (
            <div className="camera-message" aria-live="polite">
              Starting the camera… Allow access if your browser asks.
            </div>
          )}
          {flash > 0 && <div className="camera-flash" key={flash} aria-hidden="true" />}
          <div className="camera-bar">
            <button className="camera-side" onClick={upload} disabled={busy} aria-label="Upload photos instead">
              <Icon name="upload" />
              <span>Upload</span>
            </button>
            <button
              className="shutter"
              onClick={capture}
              disabled={camera !== 'live' || busy || full}
              aria-label={`Take photo ${images.length + 1} of up to ${LIMITS.maxImages}`}
            />
            <span className="camera-side camera-count" aria-live="polite">
              {images.length}/{LIMITS.maxImages}
            </span>
          </div>
        </div>
      ) : (
        <div
          className={`dropzone${dragging ? ' dragging' : ''}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            void addBlobs([...e.dataTransfer.files]);
          }}
        >
          {camera === 'denied' && (
            <Notice tone="warn" title="Camera access is blocked">
              Allow the camera for this site in your browser settings, or upload photos of the label instead.
            </Notice>
          )}
          {camera === 'unavailable' && (
            <Notice tone="info" title="No camera available">
              This device or browser doesn’t offer a camera here. Upload photos of the label instead.
            </Notice>
          )}
          {camera === 'error' && (
            <Notice tone="warn" title="The camera couldn’t start">
              Another app may be using it. Try again, or upload photos instead.
            </Notice>
          )}
          {full ? (
            <p className="muted">Remove a photo to take another.</p>
          ) : (
            <>
              <div className="row">
                <button className="btn btn-primary" onClick={upload} disabled={busy}>
                  <Icon name="upload" />
                  {images.length ? 'Add more photos' : 'Upload photos'}
                </button>
                {camera !== 'unavailable' && (
                  <button className="btn" onClick={startCamera} disabled={busy}>
                    <Icon name="camera" />
                    {camera === 'off' ? 'Open camera' : 'Try the camera again'}
                  </button>
                )}
              </div>
              <span className="muted small">or drag photos here · JPEG, PNG, WebP or HEIC</span>
            </>
          )}
        </div>
      )}
      <input
        ref={fileRef}
        type="file"
        accept={ACCEPT}
        multiple
        hidden
        onChange={(e) => {
          void addBlobs([...(e.target.files ?? [])]);
          e.target.value = '';
        }}
      />

      {error && <Notice tone="danger">{error}</Notice>}
      {busy && (
        <p className="muted small" aria-live="polite">
          Preparing photo…
        </p>
      )}

      {images.length > 0 && (
        <section aria-label="Your photos" className="stack tight">
          <ul className="thumb-strip">
            {images.map((img, i) => (
              <li key={img.id}>
                <img src={img.previewUrl} alt={`Photo ${i + 1} of the label`} />
                <button className="thumb-remove" onClick={() => remove(img.id)} aria-label={`Remove photo ${i + 1}`}>
                  <Icon name="x" size={14} />
                </button>
              </li>
            ))}
          </ul>
          {warnings.length > 0 && (
            <ul className="photo-warnings">
              {warnings.map((w) => (
                <li key={w}>
                  <Icon name="alert" size={14} />
                  {w}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {images.length > 0 && (
        <div className="sticky-actions">
          <button
            className="btn btn-primary"
            onClick={() => {
              closeCamera();
              onContinue();
            }}
            disabled={busy}
          >
            Read the label ({images.length} photo{images.length === 1 ? '' : 's'})
          </button>
        </div>
      )}

      <div className="scan-alternatives">
        {cameraOn && (
          <button className="btn btn-small" onClick={upload} disabled={busy || full}>
            <Icon name="upload" size={16} />
            Upload photos instead
          </button>
        )}
        <div className="text-links">
          <button className="link-btn" onClick={onTyped}>
            Type the label text
          </button>
          <button className="link-btn" onClick={onExample}>
            Try an example label
          </button>
          <a href="#/about">How LabelLens works</a>
        </div>
      </div>

      <p className="muted small scan-privacy">
        <Icon name="shield" size={14} /> Photos go {STATIC_SITE ? 'straight from your browser ' : ''}to {aiName(status)} to
        read the text and aren’t kept. <a href="#/privacy">Privacy</a>
      </p>
    </div>
  );
}
