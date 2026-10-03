# Provider pricing data

These reviewed files are the source data for `@llm-kit/model-registry`. There
must be one file per `ProviderId`. If no model has a confirmed price, the file
still needs `"models": []` and an `"omitted"` note explaining why.
`scripts/generate-model-registry.ts` reads these files and fails if one is
missing.

Do not edit `internal/model-registry/src/generated/registry.ts` by hand. The
generator produces it from these files.

## File shape

```jsonc
{
  "provider": "anthropic", // must match the file name
  "models": [
    {
      "canonicalId": "claude-sonnet-5",
      "provider": "anthropic", // must match the top-level "provider"
      "aliases": [],
      "family": "sonnet", // optional, organizational only
      "contextWindow": 1000000, // optional
      "pricing": [
        {
          "effectiveFrom": "2026-01-01",
          "effectiveTo": "2026-09-01", // exclusive; omit for the current, open-ended period
          "currency": "USD",
          "unit": "per-million-tokens",
          "input": "2.00", // decimal STRING — never a JSON number
          "output": "10.00",
          "cachedInput": "0.20",
          "cacheWrite": "2.50",
          "batchMultiplier": "0.5",
          "sourceUrl": "https://platform.claude.com/docs/en/about-claude/models/overview",
          "observedAt": "2026-08-05",
          "notes": ["free-text provenance/context"],
        },
      ],
      "source": {
        "url": "https://platform.claude.com/docs/en/about-claude/models/overview",
        "observedAt": "2026-08-05",
      },
    },
  ],
  "omitted": ["free-text notes on what was deliberately left out, and why"],
}
```

Rates are decimal strings so the source price does not pass through a
JavaScript `number`. `scripts/verify-pricing-data.ts` rejects numeric rate
fields.

## Update workflow

1. Update the provider file with the price, `sourceUrl`, observation date
   (`observedAt`), and effective date (`effectiveFrom`). For a retroactive
   correction, add a `PricingPeriod` with an earlier `effectiveFrom`.
   `selectPricingPeriod` chooses the qualifying period with the latest
   `effectiveFrom`, regardless of file order.
2. Validate all provider files with
   `pnpm exec tsx scripts/verify-pricing-data.ts`. This reports validation
   issues without generating the registry.
3. Run `pnpm exec tsx scripts/generate-model-registry.ts`. It validates the
   data again and writes the sorted
   `internal/model-registry/src/generated/registry.ts`.
4. Run `pnpm --filter @llm-kit/model-registry run test` and
   `pnpm --filter usage-tab run test` for the cost fixtures.
5. Review price changes separately from engine changes. Keep provider-data
   and `src/*.ts` changes in separate commits and, preferably, separate pull
   requests so reviewers can check each price against its source.
6. Add a changeset for the consuming public package, such as `usage-tab`.
   `@llm-kit/model-registry` is not published and has no changeset of its own.
7. Release data changes. Version 1 has no runtime price fetch, so a corrected
   price reaches users through a release.

CI runs `scripts/generate-model-registry.ts --check`. It does not write files
and fails if `generated/registry.ts` is stale.

## What is included

The 2026-10-03 refresh brought the registry from 152 to 172 models across 10
providers. Prices were fetched from provider pricing pages or, for Azure
OpenAI, its Retail Prices API. None were filled in from memory.

Read the refresh notes before the per-provider notes, which describe the
2026-08-05 pass except where a later refresh changed them.

### The 2026-10-03 refresh

Pricing sources for every provider were fetched again. The changes were:

- Azure's `gpt-5.6-sol`, `-terra`, and `-luna` rates now match OpenAI's:
  sol fell from $5.00 / $30.00 to $4.00 / $20.00, terra from $2.50 / $15.00
  to $2.00 / $12.00, and luna from $1.00 / $6.00 to $0.20 / $1.20. The
  Retail Prices API lists 2026-09-01 for sol and 2026-08-01 for terra and
  luna, but the older prices were observed after those dates (2026-09-07
  and 2026-08-05). The new periods therefore begin on the 2026-10-03
  observation date. A 2026-08-05 lookup for `gpt-5.6-luna` still shows the
  fivefold difference. The `usage-tab` headline example uses `gemma-4-31b`
  on Together and Bedrock, whose rates still differ.
