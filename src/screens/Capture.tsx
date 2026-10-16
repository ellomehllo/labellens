import { useEffect, useRef, useState } from 'react';
import { LIMITS } from '../../shared/types.ts';
import { Icon } from '../components/Icon.tsx';
import { Notice, PageTitle } from '../components/ui.tsx';
import { prepareImage, type PreparedImage } from '../lib/image.ts';

interface Props {
  images: PreparedImage[];
  onChange: (images: PreparedImage[]) => void;
  onContinue: () => void;
}

type CameraState = 'off' | 'starting' | 'live' | 'denied' | 'unavailable' | 'error';

export function Capture({ images, onChange, onContinue }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [camera, setCamera] = useState<CameraState>(images.length === 0 ? 'starting' : 'off');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const full = images.length >= LIMITS.maxImages;

  // Each start gets a ticket; a stream that arrives after a newer start or unmount is stopped at once.
  const ticketRef = useRef(0);

  useEffect(() => {
    if (images.length === 0) void startCamera();
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
      setCamera(name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : name === 'NotFoundError' || name === 'OverconstrainedError' ? 'unavailable' : 'error');
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
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.92));
    if (!blob) return;
    await addBlobs([blob]);
    if (images.length + 1 >= LIMITS.maxImages) closeCamera();
  }

  async function addBlobs(blobs: Blob[]) {
    setError(null);
    const room = LIMITS.maxImages - images.length;
    if (room <= 0) {
      setError(`You can add up to ${LIMITS.maxImages} photos.`);
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
  }

  const [dragging, setDragging] = useState(false);

  return (
    <div className="stack">
      <PageTitle eyebrow="Step 1 of 3">Photograph the label</PageTitle>
      <p className="tips">
        Fill the frame with the text panel, avoid glare, and take one photo per side: front, ingredients, directions
        and warnings. Up to {LIMITS.maxImages} photos.
      </p>

      {camera === 'live' || camera === 'starting' ? (
        <div className="camera">
          <video ref={videoRef} playsInline muted aria-label="Camera preview" />
          <div className="camera-frame" />
          <button className="camera-close" onClick={closeCamera} aria-label="Close camera">
            <Icon name="x" />
          </button>
          <div className="camera-bar">
            <button
              className="shutter"
              onClick={capture}
              disabled={camera !== 'live' || busy || full}
              aria-label={`Take photo ${images.length + 1} of up to ${LIMITS.maxImages}`}
            />
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
            <Notice tone="warn" title="Camera permission is off">
              Allow camera access in your browser’s site settings, or upload photos instead.
            </Notice>
          )}
          {camera === 'unavailable' && (
            <Notice tone="info" title="No camera available">
              This device or browser doesn’t offer a camera here. Upload photos instead.
            </Notice>
          )}
          {camera === 'error' && (
            <Notice tone="warn" title="The camera couldn’t start">
              Another app may be using it. Try again, or upload photos instead.
            </Notice>
          )}
          <div className="row">
            <button className="btn btn-primary" onClick={() => fileRef.current?.click()} disabled={busy || full}>
              <Icon name="upload" />
              {images.length ? 'Add more photos' : 'Choose photos'}
            </button>
            {camera !== 'unavailable' && (
              <button className="btn" onClick={startCamera} disabled={busy || full}>
                <Icon name="camera" />
                Use camera
              </button>
            )}
          </div>
          <span className="muted small">or drag photos here · JPEG, PNG, WebP or HEIC</span>
        </div>
      )}
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
        multiple
        hidden
        onChange={(e) => {
          void addBlobs([...(e.target.files ?? [])]);
          e.target.value = '';
        }}
      />

      {error && <Notice tone="danger">{error}</Notice>}
      {busy && <p className="muted small" aria-live="polite">Preparing photo…</p>}

      {images.length > 0 && (
        <section aria-label="Your photos" className="stack">
          <div className="thumbs">
            {images.map((img, i) => (
              <figure className="thumb" key={img.id}>
                <img src={img.previewUrl} alt={`Photo ${i + 1} of the label`} />
                <figcaption className="thumb-body">
                  {img.warnings.length ? (
                    img.warnings.map((w) => (
                      <span className="thumb-warn" key={w}>
                        <Icon name="alert" size={14} />
                        {w}
                      </span>
                    ))
                  ) : (
                    <span className="thumb-ok">Photo {i + 1}</span>
                  )}
                  <button className="btn btn-ghost btn-small btn-danger" onClick={() => remove(img.id)}>
                    <Icon name="trash" size={16} />
                    Remove
                  </button>
                </figcaption>
              </figure>
            ))}
          </div>
          {images.some((i) => i.warnings.length) && (
            <p className="muted small">
              Quality hints are quick estimates. You can still continue, and the next step shows exactly what could be
              read.
            </p>
          )}
        </section>
      )}

      <div className="sticky-actions">
        <button
          className="btn btn-primary"
          onClick={() => {
            stopCamera();
            onContinue();
          }}
          disabled={images.length === 0 || busy}
        >
          Read the label{images.length ? ` (${images.length} photo${images.length === 1 ? '' : 's'})` : ''}
        </button>
      </div>
    </div>
  );
}
