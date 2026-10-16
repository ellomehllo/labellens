import { openVault, type VaultContents, type VaultFile } from '../../core/vault.ts';

// Unlocked key for the static build. Kept for the tab session by default, or on this device if the
// visitor chooses. Tied to the vault's salt so a re-sealed (rotated) key forces a fresh unlock.

const STORE_KEY = 'labellens:unlocked:v1';

interface Stored {
  salt: string;
  contents: VaultContents;
}

/** The sealed key published with the site, or null if the owner hasn't configured one. */
export async function fetchVault(): Promise<VaultFile | null> {
  const res = await fetch(`${import.meta.env.BASE_URL}vault.json`, { cache: 'no-store' });
  if (!res.ok || !res.headers.get('content-type')?.includes('json')) return null;
  return res.json();
}

export function getUnlocked(vault: VaultFile): VaultContents | null {
  for (const store of [sessionStorage, localStorage]) {
    try {
      const raw = store.getItem(STORE_KEY);
      const stored = raw ? (JSON.parse(raw) as Stored) : null;
      if (stored?.salt === vault.salt) return stored.contents;
    } catch {
      /* storage unavailable */
    }
  }
  return null;
}

export async function unlock(vault: VaultFile, password: string, remember: boolean): Promise<VaultContents> {
  const contents = await openVault(vault, password);
  lock();
  try {
    (remember ? localStorage : sessionStorage).setItem(STORE_KEY, JSON.stringify({ salt: vault.salt, contents } satisfies Stored));
  } catch {
    /* still unlocked for this page view */
  }
  current = contents;
  return contents;
}

export function lock() {
  current = null;
  for (const store of [sessionStorage, localStorage]) {
    try {
      store.removeItem(STORE_KEY);
    } catch {
      /* ignore */
    }
  }
}

/** The key the local engine uses; set by unlock() or restored by the app on load. */
let current: VaultContents | null = null;
export const setCurrent = (contents: VaultContents | null) => (current = contents);
export const getCurrent = () => current;
