import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv, type Plugin } from 'vite';

// Serves /api/* from the same handler the production server uses, so `npm run dev` is one process.
// Server-only env vars (like AI_API_KEY) are copied into process.env here and never exposed
// to the browser bundle: Vite only inlines variables prefixed with VITE_.
function labelLensApi(): Plugin {
  return {
    name: 'labellens-api',
    async configureServer(server) {
      const { apiHandler } = await import('./server/api.ts');
      server.middlewares.use((req, res, next) => {
        apiHandler(req, res, next);
      });
    },
  };
}

// GitHub Pages can't send headers, so the static build carries its security policy in the page.
// The browser may only talk to this site and the four supported AI providers.
const STATIC_CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' blob: data:",
  "media-src 'self' blob:",
  "connect-src 'self' https://api.anthropic.com https://api.openai.com https://generativelanguage.googleapis.com https://openrouter.ai",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'self'",
].join('; ');

function staticHead(): Plugin {
  return {
    name: 'labellens-static-head',
    apply: 'build',
    transformIndexHtml(html) {
      if (process.env.VITE_STATIC !== 'true') return html;
      return html.replace(
        '<meta charset="UTF-8" />',
        `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${STATIC_CSP}" />\n    <meta name="referrer" content="no-referrer" />`,
      );
    },
  };
}

export default defineConfig(({ mode }) => {
  for (const [key, value] of Object.entries(loadEnv(mode, process.cwd(), ''))) {
    process.env[key] ??= value;
  }
  return {
    // "/labellens/" for the GitHub Pages project site; "/" everywhere else.
    base: process.env.VITE_BASE || '/',
    plugins: [react(), labelLensApi(), staticHead()],
    server: { port: 5173 },
  };
});
