import type { ImageInput } from '../../shared/types.ts';

export const PROVIDERS = ['anthropic', 'openai', 'gemini', 'openrouter'] as const;
export type ProviderId = (typeof PROVIDERS)[number];

export const PROVIDER_NAMES: Record<ProviderId, string> = {
  anthropic: 'Anthropic (Claude)',
  openai: 'OpenAI',
  gemini: 'Google Gemini',
  openrouter: 'OpenRouter',
};

export interface AiConfig {
  provider: ProviderId;
  apiKey: string;
  model: string;
  /** Override for OpenAI-compatible endpoints (e.g. a self-hosted gateway). */
  baseUrl: string | null;
}

/** One request that must come back as JSON matching `schema`. Provider-neutral. */
export interface StructuredRequest {
  system: string;
  images: ImageInput[];
  text: string;
  schema: Record<string, unknown>;
  effort: 'low' | 'medium' | 'high';
  maxTokens: number;
  /** Cancels the request (e.g. the user pressed Cancel). */
  signal?: AbortSignal;
}

export type ProviderCall = (config: AiConfig, request: StructuredRequest) => Promise<unknown>;
