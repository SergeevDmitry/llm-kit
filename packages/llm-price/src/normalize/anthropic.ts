/**
 * Structural adapter for Anthropic's usage shape. Field names only; this
 * file never imports the `@anthropic-ai/sdk` package.
 *
 * Anthropic's `input_tokens` is the ordinary (non-cached, non-write)
 * portion only — `cache_creation_input_tokens` and `cache_read_input_tokens`
 * are reported *additionally*, not as a subset of `input_tokens` the way
 * OpenAI's `cached_tokens` is a subset of `prompt_tokens`. This is exactly
 * the case where this package's default "cached/cache-write are subsets of
 * inputTokens" contract does not hold in the provider's raw shape, so
 * `normalizeAnthropicUsage` sums the three into `LlmUsage.inputTokens` so the
 * default "cached/cache-write are subsets of inputTokens" contract holds
 * uniformly for every caller of `calculateCost`, regardless of which
 * provider's raw shape it came from.
 */
import { InvalidUsageError } from '../errors.js';
import type { LlmUsage, NormalizedUsageResult, PriceWarning } from '../types.js';
import { unsupportedUsageFieldWarning } from '../warnings.js';
import { assertUsageObject, isPlainObject, readNumber } from './support.js';

const KNOWN_TOP_LEVEL = new Set([
  'input_tokens',
  'output_tokens',
  'cache_creation_input_tokens',
  'cache_read_input_tokens',
  'cache_creation',
]);

const KNOWN_CACHE_CREATION_FIELDS = new Set([
  'ephemeral_5m_input_tokens',
  'ephemeral_1h_input_tokens',
]);

export function normalizeAnthropicUsage(value: unknown): NormalizedUsageResult {
  const obj = assertUsageObject(value, 'normalizeAnthropicUsage');
  const adapterName = 'normalizeAnthropicUsage';

  const baseInputTokens = readNumber(obj, 'input_tokens', adapterName);
  const outputTokens = readNumber(obj, 'output_tokens', adapterName);
  if (baseInputTokens === undefined || outputTokens === undefined) {
    throw new InvalidUsageError(
      'normalizeAnthropicUsage expected numeric "input_tokens" and "output_tokens".',
    );
  }

  const cachedInputTokens = readNumber(obj, 'cache_read_input_tokens', adapterName);

  // Anthropic's prompt-caching docs (see below) confirm current responses
  // report cache-write tokens BOTH ways at once: the aggregate
  // `cache_creation_input_tokens` field AND the per-TTL breakdown
  // (`cache_creation.ephemeral_5m_input_tokens` / `.ephemeral_1h_input_tokens`),
  // with `cache_creation_input_tokens` documented as equal to the sum of the
  // `cache_creation` object's values:
  //
  //   "Note that the current cache_creation_input_tokens field equals the
  //   sum of the values in the cache_creation object."
  //   — https://platform.claude.com/docs/en/build-with-claude/prompt-caching
  //   (fetched 2026-08-06), whose example response carries both fields in
  //   the same `usage` object:
  //   { "cache_creation_input_tokens": 248, "cache_creation": { "ephemeral_5m_input_tokens": 148, "ephemeral_1h_input_tokens": 100 }, ... }
  //
  // This package's schema has one `cacheWrite` field per pricing period, not
  // one per TTL (see `docs/provider-data/anthropic.json`'s notes), so the
  // per-TTL buckets are only summed into `cacheWriteTokens` as a *fallback*
  // when the aggregate field is absent — `cache_creation_input_tokens` is
  // preferred when present, since the docs guarantee it is already the sum.
  //
  // The unknown-key scan over `cache_creation`, however, must NOT be gated
  // on that fallback: since both fields routinely co-occur, gating the scan
  // on `cacheWriteTokens === undefined` would mean the scan never runs in
  // the common case, and a future TTL bucket Anthropic adds to
  // `cache_creation` (something other than the two known
  // `ephemeral_*_input_tokens` fields) would go unreported. So the scan runs
  // whenever `cache_creation` is present, independent of whether the
  // aggregate field was also present.
  let cacheWriteTokens = readNumber(obj, 'cache_creation_input_tokens', adapterName);
  const warnings: PriceWarning[] = [];
  // `cache_creation` is itself a known field: absent or `null` is absent,
  // like every other field this adapter reads, but present-and-not-an-object
  // is malformed — it must not silently fall through to "no per-TTL data",
  // which would drop a cache-write signal without a warning.
  if (obj.cache_creation !== undefined && obj.cache_creation !== null) {
    if (!isPlainObject(obj.cache_creation)) {
      throw new InvalidUsageError(
        `${adapterName} expected "cache_creation" to be an object, received ${typeof obj.cache_creation}.`,
      );
    }
    const creation = obj.cache_creation;
    if (cacheWriteTokens === undefined) {
      const fiveMinute = readNumber(creation, 'ephemeral_5m_input_tokens', adapterName) ?? 0;
      const oneHour = readNumber(creation, 'ephemeral_1h_input_tokens', adapterName) ?? 0;
      if (fiveMinute > 0 || oneHour > 0) cacheWriteTokens = fiveMinute + oneHour;
    }
    for (const key of Object.keys(creation)) {
      if (!KNOWN_CACHE_CREATION_FIELDS.has(key)) {
        warnings.push(unsupportedUsageFieldWarning(`cache_creation.${key}`));
      }
    }
  }

  const inputTokens = baseInputTokens + (cachedInputTokens ?? 0) + (cacheWriteTokens ?? 0);

  const usage: LlmUsage = {
    inputTokens,
    outputTokens,
    ...(cachedInputTokens !== undefined ? { cachedInputTokens } : {}),
    ...(cacheWriteTokens !== undefined ? { cacheWriteTokens } : {}),
  };

  for (const key of Object.keys(obj)) {
    if (!KNOWN_TOP_LEVEL.has(key)) warnings.push(unsupportedUsageFieldWarning(key));
  }

  return { usage, warnings };
}
