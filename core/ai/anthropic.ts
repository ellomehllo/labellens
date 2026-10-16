import Anthropic from '@anthropic-ai/sdk';
import { AppError } from '../errors.ts';
import { parseJson } from './http.ts';
import type { ProviderCall } from './types.ts';

const clients = new Map<string, Anthropic>();

export const callAnthropic: ProviderCall = async (config, { system, images, text, schema, effort, maxTokens, signal }) => {
  let client = clients.get(config.apiKey);
  if (!client) {
    client = new Anthropic({
      apiKey: config.apiKey,
      maxRetries: 2,
      timeout: 180_000,
      // The GitHub Pages build calls Claude straight from the browser with a password-protected key.
      dangerouslyAllowBrowser: 'window' in globalThis,
    });
    clients.set(config.apiKey, client);
  }

  let response: Anthropic.Beta.BetaMessage;
  try {
    response = await client.beta.messages.create({
      model: config.model,
      max_tokens: maxTokens,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
      messages: [
        {
          role: 'user',
          content: [
            ...images.map((img) => ({
              type: 'image' as const,
              source: { type: 'base64' as const, media_type: img.media_type, data: img.data },
            })),
            { type: 'text' as const, text },
          ],
        },
      ],
      output_config: { effort, format: { type: 'json_schema', schema } },
    }, { signal });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw toAppError(error);
  }

  if (response.stop_reason === 'refusal') {
    throw new AppError('ai_declined', 'The AI service declined to process this label. Try different photos or text.', 422);
  }
  if (response.stop_reason === 'max_tokens') {
    throw new AppError('ai_truncated', 'The response was cut short. Try again with fewer photos or less text.', 502);
  }
  return parseJson(
    response.content
      .filter((block): block is Anthropic.Beta.BetaTextBlock => block.type === 'text')
      .map((block) => block.text)
      .join(''),
  );
};

function toAppError(error: unknown): AppError {
  if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
    console.error('[anthropic] auth error:', error.message);
    return new AppError('ai_auth', 'The AI key was rejected. It may be wrong, revoked or expired.', 503);
  }
  if (error instanceof Anthropic.RateLimitError) {
    return new AppError('ai_busy', 'The AI service is busy right now. Please wait a minute and try again.', 503);
  }
  if (error instanceof Anthropic.NotFoundError) {
    console.error('[anthropic] not found:', error.message);
    return new AppError('ai_model', 'The configured AI model isn’t available for this key.', 503);
  }
  if (error instanceof Anthropic.BadRequestError) {
    console.error('[anthropic] bad request:', error.message);
    if (/credit balance/i.test(error.message)) {
      return new AppError('ai_quota', 'The AI account for this key has run out of credit or hit its spending limit.', 503);
    }
    return new AppError('ai_rejected', 'The AI service could not process these images or text.', 422);
  }
  if (error instanceof Anthropic.APIConnectionError) {
    return new AppError('ai_unreachable', 'Couldn’t reach the AI service. Check the connection and try again.', 503);
  }
  if (error instanceof Anthropic.APIError) {
    console.error('[anthropic] api error:', error.status, error.message);
    return new AppError('ai_failed', 'The AI service had a problem. Please try again shortly.', 502);
  }
  console.error('[anthropic] unexpected error:', error);
  return new AppError('ai_failed', 'Something went wrong while contacting the AI service.', 500);
}
