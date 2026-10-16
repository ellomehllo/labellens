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
 * Non-2xx responses become AppErrors with user-facing messages; `label` is used in server logs only.
 */
export async function postJson(label: string, url: string, headers: Record<string, string>, body: unknown): Promise<unknown> {
  for (let attempt = 0; ; attempt++) {
    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (error) {
      if (attempt < RETRIES) {
        await sleep(attempt);
        continue;
      }
      console.error(`[${label}] network error:`, error);
      throw new AppError('ai_unreachable', 'Couldn’t reach the AI service. Check the server’s connection and try again.', 503);
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

function httpError(status: number, detail: string): AppError {
  if (/insufficient_quota|billing|credit|RESOURCE_EXHAUSTED.*quota|exceeded your current quota/i.test(detail)) {
    return new AppError('ai_quota', 'The AI account behind this site has run out of credit. The site owner needs to top it up.', 503);
  }
  if (status === 401 || status === 403 || /API_KEY_INVALID|invalid api key|invalid_api_key/i.test(detail)) {
    return new AppError('ai_auth', 'The server’s AI key was rejected. The site owner needs to check it.', 503);
  }
  if (status === 429) {
    return new AppError('ai_busy', 'The AI service is busy right now. Please wait a minute and try again.', 503);
  }
  if (status === 404 || /model_not_found|does not exist|not found for API version/i.test(detail)) {
    return new AppError('ai_model', 'The configured AI model isn’t available for this key.', 503);
  }
  if (status === 400 || status === 413 || status === 422) {
    return new AppError('ai_rejected', 'The AI service could not process these images or text.', 422);
  }
  return new AppError('ai_failed', 'The AI service had a problem. Please try again shortly.', 502);
}

const sleep = (attempt: number) => new Promise((r) => setTimeout(r, 800 * 2 ** attempt));
