/**
 * Internal fallback normalizer for `PriceRequest.usage: LlmUsage | unknown`.
 *
 * This is deliberately *not* one of the four provider adapters
 * (`normalizeOpenAIUsage`, etc.) and is not part of this package's public
 * surface. Its only job is to let `calculateCost` accept a value that is
 * already `LlmUsage`-shaped (numeric `inputTokens`/`outputTokens`) — whether
 * constructed by hand or produced by a provider adapter — while surfacing
 * any extra, unrecognized own-enumerable properties as warnings rather than
 * silently discarding them. It never attempts to guess a
 * raw provider response's field names (e.g. `prompt_tokens`); that is what
 * the named adapters in this directory are for.
 */
import { InvalidUsageError } from '../errors.js';
import type { LlmUsage, NormalizedUsageResult, PriceWarning } from '../types.js';
import { unsupportedUsageFieldWarning } from '../warnings.js';
import { describeValue, isPlainObject } from './support.js';

const KNOWN_FIELDS = new Set([
  'inputTokens',
  'outputTokens',
  'cachedInputTokens',
  'cacheWriteTokens',
  'reasoningTokens',
]);

/**
 * Reads `obj[key]`, treating absent/`null` as absent and throwing
 * `InvalidUsageError` for any other non-numeric type. Unlike the provider
 * adapters' `readNumber` (`./support.ts`), this does not additionally reject
 * `NaN`/`Infinity`/negative/fractional values that are already
 * `typeof 'number'` — `calculateCost`'s own `validateUsage` already rejects
 * those with the more specific `InvalidTokenCountError`, and every value
 * that reaches this function is about to be handed straight to
 * `calculateCost`, so duplicating that check here would only relabel an
 * already-correctly-classified error.
 */
function readNumericField(obj: Record<string, unknown>, key: string): number | undefined {
  const raw = obj[key];
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw !== 'number') {
    throw new InvalidUsageError(
      `expected "${key}" to be a number, received ${typeof raw} ${describeValue(raw)}.`,
    );
  }
  return raw;
}

export function normalizeRequestUsage(value: LlmUsage | unknown): NormalizedUsageResult {
  if (!isPlainObject(value)) {
    throw new InvalidUsageError(`expected an object, received ${typeof value}.`);
  }

  const inputTokens = readNumericField(value, 'inputTokens');
  const outputTokens = readNumericField(value, 'outputTokens');
  if (inputTokens === undefined || outputTokens === undefined) {
    throw new InvalidUsageError(
      'expected numeric "inputTokens" and "outputTokens" fields, found none.',
    );
  }
  const cachedInputTokens = readNumericField(value, 'cachedInputTokens');
  const cacheWriteTokens = readNumericField(value, 'cacheWriteTokens');
  const reasoningTokens = readNumericField(value, 'reasoningTokens');

  const usage: LlmUsage = {
    inputTokens,
    outputTokens,
    ...(cachedInputTokens !== undefined ? { cachedInputTokens } : {}),
    ...(cacheWriteTokens !== undefined ? { cacheWriteTokens } : {}),
    ...(reasoningTokens !== undefined ? { reasoningTokens } : {}),
  };

  const warnings: PriceWarning[] = [];
  for (const key of Object.keys(value)) {
    if (!KNOWN_FIELDS.has(key)) warnings.push(unsupportedUsageFieldWarning(key));
  }

  return { usage, warnings };
}
