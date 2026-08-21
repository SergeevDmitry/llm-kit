# usage-tab

Turn provider usage objects into a reproducible cost breakdown, from committed pricing data — never a guess.

[![npm](https://img.shields.io/npm/v/usage-tab.svg)](https://www.npmjs.com/package/usage-tab)
[![CI](https://github.com/SergeevDmitry/llm-kit/actions/workflows/ci.yml/badge.svg)](https://github.com/SergeevDmitry/llm-kit/actions/workflows/ci.yml)
[![zero dependencies](https://img.shields.io/badge/dependencies-0-brightgreen)](https://www.npmjs.com/package/usage-tab?activeTab=dependencies)

## The problem

Providers report token usage in incompatible shapes and price input, output,
cached, and batch tokens differently — and the same model name can mean two
different prices depending on who resells it. Pricing `"gpt-5.6-luna"`
without saying which provider you mean is not a rounding error: it is a 5x
swing, and the obvious fix (just pick one) is exactly the bug this package
exists to prevent.

## Before / after

```ts
import { calculateCost, AmbiguousAliasError } from 'usage-tab';

const usage = { inputTokens: 1_000_000, outputTokens: 1_000_000 };

// Azure genuinely resells this OpenAI model at a different price — not a
// typo, independently confirmed against Microsoft's live Retail Prices API.
const onAzure = calculateCost({ model: 'gpt-5.6-luna', provider: 'azure-openai', usage });
const onOpenAI = calculateCost({ model: 'gpt-5.6-luna', provider: 'openai', usage });

console.log(onAzure.totalUsdExact); // "7.00"  ($1.00/$6.00 per million tokens)
console.log(onOpenAI.totalUsdExact); // "1.40"  ($0.20/$1.20 per million tokens)
// Azure is 5x OpenAI's first-party rate for the identical model name.

// The naive fix — price "gpt-5.6-luna" without saying which provider —
// doesn't silently pick one. It throws.
try {
  calculateCost({ model: 'gpt-5.6-luna', usage });
} catch (error) {
  console.log(error instanceof AmbiguousAliasError); // true
  console.log((error as AmbiguousAliasError).code); // "AMBIGUOUS_ALIAS"
}
```

## Install

```text
npm install usage-tab
```

## Minimal usage

```ts
import { calculateCost } from 'usage-tab';

const result = calculateCost({
  model: 'gpt-5',
  provider: 'openai',
  usage: { inputTokens: 12_400, outputTokens: 850, cachedInputTokens: 9_600 },
});

result.totalUsd; // 0.0132        — ergonomic number, for display/dashboards
result.totalUsdExact; // "0.0132" — exact decimal string, for accounting
result.input; // { tokens: 2800, rate: "1.25", costUsd: 0.0035, costUsdExact: "0.0035" }
result.warnings; // readonly PriceWarning[] — empty here, never silently dropped when non-empty
```

> **These numbers are estimates, not invoices.** `usage-tab` computes what a
> request costs against pricing data this package committed and cited on a
> specific date (see [Data freshness](#data-freshness-and-effective-dates)
> below) — not what a provider actually billed you. For your real bill, use
> your provider's own invoice or usage dashboard. Treat every `CostBreakdown`
> as an estimate for budgeting, attribution, and comparison, never as a
> reconciliation source.

## Guarantees

- **Money is never binary floating point on the authoritative path.**
  Rates are parsed from decimal strings
  exactly, token counts are multiplied as integers, and the entire
  calculation — including summing input, output, cached, cache-write, and
  reasoning lines — is exact `bigint` arithmetic with a power-of-ten
  denominator, so it never needs to round. `totalUsd` is an ergonomic
  `number`; `totalUsdExact` is the authoritative decimal string.
- **An alias that matches more than one model always throws, never guesses.**
  The registry deliberately contains cross-provider collisions (the same
  open-weight model hosted by several providers, Azure reselling OpenAI
  models) — `AmbiguousAliasError` (`AMBIGUOUS_ALIAS`) is how you find out you
  need a provider qualifier, not a silently wrong bill.
- **Cached and cache-write tokens are never double-counted.** Ordinary
  billable input is `inputTokens` minus the reported cached/cache-write
  subsets, clamped at zero rather than going negative — the same rule
  applies to reasoning tokens against `outputTokens`.
- **Under-reporting cost never happens silently.** A model whose recorded
  rate is the cheapest of several published pricing tiers (Google's
  prompt-size tiers, Azure's deployment/context-length/service-tier
  dimensions) always carries a `PARTIAL_TIER_PRICING` warning. An unpriced
  token class (reasoning with no dedicated rate, cache-write with none) is
  billed at a conservative fallback rate and warned about — never dropped.
- **A known usage field with a malformed value throws, it is never priced as
  though the field were absent.** A provider or gateway that stringifies a
  number (`"1000000"` instead of `1000000`), or sends `NaN`, `Infinity`, a
  negative count, or a fractional count for a billable field like
  `cache_read_input_tokens` or `reasoning_tokens`, throws `InvalidUsageError`
  (`INVALID_USAGE`) instead of silently being treated as "field not present"
  and priced at zero. The one exception is `null`, which real provider
  responses use for "not applicable" (Anthropic's own OpenAPI schema
  documents `cache_creation_input_tokens`/`cache_read_input_tokens` as
  `integer | null`) — `null` is treated the same as an absent field, not as
  malformed. See [Provider usage adapters](#provider-usage-adapters).
- **No runtime network fetch, ever.** Pricing is committed, versioned data.
  `registryVersion` (a content hash, independent of this package's own npm
  version) proves two calculations used byte-identical pricing data.
- **Historical lookups are exact and reproducible.** A cost computed for a
  specific `at` date always resolves the same pricing period, regardless of
  when — or on which machine — you run it: every ISO `at` string is read as
  UTC, including the offset-less form `Date.parse` would otherwise read in
  the host's local timezone. See
  [Historical lookup](#historical-lookup-and-the-data-freshnesseffective-date-policy).
- **Zero runtime dependencies, browser-safe.** No `node:` import in `src/`.

## API

### `calculateCost(request, options?): CostBreakdown`

```ts no-check
function calculateCost(request: PriceRequest, options?: PriceOptions): CostBreakdown;

interface PriceRequest {
  model: string; // a canonical id or alias, from any provider
  provider?: string; // qualifies resolution to one provider — see "two channels, one rule" below
  usage: LlmUsage | unknown; // normalize a raw provider response first — see below
  mode?: 'standard' | 'batch';
  at?: Date | string; // defaults to `new Date()`; an ISO string is read as UTC
}

interface CostBreakdown {
  model: string; // exactly as requested
  canonicalModel: string; // the resolved registry id (may differ if `model` was an alias)
  provider: string;
  matchedBy: ModelMatchKind; // how `model` was resolved — see resolveModel below
  requestedProvider?: string; // `provider` exactly as requested, when supplied
  currency: 'USD';
  input: CostLine;
  output: CostLine;
  cachedInput?: CostLine;
  cacheWrite?: CostLine;
  reasoning?: CostLine;
  totalUsd: number;
  totalUsdExact: string; // authoritative — see "Exact vs. numeric totals" below
  registryVersion: string;
  pricingEffectiveFrom: string;
  warnings: readonly PriceWarning[];
}

interface CostLine {
  tokens: number;
  rate: string; // decimal USD-per-million-tokens rate actually applied
  costUsd: number;
  costUsdExact: string;
}
```

#### Provider qualifier: two channels, one rule

A provider qualifier can travel on either of two channels — `request.provider`
or `options.provider` (`PriceOptions` is `ResolveModelOptions`, which declares
`provider`, and `createPriceCalculator` forwards its own `options.provider`
straight through). **They are equivalent**: qualifying on `options` behaves
identically to qualifying on `request`, for a match, a qualified miss, an
ambiguous id, and an unrecognized provider string alike. When both are
supplied, `request.provider` wins:

```ts
import { calculateCost, UnknownModelError } from 'usage-tab';

const usage = { inputTokens: 1_000_000, outputTokens: 1_000_000 };

// identical results — same provider, same resolution, same total
const viaRequest = calculateCost({ model: 'gpt-5.6-luna', provider: 'azure-openai', usage });
const viaOptions = calculateCost({ model: 'gpt-5.6-luna', usage }, { provider: 'azure-openai' });
viaRequest.totalUsdExact === viaOptions.totalUsdExact; // true

// options.provider is exactly as hard a constraint as request.provider — a
// qualified miss throws UnknownModelError on either channel, never a silent
// fall-through to a different provider's price
try {
  calculateCost({ model: 'gpt-5.6-luna', usage }, { provider: 'not-a-provider' });
} catch (error) {
  console.log(error instanceof UnknownModelError); // true
}
```

`options.provider` exists because `createPriceCalculator` threads its own
`options` bag through to every call — useful when a calculator built with
shared overrides also needs a default provider qualifier per call, without
repeating it on `request` each time. Either channel populates
`CostBreakdown.requestedProvider`, so that field tells you a qualifier was
supplied, not which channel carried it.

### `resolveModel(model, options?): ResolvedModel`

Resolution order (never guesses; ambiguity always throws):

1. exact custom override
2. exact canonical id, qualified by `provider`
3. exact alias, qualified by `provider`
4. globally unambiguous alias
5. explicit configured `fallback`
6. throws `UnknownModelError` (`UNKNOWN_MODEL`)

```ts
import { resolveModel } from 'usage-tab';

const resolved = resolveModel('claude-haiku-4-5', { provider: 'anthropic' });
resolved.descriptor.canonicalId; // "claude-haiku-4-5-20251001" — alias resolved to the dated snapshot id
resolved.matchedBy; // "alias-scoped"
```

### `createPriceCalculator(options?): PriceCalculator`

Bundles a set of default overrides/fallback/registry once, for pricing many
requests against the same negotiated rates without repeating `options`:

```ts
import { createPriceCalculator, createPriceOverride } from 'usage-tab';

const calculator = createPriceCalculator({
  overrides: [
    createPriceOverride({
      canonicalId: 'gpt-5',
      provider: 'openai',
      input: '0.90',
      output: '7.50',
    }),
  ],
});

calculator.calculateCost({
  model: 'gpt-5',
  provider: 'openai',
  usage: { inputTokens: 1_000_000, outputTokens: 1_000_000 },
}).totalUsdExact; // "8.40" — the negotiated rate, not the $11.25 list rate
```

### Provider usage adapters

```ts no-check
normalizeOpenAIUsage(value: unknown): { usage: LlmUsage; warnings: readonly PriceWarning[] };
normalizeAnthropicUsage(value: unknown): { usage: LlmUsage; warnings: readonly PriceWarning[] };
normalizeGoogleUsage(value: unknown): { usage: LlmUsage; warnings: readonly PriceWarning[] };
normalizeOpenAICompatibleUsage(value: unknown): { usage: LlmUsage; warnings: readonly PriceWarning[] };
```

Structural adapters — field names only, never a provider SDK import. See
[Provider usage examples](#provider-usage-examples) below.

Every field each adapter recognizes has exactly two valid states: **absent**
(the key is missing, or explicitly `null` — provider responses use `null` for
"not applicable"; see the field-by-field citations below) or **present as a
non-negative integer**. Anything else present under a recognized key — a
string, a boolean, `NaN`, `Infinity`, a negative number, a fractional number —
throws `InvalidUsageError` rather than being silently treated as absent and
priced at zero. This applies to every recognized field, top-level and nested:

| Adapter                          | Required fields                                                     | Optional fields (absent-vs-invalid rule applies)                                                                                                                 |
| -------------------------------- | ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `normalizeAnthropicUsage`        | `input_tokens`, `output_tokens`                                     | `cache_read_input_tokens`, `cache_creation_input_tokens`, `cache_creation` (object) → `.ephemeral_5m_input_tokens`, `.ephemeral_1h_input_tokens`                 |
| `normalizeOpenAIUsage`           | `prompt_tokens`/`input_tokens`, `completion_tokens`/`output_tokens` | `prompt_tokens_details`/`input_tokens_details` (object) → `.cached_tokens`; `completion_tokens_details`/`output_tokens_details` (object) → `.reasoning_tokens`   |
| `normalizeGoogleUsage`           | `promptTokenCount`, `candidatesTokenCount`                          | `cachedContentTokenCount`, `thoughtsTokenCount`                                                                                                                  |
| `normalizeOpenAICompatibleUsage` | `prompt_tokens`, `completion_tokens`                                | `prompt_tokens_details` (object) → `.cached_tokens`; flat `cached_tokens`; `prompt_cache_hit_tokens`; `completion_tokens_details` (object) → `.reasoning_tokens` |
| Direct `LlmUsage` (no adapter)   | `inputTokens`, `outputTokens`                                       | `cachedInputTokens`, `cacheWriteTokens`, `reasoningTokens`                                                                                                       |

A nested parent (e.g. `cache_creation`, `prompt_tokens_details`) follows the
same rule one level up: absent/`null` is absent, but present-and-not-an-object
throws rather than silently skipping the fields inside it.

`null` really is documented provider behavior for cache fields, not a
hypothetical: Anthropic's Messages API OpenAPI schema types
`cache_creation_input_tokens` and `cache_read_input_tokens` as `integer | null`
(`input_tokens`/`output_tokens` are plain, non-nullable `integer`). OpenAI's
own prompt-caching guide instead documents `cached_tokens` as always present
and `0` — never `null` — for requests below the caching threshold; this
package treats `null` as absent there too, since a stricter reading would
reject a hypothetical gateway response without buying any real protection.

### Errors

```ts no-check
class AmbiguousAliasError extends Error {
  code: 'AMBIGUOUS_ALIAS';
} // an id matches more than one model; pass `provider` or an override
class UnknownModelError extends Error {
  code: 'UNKNOWN_MODEL';
} // nothing matched, not even a fallback
class InvalidLookupDateError extends Error {
  code: 'INVALID_LOOKUP_DATE';
} // `at` did not parse as a date
class NoPricingPeriodError extends Error {
  code: 'NO_PRICING_PERIOD';
} // `at` precedes every known period for this model
class InvalidUsageError extends Error {
  code: 'INVALID_USAGE';
} // `usage` isn't LlmUsage-shaped and wasn't normalized first, OR a
// recognized usage field is present with a malformed value (wrong type,
// NaN, Infinity, negative, or fractional) — see "Provider usage adapters"
class InvalidTokenCountError extends Error {
  code: 'INVALID_TOKEN_COUNT';
} // negative, fractional, or unsafely large token count
class InvalidRateError extends Error {
  code: 'INVALID_RATE';
} // a custom override's rate string doesn't parse
```

Every error extends `Error`, sets a stable `code` string, and carries an
actionable message. Branch on `.code`, not on message text. This holds even
for the value that landed in the offending field: a `bigint` — routine from a
`BIGINT` database column via node-postgres or mysql2 — is rendered safely in
the message rather than crashing the error-message-building code itself, which
would otherwise surface as an uncoded `TypeError` instead of `InvalidUsageError`.

## Advanced usage

### Provider usage examples

```ts
import { calculateCost, normalizeOpenAIUsage } from 'usage-tab';

// Exactly what `chat.completions.create(...).usage` (or the Responses API's
// `response.usage`) returns — this adapter accepts either shape.
const { usage, warnings } = normalizeOpenAIUsage({
  prompt_tokens: 12_400,
  completion_tokens: 850,
  prompt_tokens_details: { cached_tokens: 9_600 },
  completion_tokens_details: { reasoning_tokens: 120 },
});

warnings; // [] here — every recognized field was priced
calculateCost({ model: 'gpt-5', provider: 'openai', usage }).totalUsdExact;
```

```ts
import { normalizeAnthropicUsage } from 'usage-tab';

// Anthropic reports cache tokens *additively*, not as a subset of
// input_tokens — this adapter sums them so `LlmUsage.inputTokens` means the
// same thing (a total) regardless of which provider it came from.
const { usage } = normalizeAnthropicUsage({
  input_tokens: 700,
  output_tokens: 300,
  cache_read_input_tokens: 200,
  cache_creation_input_tokens: 100,
});
usage.inputTokens; // 1000 (700 + 200 + 100)
```

```ts
import { normalizeGoogleUsage } from 'usage-tab';

// Gemini's usageMetadata: thoughtsTokenCount is reported *additively* to
// candidatesTokenCount, not as a subset — this adapter adds it into
// outputTokens for the same reason the Anthropic adapter sums cache tokens.
const { usage } = normalizeGoogleUsage({
  promptTokenCount: 1000,
  candidatesTokenCount: 400,
  cachedContentTokenCount: 100,
  thoughtsTokenCount: 50,
});
usage.outputTokens; // 450 (400 + 50)
```

```ts
import { normalizeOpenAICompatibleUsage } from 'usage-tab';

// Groq, Together AI, and similar OpenAI-compatible chat-completions APIs —
// leniently accepts a flat `cached_tokens` or DeepSeek-style
// `prompt_cache_hit_tokens` in addition to OpenAI's nested detail shape.
const { usage } = normalizeOpenAICompatibleUsage({
  prompt_tokens: 500,
  completion_tokens: 120,
  cached_tokens: 50,
});
```

A gateway or proxy that stringifies a numeric field is a malformed known
field, not an absent one — it throws rather than being priced at zero:

```ts
import { InvalidUsageError, normalizeAnthropicUsage } from 'usage-tab';

try {
  normalizeAnthropicUsage({
    input_tokens: 700,
    output_tokens: 300,
    cache_creation_input_tokens: '1000000', // a gateway stringified this
  });
} catch (error) {
  console.log(error instanceof InvalidUsageError); // true
  console.log((error as InvalidUsageError).code); // "INVALID_USAGE"
}

// `null`, by contrast, is real provider behavior for "not applicable" and is
// treated as absent, not malformed:
normalizeAnthropicUsage({
  input_tokens: 700,
  output_tokens: 300,
  cache_read_input_tokens: null,
}).usage.cachedInputTokens; // undefined — no error, no warning
```

### Exact vs. numeric totals, and why both exist

`totalUsd`/`costUsd` are `number`s — convenient for a dashboard, a log line,
or a quick comparison, but subject to ordinary IEEE 754 float representation
once they leave this package. `totalUsdExact`/`costUsdExact` are decimal
strings computed with exact `bigint` arithmetic the entire way through — the
value to store, sum across many requests, or hand to an accounting system.
This package never derives `totalUsd` from a second, independent float
calculation; it is `Number(totalUsdExact)`, so it is always the closest
double to the true exact value, not a compounded rounding error:

```ts
import { calculateCost } from 'usage-tab';

const result = calculateCost({
  model: 'claude-sonnet-5',
  provider: 'anthropic',
  usage: { inputTokens: 333_333, outputTokens: 0 },
  at: '2026-08-15',
});

result.totalUsdExact; // "0.666666" — exact
result.totalUsd; // 0.666666    — the same value, as a number
```

### Totalling many requests exactly

`sum += breakdown.totalUsd` puts binary floating point back exactly where
`totalUsdExact` removed it. `createCostAggregator` keeps the running totals
on the same exact `bigint` path, overall and per model:

```ts
import { calculateCost, createCostAggregator, sumExactUsd } from 'usage-tab';

const aggregator = createCostAggregator();
for (const call of [
  { model: 'gpt-4o', provider: 'openai', usage: { inputTokens: 40_000, outputTokens: 4_000 } },
  {
    model: 'claude-sonnet-5',
    provider: 'anthropic',
    usage: { inputTokens: 40_000, outputTokens: 4_000 },
  },
]) {
  aggregator.add(calculateCost({ ...call, at: '2026-08-15' }));
}

aggregator.total().totalUsdExact; // exact decimal string — the value to store
aggregator.total().count; // 2
aggregator.byModel(); // Map keyed "openai:gpt-4o", "anthropic:claude-sonnet-5"

// Already have the strings — from a database column, say:
sumExactUsd(['0.10', '0.20']); // "0.30", where 0.1 + 0.2 gives 0.30000000000000004
```

`total().registryVersions` lists every pricing snapshot the aggregate drew
on. More than one is expected for a report spanning a registry update, and a
bug for a total meant to be reproducible against a single one — this package
reports it rather than guessing which you meant.

Both throw `InvalidRateError` on a value that is not a non-negative decimal
string, rather than coercing it: a stringified `NaN` or an exponent-notation
`"1e-7"` silently summing to something wrong is the failure this exists to
prevent.

### Historical lookup and the data-freshness/effective-date policy

Every price carries an `effectiveFrom` (and, when superseded, an
`effectiveTo`) date. `calculateCost`'s `at` picks the period active on that
date — `claude-sonnet-5`'s real introductory rate is the mandated golden
fixture for this behavior:

```ts
import { calculateCost } from 'usage-tab';

const usage = { inputTokens: 1_000_000, outputTokens: 1_000_000 };

calculateCost({ model: 'claude-sonnet-5', provider: 'anthropic', usage, at: '2026-08-15' })
  .totalUsdExact;
// "12.00" — the introductory rate ($2.00/$10.00), active through 2026-08-31

calculateCost({ model: 'claude-sonnet-5', provider: 'anthropic', usage, at: '2026-09-15' })
  .totalUsdExact;
// "18.00" — the standard rate ($3.00/$15.00), effective 2026-09-01
```

Period boundaries are UTC midnights, so **every ISO `at` string is read as
UTC**. An ISO date (`'2026-09-01'`) and an offset-carrying datetime
(`'2026-09-01T05:00:00Z'`, `'...+02:00'`) already are by specification; one
_without_ an offset — `'2026-09-01T05:00:00'`, the shape a log timestamp, a
`datetime-local` input, and several DB drivers produce — is `Date.parse`'s
local-time case, and is read as UTC here too. Otherwise the same lookup
prices at $12.00 in one deployment and $18.00 in another, purely from the
host's `TZ`.

A non-ISO string (`'2026/09/01'`, `'September 1, 2026'`) is
implementation-defined rather than specified, so there is no single reading
to normalize it to and it keeps whatever `Date.parse` does with it — local
time, in practice. Pass a `Date` or an ISO form.

Pricing data is committed, not fetched — there is no runtime network call,
ever. That means it can go stale between releases: a provider can change a
price the day after `usage-tab` ships, and calculations will use the old
price until the next release. This is a deliberate trade-off: a
silently-updating price is worse than a stale, visible, reproducible one. A
data-only correction always ships as a real release — check `registryVersion`
(a content hash of the pricing data, independent of this package's own npm
version) to confirm which snapshot a calculation used.

### Custom price overrides

Negotiated or enterprise rates take precedence over the registry
(resolution's highest-precedence step):

```ts
import { calculateCost, createPriceOverride } from 'usage-tab';

const negotiated = createPriceOverride({
  canonicalId: 'gpt-5',
  provider: 'openai',
  input: '0.90', // decimal strings — see the fixed-point guarantee above
  output: '7.50',
  cachedInput: '0.09',
  batchMultiplier: '0.5',
  effectiveFrom: '2026-01-01',
});

calculateCost(
  {
    model: 'gpt-5',
    provider: 'openai',
    usage: { inputTokens: 1_000_000, outputTokens: 1_000_000 },
  },
  { overrides: [negotiated] },
).totalUsdExact; // "8.40" — the negotiated rate, not the registry's $11.25
```

### Supported providers

The bundled registry ([`@llm-kit/model-registry`](../../internal/model-registry),
committed and versioned — see `registryVersion` above) covers all ten
baseline providers: `openai`, `anthropic`, `google`, `azure-openai`,
`aws-bedrock`, `groq`, `mistral`, `cohere`, `together`, `openrouter`. Pass
`provider` to qualify a lookup to one of these.

## Edge cases and limitations

| Case                                                                                                                                                 | Behavior                                                                                                                                                                                                                                           |
| ---------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| An alias matches more than one provider's model                                                                                                      | Throws `AmbiguousAliasError` (`AMBIGUOUS_ALIAS`). Pass `provider` or a custom override — never guessed.                                                                                                                                            |
| No model matches at all                                                                                                                              | Throws `UnknownModelError` (`UNKNOWN_MODEL`).                                                                                                                                                                                                      |
| `provider` is supplied but the id only exists under a _different_ provider (e.g. `{ model: 'gpt-5.5-pro', provider: 'azure-openai' }` — OpenAI-only) | Throws `UnknownModelError` (`UNKNOWN_MODEL`) — never silently priced at the other provider's rate. A provider qualifier is a constraint, not a hint; the error's `otherProviders` names where the id does exist. Unqualified lookup is unaffected. |
| `at` precedes every known pricing period for a model                                                                                                 | Throws `NoPricingPeriodError` (`NO_PRICING_PERIOD`) — never a zero or guessed cost.                                                                                                                                                                |
| A model's recorded rate is the cheapest of several published tiers                                                                                   | `PARTIAL_TIER_PRICING` warning on every calculation that uses it (Google prompt-size tiers, Azure deployment/context/service tiers).                                                                                                               |
| `mode: 'batch'` requested but the model publishes no batch rate                                                                                      | Falls back to standard pricing (the _higher_ of the two, so it never under-reports) and warns with `BATCH_PRICING_UNAVAILABLE`.                                                                                                                    |
| `cachedInputTokens + cacheWriteTokens` exceeds `inputTokens`                                                                                         | Ordinary input clamped to 0 and warns (`CACHED_EXCEEDS_INPUT`); the reported cached/write amounts are still billed in full.                                                                                                                        |
| `reasoningTokens` exceeds `outputTokens`                                                                                                             | Ordinary output clamped to 0 and warns (`REASONING_EXCEEDS_OUTPUT`); the reported reasoning amount is still billed in full.                                                                                                                        |
| Reasoning tokens reported, no dedicated `reasoning` rate                                                                                             | Billed at the output rate and warns (`REASONING_PRICED_AS_OUTPUT`) — never dropped.                                                                                                                                                                |
| Cached/cache-write tokens reported, no dedicated rate                                                                                                | Billed at the input rate and warns (`CACHED_INPUT_PRICED_AS_INPUT` / `CACHE_WRITE_PRICED_AS_INPUT`) — never dropped.                                                                                                                               |
| An unrecognized usage field (current or future)                                                                                                      | Surfaced as a `UNSUPPORTED_USAGE_FIELD` warning naming the field — never silently discarded.                                                                                                                                                       |
| A recognized usage field present with a malformed value (wrong type, `NaN`, `Infinity`, negative, fractional)                                        | Throws `InvalidUsageError` (`INVALID_USAGE`) — never priced as though the field were absent.                                                                                                                                                       |
| A recognized usage field present as `null`                                                                                                           | Treated the same as an absent field — not an error, not priced. See [Provider usage adapters](#provider-usage-adapters).                                                                                                                           |
| Zero-token request                                                                                                                                   | Returns an exact zero total; never throws.                                                                                                                                                                                                         |
| A very large aggregate token count                                                                                                                   | Stays exact up to `Number.MAX_SAFE_INTEGER`; beyond that (or negative, or fractional) throws `InvalidTokenCountError` (`INVALID_TOKEN_COUNT`).                                                                                                     |
| A pricing correction with an earlier `effectiveFrom` than an existing period                                                                         | Resolved correctly regardless of array order — the period with the latest `effectiveFrom` that still covers `at` always wins.                                                                                                                      |

What this package deliberately does not do: fetch prices
at runtime, reconcile against a provider invoice, convert currency, or model
taxes, credits, or negotiated enterprise commitments beyond what you supply
as an override.

## Runtime compatibility

Universal (browser-safe): `src/` contains no `node:` import and no provider
SDK import, verified directly by `test/no-network-calls.test.ts`. Published
as ESM and CommonJS from one build (`dist/index.js` and `dist/index.cjs`),
both proven by installing the packed tarball into a clean project and
importing it both ways. Node 20+ is the tested baseline (`engines.node:
">=20"`).

## Performance

`calculateCost` does a registry lookup, an effective-date period selection,
and a handful of exact `bigint` operations — no I/O, no allocation-heavy
data structures. Benchmarked (`pnpm run bench`) on the CI reference machine:

| Scenario                                            | Throughput                    |
| --------------------------------------------------- | ----------------------------- |
| Single calculation (input/output only)              | ~220,000 calculations/second  |
| Single calculation (input/output/cached/cacheWrite) | ~126,000 calculations/second  |
| 100,000-request aggregate                           | ~500 ms total (~5 μs/request) |
| Registry lookup, provider-qualified canonical id    | ~3.3M lookups/second          |
| Registry lookup, globally unambiguous alias         | ~1.4M lookups/second          |

Run `pnpm run bench` for numbers on your own hardware.

## Security and privacy

**No runtime network call, ever** — checked directly by
`test/no-network-calls.test.ts`, not just claimed here. Pricing is committed,
versioned data; this package never fetches, phones home, or logs your usage.
No telemetry, no `eval`. Error messages never embed token content — only
field names, counts, and model/provider identifiers.

## Contributing and license

Part of the [llm-kit](../../README.md) monorepo. MIT licensed — see
[`LICENSE`](./LICENSE).
