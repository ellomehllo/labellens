import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { ANALYZE_SCHEMA, EXTRACT_SCHEMA } from '../prompts.ts';
import { detectProvider, resolveConfig } from './config.ts';
import { callGemini, toTypeUnions } from './gemini.ts';
import { callOpenAiCompatible } from './openai.ts';
import type { AiConfig, StructuredRequest } from './types.ts';

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

interface Captured {
  url: string;
  headers: Record<string, string>;
  body: Record<string, any>;
}

/** Replaces fetch with a queue of canned responses and records each request. */
function stubFetch(...responses: { status?: number; json?: unknown; text?: string }[]): Captured[] {
  const calls: Captured[] = [];
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    calls.push({ url, headers: init.headers as Record<string, string>, body: JSON.parse(String(init.body)) });
    const r = responses[Math.min(calls.length - 1, responses.length - 1)];
    const status = r.status ?? 200;
    return new Response(r.text ?? JSON.stringify(r.json ?? {}), { status });
  }) as typeof fetch;
  return calls;
}

const request: StructuredRequest = {
  system: 'SYSTEM',
  images: [{ media_type: 'image/jpeg', data: 'AAAA' }],
  text: 'Read this label',
  schema: EXTRACT_SCHEMA,
  effort: 'medium',
  maxTokens: 1000,
};
const config = (over: Partial<AiConfig>): AiConfig => ({
  provider: 'openai',
  apiKey: 'sk-test',
  model: 'test-model',
  baseUrl: null,
  ...over,
});
const chat = (message: object, finish_reason = 'stop') => ({ json: { choices: [{ finish_reason, message }] } });

// --- Key detection and configuration -------------------------------------------------------

test('providers are detected from key prefixes', () => {
  assert.equal(detectProvider('sk-ant-api03-abc'), 'anthropic');
  assert.equal(detectProvider('sk-or-v1-abc'), 'openrouter');
  assert.equal(detectProvider('AIzaSyABC'), 'gemini');
  assert.equal(detectProvider('sk-proj-abc'), 'openai');
  assert.equal(detectProvider('sk-svcacct-abc'), 'openai');
  assert.equal(detectProvider('gsk_abc'), null);
});

test('config resolves provider, default model and overrides', () => {
  assert.deepEqual(resolveConfig({}), { ok: false, problem: 'no_key' });
  assert.deepEqual(resolveConfig({ AI_API_KEY: 'gsk_abc' }), { ok: false, problem: 'unknown_key' });

  const openai = resolveConfig({ AI_API_KEY: 'sk-proj-abc' });
  assert.ok(openai.ok && openai.config.provider === 'openai' && openai.config.model === 'gpt-6-astra');

  const named = resolveConfig({ GEMINI_API_KEY: 'unusual-format' });
  assert.ok(named.ok && named.config.provider === 'gemini' && named.config.model === 'gemini-3.8-flash');

  const forced = resolveConfig({ AI_API_KEY: 'gsk_abc', AI_PROVIDER: 'OpenAI', AI_MODEL: 'llama', AI_BASE_URL: 'https://x.test/v1/' });
  assert.ok(forced.ok);
  assert.deepEqual(forced.config, { provider: 'openai', apiKey: 'gsk_abc', model: 'llama', baseUrl: 'https://x.test/v1' });
});

// --- Schemas -------------------------------------------------------------------------------

test('schemas meet OpenAI strict-mode rules', () => {
  const walk = (node: any, path: string) => {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'object') {
      assert.equal(node.additionalProperties, false, `${path} needs additionalProperties: false`);
      assert.deepEqual([...node.required].sort(), Object.keys(node.properties).sort(), `${path} must require every field`);
    }
    for (const [k, v] of Object.entries(node)) walk(v, `${path}.${k}`);
  };
  for (const schema of [EXTRACT_SCHEMA, ANALYZE_SCHEMA]) {
    assert.equal((schema as any).type, 'object');
    assert.equal((schema as any).anyOf, undefined);
    walk(schema, 'root');
  }
});

test('Gemini schemas use type unions instead of anyOf', () => {
  const converted = toTypeUnions(ANALYZE_SCHEMA) as any;
  assert.doesNotMatch(JSON.stringify(converted), /anyOf/);
  assert.deepEqual(converted.properties.product_name.type, ['string', 'null']);
  const confidence = converted.properties.findings.items.properties.confidence;
  assert.deepEqual(confidence.type, ['string', 'null']);
  assert.ok(confidence.enum.includes(null));
});

// --- OpenAI / OpenRouter -------------------------------------------------------------------

