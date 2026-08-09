/**
 * Stable error types for `@llm-kit/model-registry`.
 *
 * Every error extends `Error`, sets a stable string `code`, and carries an
 * actionable message. Callers branch on `code`, never on `message` text —
 * messages may be reworded.
 */

export interface ModelCandidate {
  readonly provider: string;
  readonly canonicalId: string;
}

function formatCandidates(candidates: readonly ModelCandidate[]): string {
  return candidates.map((c) => `${c.provider}:${c.canonicalId}`).join(', ');
}

/**
 * Raised by `validateProviderSourceFile` (via the generator and
 * `scripts/verify-pricing-data.ts`) when source data does not match the
 * registry schema. Carries every issue found, not just the first, so a
 * reviewer fixes a source file in one pass.
 */
export class ModelRegistrySchemaError extends Error {
  readonly code = 'SCHEMA_VALIDATION_ERROR';
  readonly issues: readonly string[];

  constructor(issues: readonly string[]) {
    super(
      issues.length === 1
        ? issues[0]
        : `${String(issues.length)} schema validation issue(s):\n${issues.map((i) => `  - ${i}`).join('\n')}`,
    );
    this.name = 'ModelRegistrySchemaError';
    this.issues = issues;
  }
}

/**
 * Raised by `resolveModel` (resolution step 6) when a requested model id
 * matches nothing — not a custom override, not a provider-qualified
 * canonical id or alias, not a globally unambiguous alias (only reachable
 * when no provider was supplied — a provider qualifier is a constraint, not
 * a hint), and no fallback was configured or matched.
 */
export class UnknownModelError extends Error {
  readonly code = 'UNKNOWN_MODEL';
  readonly requestedId: string;
  readonly provider?: string;
  /**
   * Set only when the lookup was provider-qualified and `requestedId` exists
   * under one or more *other* providers — the single most actionable fact
   * for this failure. Sorted, deduplicated, and never the full registry:
   * just the providers that actually carry this id.
   */
  readonly otherProviders?: readonly string[];

  constructor(requestedId: string, provider?: string, otherProviders?: readonly string[]) {
    super(
      provider === undefined
        ? `No model matches "${requestedId}". Pass a provider to qualify the lookup, register a custom override, or configure an explicit fallback.`
        : otherProviders !== undefined && otherProviders.length > 0
          ? `No model matches "${requestedId}" for provider "${provider}" — it exists under ${otherProviders.join(', ')} instead. Pass one of those as the provider, register a custom override, or configure an explicit fallback.`
          : `No model matches "${requestedId}" for provider "${provider}". Check the provider spelling, register a custom override, or configure an explicit fallback.`,
    );
    this.name = 'UnknownModelError';
    this.requestedId = requestedId;
    this.provider = provider;
    if (otherProviders !== undefined && otherProviders.length > 0) {
      this.otherProviders = otherProviders;
    }
  }
}

/**
 * Raised by `resolveModel` whenever a requested model id would resolve to
 * more than one distinct model. Ambiguity is always an error, never a guess —
 * this is the single most important invariant this package enforces, since
 * silently picking one candidate is how a caller gets billed against the
 * wrong model.
 */
export class AmbiguousAliasError extends Error {
  readonly code = 'AMBIGUOUS_ALIAS';
  readonly requestedId: string;
  readonly candidates: readonly ModelCandidate[];

  constructor(requestedId: string, candidates: readonly ModelCandidate[]) {
    super(
      `"${requestedId}" matches more than one model (${formatCandidates(candidates)}). ` +
        'Pass a provider qualifier or a custom override to disambiguate — this id is never resolved by guessing.',
    );
    this.name = 'AmbiguousAliasError';
    this.requestedId = requestedId;
    this.candidates = candidates;
  }
}

/**
 * Model identity `selectPricingPeriod` can be told about, purely so a thrown
 * {@link AmbiguousPricingPeriodError} can name which model's override is
 * broken. `selectPricingPeriod` itself only ever sees a bare
 * `PricingPeriod[]` — it has no descriptor to read this from — so a caller
 * that has one (e.g. `llm-price`'s `selectPeriodOrThrow`, which already
 * holds the full `ModelDescriptor`) passes it through explicitly. Both
 * fields are optional and independent: omitting one still produces a
 * sentence-shaped message, and omitting the whole argument reproduces the
 * exact pre-existing (identity-free) message and error shape.
 */
export interface AmbiguousPricingPeriodIdentity {
  readonly canonicalId?: string;
  readonly provider?: string;
}

/**
 * Raised by `selectPricingPeriod` when more than one pricing period shares
 * the same (latest-qualifying) `effectiveFrom` for a lookup date — an exact
 * tie that array order would otherwise resolve silently. `validateModelDescriptor`
 * rejects overlapping periods (and two periods with the same `effectiveFrom`
 * necessarily overlap), so this cannot happen for the generated registry;
 * it is reachable only through a caller-supplied `ModelDescriptor` (e.g.
 * `llm-price`'s `options.overrides`) that never passed that validator.
 * Ambiguity here is treated the same as an ambiguous alias: this is a money
 * path, and a silent pick between two same-dated prices is exactly the
 * failure mode this package refuses to allow anywhere.
 *
 * `canonicalId`/`provider` are set only when the caller of
 * `selectPricingPeriod` supplied an {@link AmbiguousPricingPeriodIdentity} —
 * `selectPricingPeriod` has no descriptor of its own to read them from. A
 * caller working through many overrides (the case this identity exists for)
 * needs to know *which* one is broken, not just that some period tied;
 * `UnknownModelError`/`AmbiguousAliasError` carry the same kind of stable
 * identity for the same reason.
 */
export class AmbiguousPricingPeriodError extends Error {
  readonly code = 'AMBIGUOUS_PRICING_PERIOD';
  readonly at: string;
  readonly effectiveFrom: string;
  readonly count: number;
  readonly canonicalId?: string;
  readonly provider?: string;

  constructor(
    at: string,
    effectiveFrom: string,
    count: number,
    identity?: AmbiguousPricingPeriodIdentity,
  ) {
    const canonicalId = identity?.canonicalId;
    const provider = identity?.provider;
    const modelLabel =
      canonicalId !== undefined && provider !== undefined
        ? ` for model "${canonicalId}" (provider "${provider}")`
        : canonicalId !== undefined
          ? ` for model "${canonicalId}"`
          : provider !== undefined
            ? ` for provider "${provider}"`
            : '';
    super(
      `${String(count)} pricing periods share effectiveFrom "${effectiveFrom}"${modelLabel}, all covering the lookup date "${at}". ` +
        'Run this override through validateModelDescriptor (or give each period a distinct effectiveFrom, or remove the duplicate) — ' +
        'the registry never guesses between two prices for the same date.',
    );
    this.name = 'AmbiguousPricingPeriodError';
    this.at = at;
    this.effectiveFrom = effectiveFrom;
    this.count = count;
    if (canonicalId !== undefined) {
      this.canonicalId = canonicalId;
    }
    if (provider !== undefined) {
      this.provider = provider;
    }
  }
}

/**
 * Raised by `selectPricingPeriod` when the `at` lookup value cannot be
 * parsed as a date. Distinct from "no period matches" (a normal result,
 * represented by `undefined` — see `pricing-period.ts`), which is not an
 * error.
 */
export class InvalidLookupDateError extends Error {
  readonly code = 'INVALID_LOOKUP_DATE';
  readonly value: string;

  constructor(value: string) {
    super(`"${value}" is not a valid date. Pass an ISO date string or a Date instance.`);
    this.name = 'InvalidLookupDateError';
    this.value = value;
  }
}
