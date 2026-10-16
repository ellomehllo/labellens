import { resolveConfig } from '../core/ai/config.ts';
import { PROVIDER_NAMES, type AiConfig, type ProviderId } from '../core/ai/types.ts';
import { AppError } from '../core/errors.ts';

export interface AiStatus {
  ready: boolean;
  provider: ProviderId | null;
  providerName: string | null;
  model: string | null;
  problem: 'no_key' | 'unknown_key' | null;
}

/** Read on every call so a changed environment (e.g. dev .env reload) is picked up. */
export function aiStatus(): AiStatus {
  const result = resolveConfig(process.env);
  if (!result.ok) return { ready: false, provider: null, providerName: null, model: null, problem: result.problem };
  const { provider, model } = result.config;
  return { ready: true, provider, providerName: PROVIDER_NAMES[provider], model, problem: null };
}

/** The server's AI config, or a 503 the client shows as "not set up". */
export function requireAi(): AiConfig {
  const result = resolveConfig(process.env);
  if (result.ok) return result.config;
  throw result.problem === 'unknown_key'
    ? new AppError('ai_not_configured', 'The server’s AI key isn’t one LabelLens recognises. The site owner should set AI_PROVIDER.', 503)
    : new AppError('ai_not_configured', 'The AI service is not set up on this server yet.', 503);
}