- Together changed two rates: `qwen3.7-max` rose from $1.25 / $3.75 to
  $1.50 / $4.50 (cached input from $0.13 to $0.30), while `qwen3.8-flash`
  fell from $0.15 / $0.47 to $0.09 / $0.28. No other input or output rate
  changed in this refresh.
- Thirty-one models were added. Anthropic: `claude-opus-5-5`, `claude-sonnet-5-5`.
  OpenAI: `gpt-6.1-sol`, `gpt-6-sol`, `gpt-6-luna`, and from the page's
  Specialized and Cyber tables `chat-latest`, `gpt-5.3-codex`,
  `gpt-5-search-api`, `gpt-rosalind-research` (billed from 2026-10-05),
  `gpt-5.6-cyber` and `gpt-5.5-cyber`; the last three need approved access.
  Google: `gemini-3-flash-preview`, `gemini-omni-1.1-flash` and
  `gemini-omni-flash-preview` (flagged `cheapestTier`: video output costs
  $17.50 against the recorded $9.00 text rate), `gemini-robotics-er-2-preview`
  and its streaming variant (promotional until 2026-12-31, both periods
  recorded). Google's API docs did not list Gemini 4 on 2026-10-03.
  Azure: `gpt-6-astra`. Bedrock: `gemma-4-26b-a4b`,
  `gemma-4-e2b`, `gemma-3-4b`, `nemotron-3-nano-30b`. Cohere:
  `command-r7b-12-2024`, `command-r-08-2024` (the pricing page says only
  "Command R"; the docs list `command-r-08-2024` as the only live one).
  Mistral: `zai-glm-5-3`. Together: `deepseek-v4.1-flash`, `minimax-m2.7`,
  `qwen3-235b-a22b-instruct-2507-fp8`, `muse-glimmer-30b`, `inkling`,
  `cogito-v2.1-671b`, `rnj-1-instruct`.
- Cache and batch rates published since the earlier pass were added to the
  existing periods: `cacheWrite` on four OpenAI models (`gpt-6-astra`,
  `gpt-5.6-sol`/`-terra`/`-luna`) and on OpenRouter's Gemini entry;
  `cachedInput` on `gemini-3.5-flash-lite`, five Together models,
  `codestral` and the three `ministral-3` models; `batchMultiplier` on
  `codestral`, the `ministral-3` models, `zai-glm-5-2`, and Azure's
  `gpt-4-turbo` and `gpt-4`, whose Batch meters the 2026-08-05 pass missed.
