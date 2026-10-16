import { AppError } from '../errors.ts';
import { parseJson, postJson } from './http.ts';
import type { ProviderCall } from './types.ts';

// OpenAI Chat Completions with strict JSON-schema output. OpenRouter speaks the same protocol,
// and AI_BASE_URL points it at any other OpenAI-compatible endpoint.

const BASE_URLS = {
  openai: 'https://api.openai.com/v1',
  openrouter: 'https://openrouter.ai/api/v1',
} as const;

interface ChatResponse {
  choices?: {
    finish_reason?: string;
    message?: { content?: string | { type?: string; text?: string }[] | null; refusal?: string | null };
  }[];
}

export const callOpenAiCompatible: ProviderCall = async (config, { system, images, text, schema, maxTokens, signal }) => {
  const isOpenRouter = config.provider === 'openrouter';
  const base = config.baseUrl ?? BASE_URLS[isOpenRouter ? 'openrouter' : 'openai'];

  const body: Record<string, unknown> = {
    model: config.model,
    messages: [
      { role: 'system', content: system },
      {
        role: 'user',
        content: [
          ...images.map((img) => ({
            type: 'image_url',
            image_url: { url: `data:${img.media_type};base64,${img.data}`, detail: 'high' },
          })),
          { type: 'text', text },
        ],
      },
    ],
    response_format: { type: 'json_schema', json_schema: { name: 'labellens_output', strict: true, schema } },
  };
  if (isOpenRouter) {
    body.max_tokens = maxTokens;
    // Only route to endpoints that actually enforce the JSON schema.
    body.provider = { require_parameters: true };
  } else {
    body.max_completion_tokens = maxTokens;
  }

  const headers: Record<string, string> = { Authorization: `Bearer ${config.apiKey}` };
  if (isOpenRouter) headers['X-Title'] = 'LabelLens';

  const data = (await postJson(config.provider, `${base}/chat/completions`, headers, body, signal)) as ChatResponse;
  const choice = data.choices?.[0];
  if (!choice?.message) {
    throw new AppError('ai_bad_output', 'The AI service returned an empty response. Please try again.', 502);
  }
  if (choice.message.refusal || choice.finish_reason === 'content_filter') {
    throw new AppError('ai_declined', 'The AI service declined to process this label. Try different photos or text.', 422);
  }
  if (choice.finish_reason === 'length') {
    throw new AppError('ai_truncated', 'The response was cut short. Try again with fewer photos or less text.', 502);
  }
  const content = choice.message.content;
  const textOut = typeof content === 'string' ? content : (content ?? []).map((part) => part.text ?? '').join('');
  return parseJson(textOut);
};
