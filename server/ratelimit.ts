// In-memory limits. Fine for a single server process; use a shared store if you run several.

const WINDOW_MS = 10 * 60 * 1000;
const PER_WINDOW = 20;
const DAILY_LIMIT = Number(process.env.LABELLENS_DAILY_LIMIT) || 300;

const hits = new Map<string, number[]>();
let day = '';
let dailyCount = 0;

export type LimitResult = { ok: true } | { ok: false; reason: 'client' | 'daily'; retryAfter: number };

/** Records one AI call for `client` if it is allowed. */
export function takeAiCall(client: string, now = Date.now()): LimitResult {
  const today = new Date(now).toISOString().slice(0, 10);
  if (today !== day) {
    day = today;
    dailyCount = 0;
  }
  if (dailyCount >= DAILY_LIMIT) {
    const tomorrow = Date.parse(`${today}T00:00:00Z`) + 86_400_000;
    return { ok: false, reason: 'daily', retryAfter: Math.ceil((tomorrow - now) / 1000) };
  }
  const recent = (hits.get(client) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= PER_WINDOW) {
    return { ok: false, reason: 'client', retryAfter: Math.ceil((recent[0] + WINDOW_MS - now) / 1000) };
  }
  recent.push(now);
  hits.set(client, recent);
  dailyCount++;
  if (hits.size > 10_000) {
    for (const [key, times] of hits) if (now - times[times.length - 1] > WINDOW_MS) hits.delete(key);
  }
  return { ok: true };
}
