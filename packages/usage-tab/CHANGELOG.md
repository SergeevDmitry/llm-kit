# usage-tab

## 1.3.0

### Minor Changes

- a721a5f: Refresh every provider's pricing data (observed 2026-10-03) and add the models released since the last pass. 152 models to 172.

  **Azure now charges OpenAI's first-party price for `gpt-5.6-sol`, `gpt-5.6-terra` and `gpt-5.6-luna`.** Azure cut sol from $5.00/$30.00 to $4.00/$20.00, terra from $2.50/$15.00 to $2.00/$12.00 and luna from $1.00/$6.00 to $0.20/$1.20 per million tokens. The new rates apply from 2026-10-03. Lookups dated earlier still return the prices observed then, so luna on 2026-08-05 is still 5x apart. The README's headline example now uses `gemma-4-31b`, which costs 2.5x more on Together than on AWS Bedrock today.

  **Retired models are removed**, so a lookup for them now throws `UNKNOWN_MODEL` at any date; price historical usage for them with an override. They are Mistral's `devstral-2`, `devstral-small-2`, `magistral-medium`, `magistral-small`, `mistral-nemo`, `mixtral-8x7b` and `mixtral-8x22b`; Groq's `llama-3.1-8b-instant`, `llama-3.3-70b-versatile` and `qwen3.6-27b`; and Cohere's `aya-expanse-8b`.

  `gemini-omni-1.1-flash` and `gemini-omni-flash-preview` record the $9.00 text output rate and carry a `PARTIAL_TIER_PRICING` warning, because video output costs $17.50 per million tokens. `openai:gpt-3.5-turbo` loses its batch rate, since OpenAI's Batch table no longer lists it: a batch request for it is priced at standard rates with a `BATCH_PRICING_UNAVAILABLE` warning.

  Other price changes: `together:qwen3.7-max` rose from $1.25/$3.75 to $1.50/$4.50, and `together:qwen3.8-flash` fell from $0.15/$0.47 to $0.09/$0.28.

  New models: `claude-opus-5-5`, `claude-sonnet-5-5`; `gpt-6.1-sol`, `gpt-6-sol`, `gpt-6-luna`, `chat-latest`, `gpt-5.3-codex`, `gpt-5-search-api`, `gpt-rosalind-research`, `gpt-5.6-cyber`, `gpt-5.5-cyber`; `gemini-3-flash-preview`, `gemini-omni-1.1-flash`, `gemini-omni-flash-preview`, `gemini-robotics-er-2-preview`, `gemini-robotics-er-2-streaming-preview`; `gpt-6-astra` on Azure; `gemma-4-26b-a4b`, `gemma-4-e2b`, `gemma-3-4b` and `nemotron-3-nano-30b` on Bedrock; `command-r7b-12-2024` and `command-r-08-2024` on Cohere; `zai-glm-5-3` on Mistral; seven more on Together.

  Newly published rates fill in fields that were missing:

  - `cacheWrite` on four OpenAI models and OpenRouter's Gemini entry, so their cache writes are priced at the published rate instead of the input rate with a warning.
  - `cachedInput` on `gemini-3.5-flash-lite`, five Together models and four Mistral models.
  - `batchMultiplier` on five Mistral models and on Azure's `gpt-4-turbo` and `gpt-4`.

- c5113e6: `createPriceCalculator` accepts a default `provider`.

  An id registered under several providers, such as `gpt-5.6-luna` under `openai` and `azure-openai`, used to throw `AmbiguousAliasError` unless every call repeated the qualifier. A per-call `options.provider` or `request.provider` still takes precedence, and the default is a hard constraint like either of them: an id the provider does not list throws `UnknownModelError`.

### Patch Changes

- b94effd: `normalizeAnthropicUsage` now warns with `CACHE_WRITE_TTL_NOT_MODELED` when a response reports 1-hour cache writes.

  The registry records one cache-write rate per model, the 5-minute TTL rate. A 1-hour write costs more (2x input against 1.25x), so those tokens were under-priced with no warning. The cost is unchanged; the warning now says it is low. `cache_creation.ephemeral_5m_input_tokens` and `ephemeral_1h_input_tokens` are also validated when `cache_creation_input_tokens` is present, so a malformed value throws `InvalidUsageError` instead of being ignored.

- ac175df: `normalizeOpenAICompatibleUsage` now warns about unrecognized fields inside `prompt_tokens_details` and `completion_tokens_details`, matching `normalizeOpenAIUsage`.

  It used to check top-level keys only, so a token class a gateway added inside a details object, such as `image_tokens`, went unpriced with no warning.

## 1.2.0

### Minor Changes

