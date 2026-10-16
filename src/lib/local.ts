import { PROVIDER_NAMES, type AiConfig } from '../../core/ai/types.ts';
import { checkAnalyzeRequest } from '../../core/analysis.ts';
import { AppError } from '../../core/errors.ts';
import { runAnalyze, runExtract } from '../../core/pipeline.ts';
import { SOURCES } from '../../core/sources.ts';
import type { Analysis, AnalyzeRequest, Extraction, ServiceStatus, Source } from '../../shared/types.ts';
import { ApiError } from './api.ts';
import type { PreparedImage } from './image.ts';
import { getCurrent } from './unlock.ts';

// Browser engine for the GitHub Pages build: same pipeline as the server, called directly.

function config(): AiConfig {
  const contents = getCurrent();
  if (!contents) throw new ApiError('locked', 'Unlock LabelLens with the site password first.');
  return { provider: contents.provider, apiKey: contents.apiKey, model: contents.model, baseUrl: null };
}

async function run<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    if (error instanceof AppError) throw new ApiError(error.code, error.message);
    throw error;
  }
}

export function localStatus(): ServiceStatus {
  const contents = getCurrent();
  return {
    ai: Boolean(contents),
    provider: contents ? PROVIDER_NAMES[contents.provider] : null,
    model: contents?.model ?? null,
    problem: contents ? null : 'no_key',
    sources: SOURCES.length,
    limits: { maxImages: 4, maxImageBytes: 5 * 1024 * 1024 },
  };
}

export const localSources = (): Source[] => SOURCES;

export function localExtract(images: PreparedImage[], onStage: (stage: string) => void, signal: AbortSignal): Promise<Extraction> {
  return run(() =>
    runExtract(config(), images.map((img) => ({ media_type: img.mediaType, data: img.base64 })), onStage, signal),
  );
}

export function localAnalyze(request: AnalyzeRequest, onStage: (stage: string) => void, signal: AbortSignal): Promise<Analysis> {
  return run(() => runAnalyze(config(), checkAnalyzeRequest(request), onStage, signal));
}
