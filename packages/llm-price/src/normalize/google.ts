/**
 * Structural adapter for Google Gemini's `usageMetadata` shape. Field names
 * only; this file never imports `@google/genai` or `@google/generative-ai`.
 *
 * Gemini's `candidatesTokenCount` excludes `thoughtsTokenCount` — thought
 * (reasoning) tokens are billed and reported separately, never folded into
 * the candidates count the way OpenAI folds `reasoning_tokens` into
 * `completion_tokens`. This is the mirror case of `normalizeAnthropicUsage`:
 * to give every caller of `calculateCost` the same "reasoning is a subset of
 * outputTokens" default, this adapter *adds*
 * `thoughtsTokenCount` into `LlmUsage.outputTokens` so `calculateCost`'s
 * subtraction recovers exactly `candidatesTokenCount` as ordinary output.
 * `cachedContentTokenCount`, by contrast, genuinely is a subset of
 * `promptTokenCount` already, so `inputTokens` needs no adjustment.
 */
import { InvalidUsageError } from '../errors.js';
import type { LlmUsage, NormalizedUsageResult, PriceWarning } from '../types.js';
import { unsupportedUsageFieldWarning } from '../warnings.js';
import { assertUsageObject, readNumber } from './support.js';

const KNOWN_TOP_LEVEL = new Set([
  'promptTokenCount',
  'candidatesTokenCount',
  'totalTokenCount',
  'cachedContentTokenCount',
  'thoughtsTokenCount',
]);

export function normalizeGoogleUsage(value: unknown): NormalizedUsageResult {
  const obj = assertUsageObject(value, 'normalizeGoogleUsage');
  const adapterName = 'normalizeGoogleUsage';

  const inputTokens = readNumber(obj, 'promptTokenCount', adapterName);
  const candidatesTokenCount = readNumber(obj, 'candidatesTokenCount', adapterName);
  if (inputTokens === undefined || candidatesTokenCount === undefined) {
    throw new InvalidUsageError(
      'normalizeGoogleUsage expected numeric "promptTokenCount" and "candidatesTokenCount" (Gemini usageMetadata).',
    );
  }

  const cachedInputTokens = readNumber(obj, 'cachedContentTokenCount', adapterName);
  const reasoningTokens = readNumber(obj, 'thoughtsTokenCount', adapterName);
  const outputTokens = candidatesTokenCount + (reasoningTokens ?? 0);

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
