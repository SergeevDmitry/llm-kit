/**
 * Public types.
 */
import type { ModelDescriptor, ModelMatchKind, ProviderId } from '@llm-kit/model-registry';

/**
 * Normalized token usage for one request. `inputTokens` and `outputTokens`
 * are the *total* reported counts; `cachedInputTokens` and `cacheWriteTokens`
 * are subsets of `inputTokens`, and `reasoningTokens` is a subset of
 * `outputTokens`, unless a specific provider adapter documents otherwise
 * — see `normalize/anthropic.ts` and `normalize/google.ts`
 * for the two adapters that must add rather than assume a subset relationship
 * in the provider's own raw shape.
 */
export interface LlmUsage {
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly cachedInputTokens?: number;
  readonly cacheWriteTokens?: number;
  readonly reasoningTokens?: number;
}

export type PriceMode = 'standard' | 'batch';

export interface PriceRequest {
  /** The id you have — a canonical id or an alias, from any provider. */
  readonly model: string;
  /**
   * Qualifies resolution to one provider (resolution steps 2–3). Omit to
   * resolve globally (step 4). `calculateCost` also accepts a provider
   * qualifier on its `options` bag (`PriceOptions.provider`, useful when a
   * `PriceCalculator` was built with a default) — when both are supplied,
   * `request.provider` takes precedence. Either channel populates
   * `CostBreakdown.requestedProvider`, so it is never a way to tell which
   * one was used.
   */
  readonly provider?: ProviderId | string;
  /**
   * Already-normalized usage, or a raw value structurally close enough to
   * `LlmUsage` to be used directly (numeric `inputTokens`/`outputTokens`).
   * Anything else — a raw OpenAI/Anthropic/Google response object — must go
   * through the matching `normalize*Usage` adapter first; `calculateCost`
   * never guesses a provider's field names for you.
   */
  readonly usage: LlmUsage | unknown;
  /** `'batch'` applies the resolved period's `batchMultiplier` when one is published; falls back to standard pricing (with a warning) otherwise. */
  readonly mode?: PriceMode;
  /** Effective date for pricing-period selection. Defaults to `new Date()`. */
  readonly at?: Date | string;
}

export interface CostLine {
  /** Token count this line was billed against. */
  readonly tokens: number;
  /** The decimal USD-per-million-tokens rate actually applied, after any batch multiplier. */
  readonly rate: string;
  readonly costUsd: number;
  readonly costUsdExact: string;
}

export type PriceWarningCode =
  | 'UNSUPPORTED_USAGE_FIELD'
  | 'CACHED_EXCEEDS_INPUT'
  | 'REASONING_EXCEEDS_OUTPUT'
  | 'BATCH_PRICING_UNAVAILABLE'
  | 'PARTIAL_TIER_PRICING'
  | 'REASONING_PRICED_AS_OUTPUT'
  | 'CACHED_INPUT_PRICED_AS_INPUT'
  | 'CACHE_WRITE_PRICED_AS_INPUT';

/**
 * A non-fatal condition surfaced alongside a `CostBreakdown` — the same rule
 * that keeps unsupported usage fields visible as warnings, never silently
 * discarded, extended to every other place this package must not
 * fail silently. Always JSON-serializable. Never a substitute for an error:
 * anything that would make the reported cost meaningless (an unresolvable
 * model, no priced period for the lookup date) throws instead of warning —
 * see `errors.ts`.
 */
export interface PriceWarning {
  readonly code: PriceWarningCode;
  readonly message: string;
  /** Usage or pricing field the warning concerns, when applicable. */
  readonly field?: string;
}

