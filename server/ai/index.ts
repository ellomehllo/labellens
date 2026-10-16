import { AppError } from '../errors.ts';
import { callAnthropic } from './anthropic.ts';
import { resolveConfig } from './config.ts';
import { callGemini } from './gemini.ts';
import { callOpenAiCompatible } from './openai.ts';
import { PROVIDER_NAMES, type ProviderCall, type ProviderId, type StructuredRequest } from './types.ts';

const CALLS: Record<ProviderId, ProviderCall> = {
  anthropic: callAnthropic,
  openai: callOpenAiCompatible,
  openrouter: callOpenAiCompatible,
  gemini: callGemini,
};

export interface AiStatus {
  ready: boolean;
  provider: ProviderId | null;
  providerName: string | null;
  model: string | null;
  problem: 'no_key' | 'unknown_key' | null;
}

/** Read on every call so a changed environment (e.g. dev .env reload) is picked up. */
export function aiStatus(): AiStatus {
  const result = resolveConfig();
  if (!result.ok) return { ready: false, provider: null, providerName: null, model: null, problem: result.problem };
  const { provider, model } = result.config;
  return { ready: true, provider, providerName: PROVIDER_NAMES[provider], model, problem: null };
}

export function requireAi() {
  const result = resolveConfig();
  if (result.ok) return result.config;
  throw result.problem === 'unknown_key'
    ? new AppError('ai_not_configured', 'The server’s AI key isn’t one LabelLens recognises. The site owner should set AI_PROVIDER.', 503)
    : new AppError('ai_not_configured', 'The AI service is not set up on this server yet.', 503);
}

/** One structured-output call to whichever provider the configured key belongs to. */
export async function structuredCall(request: StructuredRequest): Promise<{ data: unknown; model: string; provider: ProviderId }> {
  const config = requireAi();
  const data = await CALLS[config.provider](config, request);
  return { data, model: config.model, provider: config.provider };
}
