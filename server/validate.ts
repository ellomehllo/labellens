import { randomUUID } from 'node:crypto';
import {
  CATEGORIES,
  CONFIDENCE,
  FINDING_TYPES,
  LIMITS,
  RELEVANCE,
  SECTION_KINDS,
  type Analysis,
  type AnalyzeRequest,
  type Category,
  type Confidence,
  type Evidence,
  type Extraction,
  type Finding,
  type InputKind,
  type SectionKind,
} from '../shared/types.ts';
import { AppError } from './errors.ts';
import { findPoint } from './sources.ts';

type Json = Record<string, unknown>;

const isObj = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v);
const oneOf = <T extends string>(list: readonly T[], v: unknown, fallback: T): T =>
  list.includes(v as T) ? (v as T) : fallback;
const text = (v: unknown, max = 2000): string => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const textOrNull = (v: unknown, max = 2000): string | null => text(v, max) || null;
const textList = (v: unknown, max = 20, each = 500): string[] =>
  Array.isArray(v) ? v.map((x) => text(x, each)).filter(Boolean).slice(0, max) : [];

// ---------------------------------------------------------------------------
// Uploaded images
// ---------------------------------------------------------------------------

export interface CheckedImage {
  media_type: 'image/jpeg' | 'image/png' | 'image/webp';
  data: string;
}

