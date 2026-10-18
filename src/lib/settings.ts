import { useSyncExternalStore } from 'react';

// Visitor preferences, kept in this browser only.

export interface Settings {
  showTips: boolean;
  /** Keep scans for this browser session (sessionStorage). */
  saveHistory: boolean;
  introSeen: boolean;
}

const KEY = 'labellens:settings:v2';
const DEFAULTS: Settings = { showTips: true, saveHistory: true, introSeen: false };
const listeners = new Set<() => void>();

function load(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Settings>) } : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

let current = load();

export const getSettings = () => current;

export function updateSettings(patch: Partial<Settings>) {
  current = { ...current, ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    /* storage unavailable: setting lasts for this page view */
  }
  listeners.forEach((l) => l());
}

export function useSettings(): Settings {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSettings,
  );
}
