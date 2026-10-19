import { AppError } from '../errors.ts';

const TIMEOUT_MS = 180_000;
const RETRIES = 2;

export function parseJson(text: string): unknown {
  // Some OpenAI-compatible models wrap JSON in a code fence despite a schema; tolerate that.
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try {
    return JSON.parse(trimmed);
  } catch {
    throw new AppError('ai_bad_output', 'The AI service returned an unreadable response. Please try again.', 502);
  }
}

/**
 * POSTs JSON with a timeout, retrying network errors and 5xx responses.
 * Non-2xx responses become AppErrors with user-facing messages; `label` is only used in logs.
 * Runs in Node and in the browser.
 */
export async function postJson(
  label: string,
  url: string,
  headers: Record<string, string>,
  body: unknown,
  signal?: AbortSignal,
): Promise<unknown> {
  for (let attempt = 0; ; attempt++) {
    let res: Response;
    try {
      const timeout = AbortSignal.timeout(TIMEOUT_MS);
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify(body),
        signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
      });
    } catch (error) {
      if (signal?.aborted) throw error;
      if (attempt < RETRIES) {
        await sleep(attempt);
        continue;
      }
      console.error(`[${label}] network error:`, error);
      // In a browser, OpenAI's error replies lack CORS headers, so a rejected key looks like a network failure.
      const keyHint = label === 'openai' && 'window' in globalThis ? ' If your connection is fine, the AI key may be wrong or revoked.' : '';
      throw new AppError('ai_unreachable', `Couldn’t reach the AI service. Check the connection and try again.${keyHint}`, 503);
    }

    if (res.ok) return res.json();
    if (res.status >= 500 && attempt < RETRIES) {
      await sleep(attempt);
      continue;
    }
    const detail = await res.text().catch(() => '');
    console.error(`[${label}] HTTP ${res.status}:`, detail.slice(0, 500));
    throw httpError(res.status, detail);
  }
}

// Only explicit out-of-credit signals count as quota. OpenAI's ordinary rate-limit replies also link to
// the billing page, so a bare "billing" mention must not be read as "no credit".
const QUOTA = /insufficient_quota|exceeded your current quota|credit balance is too low|insufficient credits|billing_hard_limit|billing_not_active/i;

function httpError(status: number, detail: string): AppError {
  const reason = providerReason(detail);
  const says = reason ? ` The provider says: “${reason}”` : '';
  if (status === 402 || QUOTA.test(detail)) {
    return new AppError('ai_quota', `The AI account for this key has run out of credit or hit its spending limit.${says}`, 503);
  }
  if (status === 401 || status === 403 || /API_KEY_INVALID|invalid api key|invalid_api_key/i.test(detail)) {
    return new AppError('ai_auth', 'The AI key was rejected. It may be wrong, revoked or expired.', 503);
  }
  if (status === 429) {
    return new AppError('ai_busy', `The AI service is limiting requests right now. Wait a minute and try again.${says}`, 503);
  }
  if (status === 404 || /model_not_found|does not exist|not found for API version/i.test(detail)) {
    return new AppError('ai_model', `The configured AI model isn’t available for this key.${says}`, 503);
  }
  if (status === 400 || status === 413 || status === 422) {
    return new AppError('ai_rejected', `The AI service could not process these images or text.${says}`, 422);
  }
  return new AppError('ai_failed', 'The AI service had a problem. Please try again shortly.', 502);
}

/** The provider's own short error message, with anything key-like masked. */
export function providerReason(detail: string): string | null {
  let message = '';
  try {
    const body = JSON.parse(detail);
    const err = Array.isArray(body) ? body[0]?.error : body?.error;
    message = typeof err === 'string' ? err : typeof err?.message === 'string' ? err.message : '';
  } catch {
    message = detail;
  }
  message = message
    .replace(/\b(sk-[A-Za-z0-9]{0,4})[A-Za-z0-9_*-]{6,}/g, '$1…')
    .replace(/\bAIza[0-9A-Za-z_-]{6,}/g, 'AIza…')
    .replace(/\s+/g, ' ')
    .trim();
  if (!message || /^<!doctype|^<html/i.test(message)) return null;
  return message.length > 220 ? `${message.slice(0, 217)}…` : message;
}

const sleep = (attempt: number) => new Promise((r) => setTimeout(r, 800 * 2 ** attempt));
