import { LIMITS } from '../../shared/types.ts';

export interface PreparedImage {
  id: string;
  previewUrl: string;
  base64: string;
  mediaType: 'image/jpeg';
  width: number;
  height: number;
  /** Heuristic hints only; they never block sending. */
  warnings: string[];
}

export class ImageError extends Error {}

const MAX_INPUT_BYTES = 30 * 1024 * 1024;
const MAX_EDGE = 1600;

/** Decodes, orients, downsizes and re-encodes a photo as JPEG, and runs a quick quality check. */
export async function prepareImage(file: Blob, name = 'Photo'): Promise<PreparedImage> {
  if (file.type && !file.type.startsWith('image/')) {
    throw new ImageError(`${name} isn’t an image. Choose a JPEG, PNG or WebP photo.`);
  }
  if (file.size > MAX_INPUT_BYTES) {
    throw new ImageError(`${name} is over 30 MB. Choose a smaller photo.`);
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new ImageError(
      `${name} couldn’t be opened in this browser. Try a JPEG or PNG (some browsers can’t open HEIC photos).`,
    );
  }

  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new ImageError('This browser can’t process images.');
  ctx.drawImage(bitmap, 0, 0, width, height);
  const warnings = qualityWarnings(bitmap, Math.max(bitmap.width, bitmap.height), file.type !== 'image/png');
  bitmap.close();

  let quality = 0.88;
  let blob = await toJpeg(canvas, quality);
  while (blob.size > LIMITS.maxImageBytes && quality > 0.5) {
    quality -= 0.12;
    blob = await toJpeg(canvas, quality);
  }
  if (blob.size > LIMITS.maxImageBytes) throw new ImageError(`${name} is still too large after compression.`);

  return {
    id: crypto.randomUUID(),
    previewUrl: URL.createObjectURL(blob),
    base64: await toBase64(blob),
    mediaType: 'image/jpeg',
    width,
    height,
    warnings,
  };
}

function toJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new ImageError('Couldn’t encode the photo.'))), 'image/jpeg', quality),
  );
}

function toBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.onerror = () => reject(new ImageError('Couldn’t read the photo.'));
    reader.readAsDataURL(blob);
  });
}

/** Brightness and sharpness estimates on a small grayscale copy. Thresholds are deliberately cautious. */
function qualityWarnings(bitmap: ImageBitmap, longEdge: number, isPhoto: boolean): string[] {
  const warnings: string[] = [];
  if (longEdge < 700) warnings.push('Low resolution: small text may not be readable.');

  const w = 320;
  const h = Math.max(1, Math.round((bitmap.height / bitmap.width) * w));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return warnings;
  ctx.drawImage(bitmap, 0, 0, w, h);
  const { data } = ctx.getImageData(0, 0, w, h);
  const gray = new Float32Array(w * h);
  let sum = 0;
  let clipped = 0;
  for (let i = 0; i < gray.length; i++) {
    const v = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
    gray[i] = v;
    sum += v;
    if (Math.min(data[i * 4], data[i * 4 + 1], data[i * 4 + 2]) >= 253) clipped++;
  }
  // A white label is fine; glare shows up as a large area blown out to pure white in a camera photo.
  if (sum / gray.length < 55) warnings.push('Looks dark: try more light.');
  else if (isPhoto && clipped / gray.length > 0.25) warnings.push('Large blown-out areas: check for glare.');

  // Variance of the Laplacian: low values suggest blur.
  let lapSum = 0;
  let lapSq = 0;
  let n = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const lap = gray[i - w] + gray[i + w] + gray[i - 1] + gray[i + 1] - 4 * gray[i];
      lapSum += lap;
      lapSq += lap * lap;
      n++;
    }
  }
  const variance = n ? lapSq / n - (lapSum / n) ** 2 : 0;
  if (variance < 40) warnings.push('May be blurry: hold steady and tap to focus.');
  return warnings;
}
