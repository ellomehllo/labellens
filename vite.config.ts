import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv, type Plugin } from 'vite';

// Serves /api/* from the same handler the production server uses, so `npm run dev` is one process.
// Server-only env vars (like ANTHROPIC_API_KEY) are copied into process.env here and never exposed
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

export default defineConfig(({ mode }) => {
  for (const [key, value] of Object.entries(loadEnv(mode, process.cwd(), ''))) {
    process.env[key] ??= value;
  }
  return {
    plugins: [react(), labelLensApi()],
    server: { port: 5173 },
  };
});
