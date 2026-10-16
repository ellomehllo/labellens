import { appendFile, mkdir } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { CATEGORIES, FINDING_TYPES, LIMITS, SECTION_LABELS, type ServiceStatus } from '../shared/types.ts';
import { AppError, MODEL, aiConfigured, structuredCall } from './claude.ts';
import { ANALYZE_SCHEMA, ANALYZE_SYSTEM, EXTRACT_SCHEMA, EXTRACT_SYSTEM } from './prompts.ts';
import { takeAiCall } from './ratelimit.ts';
import { SOURCES } from './sources.ts';
import { buildAnalysis, checkAnalyzeRequest, checkImages, normalizeExtraction } from './validate.ts';

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
      case 'GET /api/status':
        return sendJson(res, 200, {
          ai: aiConfigured(),
          model: MODEL,
          sources: SOURCES.length,
          limits: { maxImages: LIMITS.maxImages, maxImageBytes: LIMITS.maxImageBytes },
        } satisfies ServiceStatus);
      case 'GET /api/sources':
        return sendJson(res, 200, { sources: SOURCES });
      case 'POST /api/extract':
        return await extract(req, res);
      case 'POST /api/analyze':
        return await analyze(req, res);
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
  limitAi(req);
  const stream = startStream(res);
  stream({ stage: 'reading_text' });
  const raw = await structuredCall({
    system: EXTRACT_SYSTEM,
    content: [
      ...images.map((img) => ({
        type: 'image' as const,
        source: { type: 'base64' as const, media_type: img.media_type, data: img.data },
      })),
      {
        type: 'text' as const,
        text: `These ${images.length} photo(s) show one product's packaging. Transcribe the label text as instructed.`,
      },
    ],
    schema: EXTRACT_SCHEMA,
    effort: 'medium',
    maxTokens: 16000,
  });
  stream({ stage: 'organising_text' });
  stream({ result: normalizeExtraction(raw) });
  res.end();
}

// Step 2: user-checked text -> explanation with source-checked findings. Text only; no images.
async function analyze(req: IncomingMessage, res: ServerResponse) {
  const request = checkAnalyzeRequest(await readJson(req));
  limitAi(req);
  const stream = startStream(res);
  stream({ stage: 'interpreting' });
  const labelText = request.sections
    .map((s) => {
      const notes = [s.edited ? 'corrected by user' : null, s.confidence ? `read with ${s.confidence} confidence` : null]
        .filter(Boolean)
        .join(', ');
      return `### ${SECTION_LABELS[s.kind]}${notes ? ` (${notes})` : ''}\n${s.text}`;
    })
    .join('\n\n');
  const raw = await structuredCall({
    system: ANALYZE_SYSTEM,
    content: [
      {
        type: 'text',
        text: [
          `Category: ${request.category}`,
          `Market where bought: ${request.market ?? 'unknown'}`,
          `Source of text: ${request.input === 'photo' ? `read from photos (overall readability: ${request.readability ?? 'unknown'})` : request.input === 'example' ? 'LabelLens example label text' : 'typed by the user'}`,
          '',
          '<label_text>',
          labelText,
          '</label_text>',
        ].join('\n'),
      },
    ],
    schema: ANALYZE_SCHEMA,
    effort: 'medium',
    maxTokens: 24000,
  });
  stream({ stage: 'checking_sources' });
  const analysis = buildAnalysis(raw, request, MODEL);
  stream({ stage: 'checking_wording' });
  stream({ result: analysis });
  res.end();
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
  if (!aiConfigured()) throw new AppError('ai_not_configured', 'The AI service is not set up on this server yet.', 503);
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
