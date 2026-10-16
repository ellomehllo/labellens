import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { AnalyzeRequest } from '../shared/types.ts';
import { buildAnalysis, checkAnalyzeRequest, normalizeExtraction } from './analysis.ts';

const request: AnalyzeRequest = {
  sections: [{ kind: 'ingredients', text: 'Oats, honey', confidence: 'high', edited: false }],
  category: 'food',
  market: 'US',
  input: 'photo',
  readability: 'good',
};

const finding = (over: Record<string, unknown>) => ({
  title: 'A finding',
  explanation: 'An explanation.',
  type: 'interpretation',
  relevance: 'informational',
  confidence: 'high',
  label_quote: null,
  limitations: [],
  evidence: [],
  why_unverified: null,
  ...over,
});

test('verified claims resolve to registry metadata', () => {
  const out = buildAnalysis(
    {
      summary: 'A cereal.',
      findings: [finding({ type: 'verified_claim', evidence: [{ source_id: 'fda-food-allergies', point_id: 'may-contain' }] })],
    },
    request,
    'test-model',
  );
  const ev = out.findings[0].evidence[0];
  assert.equal(out.findings[0].type, 'verified_claim');
  assert.equal(ev.url, 'https://www.fda.gov/food/nutrition-food-labeling-and-critical-foods/food-allergies');
  assert.equal(ev.retrieved_at, '2026-10-17');
  assert.match(ev.supports_claim, /voluntary/);
});

test('verified claims with unknown references are downgraded to unverified', () => {
  const out = buildAnalysis(
    {
      summary: 'A cereal.',
      findings: [finding({ type: 'verified_claim', evidence: [{ source_id: 'made-up', point_id: 'x' }] })],
    },
    request,
    'test-model',
  );
  assert.equal(out.findings[0].type, 'unverified');
  assert.equal(out.findings[0].evidence.length, 0);
  assert.ok(out.findings[0].why_unverified);
  assert.equal(out.meta.dropped_references, 1);
});

test('absolute safety verdicts are removed but quoted label text is kept', () => {
  const out = buildAnalysis(
    {
      summary: 'This is a toothpaste. This product is completely safe for everyone. The label says "keep out of reach of children".',
      findings: [finding({ explanation: 'The label states "100% safe formula". It is used twice daily.' })],
    },
    request,
    'test-model',
  );
  assert.doesNotMatch(out.summary, /completely safe/);
  assert.match(out.summary, /keep out of reach/);
  assert.match(out.findings[0].explanation, /100% safe formula/);
  assert.equal(out.meta.safety_edits, 1);
  assert.ok(out.overall_limitations.some((l) => /absolute safety/.test(l)));
});

test('non-matching jurisdiction adds a limitation', () => {
  const out = buildAnalysis(
    {
      summary: 'A cereal.',
      findings: [finding({ type: 'verified_claim', evidence: [{ source_id: 'fda-food-allergies', point_id: 'nine-major' }] })],
    },
    { ...request, market: 'IN' },
    'test-model',
  );
  assert.ok(out.findings[0].limitations.some((l) => /United States/.test(l)));
});

test('extraction merges repeated section kinds and keeps the lower confidence', () => {
  const out = normalizeExtraction({
    readability: 'fair',
    sections: [
      { kind: 'ingredients', text: 'Water, glycerin', confidence: 'high', uncertain_parts: [] },
      { kind: 'ingredients', text: 'Parf[?]m', confidence: 'medium', uncertain_parts: ['Parf[?]m'] },
      { kind: 'nonsense', text: 'Hello', confidence: 'high', uncertain_parts: [] },
    ],
    category: 'cosmetics',
    category_confidence: 'high',
    market: null,
  });
  const ingredients = out.sections.find((s) => s.kind === 'ingredients');
  assert.equal(ingredients?.confidence, 'medium');
  assert.match(ingredients?.text ?? '', /Parf\[\?\]m/);
  assert.equal(out.sections.find((s) => s.text === 'Hello')?.kind, 'other');
});

test('analyze requests need some text', () => {
  assert.throws(() => checkAnalyzeRequest({ sections: [{ kind: 'ingredients', text: '  ' }] }), /no label text/);
  assert.equal(checkAnalyzeRequest({ sections: [{ kind: 'warnings', text: 'Keep away from eyes' }], market: 'other' }).market, null);
});
