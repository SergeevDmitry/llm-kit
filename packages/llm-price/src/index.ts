/**
 * llm-price — public entry point.
 *
 * Turns normalized (or provider-raw, via an adapter) LLM usage into a
 * reproducible cost breakdown against versioned, dated, committed pricing
 * data (`@llm-kit/model-registry`, bundled into this package at build time).
 * No runtime network fetch, ever; every price is
 * estimated from committed data, not an invoice. See `README.md`.
 */

export { calculateCost } from './calculate-cost.js';
export { resolveModel } from './resolve-model.js';
export { createPriceCalculator } from './calculator.js';
export { createPriceOverride } from './overrides.js';

export {
  NoPricingPeriodError,
  InvalidUsageError,
  InvalidTokenCountError,
  InvalidRateError,
} from './errors.js';

// Re-exported unchanged from `@llm-kit/model-registry` (bundled into this
// package): this package's own `resolveModel` delegates to it directly, so
// it throws these same classes — a caller catching by `code` never needs to
// know which package actually threw.
export {
  AmbiguousAliasError,
  UnknownModelError,
  InvalidLookupDateError,
  type ModelCandidate,
} from '@llm-kit/model-registry';

export { normalizeOpenAIUsage } from './normalize/openai.js';
export { normalizeAnthropicUsage } from './normalize/anthropic.js';
export { normalizeGoogleUsage } from './normalize/google.js';
export { normalizeOpenAICompatibleUsage } from './normalize/openai-compatible.js';

export type {
  LlmUsage,
  PriceMode,
  PriceRequest,
  CostLine,
  CostBreakdown,
  PriceWarning,
  PriceWarningCode,
  NormalizedUsageResult,
  ResolveModelOptions,
  ResolvedModel,
  PriceOptions,
  PriceCalculatorOptions,
  PriceCalculator,
  CustomPriceInput,
} from './types.js';

// Re-exported types this package's public API is built on (bundled, never
// published on their own — this is the only way to reach them):
export type {
  ModelDescriptor,
  PricingPeriod,
  ProviderId,
  RegistrySource,
} from '@llm-kit/model-registry';
export { MODEL_REGISTRY, REGISTRY_VERSION } from '@llm-kit/model-registry';
