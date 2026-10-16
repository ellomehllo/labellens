import { AppError } from '../core/errors.ts';
import { LIMITS, type ImageInput } from '../shared/types.ts';

// Upload checks for the server API. Browser-only (GitHub Pages) mode skips these because its
// images come straight from the app's own canvas encoder and never cross a network boundary.

type Json = Record<string, unknown>;
const isObj = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v);

const MAGIC: Record<ImageInput['media_type'], (b: Buffer) => boolean> = {
  'image/jpeg': (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  'image/png': (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  'image/webp': (b) => b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP',
};

export function checkImages(body: unknown): ImageInput[] {
  const images = isObj(body) ? body.images : null;
  if (!Array.isArray(images) || images.length === 0) {
    throw new AppError('no_images', 'Add at least one photo of the label.', 400);
  }
  if (images.length > LIMITS.maxImages) {
    throw new AppError('too_many_images', `You can send up to ${LIMITS.maxImages} photos at a time.`, 400);
  }
  return images.map((img, i) => {
    const mediaType = isObj(img) ? img.media_type : null;
    const data = isObj(img) ? img.data : null;
    if (typeof mediaType !== 'string' || !(mediaType in MAGIC) || typeof data !== 'string') {
      throw new AppError('invalid_file', `Photo ${i + 1} isn’t a JPEG, PNG or WebP image.`, 400);
    }
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(data)) {
      throw new AppError('invalid_file', `Photo ${i + 1} couldn’t be read.`, 400);
    }
    const bytes = Buffer.from(data, 'base64');
    if (bytes.length > LIMITS.maxImageBytes) {
      throw new AppError('file_too_large', `Photo ${i + 1} is larger than ${LIMITS.maxImageBytes / 1024 / 1024} MB.`, 413);
    }
    const type = mediaType as ImageInput['media_type'];
    if (bytes.length < 100 || !MAGIC[type](bytes)) {
      throw new AppError('invalid_file', `Photo ${i + 1} doesn’t look like a valid image file.`, 400);
    }
    return { media_type: type, data };
  });
}
