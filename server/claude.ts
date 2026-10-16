import Anthropic from '@anthropic-ai/sdk';

export const MODEL = process.env.LABELLENS_MODEL || 'claude-opus-5-5';

export class AppError extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status = 500) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export function aiConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

let client: Anthropic | null = null;

interface StructuredRequest {
  system: string;
  content: Anthropic.Beta.BetaContentBlockParam[];
  schema: Record<string, unknown>;
  effort: 'low' | 'medium' | 'high';
  maxTokens: number;
}

/** One Claude call that must return JSON matching `schema`. Throws AppError with a user-facing message. */
export async function structuredCall({ system, content, schema, effort, maxTokens }: StructuredRequest): Promise<unknown> {
  if (!aiConfigured()) {
    throw new AppError('ai_not_configured', 'The AI service is not set up on this server yet.', 503);
  }
  client ??= new Anthropic({ maxRetries: 2, timeout: 180_000 });

  let response: Anthropic.Beta.BetaMessage;
  try {
    response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: maxTokens,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content }],
      output_config: { effort, format: { type: 'json_schema', schema } },
    });
  } catch (error) {
    throw toAppError(error);
  }

  if (response.stop_reason === 'refusal') {
    throw new AppError('ai_declined', 'The AI service declined to process this label. Try different photos or text.', 422);
  }
  if (response.stop_reason === 'max_tokens') {
    throw new AppError('ai_truncated', 'The response was cut short. Try again with fewer photos or less text.', 502);
  }

  const text = response.content
    .filter((block): block is Anthropic.Beta.BetaTextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('');
  try {
    return JSON.parse(text);
  } catch {
    throw new AppError('ai_bad_output', 'The AI service returned an unreadable response. Please try again.', 502);
  }
}

function toAppError(error: unknown): AppError {
  if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
    console.error('[claude] auth error:', error.message);
    return new AppError('ai_auth', 'The server’s AI credentials were rejected. The site owner needs to check the API key.', 503);
  }
  if (error instanceof Anthropic.RateLimitError) {
    return new AppError('ai_busy', 'The AI service is busy right now. Please wait a minute and try again.', 503);
  }
  if (error instanceof Anthropic.BadRequestError) {
    console.error('[claude] bad request:', error.message);
    return new AppError('ai_rejected', 'The AI service could not process these images or text.', 422);
  }
  if (error instanceof Anthropic.APIConnectionError) {
    return new AppError('ai_unreachable', 'Couldn’t reach the AI service. Check the server’s connection and try again.', 503);
  }
  if (error instanceof Anthropic.APIError) {
    console.error('[claude] api error:', error.status, error.message);
    return new AppError('ai_failed', 'The AI service had a problem. Please try again shortly.', 502);
  }
  console.error('[claude] unexpected error:', error);
  return new AppError('ai_failed', 'Something went wrong while contacting the AI service.', 500);
}
