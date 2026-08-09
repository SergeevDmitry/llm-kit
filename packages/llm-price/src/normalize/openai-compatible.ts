/**
 * Structural adapter for OpenAI-compatible chat-completions APIs (Groq,
 * Together AI, Mistral's La Plateforme, and similar) — the same
 * `prompt_tokens`/`completion_tokens` shape OpenAI popularized, but leniently:
 * these providers don't always nest cached-token counts under
 * `prompt_tokens_details` the way OpenAI does, so this adapter also accepts
 * a flat top-level `cached_tokens` and DeepSeek-style
 * `prompt_cache_hit_tokens`. Field names only; no provider SDK import.
 */
import { InvalidUsageError } from '../errors.js';
import type { LlmUsage, NormalizedUsageResult, PriceWarning } from '../types.js';
import { unsupportedUsageFieldWarning } from '../warnings.js';
import { assertUsageObject, readNestedNumber, readNumber } from './support.js';

const KNOWN_TOP_LEVEL = new Set([
  'prompt_tokens',
  'completion_tokens',
  'total_tokens',
  'prompt_tokens_details',
  'completion_tokens_details',
  'cached_tokens',
  'prompt_cache_hit_tokens',
  'prompt_cache_miss_tokens',
]);

export function normalizeOpenAICompatibleUsage(value: unknown): NormalizedUsageResult {
  const obj = assertUsageObject(value, 'normalizeOpenAICompatibleUsage');
  const adapterName = 'normalizeOpenAICompatibleUsage';

  const inputTokens = readNumber(obj, 'prompt_tokens', adapterName);
  const outputTokens = readNumber(obj, 'completion_tokens', adapterName);
  if (inputTokens === undefined || outputTokens === undefined) {
    throw new InvalidUsageError(
      'normalizeOpenAICompatibleUsage expected numeric "prompt_tokens" and "completion_tokens".',
    );
  }

  const cachedInputTokens =
    readNestedNumber(obj, 'prompt_tokens_details', 'cached_tokens', adapterName) ??
    readNumber(obj, 'cached_tokens', adapterName) ??
    readNumber(obj, 'prompt_cache_hit_tokens', adapterName);
  const reasoningTokens = readNestedNumber(
    obj,
    'completion_tokens_details',
    'reasoning_tokens',
    adapterName,
  );

  const usage: LlmUsage = {
    inputTokens,
    outputTokens,
    ...(cachedInputTokens !== undefined ? { cachedInputTokens } : {}),
    ...(reasoningTokens !== undefined ? { reasoningTokens } : {}),
  };

  const warnings: PriceWarning[] = [];
  for (const key of Object.keys(obj)) {
    if (!KNOWN_TOP_LEVEL.has(key)) warnings.push(unsupportedUsageFieldWarning(key));
  }

  return { usage, warnings };
}
