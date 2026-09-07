# usage-tab

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
