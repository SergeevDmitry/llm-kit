/**
 * `PriceWarning` constructors — kept out of `calculate-cost.ts` so its main
 * algorithm reads as a sequence of decisions, not a wall of message text.
 */
import type { PriceWarning } from './types.js';

export function unsupportedUsageFieldWarning(field: string): PriceWarning {
  return {
    code: 'UNSUPPORTED_USAGE_FIELD',
    field,
    message: `usage field "${field}" is not recognized and was not priced. It is preserved here rather than silently discarded — if this represents billable tokens, report it under a known LlmUsage field.`,
  };
}

export function cachedExceedsInputWarning(inputTokens: number, subsetTotal: number): PriceWarning {
  return {
    code: 'CACHED_EXCEEDS_INPUT',
    field: 'cachedInputTokens',
    message: `cachedInputTokens + cacheWriteTokens (${String(subsetTotal)}) exceeds inputTokens (${String(inputTokens)}). Ordinary billable input was clamped to 0 rather than going negative; the reported cached/cache-write token counts were still billed in full.`,
  };
}

export function reasoningExceedsOutputWarning(
  outputTokens: number,
  reasoningTokens: number,
): PriceWarning {
  return {
    code: 'REASONING_EXCEEDS_OUTPUT',
    field: 'reasoningTokens',
    message: `reasoningTokens (${String(reasoningTokens)}) exceeds outputTokens (${String(outputTokens)}). Ordinary billable output was clamped to 0 rather than going negative; the reported reasoning token count was still billed in full.`,
  };
}

export function batchPricingUnavailableWarning(
  canonicalModel: string,
  provider: string,
): PriceWarning {
  return {
    code: 'BATCH_PRICING_UNAVAILABLE',
    message: `mode: 'batch' was requested but "${provider}:${canonicalModel}"'s resolved pricing period publishes no batchMultiplier. Standard (non-batch) rates were used instead — this is the higher of the two prices, so the calculation never under-reports.`,
  };
}

export function partialTierPricingWarning(canonicalModel: string, provider: string): PriceWarning {
  return {
    code: 'PARTIAL_TIER_PRICING',
    message: `"${provider}:${canonicalModel}"'s recorded rate is the cheapest of several published pricing tiers for this model (e.g. prompt size, deployment region, context length, or service tier — see the registry entry's notes for which). Real usage billed under a different tier will cost more than this calculation reports.`,
  };
}

export function reasoningPricedAsOutputWarning(
  canonicalModel: string,
  provider: string,
): PriceWarning {
  return {
    code: 'REASONING_PRICED_AS_OUTPUT',
    field: 'reasoningTokens',
    message: `"${provider}:${canonicalModel}" reported reasoning tokens but its pricing period publishes no dedicated reasoning rate. Billed at the output rate instead of being dropped, so the calculation never under-reports — but the real reasoning-token rate, if the provider publishes one, may differ.`,
  };
}

export function cachedInputPricedAsInputWarning(
  canonicalModel: string,
  provider: string,
): PriceWarning {
  return {
    code: 'CACHED_INPUT_PRICED_AS_INPUT',
    field: 'cachedInputTokens',
    message: `"${provider}:${canonicalModel}" reported cached input tokens but its pricing period publishes no dedicated cachedInput rate. Billed at the ordinary input rate instead of being dropped — the real cached rate, almost always cheaper, is not reflected, so this calculation may over-report for this line, never under-report.`,
  };
}

export function cacheWritePricedAsInputWarning(
  canonicalModel: string,
  provider: string,
): PriceWarning {
  return {
    code: 'CACHE_WRITE_PRICED_AS_INPUT',
    field: 'cacheWriteTokens',
    message: `"${provider}:${canonicalModel}" reported cache-write tokens but its pricing period publishes no dedicated cacheWrite rate. Billed at the ordinary input rate instead of being dropped — the real cache-write rate, usually a premium over input, is not reflected, so this calculation may under-report for this line.`,
  };
}
