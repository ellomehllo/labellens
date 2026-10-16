import { PROVIDERS, type AiConfig, type ProviderId } from './types.ts';

export const DEFAULT_MODELS: Record<ProviderId, string> = {
  anthropic: 'claude-opus-5-5',
  openai: 'gpt-6-astra',
  gemini: 'gemini-3.8-flash',
  openrouter: 'anthropic/claude-opus-5.5',
};

// Provider-specific variable names still work; AI_API_KEY is the one to use for any provider.
const KEY_VARS: [string, ProviderId | null][] = [
  ['AI_API_KEY', null],
  ['ANTHROPIC_API_KEY', 'anthropic'],
  ['OPENAI_API_KEY', 'openai'],
  ['GEMINI_API_KEY', 'gemini'],
  ['GOOGLE_API_KEY', 'gemini'],
  ['OPENROUTER_API_KEY', 'openrouter'],
];

/** Recognises a provider from the shape of its API key. */
export function detectProvider(key: string): ProviderId | null {
  const k = key.trim();
  if (k.startsWith('sk-ant-')) return 'anthropic';
  if (k.startsWith('sk-or-')) return 'openrouter';
  if (k.startsWith('AIza')) return 'gemini';
  if (k.startsWith('sk-')) return 'openai';
  return null;
}

export type ConfigResult = { ok: true; config: AiConfig } | { ok: false; problem: 'no_key' | 'unknown_key' };

export function resolveConfig(env: Record<string, string | undefined> = process.env): ConfigResult {
  const found = KEY_VARS.find(([name]) => env[name]?.trim());
  if (!found) return { ok: false, problem: 'no_key' };
  const [name, impliedProvider] = found;
  const apiKey = env[name]!.trim();

  const forced = env.AI_PROVIDER?.trim().toLowerCase();
  const provider =
    (PROVIDERS as readonly string[]).includes(forced ?? '')
      ? (forced as ProviderId)
      : (detectProvider(apiKey) ?? impliedProvider);
  if (!provider) return { ok: false, problem: 'unknown_key' };

  return {
    ok: true,
    config: {
      provider,
      apiKey,
      model: env.AI_MODEL?.trim() || env.LABELLENS_MODEL?.trim() || DEFAULT_MODELS[provider],
      baseUrl: env.AI_BASE_URL?.trim().replace(/\/+$/, '') || null,
    },
  };
}
