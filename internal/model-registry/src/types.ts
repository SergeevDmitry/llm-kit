/**
 * Registry schema — model identity and pricing periods.
 *
 * This is the contract `usage-tab` consumes directly, and that `chat-fit`
 * optionally consumes for context-window helpers. Changing a field here is
 * a breaking change for both packages.
 */

export type ProviderId =
  | 'openai'
  | 'anthropic'
  | 'google'
  | 'azure-openai'
  | 'aws-bedrock'
  | 'groq'
  | 'mistral'
  | 'cohere'
  | 'together'
  | 'openrouter';

/**
 * Every `ProviderId`, in the fixed order the generator sorts by. Also the
 * list of source files `scripts/generate-model-registry.ts` expects under
 * `docs/provider-data/` — one per provider, even if its `models` array is
 * empty pending a reviewed price.
 */
export const PROVIDER_IDS: readonly ProviderId[] = [
  'openai',
  'anthropic',
  'google',
  'azure-openai',
  'aws-bedrock',
  'groq',
  'mistral',
  'cohere',
  'together',
  'openrouter',
];

/**
 * Provenance for a registry entry: where the data came from and when it was
 * last reviewed against that source. Distinct from a pricing period's own
 * `sourceUrl`/`observedAt`, which track the price specifically — a model's
 * identity metadata (context window, capabilities) and its price can be
 * confirmed on different dates.
 */
export interface RegistrySource {
  readonly url: string;
  /** ISO date (YYYY-MM-DD) the data was observed/reviewed. */
  readonly observedAt: string;
  readonly notes?: readonly string[];
}

/**
 * A priced interval for one model. Rates are decimal STRINGS end to end — a
 * price must never pass through a JavaScript `number` on its authoritative
 * path: money must never be calculated with binary floating point.
 * Consumers (e.g. `usage-tab`) parse them into fixed-point integers
 * themselves; this package never does arithmetic on them.
 *
 * A period is active for `effectiveFrom <= at < effectiveTo` — `effectiveTo`
 * is exclusive so a restated price takes over cleanly at midnight of its own
 * effective date, with no shared instant between two periods. Omit
 * `effectiveTo` for the current, open-ended period. See `pricing-period.ts`.
 */
export interface PricingPeriod {
  /** ISO date (YYYY-MM-DD) the period starts being active (inclusive). */
  readonly effectiveFrom: string;
  /** ISO date (YYYY-MM-DD) the period stops being active (exclusive). */
  readonly effectiveTo?: string;
  readonly currency: 'USD';
  readonly unit: 'per-million-tokens';
  readonly input: string;
  readonly output: string;
  readonly cachedInput?: string;
  readonly cacheWrite?: string;
  readonly reasoning?: string;
  /** Multiplier applied to all token usage under the provider's batch API, e.g. `"0.5"` for a 50% discount. */
  readonly batchMultiplier?: string;
  /**
   * `true` when this period records the cheapest of several published
   * pricing tiers for the same model — e.g. Google's <=200k-token prompt-size
   * tier (a higher rate applies above it), or Azure OpenAI's Global
   * deployment + short-context + Standard service tier (Data Zone/Regional
   * deployment, long-context, and Priority Processing each cost more). This
   * schema has no dimension for the tier itself — only a flag that one
   * exists — because the extra dimensions differ per provider (prompt size,
   * deployment region, context length, service tier) and are not uniform
   * enough to model generically. Consumers (`usage-tab`) surface a warning
   * whenever a calculation uses a period with this flag set, since real usage
   * under a different tier costs more than the calculation reports — never
   * omit this on a period whose provider file documents a higher unrecorded
   * tier: accuracy matters more than breadth here, and under-reporting cost
   * is the worst failure a pricing library can make.
   * Omit entirely (never `false`) when the recorded rate is the only
   * published tier.
   */
  readonly cheapestTier?: true;
  /**
   * URL of the authoritative documentation this rate was read from.
   * Mandatory: every pricing period carries a source URL, an observed date,
   * and an effective date.
   */
  readonly sourceUrl: string;
  /** ISO date (YYYY-MM-DD) the rate was observed/reviewed against `sourceUrl`. */
  readonly observedAt: string;
  readonly notes?: readonly string[];
}

export interface ModelDescriptor {
  readonly canonicalId: string;
  readonly provider: ProviderId;
  readonly aliases: readonly string[];
  readonly family?: string;
  readonly tokenizerFamily?: string;
  readonly contextWindow?: number;
  readonly capabilities?: readonly string[];
  readonly pricing?: readonly PricingPeriod[];
  readonly source?: RegistrySource;
}