- Eleven retired models were removed because they can no longer be called:
  Mistral's `devstral-2`, `devstral-small-2`, `magistral-medium`,
  `magistral-small`, `mistral-nemo`, `mixtral-8x7b` and `mixtral-8x22b`;
  Groq's `llama-3.1-8b-instant`, `llama-3.3-70b-versatile` and `qwen3.6-27b`
  (shut down per Groq's deprecations page); Cohere's `aya-expanse-8b`. Each
  file's `omitted` notes record the retirement dates. A lookup for these ids
  returns `UNKNOWN_MODEL` for any date when no override or fallback is
  supplied, so historical usage needs an override. `deepseek-v4-pro` and `gpt-oss-20b` (Together) and the three Nova
  models (Bedrock) were not on the fetched pages but are not known to be
  retired, so they are unchanged.
- `gpt-3.5-turbo` loses its `batchMultiplier`: OpenAI's Batch table no longer
  lists it.
- All 32 existing Azure models were re-queried this time, but most in
  `eastus2` only rather than across every region; each entry's notes say
  which regions were checked.

### The 2026-09-07 refresh

Pricing pages for all providers were fetched again. Changes from this pass:

- Anthropic cancelled the planned `claude-sonnet-5` increase. Its pricing
  page says the $2.00 / $10.00 launch rate is the standard rate and that the
  planned $3.00 / $15.00 rate would not take effect on 2026-09-01. The
  2026-08-05 data had included that higher rate, so lookups dated from
  2026-09-01 overreported the price by 50%. The unused period was removed
  because it never took effect.
- **New models.** Anthropic: `claude-fable-5-1`, `claude-mythos-5-1`,
  `claude-mythos-5`, plus the legacy models the pricing page still publishes
  rates for (`claude-opus-4-5`, `claude-opus-4-1`, `claude-opus-4`,
  `claude-sonnet-4-5`, `claude-sonnet-4`, `claude-haiku-3-5`): 8 models to 17.
  OpenAI: `gpt-6-astra`. Google: `gemini-3.8-flash`, `gemini-3.7-flash`,
  `gemini-3.1-flash-lite`. Groq: `qwen3.8-27b`. Mistral: `zai-glm-5-2`.
  Together: 11 more, including the GLM 5.3 and Qwen 3.8 families. AWS Bedrock:
  `gemma-3-27b`, `gemma-3-12b`, `nemotron-3-super-120b`.
- **Price changes.** `openai:gpt-5.6-sol` cut from $5.00 / $30.00 to
  $4.00 / $20.00. `google:gemini-3.6-flash` moved to a promotional
  $0.75 / $3.75, published as running through 2026-12-31 with the standard
  $1.50 / $7.50 resuming 2027-01-01.
- **Newly published detail, previously omitted for lack of a per-model
  source.** Google now publishes per-model context-caching and Batch rows, so
  `cachedInput` is recorded for eight Gemini models and `batchMultiplier` for
  the two Pro models. Mistral publishes "Cached input: 90% discount" and
  "Batch: 50% discount" per model, so its three flagship models gain both.
  OpenRouter's model pages now print Cache Read (and, for Claude, Cache Write)
  rates. OpenAI's Batch section now states the 50% saving covers **all** text
  models in the standard table, so the `-pro` tiers no longer omit
  `batchMultiplier`.
- The `UNCERTAIN` flag was removed from
  `openrouter:anthropic/claude-sonnet-5`. Its $2.00 / $10.00 rate had matched
  Anthropic's introductory price, which became the standard price. The note
  explaining the original flag remains.
- On 2026-09-07, Azure's `gpt-5.6-sol` still cost $5.00 / $30.00 /
  $0.50 after OpenAI cut its rate. That made it a third same-ID price
  divergence alongside `gpt-5.6-terra` and `gpt-5.6-luna`. Azure matched
  OpenAI's rates by the 2026-10-03 observation described above.
- Rates not checked on 2026-09-07 kept their 2026-08-05 `observedAt`.
  This includes two Groq Llama models, several Mistral and Together entries,
  the Bedrock Nova models, and 31 of Azure's 32 models. Their per-period
  notes explain the gap. A model missing from one page fetch was not treated
  as withdrawn, and its rate was not given a new observation date.

The real-data effective-date fixture now uses `google:gemini-3.6-flash`.
Google publishes both period boundaries, and `claude-sonnet-5` now has one
period. `openai:gpt-5.6-sol` provides another two-period case.
`internal/model-registry/test/pricing-period.test.ts` retains the earlier
sonnet-5 shape as a synthetic fixture. The cancellation is also covered in
`packages/usage-tab/test/effective-date.test.ts`.

### The 2026-08-05 pass

**Anthropic** — 8 models (`claude-fable-5`, `claude-opus-5`,
`claude-opus-4-8`, `claude-opus-4-7`, `claude-opus-4-6`, `claude-sonnet-5`,
`claude-sonnet-4-6`, `claude-haiku-4-5`), sourced from
<https://platform.claude.com/docs/en/about-claude/models/overview>, observed
2026-08-05. The entries record:

- `claude-sonnet-5` carried **two** pricing periods: an introductory rate
  ($2.00 / $10.00 input/output per million tokens) active through 2026-08-31,
  then the standard rate ($3.00 / $15.00) from 2026-09-01, **superseded by
  the 2026-09-07 refresh**, which found the increase cancelled. It is now one
  open period at $2.00 / $10.00, and no longer the golden fixture.
- `claude-haiku-4-5`'s `canonicalId` is the full dated snapshot id
  (`claude-haiku-4-5-20251001`), with the short form as an alias — a genuine
  alias/canonical-ID resolution case (see
  `internal/model-registry/test/generated-registry.test.ts`).
- Cache economics: `cachedInput` is 0.1x the input rate; `cacheWrite` is 1.25x
  the input rate for the **5-minute** cache TTL. Anthropic's 1-hour TTL write
  multiplier (2x input) is **not** separately modeled — this schema has one
  `cacheWrite` field per period, not one per TTL. Every period's `notes` say
  so explicitly. Adding a second cache-write field for the 1-hour TTL is a
  schema change for a future revision.
- `batchMultiplier` is `"0.5"` (Anthropic's Batch API: 50% off all token
  usage) on every period.
- None of the eight models' true rollout dates were observed — only that they
  are the _current_ rates as of 2026-08-05. Every period's `effectiveFrom` is
  set conservatively to `2026-01-01` (except `claude-sonnet-5`'s standard
  period, whose `effectiveFrom` — 2026-09-01 — _is_ known precisely, since it
  is defined as the day the introductory offer ends) and says so in `notes`.
  A conservative (too-early) `effectiveFrom` can only make a historical lookup
  succeed when it should have returned "no period found" — never the reverse.

**OpenAI** — 28 models (the full `gpt-5.6`/`gpt-5.5`/`gpt-5.4`/`gpt-5.2`/
`gpt-5.1`/`gpt-5` families including `-mini`/`-nano`/`-pro` variants,
`gpt-4.1`, `gpt-4o` families, the `o1`/`o3`/`o4` reasoning series, and
`gpt-3.5-turbo`), sourced from
<https://developers.openai.com/api/docs/pricing>, observed 2026-08-05.
Fetched twice and confirmed to match exactly, with `o1-pro` and
`gpt-3.5-turbo` picked up on the second pass. `batchMultiplier` "0.5" is
applied to non-`-pro` models per the page's general Batch API statement;
`-pro`/reasoning-`-pro` models omit it as unconfirmed. No effective date is
published; every period conservatively uses `2026-01-01`.

**Google (Gemini)** — 7 models: `gemini-3.6-flash`, `gemini-3.5-flash`,
`gemini-3.5-flash-lite`, `gemini-2.5-flash`, `gemini-2.5-flash-lite`,
`gemini-3.1-pro-preview`, `gemini-2.5-pro`, sourced from
<https://ai.google.dev/gemini-api/docs/pricing>, observed 2026-08-05.
`batchMultiplier` "0.5" was verified per-model from the page's own Batch
rows for the Flash-tier models. The two Pro-tier models publish
context-length-tiered pricing (higher rate above 200k tokens); only the
`<=200k` tier is recorded since this schema has no context-length dimension
— noted explicitly on each entry. `cachedInput` is omitted everywhere: the
page's cached-token rate is stated in aggregate across models, not
confirmed per model.

**Groq** — 5 models: `llama-3.1-8b-instant`, `llama-3.3-70b-versatile`,
`gpt-oss-120b`, `gpt-oss-20b`, `qwen3.6-27b` (a Preview-tier model, flagged
as less stable), sourced from <https://console.groq.com/docs/models>,
observed 2026-08-05. Groq's own top-level `/pricing` page renders no
pricing table via automated fetch; the `/docs/models` page did.

**Mistral** — 14 models spanning `mistral-medium-3.5`, `mistral-small-4`,
`mistral-large-3`, `devstral-2`/`devstral-small-2`, `codestral`,
`magistral-medium`/`magistral-small`, `ministral-3-3b`/`-8b`/`-14b`,
`mistral-nemo`, `mixtral-8x7b`/`mixtral-8x22b`, sourced from
<https://mistral.ai/pricing/api> (the top-level `/pricing` and
`/products/la-plateforme` pages render no usable table via automated
fetch), observed 2026-08-05. Embedding, OCR, and Voxtral audio models are
excluded — priced in units this per-million-tokens schema does not model.

