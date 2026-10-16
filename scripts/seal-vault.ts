// Encrypts the AI key with the site password for the static (GitHub Pages) build.
// Usage: AI_API_KEY=... APP_PASSWORD=... node scripts/seal-vault.ts <output path>
// In CI both values come from GitHub Actions secrets and never touch the repository.
// Prints only the provider and model, never the key or password.

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { resolveConfig } from '../core/ai/config.ts';
import { PROVIDER_NAMES } from '../core/ai/types.ts';
import { sealVault } from '../core/vault.ts';

const MIN_PASSWORD = 12;
const out = process.argv[2] ?? 'dist/vault.json';
const password = process.env.APP_PASSWORD ?? '';
const config = resolveConfig(process.env);

if (!config.ok || !password) {
  const missing = [!config.ok && 'AI_API_KEY', !password && 'APP_PASSWORD'].filter(Boolean).join(' and ');
  console.warn(`::warning::No ${missing} secret, so the site will say it isn't set up yet.`);
  process.exit(0);
}
if (password.length < MIN_PASSWORD) {
  console.error(`::error::APP_PASSWORD must be at least ${MIN_PASSWORD} characters (a few random words works well).`);
  process.exit(1);
}

const { apiKey, provider, model } = config.config;
const vault = await sealVault({ apiKey, provider, model }, password);
await mkdir(dirname(out), { recursive: true });
await writeFile(out, JSON.stringify(vault));
console.log(`Sealed ${PROVIDER_NAMES[provider]} key (model ${model}) into ${out}.`);
