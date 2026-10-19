import { AppError } from '../errors.ts';
import { parseJson, postJson } from './http.ts';
import type { ProviderCall } from './types.ts';

// Google Gemini generateContent with a JSON-schema response.

const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';
const BLOCKED = new Set(['SAFETY', 'PROHIBITED_CONTENT', 'BLOCKLIST', 'SPII', 'RECITATION', 'IMAGE_SAFETY']);

interface GeminiResponse {
  promptFeedback?: { blockReason?: string };
  candidates?: { finishReason?: string; content?: { parts?: { text?: string; thought?: boolean }[] } }[];
}

export const callGemini: ProviderCall = async (config, { system, images, text, schema, effort, maxTokens, signal }) => {
  const base = config.baseUrl ?? BASE_URL;
  const body = {
    systemInstruction: { parts: [{ text: system }] },
    contents: [
      {
        role: 'user',
        parts: [...images.map((img) => ({ inlineData: { mimeType: img.media_type, data: img.data } })), { text }],
      },
    ],
    generationConfig: {
      responseMimeType: 'application/json',
      responseJsonSchema: toTypeUnions(schema),
      maxOutputTokens: maxTokens,
      // Gemini 3 models think before answering (medium or high by default), which is slow for plain
      // transcription; the request's effort sets the level.
      thinkingConfig: { thinkingLevel: effort },
    },
  };

  const url = `${base}/models/${encodeURIComponent(config.model)}:generateContent`;
  const data = (await postJson('gemini', url, { 'x-goog-api-key': config.apiKey }, body, signal)) as GeminiResponse;

  if (data.promptFeedback?.blockReason) {
    throw new AppError('ai_declined', 'The AI service declined to process this label. Try different photos or text.', 422);
  }
  const candidate = data.candidates?.[0];
  if (!candidate) throw new AppError('ai_bad_output', 'The AI service returned an empty response. Please try again.', 502);
  if (candidate.finishReason && BLOCKED.has(candidate.finishReason)) {
    throw new AppError('ai_declined', 'The AI service declined to process this label. Try different photos or text.', 422);
  }
  if (candidate.finishReason === 'MAX_TOKENS') {
    throw new AppError('ai_truncated', 'The response was cut short. Try again with fewer photos or less text.', 502);
  }
  const out = (candidate.content?.parts ?? [])
    .filter((p) => !p.thought)
    .map((p) => p.text ?? '')
    .join('');
  return parseJson(out);
};

/**
 * Gemini documents nullable fields as type unions (["string", "null"]) rather than anyOf,
 * so `anyOf: [X, {type: "null"}]` is rewritten into X with "null" added to its type (and enum).
 */
export function toTypeUnions(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(toTypeUnions);
  if (!node || typeof node !== 'object') return node;
  const obj = node as Record<string, unknown>;
  const anyOf = obj.anyOf;
  if (Array.isArray(anyOf) && anyOf.length === 2) {
    const nullIndex = anyOf.findIndex((s) => (s as { type?: unknown })?.type === 'null');
    const other = anyOf[1 - nullIndex] as Record<string, unknown> | undefined;
    if (nullIndex !== -1 && other && typeof other.type === 'string') {
      const merged: Record<string, unknown> = { ...(toTypeUnions(other) as object), type: [other.type, 'null'] };
      if (Array.isArray(other.enum)) merged.enum = [...other.enum, null];
      return merged;
    }
  }
  return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, toTypeUnions(v)]));
}