test('OpenAI request uses strict JSON schema and data-URL images', async () => {
  const calls = stubFetch(chat({ content: '{"ok":true}' }));
  assert.deepEqual(await callOpenAiCompatible(config({}), request), { ok: true });
  const [call] = calls;
  assert.equal(call.url, 'https://api.openai.com/v1/chat/completions');
  assert.equal(call.headers.Authorization, 'Bearer sk-test');
  assert.equal(call.body.response_format.type, 'json_schema');
  assert.equal(call.body.response_format.json_schema.strict, true);
  assert.equal(call.body.max_completion_tokens, 1000);
  assert.equal(call.body.messages[0].content, 'SYSTEM');
  assert.equal(call.body.messages[1].content[0].image_url.url, 'data:image/jpeg;base64,AAAA');
});

test('OpenRouter routes only to schema-enforcing providers', async () => {
  const calls = stubFetch(chat({ content: '{"ok":1}' }));
  await callOpenAiCompatible(config({ provider: 'openrouter', model: 'anthropic/claude-opus-5.5' }), request);
  assert.equal(calls[0].url, 'https://openrouter.ai/api/v1/chat/completions');
  assert.deepEqual(calls[0].body.provider, { require_parameters: true });
  assert.equal(calls[0].body.max_tokens, 1000);
});

test('custom base URL is used for OpenAI-compatible endpoints', async () => {
  const calls = stubFetch(chat({ content: '{}' }));
  await callOpenAiCompatible(config({ baseUrl: 'https://gateway.test/v1' }), request);
  assert.equal(calls[0].url, 'https://gateway.test/v1/chat/completions');
});

test('OpenAI refusals, truncation and errors map to clear codes', async () => {
  stubFetch(chat({ content: null, refusal: 'no' }));
  await assert.rejects(callOpenAiCompatible(config({}), request), { code: 'ai_declined' });
  stubFetch(chat({ content: '{"a":' }, 'length'));
  await assert.rejects(callOpenAiCompatible(config({}), request), { code: 'ai_truncated' });
  stubFetch({ status: 401, text: '{"error":{"code":"invalid_api_key"}}' });
  await assert.rejects(callOpenAiCompatible(config({}), request), { code: 'ai_auth' });
  stubFetch({ status: 429, text: '{"error":{"code":"insufficient_quota"}}' });
  await assert.rejects(callOpenAiCompatible(config({}), request), { code: 'ai_quota' });
  stubFetch({ status: 404, text: '{"error":{"code":"model_not_found"}}' });
  await assert.rejects(callOpenAiCompatible(config({}), request), { code: 'ai_model' });
});

test('server errors are retried', async () => {
  const calls = stubFetch({ status: 503, text: 'busy' }, chat({ content: '{"ok":true}' }));
  assert.deepEqual(await callOpenAiCompatible(config({}), request), { ok: true });
  assert.equal(calls.length, 2);
});

// --- Gemini --------------------------------------------------------------------------------

const gemini = (candidate: object, extra: object = {}) => ({ json: { candidates: [candidate], ...extra } });

test('Gemini request uses inline images, system instruction and a JSON schema', async () => {
  const calls = stubFetch(
    gemini({ finishReason: 'STOP', content: { parts: [{ text: 'thinking…', thought: true }, { text: '{"ok":true}' }] } }),
  );
  const out = await callGemini(config({ provider: 'gemini', apiKey: 'AIzaTest', model: 'gemini-3.8-flash' }), request);
  assert.deepEqual(out, { ok: true });
  const [call] = calls;
  assert.equal(call.url, 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent');
  assert.equal(call.headers['x-goog-api-key'], 'AIzaTest');
  assert.equal(call.body.systemInstruction.parts[0].text, 'SYSTEM');
  assert.deepEqual(call.body.contents[0].parts[0], { inlineData: { mimeType: 'image/jpeg', data: 'AAAA' } });
  assert.equal(call.body.generationConfig.responseMimeType, 'application/json');
  assert.doesNotMatch(JSON.stringify(call.body.generationConfig.responseJsonSchema), /anyOf/);
});

test('Gemini blocks and truncation map to clear codes', async () => {
  const cfg = config({ provider: 'gemini', apiKey: 'AIzaTest' });
  stubFetch({ json: { promptFeedback: { blockReason: 'SAFETY' } } });
  await assert.rejects(callGemini(cfg, request), { code: 'ai_declined' });
  stubFetch(gemini({ finishReason: 'SAFETY' }));
  await assert.rejects(callGemini(cfg, request), { code: 'ai_declined' });
  stubFetch(gemini({ finishReason: 'MAX_TOKENS', content: { parts: [{ text: '{' }] } }));
  await assert.rejects(callGemini(cfg, request), { code: 'ai_truncated' });
  stubFetch({ status: 400, text: '{"error":{"status":"INVALID_ARGUMENT","details":[{"reason":"API_KEY_INVALID"}]}}' });
  await assert.rejects(callGemini(cfg, request), { code: 'ai_auth' });
});
