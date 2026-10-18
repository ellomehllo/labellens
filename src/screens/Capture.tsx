import { useEffect, useRef, useState } from 'react';
import { LIMITS, type ServiceStatus } from '../../shared/types.ts';
import { Icon } from '../components/Icon.tsx';
import { MochiTips } from '../components/Mochi.tsx';
import { Notice } from '../components/ui.tsx';
import { prepareImage, type PreparedImage } from '../lib/image.ts';

// The landing screen: a dark scanner whose camera starts straight away. Photos, typed text and the
// sample label are secondary routes.

interface Props {
  images: PreparedImage[];
  status: ServiceStatus | 'offline' | null;
  onChange: (images: PreparedImage[]) => void;
  onContinue: () => void;
  onTyped: () => void;
  onExample: () => void;
  onSettings: () => void;
  onHistory: () => void;
}

type CameraState = 'off' | 'starting' | 'live' | 'denied' | 'unavailable' | 'error';

const ACCEPT = 'image/jpeg,image/png,image/webp,image/heic,image/heif';

export function Capture({ images, status, onChange, onContinue, onTyped, onExample, onSettings, onHistory }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const full = images.length >= LIMITS.maxImages;
  const [camera, setCamera] = useState<CameraState>(full ? 'off' : 'starting');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState(0);

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
    if (blob) await addBlobs([blob]);
  }

  async function addBlobs(blobs: Blob[]) {
    setError(null);
    const room = LIMITS.maxImages - images.length;
    if (room <= 0) {
      setError(`That’s ${LIMITS.maxImages} photos, the most for one label.`);
      return;
    }
    if (blobs.length > room) setError(`Only the first ${room} photo${room === 1 ? '' : 's'} were added (limit ${LIMITS.maxImages}).`);
    setBusy(true);
    try {
      const prepared: PreparedImage[] = [];
      for (const [i, blob] of blobs.slice(0, room).entries()) {
        prepared.push(await prepareImage(blob, `Photo ${images.length + i + 1}`));
      }
      onChange([...images, ...prepared]);
      if (images.length + prepared.length >= LIMITS.maxImages) closeCamera();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Couldn’t add that photo.');
    } finally {
      setBusy(false);
    }
  }

  function remove(id: string) {
    const img = images.find((i) => i.id === id);
    if (img) URL.revokeObjectURL(img.previewUrl);
    onChange(images.filter((i) => i.id !== id));
    if (camera === 'off') void startCamera();
  }

  const live = camera === 'live';
  // One hint per photo keeps the controls on screen; the review step reports readability in full.
  const warnings = images.flatMap((img, i) => (img.warnings.length ? [`Photo ${i + 1}: ${img.warnings[0]}`] : []));
  const tips =
    images.length > 0
      ? full
        ? ['That’s all four sides. Tap Read label and I’ll get started.']
        : ['Got it! Snap another side, or tap Read label.', 'Ingredients, directions and warnings help most.']
      : live
        ? ['Fill the frame with the ingredients or warnings.', 'No label handy? Try the sample below.', 'Got several sides? Snap up to 4 photos.']
        : ['Tap the big button and I’ll open the camera.', 'No label handy? Try the sample below.'];

  return (
    <div className="scanner">
      <video ref={videoRef} playsInline muted aria-label="Camera preview" hidden={!live} />
      {live && <div className="scanner-shade" />}
      {flash > 0 && <div className="camera-flash" key={flash} aria-hidden="true" />}

      <header className="scanner-head">
        <h1>LabelLens</h1>
        <button className="glass-btn" onClick={onSettings} aria-label="Settings">
          <Icon name="gear" size={20} />
        </button>
      </header>

      {status === 'offline' && <Notice tone="danger" title="Can’t reach the LabelLens server">Try again in a moment.</Notice>}
      {status && status !== 'offline' && !status.ai && (
        <Notice tone="warn" title="Label reading isn’t switched on yet">
          The site owner needs to add an AI key (<code>AI_API_KEY</code>).
        </Notice>
      )}

      <div className="viewfinder">
        <i />
        <i />
        <i />
        <i />
        {!live && (
          <div className="viewfinder-note">
            {camera === 'starting' ? (
              <span>Opening the camera… allow access if your browser asks.</span>
            ) : full ? (
              <span>Remove a photo to take another.</span>
            ) : (
              <>
                {camera !== 'unavailable' && (
                  <button className="glass-pill" onClick={startCamera}>
                    <Icon name="camera" />
                    Turn on camera
                  </button>
                )}
                {camera === 'denied' && <span>Camera access is blocked. Allow it in your browser settings, or pick from Photos.</span>}
                {camera === 'unavailable' && <span>No camera here. Pick a label from Photos instead.</span>}
                {camera === 'error' && <span>The camera couldn’t start. Another app may be using it.</span>}
              </>
            )}
          </div>
        )}
      </div>

      <div className="scanner-bottom">
        {images.length > 0 && (
          <div className="stack tight">
            <div className="shot-tray">
              <ul aria-label="Your photos">
                {images.map((img, i) => (
                  <li key={img.id}>
                    <img src={img.previewUrl} alt={`Photo ${i + 1} of the label`} />
                    <button className="shot-remove" onClick={() => remove(img.id)} aria-label={`Remove photo ${i + 1}`}>
                      <Icon name="x" size={12} />
                    </button>
                  </li>
                ))}
              </ul>
              <button
                className="read-pill"
                onClick={() => {
                  closeCamera();
                  onContinue();
                }}
                disabled={busy}
              >
                Read label
                <Icon name="chevronRight" size={16} />
              </button>
            </div>
            {warnings.map((w) => (
              <span className="shot-warn" key={w}>
                <Icon name="alert" size={14} />
                {w}
              </span>
            ))}
          </div>
        )}
        {error && <Notice tone="danger">{error}</Notice>}

        <MochiTips tips={tips} dark />

        <div className="controls">
          <button className="side-ctl" onClick={() => fileRef.current?.click()} disabled={busy || full}>
            <span>
              <Icon name="image" />
            </span>
            <span>Photos</span>
          </button>
          <button
            className="shutter"
            onClick={live ? capture : startCamera}
            disabled={busy || full || camera === 'starting' || camera === 'unavailable'}
            aria-label={live ? `Take photo ${images.length + 1} of up to ${LIMITS.maxImages}` : 'Turn on camera'}
          />
          <button className="side-ctl" onClick={onHistory}>
            <span>
              <Icon name="history" />
            </span>
            <span>History</span>
          </button>
        </div>

        <button className="sample-pill" onClick={onExample}>
          <Icon name="sparkles" size={16} />
          Try a sample label
        </button>
        <div className="scanner-links">
          <button onClick={onTyped}>Type the text instead</button>
          <a href="#/privacy">Privacy</a>
        </div>
      </div>

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
    </div>
  );
}