const MAGIC: Record<CheckedImage['media_type'], (b: Buffer) => boolean> = {
  'image/jpeg': (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  'image/png': (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  'image/webp': (b) => b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP',
};

export function checkImages(body: unknown): CheckedImage[] {
  const images = isObj(body) ? body.images : null;
  if (!Array.isArray(images) || images.length === 0) {
    throw new AppError('no_images', 'Add at least one photo of the label.', 400);
  }
  if (images.length > LIMITS.maxImages) {
    throw new AppError('too_many_images', `You can send up to ${LIMITS.maxImages} photos at a time.`, 400);
  }
  return images.map((img, i) => {
    const mediaType = isObj(img) ? img.media_type : null;
    const data = isObj(img) ? img.data : null;
    if (typeof mediaType !== 'string' || !(mediaType in MAGIC) || typeof data !== 'string') {
      throw new AppError('invalid_file', `Photo ${i + 1} isn’t a JPEG, PNG or WebP image.`, 400);
    }
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(data)) {
      throw new AppError('invalid_file', `Photo ${i + 1} couldn’t be read.`, 400);
    }
    const bytes = Buffer.from(data, 'base64');
    if (bytes.length > LIMITS.maxImageBytes) {
      throw new AppError('file_too_large', `Photo ${i + 1} is larger than ${LIMITS.maxImageBytes / 1024 / 1024} MB.`, 413);
    }
    const type = mediaType as CheckedImage['media_type'];
    if (bytes.length < 100 || !MAGIC[type](bytes)) {
      throw new AppError('invalid_file', `Photo ${i + 1} doesn’t look like a valid image file.`, 400);
    }
    return { media_type: type, data };
  });
}

// ---------------------------------------------------------------------------
// Step 1 output
// ---------------------------------------------------------------------------

export function normalizeExtraction(raw: unknown): Extraction {
  if (!isObj(raw)) throw new AppError('ai_bad_output', 'The label reader returned an unexpected response.', 502);
  const merged = new Map<SectionKind, Extraction['sections'][number]>();
  for (const s of Array.isArray(raw.sections) ? raw.sections : []) {
    if (!isObj(s)) continue;
    const body = text(s.text, LIMITS.maxSectionChars);
    if (!body) continue;
    const kind = oneOf(SECTION_KINDS, s.kind, 'other');
    const confidence = oneOf(CONFIDENCE, s.confidence, 'low');
    const existing = merged.get(kind);
    if (existing) {
      existing.text = `${existing.text}\n${body}`.slice(0, LIMITS.maxSectionChars);
      existing.uncertain.push(...textList(s.uncertain_parts));
      existing.confidence = worse(existing.confidence ?? 'low', confidence);
    } else {
      merged.set(kind, { id: randomUUID(), kind, text: body, confidence, uncertain: textList(s.uncertain_parts), edited: false });
    }
  }
  const order = (k: SectionKind) => SECTION_KINDS.indexOf(k);
  return {
    readability: oneOf(['good', 'fair', 'poor'] as const, raw.readability, 'fair'),
    image_issues: textList(raw.image_issues, 10),
    not_a_label: raw.not_a_label === true,
    sections: [...merged.values()].sort((a, b) => order(a.kind) - order(b.kind)),
    category: oneOf(CATEGORIES, raw.category, 'other'),
    category_confidence: oneOf(CONFIDENCE, raw.category_confidence, 'low'),
    market: textOrNull(raw.market, 60),
    market_basis: textOrNull(raw.market_basis, 300),
    notes: textList(raw.notes, 10),
  };
}

function worse(a: Confidence, b: Confidence): Confidence {
  return CONFIDENCE.indexOf(a) > CONFIDENCE.indexOf(b) ? a : b;
}

// ---------------------------------------------------------------------------
// Step 2 input
// ---------------------------------------------------------------------------

export function checkAnalyzeRequest(body: unknown): AnalyzeRequest {
  if (!isObj(body) || !Array.isArray(body.sections)) {
    throw new AppError('bad_request', 'Missing label text.', 400);
  }
  const sections = body.sections
    .filter(isObj)
    .slice(0, LIMITS.maxSections)
    .map((s) => ({
      kind: oneOf(SECTION_KINDS, s.kind, 'other'),
      text: text(s.text, LIMITS.maxSectionChars),
      confidence: s.confidence === null ? null : oneOf(CONFIDENCE, s.confidence, 'low'),
      edited: s.edited === true,
    }))
    .filter((s) => s.text);
  const total = sections.reduce((n, s) => n + s.text.length, 0);
  if (sections.length === 0 || total < 3) {
    throw new AppError('empty_text', 'There’s no label text to analyze yet. Add or correct the text first.', 400);
  }
  if (total > LIMITS.maxTotalChars) {
    throw new AppError('text_too_long', 'That’s more text than one label usually has. Trim it and try again.', 413);
  }
  const market = textOrNull(body.market, 60);
  return {
    sections,
    category: oneOf(CATEGORIES, body.category, 'other'),
    market: market === 'other' ? null : market,
    input: oneOf<InputKind>(['photo', 'typed', 'example'], body.input, 'typed'),
    readability: body.readability === null ? null : oneOf(['good', 'fair', 'poor'] as const, body.readability, 'fair'),
  };
}

// ---------------------------------------------------------------------------
// Step 2 output: resolve evidence, enforce the safety rules, fill metadata
// ---------------------------------------------------------------------------

// Absolute safety verdicts the product principles rule out. Quoted label text is exempt.
const ABSOLUTE_CLAIMS = [
  /\b(?:completely|totally|perfectly|entirely|absolutely|100%|guaranteed(?: to be)?)\s+(?:safe|harmless|non-?toxic|risk-?free)\b/i,
  /\bsafe for (?:everyone|anyone|all ages|all people)\b/i,
  /\b(?:no|zero) (?:health )?risks? (?:at all|whatsoever)\b/i,
  /\b(?:this|the) product is (?:safe|unsafe|dangerous|toxic|harmful|poisonous)\b/i,
  /\b(?:is|are) (?:toxic|poisonous|dangerous|harmful) (?:to|for) (?:everyone|anyone|humans|people)\b/i,
];

interface SafetyLog {
  edits: number;
}

/** Removes sentences that state absolute safety verdicts. Returns the cleaned text. */
function enforceNoVerdicts(input: string, log: SafetyLog): string {
  const sentences = input.split(/(?<=[.!?])\s+/);
  const kept = sentences.filter((s) => !ABSOLUTE_CLAIMS.some((re) => re.test(s.replace(/"[^"]*"|“[^”]*”/g, ''))));
  if (kept.length === sentences.length) return input;
  log.edits += sentences.length - kept.length;
  return kept.join(' ');
}

export function buildAnalysis(raw: unknown, req: AnalyzeRequest, model: string, provider: string | null = null): Analysis {
  if (!isObj(raw)) throw new AppError('ai_bad_output', 'The analysis came back in an unexpected format.', 502);
  const log: SafetyLog = { edits: 0 };
  const clean = (v: unknown, max = 2000) => enforceNoVerdicts(text(v, max), log);
  const retrievedAt = new Map<string, string>();
  let dropped = 0;

  const findings: Finding[] = [];
  for (const f of Array.isArray(raw.findings) ? raw.findings.slice(0, 16) : []) {
    if (!isObj(f)) continue;
    const title = text(f.title, 160);
    const explanation = clean(f.explanation);
    if (!title || !explanation) continue;

    const evidence: Evidence[] = [];
    const seen = new Set<string>();
    for (const e of Array.isArray(f.evidence) ? f.evidence : []) {
      const hit = isObj(e) ? findPoint(String(e.source_id), String(e.point_id)) : null;
      if (!hit) {
        dropped++;
        continue;
      }
      const key = `${hit.source.id}/${hit.point.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      retrievedAt.set(hit.source.id, hit.source.checked);
      evidence.push({
        source_id: hit.source.id,
        title: hit.source.title,
        publisher: hit.source.publisher,
        url: hit.source.url,
        jurisdiction: hit.source.jurisdiction,
        published_or_updated_at: hit.source.updated,
        retrieved_at: hit.source.checked,
        supports_claim: hit.point.text,
      });
    }

    let type = oneOf(FINDING_TYPES, f.type, 'interpretation');
    let whyUnverified = textOrNull(f.why_unverified, 500);
    const limitations = textList(f.limitations, 6);
    if (type === 'verified_claim' && evidence.length === 0) {
      // A "verified" claim with no resolvable source is downgraded, never shown as verified.
      type = 'unverified';
      whyUnverified ??= 'No source in LabelLens’s curated list directly supports this statement.';
    }
    if (type === 'unverified') whyUnverified ??= 'Not enough evidence was available to check this statement.';
    if (type !== 'unverified') whyUnverified = null;

    const marketLimit = jurisdictionLimit(evidence, req.market);
    if (marketLimit && !limitations.includes(marketLimit)) limitations.push(marketLimit);

    findings.push({
      id: randomUUID(),
      title,
      explanation,
      type,
      relevance: oneOf(RELEVANCE, f.relevance, 'informational'),
      confidence: type === 'label_fact' ? null : f.confidence === null ? null : oneOf(CONFIDENCE, f.confidence, 'medium'),
      label_quote: textOrNull(f.label_quote, 600),
      limitations,
      evidence,
      why_unverified: whyUnverified,
    });
  }

  const groups = (Array.isArray(raw.ingredient_groups) ? raw.ingredient_groups : [])
    .filter(isObj)
    .slice(0, 12)
    .map((g) => ({
      group: text(g.group, 80) || 'Ingredients',
      items: (Array.isArray(g.items) ? g.items : [])
        .filter(isObj)
        .slice(0, 60)
        .map((i) => ({
          name: text(i.name, 120),
          explanation: clean(i.explanation, 400),
          confidence: oneOf(CONFIDENCE, i.confidence, 'medium') as Confidence,
        }))
        .filter((i) => i.name),
    }))
    .filter((g) => g.items.length > 0);

  const summary = clean(raw.summary, 800);
  if (!summary && findings.length === 0) {
    throw new AppError('ai_empty', 'The analysis came back empty. Check the label text and try again.', 502);
  }

  const overall = textList(raw.overall_limitations, 8);
  if (log.edits > 0) {
    overall.push('An automatic check removed wording that stated an absolute safety verdict, which a label alone can’t support.');
  }
  if (req.input === 'example') {
    overall.unshift('This analysis is of LabelLens’s example label text, not a real product photo.');
  }

  return {
    product: {
      name: textOrNull(raw.product_name, 160),
      brand: textOrNull(raw.brand, 120),
      category: req.category as Category,
      market: req.market,
    },
    summary: summary || 'LabelLens couldn’t write a summary for this text. See the details below.',
    category_note: textOrNull(raw.category_note, 300),
    label_facts: (Array.isArray(raw.label_facts) ? raw.label_facts : [])
      .filter(isObj)
      .slice(0, 20)
      .map((x) => ({ field: text(x.field, 80), value: text(x.value, 800) }))
      .filter((x) => x.field && x.value),
    findings,
    ingredient_groups: groups,
    unreadable_or_missing: textList(raw.unreadable_or_missing, 10),
    overall_limitations: overall,
    next_steps: textList(raw.next_steps, 5),
    meta: {
      model,
      provider,
      analyzed_at: new Date().toISOString(),
      input: req.input,
      readability: req.readability,
      safety_edits: log.edits,
      dropped_references: dropped,
    },
  };
}

const MARKET_JURISDICTION: Record<string, string> = {
  US: 'United States',
  CA: 'Canada',
  EU: 'European Union',
};

function jurisdictionLimit(evidence: Evidence[], market: string | null): string | null {
  const regional = [...new Set(evidence.map((e) => e.jurisdiction).filter((j) => j !== 'International'))];
  if (regional.length === 0) return null;
  const marketName = market ? MARKET_JURISDICTION[market] : undefined;
  if (marketName && regional.every((j) => j === marketName)) return null;
  const where = market ? 'the market you selected' : 'every market';
  return `The cited source${regional.length > 1 ? 's describe' : ' describes'} ${regional.join(' and ')} guidance, which may not apply in ${where}.`;
}
