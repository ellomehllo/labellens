import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';
import { apiHandler } from './api.ts';
import { aiConfigured, MODEL } from './claude.ts';

const PORT = Number(process.env.PORT) || 8787;
const DIST = resolve(import.meta.dirname, '../dist');

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
  '.json': 'application/json',
};

export const SECURITY_HEADERS: Record<string, string> = {
  'Content-Security-Policy':
    "default-src 'self'; img-src 'self' blob: data:; media-src 'self' blob:; style-src 'self'; script-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Permissions-Policy': 'camera=(self), microphone=(), geolocation=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
};

const server = createServer(async (req, res) => {
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) res.setHeader(name, value);
  if (req.url?.startsWith('/api/')) return apiHandler(req, res);
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405).end();
    return;
  }

  const urlPath = decodeURIComponent((req.url ?? '/').split('?')[0]);
  let file = normalize(join(DIST, urlPath));
  if (!file.startsWith(DIST)) {
    res.writeHead(400).end();
    return;
  }
  try {
    if (!(await stat(file)).isFile()) throw new Error('not a file');
  } catch {
    file = join(DIST, 'index.html'); // single-page app fallback
  }
  try {
    await stat(file);
  } catch {
    res.writeHead(500, { 'Content-Type': 'text/plain' }).end('Build missing. Run `npm run build` first.');
    return;
  }
  const isAsset = file.includes(`${DIST}/assets/`);
  res.writeHead(200, {
    'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream',
    'Cache-Control': isAsset ? 'public, max-age=31536000, immutable' : 'no-cache',
  });
  createReadStream(file).pipe(res);
});

server.listen(PORT, () => {
  console.log(`LabelLens running at http://localhost:${PORT}`);
  console.log(aiConfigured() ? `AI: ${MODEL}` : 'AI: not configured (set ANTHROPIC_API_KEY in .env)');
});
