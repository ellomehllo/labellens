import { SECTION_LABELS, type Analysis, type AnalyzeRequest, type Extraction, type ImageInput } from '../shared/types.ts';
import { structuredCall } from './ai/index.ts';
import { PROVIDER_NAMES, type AiConfig } from './ai/types.ts';
import { buildAnalysis, normalizeExtraction } from './analysis.ts';
import { ANALYZE_SCHEMA, ANALYZE_SYSTEM, EXTRACT_SCHEMA, EXTRACT_SYSTEM } from './prompts.ts';

// The two LabelLens steps, shared by the Node API and the browser-only (GitHub Pages) build.
// `onStage` is only called when that work actually starts, so progress shown to users is truthful.

type OnStage = (stage: string) => void;

/** Step 1: photos → structured label text. */
export async function runExtract(config: AiConfig, images: ImageInput[], onStage: OnStage, signal?: AbortSignal): Promise<Extraction> {
  onStage('reading_text');
  const raw = await structuredCall(config, {
    system: EXTRACT_SYSTEM,
    images,
    text: `These ${images.length} photo(s) show one product's packaging. Transcribe the label text as instructed.`,
    schema: EXTRACT_SCHEMA,
    effort: 'low', // transcription, not reasoning: keeps label reading fast
    maxTokens: 16000,
    signal,
  });
  onStage('organising_text');
  return normalizeExtraction(raw);
}

/** Step 2: user-checked text → explanation with source-checked findings. Text only, no images. */
export async function runAnalyze(config: AiConfig, request: AnalyzeRequest, onStage: OnStage, signal?: AbortSignal): Promise<Analysis> {
  onStage('interpreting');
  const labelText = request.sections
    .map((s) => {
      const notes = [s.edited ? 'corrected by user' : null, s.confidence ? `read with ${s.confidence} confidence` : null]
        .filter(Boolean)
        .join(', ');
      return `### ${SECTION_LABELS[s.kind]}${notes ? ` (${notes})` : ''}\n${s.text}`;
    })
    .join('\n\n');
  const source =
    request.input === 'photo'
      ? `read from photos (overall readability: ${request.readability ?? 'unknown'})`
      : request.input === 'example'
        ? 'LabelLens example label text'
        : 'typed by the user';

  const raw = await structuredCall(config, {
    system: ANALYZE_SYSTEM,
    images: [],
    text: [
      `Category: ${request.category}`,
      `Market where bought: ${request.market ?? 'unknown'}`,
      `Source of text: ${source}`,
      '',
      '<label_text>',
      labelText,
      '</label_text>',
    ].join('\n'),
    schema: ANALYZE_SCHEMA,
    effort: 'medium',
    maxTokens: 24000,
    signal,
  });
  onStage('checking_sources');
  const analysis = buildAnalysis(raw, request, config.model, PROVIDER_NAMES[config.provider]);
  onStage('checking_wording');
  return analysis;
}
