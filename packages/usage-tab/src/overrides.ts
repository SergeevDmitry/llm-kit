/**
 * Custom/negotiated pricing overrides — an exact custom override is the
 * highest-precedence resolution step.
 */
import type { ModelDescriptor, PricingPeriod, ProviderId } from '@llm-kit/model-registry';
import type { CustomPriceInput } from './types.js';

/**
 * Builds a single-period `ModelDescriptor` from a simplified rate shape, for
 * passing as `options.overrides` to `calculateCost`/`resolveModel`/
 * `createPriceCalculator` — without hand-writing the full registry schema
 * (`sourceUrl`, `observedAt`, etc. are given sensible, deterministic
 * defaults rather than reading the system clock, so the result is a pure
 * function of its input).
 */
export function createPriceOverride(input: CustomPriceInput): ModelDescriptor {
  const effectiveFrom = input.effectiveFrom ?? '1970-01-01';
  const period: PricingPeriod = {
    effectiveFrom,
    ...(input.effectiveTo !== undefined ? { effectiveTo: input.effectiveTo } : {}),
    currency: 'USD',
    unit: 'per-million-tokens',
    input: input.input,
    output: input.output,
    ...(input.cachedInput !== undefined ? { cachedInput: input.cachedInput } : {}),
    ...(input.cacheWrite !== undefined ? { cacheWrite: input.cacheWrite } : {}),
    ...(input.reasoning !== undefined ? { reasoning: input.reasoning } : {}),
    ...(input.batchMultiplier !== undefined ? { batchMultiplier: input.batchMultiplier } : {}),
    sourceUrl: input.sourceUrl ?? 'urn:usage-tab:custom-override',
    observedAt: input.observedAt ?? effectiveFrom,
    ...(input.notes !== undefined ? { notes: input.notes } : {}),
  };

  return {
    canonicalId: input.canonicalId,
    // `ModelDescriptor.provider` is typed `ProviderId` for registry source
    // data (schema-validated against the baseline provider list); an
    // override is not registry source data, and `resolveModel` never checks
    // this field against `PROVIDER_IDS` at runtime, so a negotiated deal
    // with an unlisted vendor is free to use any label here.
    provider: (input.provider ?? 'custom') as ProviderId,
    aliases: input.aliases ?? [],
    ...(input.family !== undefined ? { family: input.family } : {}),
    ...(input.contextWindow !== undefined ? { contextWindow: input.contextWindow } : {}),
    pricing: [period],
  };
}