export interface CostBreakdown {
  /** The id exactly as requested. */
  readonly model: string;
  /** The resolved registry entry's canonical id — may differ from `model` when `model` was an alias. */
  readonly canonicalModel: string;
  readonly provider: string;
  /**
   * How `model` was matched (registry resolution steps 1–5 — see
   * `ResolveModelOptions`/`resolveModel`). Surfaced so a caller can tell a
   * plain provider-qualified match (`'canonical-qualified'`/`'alias-scoped'`)
   * apart from one that only succeeded via an explicitly configured
   * `fallback` — the one remaining path (by design, not an oversight: see
   * README "Edge cases and limitations") where `provider` can legitimately
   * differ from the `provider` you requested.
   */
  readonly matchedBy: ModelMatchKind;
  /** The provider qualifier exactly as requested, when one was supplied on either `request.provider` or `options.provider` (see `PriceRequest.provider`). Compare against `provider` to notice a `fallback` match that landed on a different provider. */
  readonly requestedProvider?: string;
  readonly currency: 'USD';
  readonly input: CostLine;
  readonly output: CostLine;
  readonly cachedInput?: CostLine;
  readonly cacheWrite?: CostLine;
  readonly reasoning?: CostLine;
  /** Ergonomic numeric total. Not the authoritative value — see `totalUsdExact`. */
  readonly totalUsd: number;
  /** Exact decimal string total, computed with integer/BigInt fixed-point arithmetic — the authoritative value; never derived from binary floating point. */
  readonly totalUsdExact: string;
  /** Content hash of the pricing data used (`@llm-kit/model-registry`'s `REGISTRY_VERSION`), independent of this package's own npm version. */
  readonly registryVersion: string;
  /** `effectiveFrom` of the pricing period actually used. */
  readonly pricingEffectiveFrom: string;
  readonly warnings: readonly PriceWarning[];
}

/** Return shape of every `normalize*Usage` adapter (and the internal generic fallback). */
export interface NormalizedUsageResult {
  readonly usage: LlmUsage;
  readonly warnings: readonly PriceWarning[];
}

export interface ResolveModelOptions {
  readonly provider?: ProviderId | string;
  readonly overrides?: readonly ModelDescriptor[];
  readonly fallback?: string;
  /** Registry to resolve against. Defaults to the bundled `MODEL_REGISTRY`; overriding is mainly for tests. */
  readonly registry?: readonly ModelDescriptor[];
}

export interface ResolvedModel {
  readonly descriptor: ModelDescriptor;
  readonly matchedBy: ModelMatchKind;
  readonly requestedId: string;
  readonly requestedProvider?: string;
}

/**
 * `PriceOptions.provider` and `PriceRequest.provider` are the same
 * qualifier on two channels — see `PriceRequest.provider`'s doc comment for
 * the precedence rule `calculateCost` applies between them.
 */
export type PriceOptions = ResolveModelOptions;

export interface PriceCalculatorOptions {
  readonly overrides?: readonly ModelDescriptor[];
  readonly fallback?: string;
  readonly registry?: readonly ModelDescriptor[];
}

export interface PriceCalculator {
  calculateCost(request: PriceRequest, options?: PriceOptions): CostBreakdown;
  resolveModel(model: string, options?: ResolveModelOptions): ResolvedModel;
}

/** Input to `createPriceOverride` — a simplified way to build one custom `ModelDescriptor` without hand-writing the full registry shape. */
export interface CustomPriceInput {
  readonly canonicalId: string;
  /**
   * Defaults to `'custom'`. Typed as a plain `string`, not `ProviderId` —
   * unlike registry source data (schema-validated against the baseline
   * provider list), a custom override may represent a negotiated deal with a
   * vendor outside that list, and `resolveModel` never enforces `ProviderId`
   * at runtime, only at the registry-generation boundary.
   */
  readonly provider?: string;
  readonly aliases?: readonly string[];
  readonly family?: string;
  readonly contextWindow?: number;
  readonly input: string;
  readonly output: string;
  readonly cachedInput?: string;
  readonly cacheWrite?: string;
  readonly reasoning?: string;
  readonly batchMultiplier?: string;
  /** ISO date. Defaults to `'1970-01-01'` (always active). */
  readonly effectiveFrom?: string;
  readonly effectiveTo?: string;
  readonly sourceUrl?: string;
  /** ISO date. Defaults to `effectiveFrom`. */
  readonly observedAt?: string;
  readonly notes?: readonly string[];
}
