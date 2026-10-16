import type { AiConfig, ProviderCall, ProviderId, StructuredRequest } from './types.ts';

// Adapters load on first use, so the browser only downloads the provider it actually calls.
const LOADERS: Record<ProviderId, () => Promise<ProviderCall>> = {
  anthropic: () => import('./anthropic.ts').then((m) => m.callAnthropic),
  openai: () => import('./openai.ts').then((m) => m.callOpenAiCompatible),
  openrouter: () => import('./openai.ts').then((m) => m.callOpenAiCompatible),
  gemini: () => import('./gemini.ts').then((m) => m.callGemini),
};

/** One structured-output call to the provider in `config`. */
export async function structuredCall(config: AiConfig, request: StructuredRequest): Promise<unknown> {
  const call = await LOADERS[config.provider]();
  return call(config, request);
}
