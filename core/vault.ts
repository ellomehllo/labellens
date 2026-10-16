import type { ProviderId } from './ai/types.ts';
import { AppError } from './errors.ts';

// Password-encrypted AI key for the static (GitHub Pages) build. The build seals the key with the
// site password; the browser opens it. Without the password the file is useless, provided the
// password is strong. Anyone who has the password can recover the key, so share it carefully.
// Uses Web Crypto only, so the same code runs in Node (build) and the browser.

export const VAULT_ITERATIONS = 600_000; // PBKDF2-SHA256, OWASP's current recommendation

export interface VaultFile {
  v: 1;
  kdf: 'PBKDF2-SHA256';
  iterations: number;
  salt: string;
  iv: string;
  data: string;
}

export interface VaultContents {
  apiKey: string;
  provider: ProviderId;
  model: string;
}

export async function sealVault(contents: VaultContents, password: string): Promise<VaultFile> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt, VAULT_ITERATIONS);
  const plain = new TextEncoder().encode(JSON.stringify(contents));
  const sealed = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plain));
  return { v: 1, kdf: 'PBKDF2-SHA256', iterations: VAULT_ITERATIONS, salt: toB64(salt), iv: toB64(iv), data: toB64(sealed) };
}

/** Throws AppError('wrong_password') when the password doesn't match (AES-GCM authentication fails). */
export async function openVault(file: VaultFile, password: string): Promise<VaultContents> {
  if (file.v !== 1 || file.kdf !== 'PBKDF2-SHA256') throw new AppError('vault_invalid', 'This site’s key file is in an unknown format.');
  const key = await deriveKey(password, fromB64(file.salt), file.iterations);
  let plain: ArrayBuffer;
  try {
    plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(file.iv) }, key, fromB64(file.data));
  } catch {
    throw new AppError('wrong_password', 'That password didn’t work.', 401);
  }
  return JSON.parse(new TextDecoder().decode(plain)) as VaultContents;
}

async function deriveKey(password: string, salt: Uint8Array<ArrayBuffer>, iterations: number): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

function toB64(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function fromB64(text: string): Uint8Array<ArrayBuffer> {
  const binary = atob(text);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