**Cohere** — 7 models: `command`, `command-light`, `command-r-03-2024`,
`command-r-plus-04-2024`, `command-r-plus-08-2024`, `aya-expanse-8b`,
`aya-expanse-32b`, sourced from <https://cohere.com/pricing>, observed
2026-08-05. The model catalogue checked at
<https://docs.cohere.com/docs/models> included Command A+, Command A,
Command R7B, and Command A Translate/Reasoning/Vision, but the pricing page
fetch did not publish per-token prices for them. The 2026-08-05 file included
only Command, Command R, Command R+, and Aya Expanse models with explicit
prices.

**Together AI** — 10 models, a representative slice of ~30 fetched from
<https://www.together.ai/pricing> spanning DeepSeek, Kimi (Moonshot), Qwen
(Alibaba), GLM (Zhipu), Llama (Meta), gpt-oss (OpenAI open-weight),
MiniMax, and Gemma (Google), observed 2026-08-05.

**OpenRouter** — 4 models, one each proxying OpenAI (`openai/gpt-5`),
Anthropic (`anthropic/claude-sonnet-5`), and Google
(`google/gemini-3.1-pro-preview`), plus one open-weight Meta model
(`meta-llama/llama-3.3-70b-instruct`), each fetched from its own
`https://openrouter.ai/<slug>` page (the aggregate `/models` listing page and
the bulk `/api/v1/models` JSON did not render usable pricing consistently
via automated fetch), observed 2026-08-05. **Flagged uncertainty**: the
`anthropic/claude-sonnet-5` entry's observed rate ($2.00/$10.00) matches
Anthropic's own _introductory_ rate rather than the standard rate that was
then scheduled for 2026-09-01. **Resolved by the 2026-09-07 refresh**: that
increase was cancelled, so the listing matched the standard rate all along and
the flag is withdrawn.

