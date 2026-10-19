import { appendFile, mkdir } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { checkAnalyzeRequest } from '../core/analysis.ts';
import { AppError } from '../core/errors.ts';
import { runAnalyze, runExtract, runPing } from '../core/pipeline.ts';
import { SOURCES } from '../core/sources.ts';
import { CATEGORIES, FINDING_TYPES, LIMITS, type ServiceStatus } from '../shared/types.ts';
import { aiStatus, requireAi } from './ai.ts';
import { takeAiCall } from './ratelimit.ts';
import { checkImages } from './validate.ts';

const MAX_BODY = Math.ceil(LIMITS.maxImages * LIMITS.maxImageBytes * 1.4) + 64 * 1024;
const FEEDBACK_ON = process.env.LABELLENS_FEEDBACK !== 'off';

type Next = (err?: unknown) => void;

/** Connect-style handler for /api/*. Used by the production server and the Vite dev server. */
export async function apiHandler(req: IncomingMessage, res: ServerResponse, next?: Next): Promise<void> {
  const path = (req.url ?? '').split('?')[0];
  if (!path.startsWith('/api/')) {
    if (next) next();
    else sendJson(res, 404, { error: { code: 'not_found', message: 'Not found' } });
    return;
  }
  res.setHeader('Cache-Control', 'no-store');
  try {
    const route = `${req.method} ${path}`;
    switch (route) {
      case 'GET /api/status': {
        const ai = aiStatus();
        return sendJson(res, 200, {
          ai: ai.ready,
          provider: ai.providerName,
          model: ai.model,
          problem: ai.problem,
          sources: SOURCES.length,
          limits: { maxImages: LIMITS.maxImages, maxImageBytes: LIMITS.maxImageBytes },
        } satisfies ServiceStatus);
      }
      case 'GET /api/sources':
        return sendJson(res, 200, { sources: SOURCES });
      case 'POST /api/extract':
        return await extract(req, res);
      case 'POST /api/analyze':
        return await analyze(req, res);
      case 'POST /api/ping':
        return sendJson(res, 200, await runPing(limitAi(req)));
      case 'POST /api/feedback':
        return await feedback(req, res);
      default:
        throw new AppError('not_found', 'Unknown endpoint.', 404);
    }
  } catch (error) {
    const appError = error instanceof AppError ? error : new AppError('server_error', 'Something went wrong on the server.');
    if (!(error instanceof AppError)) console.error('[api]', error);
    if (res.headersSent) {
      res.end(JSON.stringify({ error: { code: appError.code, message: appError.message } }) + '\n');
    } else {
      sendJson(res, appError.status, { error: { code: appError.code, message: appError.message } });
    }
  }
}

// Step 1: photos -> structured label text. Images are held in memory for this request only.
async function extract(req: IncomingMessage, res: ServerResponse) {
  const images = checkImages(await readJson(req));
  const config = limitAi(req);
  const stream = startStream(res);
  const extraction = await runExtract(config, images, (stage) => stream({ stage }), abortOnClose(res));
  stream({ result: extraction });
  res.end();
}

// Step 2: user-checked text -> explanation with source-checked findings. Text only; no images.
async function analyze(req: IncomingMessage, res: ServerResponse) {
  const request = checkAnalyzeRequest(await readJson(req));
  const config = limitAi(req);
  const stream = startStream(res);
  const analysis = await runAnalyze(config, request, (stage) => stream({ stage }), abortOnClose(res));
  stream({ result: analysis });
  res.end();
}

/** Stops paying for an AI call when the browser goes away (e.g. the user pressed Cancel). */
function abortOnClose(res: ServerResponse): AbortSignal {
  const controller = new AbortController();
  res.on('close', () => {
    if (!res.writableEnded) controller.abort();
  });
  return controller.signal;
}

async function feedback(req: IncomingMessage, res: ServerResponse) {
  const body = (await readJson(req, 8 * 1024)) as Record<string, unknown>;
  const reasons = ['helpful', 'wrong', 'unclear', 'source_mismatch', 'too_alarming', 'other'];
  const entry = {
    at: new Date().toISOString(),
    reason: reasons.includes(String(body.reason)) ? body.reason : 'other',
    category: CATEGORIES.includes(body.category as never) ? body.category : null,
    finding_type: FINDING_TYPES.includes(body.finding_type as never) ? body.finding_type : null,
    finding_title: String(body.finding_title ?? '').slice(0, 200),
    comment: String(body.comment ?? '').slice(0, 500),
  };
  if (FEEDBACK_ON) {
    await mkdir('data', { recursive: true });
    await appendFile('data/feedback.jsonl', JSON.stringify(entry) + '\n');
  }
  sendJson(res, 200, { ok: true, stored: FEEDBACK_ON });
}

// ---------------------------------------------------------------------------

function limitAi(req: IncomingMessage) {
  const config = requireAi();
  const forwarded = req.headers['x-forwarded-for'];
  const client = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(',')[0].trim() || req.socket.remoteAddress || 'unknown';
  const result = takeAiCall(client);
  if (!result.ok) {
    const minutes = Math.max(1, Math.round(result.retryAfter / 60));
    throw new AppError(
      'rate_limited',
      result.reason === 'daily'
        ? 'LabelLens has reached today’s analysis limit. Please try again tomorrow.'
        : `Too many requests from this device. Try again in about ${minutes} minute${minutes === 1 ? '' : 's'}.`,
      429,
    );
  }
  return config;
}

/** Newline-delimited JSON progress stream. Stages are only sent when that work actually starts. */
function startStream(res: ServerResponse) {
  res.writeHead(200, { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'X-Accel-Buffering': 'no' });
  return (event: object) => res.write(JSON.stringify(event) + '\n');
}

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

async function readJson(req: IncomingMessage, limit = MAX_BODY): Promise<unknown> {
  if (!String(req.headers['content-type'] ?? '').includes('application/json')) {
    throw new AppError('bad_request', 'Expected a JSON request.', 415);
  }
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw new AppError('file_too_large', 'The upload is too large.', 413);
    chunks.push(chunk as Buffer);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new AppError('bad_request', 'The request couldn’t be read.', 400);
  }
}
