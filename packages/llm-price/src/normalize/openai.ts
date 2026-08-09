/**
 * Structural adapter for OpenAI's usage shape — both the Chat Completions
 * form (`prompt_tokens`/`completion_tokens`) and the newer Responses API
 * form (`input_tokens`/`output_tokens`). Field names only; this file never
 * imports the `openai` SDK.
 *
 * OpenAI's `completion_tokens`/`output_tokens` already *includes* reasoning
 * tokens as a subset (confirmed by OpenAI's own usage docs for the o-series
 * and GPT-5 reasoning models), matching this package's default "reasoning is
 * a subset of outputTokens" contract — no arithmetic is needed here to make
 * it a subset; `calculateCost` performs the subtraction.
 */
import { InvalidUsageError } from '../errors.js';
import type { LlmUsage, NormalizedUsageResult, PriceWarning } from '../types.js';
import { unsupportedUsageFieldWarning } from '../warnings.js';
import { assertUsageObject, isPlainObject, readNestedNumber, readNumber } from './support.js';

const KNOWN_TOP_LEVEL = new Set([
  'prompt_tokens',
  'completion_tokens',
  'input_tokens',
  'output_tokens',
  'total_tokens',
  'prompt_tokens_details',
  'completion_tokens_details',
  'input_tokens_details',
  'output_tokens_details',
]);

const KNOWN_DETAIL_FIELDS = new Set([
  'cached_tokens',
  'reasoning_tokens',
  'audio_tokens',
  'accepted_prediction_tokens',
  'rejected_prediction_tokens',
]);

export function normalizeOpenAIUsage(value: unknown): NormalizedUsageResult {
  const obj = assertUsageObject(value, 'normalizeOpenAIUsage');
  const adapterName = 'normalizeOpenAIUsage';

  const inputTokens =
    readNumber(obj, 'prompt_tokens', adapterName) ?? readNumber(obj, 'input_tokens', adapterName);
  const outputTokens =
    readNumber(obj, 'completion_tokens', adapterName) ??
    readNumber(obj, 'output_tokens', adapterName);
  if (inputTokens === undefined || outputTokens === undefined) {
    throw new InvalidUsageError(
      'normalizeOpenAIUsage expected numeric "prompt_tokens"/"completion_tokens" (Chat Completions) or "input_tokens"/"output_tokens" (Responses API).',
    );
  }

  const cachedInputTokens =
    readNestedNumber(obj, 'prompt_tokens_details', 'cached_tokens', adapterName) ??
    readNestedNumber(obj, 'input_tokens_details', 'cached_tokens', adapterName);
  const reasoningTokens =
    readNestedNumber(obj, 'completion_tokens_details', 'reasoning_tokens', adapterName) ??
    readNestedNumber(obj, 'output_tokens_details', 'reasoning_tokens', adapterName);

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
  for (const detailKey of [
    'prompt_tokens_details',
    'completion_tokens_details',
    'input_tokens_details',
    'output_tokens_details',
  ]) {
    const details = obj[detailKey];
    if (!isPlainObject(details)) continue;
    for (const key of Object.keys(details)) {
      if (!KNOWN_DETAIL_FIELDS.has(key))
        warnings.push(unsupportedUsageFieldWarning(`${detailKey}.${key}`));
    }
  }

  return { usage, warnings };
}
