# Provider pricing data

Reviewed, hand-authored source data for `@llm-kit/model-registry`. One file per
`ProviderId`, always present — even a provider with zero confidently-sourced
models still ships a file, with `"models": []` and an `"omitted"` note
explaining the gap. `scripts/generate-model-registry.ts` reads every file here
and refuses to run if any is missing, since the generated registry must come
only from these reviewed source files.

**Never hand-edit `internal/model-registry/src/generated/registry.ts`.** It is
produced from these files and only from these files.

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

Rates are decimal strings on purpose: a price must never pass through a
JavaScript `number` on its authoritative path.
`scripts/verify-pricing-data.ts` rejects a JSON number in a rate field.

## Update workflow

1. **Update the provider source file** with the new/corrected price, its
   `sourceUrl`, the date you observed it (`observedAt`), and the date it takes
   effect (`effectiveFrom`). A price correction that applies retroactively is
   representable: add a new `PricingPeriod` with an `effectiveFrom` earlier
   than an existing one's — `selectPricingPeriod` always picks the period with
   the latest `effectiveFrom` that still covers the lookup date, regardless of
   the order periods appear in the file.
2. **Run schema validation**: `pnpm exec tsx scripts/verify-pricing-data.ts`.
   Fast, no generation, reports every issue across every provider file in one
   pass.
3. **Generate the sorted registry output**:
   `pnpm exec tsx scripts/generate-model-registry.ts`. This re-validates (so it
   can never silently generate from bad data) and writes
   `internal/model-registry/src/generated/registry.ts`.
4. **Run the golden cost fixtures** — `pnpm --filter @llm-kit/model-registry run test`
   at minimum; once `usage-tab` consumes this data, its own golden fixtures
   too (`pnpm --filter usage-tab run test`).
5. **Review the data diff separately from any engine code.** A provider-data
   change and a `src/*.ts` change are different commits and, ideally, different
   pull requests — this is a repository working agreement, not just a
   suggestion, because a reviewer checking a price against a source URL should
   not also be reviewing resolution logic in the same diff.
6. **Add a changeset** noting the price change (owned by the consuming public
   package, e.g. `usage-tab`, once it exists — `@llm-kit/model-registry` itself
   is never published, so it has no changeset of its own).
7. **Publish a release even when only data changes.** A stale committed price
   is a silent correctness bug; there is no "data-only, skip the release" path
   in this repository. Runtime remote updates are prohibited in v1 (no
   network fetch, ever) specifically so that "the data is wrong" always has a
   release as its fix.

`scripts/generate-model-registry.ts --check` (no write, exit non-zero on any
diff) is what CI runs; a stale `generated/registry.ts` fails the build.

## What is included

As of the 2026-08-05 pass, the registry carries **123 models across all 10
providers** — Azure OpenAI (32 models) closed the last provider gap. Every
price below was fetched from the provider's own current pricing page (or, for
Azure OpenAI, its retail pricing API) on 2026-08-05; none was recalled from
training data.

**Anthropic** — 8 models (`claude-fable-5`, `claude-opus-5`,
`claude-opus-4-8`, `claude-opus-4-7`, `claude-opus-4-6`, `claude-sonnet-5`,
`claude-sonnet-4-6`, `claude-haiku-4-5`), sourced from
<https://platform.claude.com/docs/en/about-claude/models/overview>, observed
2026-08-05, and checked against that page directly. Notable shape:

- `claude-sonnet-5` carries **two** pricing periods: an introductory rate
  ($2.00 / $10.00 input/output per million tokens) active through 2026-08-31,
  then the standard rate ($3.00 / $15.00) from 2026-09-01. This is the
  effective-date-selection golden fixture (see
  `internal/model-registry/test/pricing-period.test.ts`).
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
2026-08-05. **Notable gap**: Cohere's current model catalogue (confirmed via
<https://docs.cohere.com/docs/models>) includes newer flagship models —
Command A+, Command A, Command R7B, Command A Translate/Reasoning/Vision —
none of which have a published per-token price on the pricing page as
fetched, so none are included. Only the older Command/Command R/Command
R+/Aya Expanse models with an explicit published price made it in.

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
Anthropic's own _introductory_ rate rather than the standard rate that takes
over 2026-09-01 — see that entry's `notes` for the caveat and a
re-verification reminder.

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
- **Region-independence spot-checked programmatically, not just a couple of
  regions.** Every Global-tier rate was confirmed identical across all
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

## Cross-provider alias/canonicalId collisions (deliberate, not errors)

Because several providers publish the _same_ open-weight or resold model
under the _same_ name, a handful of canonicalIds are intentionally reused
across provider files — always noted in both files' `notes`:

- `gpt-oss-120b` / `gpt-oss-20b`: Groq and Together AI both host these
  OpenAI open-weight models, at different (in one case, coincidentally
  matching) rates.
- `gemma-4-31b`: Together AI and AWS Bedrock both list this Google
  open-weight model, at different rates.
- `mistral-large-3`: Mistral's own first-party file and AWS Bedrock's resale
  file both list it, at (coincidentally) matching rates, independently
  fetched from each provider's own page.
- `llama-3.3-70b` (in various forms): hosted independently by Groq,
  Together AI, and (as `meta-llama/llama-3.3-70b-instruct`) OpenRouter, at
  three different rates — Meta has no first-party API, so no fourth entry
  exists to compare against.
- **Azure OpenAI ↔ OpenAI (27 of Azure's 32 models)**: Azure genuinely
  resells the identical first-party OpenAI models, so `azure-openai.json`
  intentionally reuses `openai.json`'s exact `canonicalId`s (`gpt-5`,
  `gpt-4o`, `o1`, etc.) — following the aws-bedrock.json precedent (same-id
  reuse) rather than openrouter.json's provider-prefixed-slug convention,
  since unlike OpenRouter's proxy catalogue, Azure has no distinct slug
  scheme of its own for the same model. 25 of these 27 collisions are
  matching-price ("no markup") pairs; 2 (`gpt-5.6-terra`, `gpt-5.6-luna`)
  are same-id pairs with **different, independently-confirmed** prices — see
  the Azure OpenAI entry above. Each Azure model's `notes` documents the
  collision; per this pass's ownership boundary, `openai.json` itself was
  not edited to add a mirroring note — a follow-up pass should add one.

By the resolver's design, a lookup without a provider
qualifier for any of these names is ambiguous by design and must fail
`UNKNOWN_MODEL`/ambiguity resolution rather than silently pick one —
`usage-tab` users who look up e.g. `"gpt-oss-120b"` without specifying
`provider: 'groq'` or `provider: 'together'` will hit this.

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
- **General principle**: a wrong or stale price is the single worst defect
  this package can ship — accuracy matters more than breadth. Every model
  above was fetched and observed on 2026-08-05 against the cited `sourceUrl`;
  nothing was filled in from memory, and no model's price was inferred from a
  different model's price.

## Adding a new provider or model

1. Confirm the price against the provider's own current pricing page — not a
   secondary source, not a cached memory of what it used to be.
2. Add or edit the model entry in `docs/provider-data/<provider>.json`,
   filling in `sourceUrl` and `observedAt` for every pricing period you touch.
3. Run `pnpm exec tsx scripts/verify-pricing-data.ts` and fix every reported
   issue — the messages name the exact field and what was expected.
4. Run `pnpm exec tsx scripts/generate-model-registry.ts` and commit the
   resulting diff in `internal/model-registry/src/generated/registry.ts`
   alongside the source-data diff, in a commit separate from any engine code.
5. If you cannot confirm a price with confidence, do not add the model —
   add or extend an `omitted` note instead.
