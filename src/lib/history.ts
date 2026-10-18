import type { Analysis, LabelSection } from '../../shared/types.ts';

// Scan history lives in this tab's sessionStorage: kept for the session, gone when the tab closes.
// No photos are stored, only text results. Off entirely when "Save scan history" is off.

export interface SavedScan {
  id: string;
  savedAt: string;
  analysis: Analysis;
  sections: LabelSection[];
}

const SCANS_KEY = 'labellens:scans:v2';
const MAX_SCANS = 50;

function read(): SavedScan[] {
  try {
    const raw = sessionStorage.getItem(SCANS_KEY);
    return raw ? (JSON.parse(raw) as SavedScan[]) : [];
  } catch {
    return [];
  }
}

function write(scans: SavedScan[]): boolean {
  try {
    sessionStorage.setItem(SCANS_KEY, JSON.stringify(scans));
    return true;
  } catch {
    return false;
  }
}

export const listScans = (): SavedScan[] => read();
export const getScan = (id: string) => read().find((s) => s.id === id) ?? null;

export function saveScan(analysis: Analysis, sections: LabelSection[]): SavedScan | null {
  const existing = read().find((s) => s.analysis.meta.analyzed_at === analysis.meta.analyzed_at);
  if (existing) return existing;
  const scan: SavedScan = { id: crypto.randomUUID(), savedAt: new Date().toISOString(), analysis, sections };
  return write([scan, ...read()].slice(0, MAX_SCANS)) ? scan : null;
}

export const deleteScan = (id: string) => write(read().filter((s) => s.id !== id));

export function deleteAllScans() {
  try {
    sessionStorage.removeItem(SCANS_KEY);
    localStorage.removeItem('labellens:scans:v1'); // results saved by the earlier version
  } catch {
    /* storage unavailable: nothing stored */
  }
}