**AWS Bedrock** — 8 models: `claude-3.5-sonnet`/`claude-3.5-sonnet-v2`
(Anthropic, with a page-confirmed effective date of 2025-12-01, the only
non-conservative `effectiveFrom` outside Anthropic's own file),
`amazon-nova-micro`/`-lite`/`-pro` (AWS's own first-party model),
`gemma-4-31b` (Google), `mistral-large-3` (Mistral), and `nemotron-nano-2`
(NVIDIA), sourced from <https://aws.amazon.com/bedrock/pricing/>, observed
2026-08-05. Every rate is Bedrock's own resale rate card, independently
fetched — never copied from another provider's file, even where a
same-named model exists elsewhere in this registry (see the
"cross-provider collisions" note below).

**Azure OpenAI** — 32 models, sourced from Microsoft's public **Retail Prices
API**
(`https://prices.azure.com/api/retail/prices?currencyCode='USD'&$filter=contains(productName,%20'OpenAI')`)
rather than the JavaScript-rendered pricing page, since the API needs no
JavaScript execution and is not domain-gated the way the Azure/Learn docs
pages are. 20,399 line items were paged through (21 pages
of up to 1,000 rows, following `NextPageLink` to `null`) and reduced to 32
confidently-mapped text-token chat/reasoning models spanning the GPT-5
family (`gpt-5`/`-mini`/`-nano`/`-pro`, `gpt-5.1`, `gpt-5.2`/`-pro`,
`gpt-5.4`/`-mini`/`-nano`/`-pro`, `gpt-5.5`, `gpt-5.6-sol`/`-terra`/`-luna`),
the GPT-4.x family (`gpt-4.1`/`-mini`/`-nano`, `gpt-4o`/`-mini`,
`gpt-4-turbo`, `gpt-4`, `gpt-4-32k`), the o-series
(`o1`/`-mini`/`-preview`/`-pro`, `o3`/`-mini`/`-pro`, `o4-mini`), and
`gpt-3.5-turbo`, observed 2026-08-05. Normalization decisions, all recorded
per-model in `azure-openai.json`'s `notes`:

- **Global deployment, standard (non-batch, non-Priority-Processing) tier
  only.** Every included model also has Data Zone pricing (a consistent
  ~10% premium over Global, e.g. `gpt-5.4`: Global $2.50/$15.00 input/output
  vs Data Zone $2.75/$16.50) and, for most families, Regional and
  "Priority Processing" pricing — none of these are recorded as separate
  models; this schema has one price per model per period, and Global is the
  default, lowest-cost deployment tier that tracks OpenAI's own first-party
  rate.
- **1K→1M unit conversion done as exact string manipulation.** The Retail
  Prices API quotes roughly half these meters per 1,000 tokens and half per
  1,000,000; every `1K` rate was converted by moving the decimal point 3
  places as a string operation (never `price * 1000` in floating point),
  since a price must never pass through binary floating point on its
  authoritative path.
- **Batch relationship independently confirmed per model, not assumed.**
  `batchMultiplier: "0.5"` is recorded only where this model's own Batch-API
  meter was found and computed to exactly 0.5× the standard Global rate for
  both input and output (24 of 32 models, including every `-pro` tier —
  Azure's data confirms 0.5x for pro-tier models that OpenAI's own pricing
  page left unconfirmed). The 8 models with no Batch-API meter found
  (`gpt-5.6-sol`/`-terra`/`-luna`, `gpt-4-turbo`, `gpt-4`, `gpt-4-32k`,
  `o1-preview`, `gpt-3.5-turbo`) omit `batchMultiplier` rather than guessing.
- **Regional consistency.** Every Global-tier rate was confirmed identical across all
  ~24–28 Azure regions the API returned for that meter (not merely 2–3
  samples). Three legacy SKUs (`gpt-4`, `gpt-4-32k`, `gpt-3.5-turbo`)
  returned exactly one row each (a single primary-meter-region list price,
  no per-region duplication) — noted as a genuine data-shape difference,
  not a contradiction of region-independence.
- **Cross-checked against `openai.json`, since a resold model must be
  verified against the reselling provider's own first-party file to catch
  markup or drift.** 25 of 32 models
  match OpenAI's own first-party rate exactly (`gpt-5`, `gpt-5-mini`,
  `gpt-5-nano`, `gpt-5-pro`, `gpt-5.1`, `gpt-5.2`, `gpt-5.2-pro`, `gpt-5.4`
  and its `-mini`/`-nano`/`-pro` variants, `gpt-5.5`, `gpt-5.6-sol`,
  `gpt-4.1` and its `-mini`/`-nano` variants, `gpt-4o`, `gpt-4o-mini`, `o1`,
  `o1-pro`, `o3`, `o3-mini`, `o3-pro`, `o4-mini`, `gpt-3.5-turbo`) — no
  markup detected. **Two genuinely differ**: `gpt-5.6-terra` is
  $2.50/$15.00/$0.25 on Azure Global vs OpenAI first-party's $2.00/$12.00/
  $0.20, and `gpt-5.6-luna` is $1.00/$6.00/$0.10 on Azure vs $0.20/$1.20/
  $0.02 first-party — both confirmed pricing divergences for the same named
  model, not transcription errors; see the "cross-provider collisions"
  section below. The remaining 5 models (`gpt-4-turbo`, `gpt-4`, `gpt-4-32k`,
  `o1-mini`, `o1-preview`) have no comparable entry in openai.json's current
  snapshot (legacy models no longer on OpenAI's own pricing page), so no
  comparison was possible.
- **`effectiveFrom` is sourced, not a blanket conservative guess.** Unlike
  every other provider file, the Retail Prices API publishes its own
  `effectiveStartDate` per meter row. Each model's `effectiveFrom` uses the
  earliest such date observed across that meter's regional rows (e.g.
  `gpt-4o`: 2024-12-01; `gpt-5.6-*`: 2026-07-01) rather than the repository's
  usual 2026-01-01 placeholder — still conservative (a lower bound, never a
  guess forward), but genuinely sourced.
- **Scope: text token pricing only.** Excluded:
  `Azure OpenAI Media` (image/video), realtime audio, transcription/TTS,
  embeddings, `Code-Interpreter`, `file-search-tool-calls`, all
  fine-tuning (`ft`/`RFT`) meters, `computer-use-preview`, the Codex-branded
  model family and `gpt-5.3` (real models, plausibly, but no
  confidently-mappable canonical id and no first-party cross-check
  available), and Provisioned Throughput (a reserved-capacity, per-PTU-hour
  billing model, not per-token). Full reasoning for each exclusion is in
  `azure-openai.json`'s `omitted` array.

## Shared model IDs across providers

Providers sometimes publish the same open-weight or resold model under
the same name. The following `canonicalId`s are shared across provider files.
The Azure entries document their collisions in `azure-openai.json`; matching
notes have not yet been added to `openai.json`:

- `gpt-oss-120b` / `gpt-oss-20b`: Groq and Together AI both host these
  OpenAI open-weight models, at different (in one case, coincidentally
  matching) rates.
- `gemma-4-31b`: Together AI and AWS Bedrock both list this Google
  open-weight model, at different rates.
- `mistral-large-3`: Mistral's own first-party file and AWS Bedrock's resale
  file both list it, at (coincidentally) matching rates, independently
  fetched from each provider's own page.
- `llama-3.3-70b` (in various forms): hosted independently by Together AI
  and (as `meta-llama/llama-3.3-70b-instruct`) OpenRouter, at different
  rates. Groq's `llama-3.3-70b-versatile` was removed on 2026-10-03 after its
  shutdown there. Meta has no first-party API, so no further entry exists to
  compare against.
- **Azure OpenAI ↔ OpenAI (28 of Azure's 33 models as of 2026-10-03)**: Azure genuinely
  resells the identical first-party OpenAI models, so `azure-openai.json`
  intentionally reuses `openai.json`'s exact `canonicalId`s (`gpt-5`,
  `gpt-4o`, `o1`, etc.) — following the aws-bedrock.json precedent (same-id
  reuse) rather than openrouter.json's provider-prefixed-slug convention,
  since unlike OpenRouter's proxy catalogue, Azure has no distinct slug
  scheme of its own for the same model. As of 2026-10-03 all 28 match
  OpenAI's current first-party price. `gpt-5.6-sol`, `-terra` and `-luna`
  were **different, independently-confirmed** prices until Azure cut them;
  those rates stay as closed periods, so lookups dated before 2026-10-03
  still show the divergence. Each Azure model's `notes` documents the
  collision; per this pass's ownership boundary, `openai.json` itself was
  not edited to add a mirroring note — a follow-up pass should add one.

An unqualified lookup for a shared ID fails with `AMBIGUOUS_ALIAS`.
For example, `usage-tab` needs `provider: 'groq'` or
`provider: 'together'` to resolve `"gpt-oss-120b"`.

## What is deliberately omitted, and why

- **Within Azure OpenAI** — Data Zone, Regional, and Priority Processing
  deployment tiers; every fine-tuning/RFT meter; non-text pricing (media,
  audio, embeddings, tool-calls); `gpt-5.3` and the Codex-branded model
  family (no confidently-mappable canonical id); and reserved-capacity
  Provisioned Throughput. See the Azure OpenAI entry above and
  `azure-openai.json`'s own `omitted` array for the full reasoning.
- **Within Anthropic** — older model generations (3.x and earlier): not
  confirmed against current Anthropic documentation.
- **Within every other provider** — each file's own `omitted` array names
  the specific models or model families left out and why (wrong pricing
  unit for this schema, no published price found, catalogue too large for
  exhaustive coverage, etc.). Read the file directly for specifics; this
  README summarizes, it does not duplicate, each file's reasoning.
- Prices need a provider source. The initial entries were checked against
  their cited `sourceUrl` on 2026-08-05; later observations are dated in each
  period. No price was filled in from memory or inferred from another model.

## Adding a new provider or model

1. Confirm the price against the provider's pricing page or API.
2. Add or edit the model entry in `docs/provider-data/<provider>.json`,
   filling in `sourceUrl` and `observedAt` for every pricing period you touch.
3. Run `pnpm exec tsx scripts/verify-pricing-data.ts` and fix the reported
   issues. Each message names the field and expected value.
4. Run `pnpm exec tsx scripts/generate-model-registry.ts` and commit the
   resulting diff in `internal/model-registry/src/generated/registry.ts`
   alongside the source-data diff, in a commit separate from any engine code.
5. If you cannot confirm a price, leave out the model and explain why in
   `omitted`.