- 97a1ce9: Refresh every provider's pricing data (observed 2026-09-07) and add the models released since the last pass. 123 models to 152.

  **Correction: `anthropic:claude-sonnet-5` was over-reported by 50% for any date from 2026-09-01.** The previous snapshot modelled Anthropic's announced increase to $3.00/$15.00 per million tokens as a real pricing period. Anthropic's pricing page now states that increase will not occur and the $2.00/$10.00 launch rate is the standard price, so the period is removed - a rate that never took effect must not be reachable at any lookup date.

  Other price changes: `openai:gpt-5.6-sol` cut from $5.00/$30.00 to $4.00/$20.00 (Azure's resale of the same model did not follow, so it is now a confirmed divergence); `google:gemini-3.6-flash` moved to a promotional $0.75/$3.75 published as running through 2026-12-31, with the standard $1.50/$7.50 resuming 2027-01-01.

  New models: `claude-fable-5-1`, `claude-mythos-5-1`, `claude-mythos-5` and six legacy Claude models Anthropic still publishes rates for; `gpt-6-astra`; `gemini-3.8-flash`, `gemini-3.7-flash`, `gemini-3.1-flash-lite`; `qwen3.8-27b` on Groq; `zai-glm-5-2` on Mistral; eleven more on Together; `gemma-3-27b`, `gemma-3-12b` and `nemotron-3-super-120b` on Bedrock.

  Newly published per-model detail fills in fields previously omitted for want of a source: `cachedInput` on eight Gemini models, three Mistral models and three OpenRouter models, `cacheWrite` on OpenRouter's Claude entry, and `batchMultiplier` on the two Gemini Pro models, three Mistral models and OpenAI's `-pro` tiers. The `UNCERTAIN` flag on `openrouter:anthropic/claude-sonnet-5` is withdrawn: the rate it questioned turned out to be correct.

## 1.1.0

### Minor Changes

- 6b8eca2: Add `sumExactUsd` and `createCostAggregator` — exact totals across many requests. The exact decimal channel previously dead-ended at a single request's `totalUsdExact`: a caller wanting a daily or monthly figure — the package's namesake use case — either wrote `sum += breakdown.totalUsd`, reintroducing float drift at exactly the boundary the package pushed them past, or hand-parsed decimal strings. Both new functions sum on the same `bigint` fixed-point path every individual cost is already computed with, and reject anything that is not a non-negative decimal string (`InvalidRateError`) rather than coercing it. `createCostAggregator` also reports `count`, per-model totals keyed by resolved `provider:canonicalModel`, and every distinct `registryVersion` the aggregate drew on, so a total that silently mixes pricing snapshots is visible.

  Also fix `parseDecimalRate` throwing a raw `TypeError`, outside the package's error taxonomy, for a non-string rate that reached it past the type — a hand-built override or a JSON round-trip. `RegExp.test` stringifies its argument, so a numeric `1.5` passed the decimal pattern and then failed on `indexOf`. It now throws `InvalidRateError` like every other malformed rate.

- da64bf2: Read every ISO `at` string as UTC, including the offset-less form. `calculateCost` passed `at` to `Date.parse`, where a datetime without a UTC offset (`"2026-09-01T05:00:00"` — a log timestamp, a `datetime-local` input, several DB drivers) is local time by specification, while an ISO date and an offset-carrying datetime are both UTC. Pricing periods start at UTC midnight, so the local-time reading landed on either side of a price restatement depending on the host: the identical historical lookup priced at $12.00 in one deployment and $18.00 in another, silently breaking the reproducibility a dated, committed price registry exists to provide. Such values are now normalized to UTC — the reading every other accepted ISO form already got — rather than inheriting the process's timezone. The same normalization applies to `effectiveFrom`/`effectiveTo` on a caller-supplied override, which never passed through the registry's schema validation.

  Non-ISO strings (`"2026/09/01"`, `"September 1, 2026"`) are implementation-defined rather than specified, so there is no single reading to normalize them to; they still go to `Date.parse` unchanged, and the documentation now says to pass a `Date` or an ISO form instead.

  Also fix an invalid `Date` in `at` escaping the error taxonomy: building the `InvalidLookupDateError` called `toISOString()`, which throws on an invalid date, so callers saw an uncoded `RangeError` instead. It now throws `InvalidLookupDateError` (`INVALID_LOOKUP_DATE`) like the equivalent string.

### Patch Changes

- 3cbd4c7: Fix a provider-qualified lookup silently resolving duplicate entries by array order instead of reporting ambiguity. When two caller-supplied `overrides` (or two entries of a caller-supplied registry) shared the same `provider` and `canonicalId` — the shape produced by merging an org-wide price list with a team's — the exact-canonical step took whichever came first, so the identical request could price differently depending on concatenation order. Supplying the provider qualifier, which the documentation tells callers to do, therefore made ambiguity detection weaker than the unqualified lookup, which already raised `AMBIGUOUS_ALIAS`. Both channels now raise `AMBIGUOUS_ALIAS` with every duplicate listed as a candidate. Well-formed data, where provider and canonical id are unique, is unaffected.
