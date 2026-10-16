import type { Analysis, LabelSection } from '../../shared/types.ts';

// Saved scans live only in this browser's localStorage. No photos are stored, only text results.

export interface SavedScan {
  id: string;
  savedAt: string;
  analysis: Analysis;
  sections: LabelSection[];
}

const SCANS_KEY = 'labellens:scans:v1';
const SETTINGS_KEY = 'labellens:settings:v1';
const MAX_SCANS = 50;

export interface Settings {
  autoSave: boolean;
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export const getSettings = (): Settings => ({ autoSave: false, ...read<Partial<Settings>>(SETTINGS_KEY, {}) });
export const saveSettings = (settings: Settings) => write(SETTINGS_KEY, settings);

export const listScans = (): SavedScan[] => read<SavedScan[]>(SCANS_KEY, []);
export const getScan = (id: string) => listScans().find((s) => s.id === id) ?? null;

export function saveScan(analysis: Analysis, sections: LabelSection[]): SavedScan | null {
  const existing = listScans().find((s) => s.analysis.meta.analyzed_at === analysis.meta.analyzed_at);
  if (existing) return existing;
  const scan: SavedScan = { id: crypto.randomUUID(), savedAt: new Date().toISOString(), analysis, sections };
  return write(SCANS_KEY, [scan, ...listScans()].slice(0, MAX_SCANS)) ? scan : null;
}

export const deleteScan = (id: string) => write(SCANS_KEY, listScans().filter((s) => s.id !== id));

export function deleteAllScans() {
  try {
    localStorage.removeItem(SCANS_KEY);
  } catch {
    /* storage unavailable: nothing stored */
  }
}
