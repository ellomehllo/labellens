import type { Analysis, AnalyzeRequest, Extraction, ServiceStatus, Source, StreamEvent } from '../../shared/types.ts';
import type { PreparedImage } from './image.ts';
import { FEEDBACK_URL, STATIC_SITE } from './mode.ts';

// In the GitHub Pages build these calls run the pipeline in the browser (./local.ts, loaded on
// demand); otherwise they go to the LabelLens server's /api.
const local = () => import('./local.ts');

export class ApiError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

/** Names the server's AI provider (e.g. "OpenAI") for privacy wording, or a neutral phrase if unknown. */
export function aiName(status: ServiceStatus | 'offline' | null): string {
  return status && status !== 'offline' && status.provider ? status.provider : 'an AI service';
}

export async function getStatus(): Promise<ServiceStatus> {
  if (STATIC_SITE) return (await local()).localStatus();
  const res = await fetch('/api/status');
  if (!res.ok) throw new ApiError('server_error', 'LabelLens’s server isn’t responding.');
  return res.json();
}

export async function getSources(): Promise<Source[]> {
  if (STATIC_SITE) return (await local()).localSources();
  const res = await fetch('/api/sources');
  if (!res.ok) throw new ApiError('server_error', 'Couldn’t load the source list.');
  return (await res.json()).sources;
}

export async function extractLabel(images: PreparedImage[], onStage: (stage: string) => void, signal: AbortSignal) {
  if (STATIC_SITE) return (await local()).localExtract(images, onStage, signal);
  return streamCall<Extraction>(
    '/api/extract',
    { images: images.map((img) => ({ media_type: img.mediaType, data: img.base64 })) },
    onStage,
    signal,
  );
}

export async function analyzeLabel(request: AnalyzeRequest, onStage: (stage: string) => void, signal: AbortSignal) {
  if (STATIC_SITE) return (await local()).localAnalyze(request, onStage, signal);
  return streamCall<Analysis>('/api/analyze', request, onStage, signal);
}

export async function sendFeedback(body: {
  reason: string;
  category: string;
  finding_type: string;
  finding_title: string;
}): Promise<boolean> {
  if (STATIC_SITE) {
    // No server to store reports: open a pre-filled GitHub issue the visitor can choose to submit.
    if (!FEEDBACK_URL) return false;
    const params = new URLSearchParams({
      title: `Finding feedback: ${body.reason}`,
      body: `Reason: ${body.reason}\nCategory: ${body.category}\nFinding type: ${body.finding_type}\nFinding: ${body.finding_title}\n\n(Add any details. Don't include personal information.)`,
    });
    window.open(`${FEEDBACK_URL}?${params}`, '_blank', 'noopener'); // returns null with noopener
    return true;
  }
  try {
    const res = await fetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** POSTs JSON and reads the server's newline-delimited progress events until a result arrives. */
async function streamCall<T>(path: string, body: unknown, onStage: (stage: string) => void, signal: AbortSignal): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    });
  } catch (error) {
    if (signal.aborted) throw error;
    throw new ApiError('network', 'Couldn’t reach LabelLens. Check your connection and try again.');
  }

  if (!res.ok || !res.body) {
    const payload = await res.json().catch(() => null);
    throw new ApiError(
      payload?.error?.code ?? 'server_error',
      payload?.error?.message ?? `The server responded with an error (${res.status}).`,
    );
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let result: T | undefined;
  const handle = (line: string) => {
    if (!line.trim()) return;
    const event = JSON.parse(line) as StreamEvent<T>;
    if ('error' in event) throw new ApiError(event.error.code, event.error.message);
    if ('stage' in event) onStage(event.stage);
    if ('result' in event) result = event.result;
  };
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      lines.forEach(handle);
    }
    handle(buffer);
  } catch (error) {
    if (error instanceof ApiError || signal.aborted) throw error;
    throw new ApiError('network', 'The connection dropped before the result arrived. Please try again.');
  }
  if (result === undefined) {
    throw new ApiError('incomplete', 'The server finished without sending a result. Please try again.');
  }
  return result;
}
