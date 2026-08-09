/**
 * Stable error types this package throws directly. `resolveModel` and
 * `calculateCost` also propagate `AmbiguousAliasError`, `UnknownModelError`,
 * and `InvalidLookupDateError` unchanged from `@llm-kit/model-registry` (see
 * `index.ts`) — they are not redefined here, so a caller catching by `code`
 * only ever deals with one class per code, regardless of which package threw
 * it.
 *
 * Every error extends `Error`, sets a stable string `code`, and carries an
 * actionable message. Normal conditions —
 * an unsupported usage field, a period recording only the cheapest of
 * several tiers — are `PriceWarning`s (see `types.ts`), not exceptions;
 * these classes are reserved for conditions where the reported cost would
 * otherwise be meaningless or silently wrong.
 */

/**
 * Raised by `calculateCost` when `selectPricingPeriod` finds no period
 * covering the lookup date — including a lookup date that precedes the
 * first known period for a model. Returning a zero or default cost here
 * would be exactly the silent under-reporting this package exists to
 * prevent, so this is a thrown error, never a warning.
 */
export class NoPricingPeriodError extends Error {
  readonly code = 'NO_PRICING_PERIOD';
  readonly canonicalModel: string;
  readonly provider: string;
  readonly at: string;

  constructor(canonicalModel: string, provider: string, at: string) {
    super(
      `No pricing period for "${provider}:${canonicalModel}" covers ${at}. ` +
        'Either the requested date precedes every known period for this model, or the model has no pricing data at all.',
    );
    this.name = 'NoPricingPeriodError';
    this.canonicalModel = canonicalModel;
    this.provider = provider;
    this.at = at;
  }
}

/**
 * Raised when `PriceRequest.usage` is neither an `LlmUsage`-shaped object
 * (numeric `inputTokens`/`outputTokens`) nor something a `normalize*Usage`
 * adapter already turned into one. `calculateCost` never guesses a raw
 * provider response's field names — call the matching adapter first.
 */
export class InvalidUsageError extends Error {
  readonly code = 'INVALID_USAGE';

  constructor(reason: string) {
    super(
      `Invalid usage: ${reason} Pass an LlmUsage object ({ inputTokens, outputTokens, ... }), ` +
        'or normalize a raw provider response first with normalizeOpenAIUsage/normalizeAnthropicUsage/normalizeGoogleUsage/normalizeOpenAICompatibleUsage.',
    );
    this.name = 'InvalidUsageError';
  }
}

/**
 * Raised when a token count is negative, non-integer, or not a JS safe
 * integer. Very large aggregate token counts are expected to work up to
 * `Number.MAX_SAFE_INTEGER`; beyond that, or below zero, or fractional, the
 * count is rejected rather than silently coerced.
 */
export class InvalidTokenCountError extends Error {
  readonly code = 'INVALID_TOKEN_COUNT';
  readonly field: string;
  readonly value: number;

  constructor(field: string, value: number) {
    super(
      `usage.${field} must be a non-negative safe integer, received ${String(value)}. ` +
        'Negative, fractional, or unsafely large token counts are rejected rather than silently coerced.',
    );
    this.name = 'InvalidTokenCountError';
    this.field = field;
    this.value = value;
  }
}

/**
 * Raised when a pricing-period rate string does not parse as an exact
 * non-negative decimal. Registry data is validated at generation time
 * (`@llm-kit/model-registry`'s schema), so this only fires for a malformed
 * `createPriceOverride`/custom `ModelDescriptor` supplied at the call site.
 */
export class InvalidRateError extends Error {
  readonly code = 'INVALID_RATE';
  readonly field: string;
  readonly value: string;

  constructor(field: string, value: string) {
    super(
      `Pricing field "${field}" must be a non-negative decimal string (e.g. "3.00"), received ${JSON.stringify(value)}.`,
    );
    this.name = 'InvalidRateError';
    this.field = field;
    this.value = value;
  }
}
