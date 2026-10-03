/**
 * GENERATED FILE — DO NOT EDIT BY HAND.
 *
 * Produced by `scripts/generate-model-registry.ts` from the reviewed source
 * files under `docs/provider-data/`. Editing this file directly is forbidden.
 *
 * Regenerate: pnpm exec tsx scripts/generate-model-registry.ts
 * Verify:     pnpm exec tsx scripts/generate-model-registry.ts --check
 */
import type { ModelDescriptor } from '../types.js';

export const REGISTRY_VERSION = "registry-80b485cdde8406b4";

export const MODEL_REGISTRY: readonly ModelDescriptor[] = [
  {
    canonicalId: "claude-fable-5",
    provider: "anthropic",
    aliases: [],
    family: "fable",
    contextWindow: 1000000,
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"10.00","output":"50.00","cachedInput":"1.00","cacheWrite":"12.50","batchMultiplier":"0.5","sourceUrl":"https://platform.claude.com/docs/en/about-claude/pricing","observedAt":"2026-10-03","notes":["Anthropic did not publish an effective date for this rate. effectiveFrom uses 2026-01-01 as a conservative placeholder until the rollout date is confirmed.","cacheWrite records the 5-minute TTL rate (1.25x input). The schema has one cacheWrite field, so it does not separately record the 1-hour write rate (2x input)."]},
    ],
    source: {"url":"https://platform.claude.com/docs/en/about-claude/pricing","observedAt":"2026-10-03"},
  },
  {
    canonicalId: "claude-fable-5-1",
    provider: "anthropic",
    aliases: [],
    family: "fable",
    contextWindow: 1000000,
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"10.00","output":"50.00","cachedInput":"0.25","cacheWrite":"12.50","batchMultiplier":"0.5","sourceUrl":"https://platform.claude.com/docs/en/about-claude/pricing","observedAt":"2026-10-03","notes":["Anthropic did not publish an effective date for this rate. effectiveFrom uses 2026-01-01 as a conservative placeholder until the rollout date is confirmed.","Cache hits are priced at 0.025x base input on this model (page footnote 1), not the 0.1x every other model uses - cachedInput is read from the table, not derived.","cacheWrite records the 5-minute TTL rate (1.25x input). The schema has one cacheWrite field, so it does not separately record the 1-hour write rate (2x input)."]},
    ],
    source: {"url":"https://platform.claude.com/docs/en/about-claude/pricing","observedAt":"2026-10-03"},
  },
  {
    canonicalId: "claude-haiku-3-5",
    provider: "anthropic",
    aliases: [],
    family: "haiku",
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"0.80","output":"4.00","cachedInput":"0.08","cacheWrite":"1.00","batchMultiplier":"0.5","sourceUrl":"https://platform.claude.com/docs/en/about-claude/pricing","observedAt":"2026-10-03","notes":["Anthropic did not publish an effective date for this rate. effectiveFrom uses 2026-01-01 as a conservative placeholder until the rollout date is confirmed.","Retired on Anthropic-operated platforms; the pricing page still publishes its rate and notes it remains available on Amazon Bedrock and Google Cloud. Included so historical usage can still be priced.","This model predates 2026, so the conservative 2026-01-01 effectiveFrom cannot price usage from its actual lifetime; no rollout date was published on the source page. A future pass should source real dates before relying on historical lookups for it.","cacheWrite records the 5-minute TTL rate (1.25x input). The schema has one cacheWrite field, so it does not separately record the 1-hour write rate (2x input)."]},
    ],
    source: {"url":"https://platform.claude.com/docs/en/about-claude/pricing","observedAt":"2026-10-03"},
  },
  {
    canonicalId: "claude-haiku-4-5-20251001",
    provider: "anthropic",
    aliases: ["claude-haiku-4-5"],
    family: "haiku",
    contextWindow: 200000,
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"1.00","output":"5.00","cachedInput":"0.10","cacheWrite":"1.25","batchMultiplier":"0.5","sourceUrl":"https://platform.claude.com/docs/en/about-claude/pricing","observedAt":"2026-10-03","notes":["Anthropic did not publish an effective date for this rate. effectiveFrom uses 2026-01-01 as a conservative placeholder until the rollout date is confirmed.","cacheWrite records the 5-minute TTL rate (1.25x input). The schema has one cacheWrite field, so it does not separately record the 1-hour write rate (2x input)."]},
    ],
    source: {"url":"https://platform.claude.com/docs/en/about-claude/pricing","observedAt":"2026-10-03","notes":["canonicalId is the dated snapshot id published on the models overview page; claude-haiku-4-5 is the alias that resolves to it."]},
  },
  {
    canonicalId: "claude-mythos-5",
    provider: "anthropic",
    aliases: [],
    family: "mythos",
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"10.00","output":"50.00","cachedInput":"1.00","cacheWrite":"12.50","batchMultiplier":"0.5","sourceUrl":"https://platform.claude.com/docs/en/about-claude/pricing","observedAt":"2026-10-03","notes":["Anthropic did not publish an effective date for this rate. effectiveFrom uses 2026-01-01 as a conservative placeholder until the rollout date is confirmed.","Limited availability model (page links it to anthropic.com/glasswing); its published rate is recorded as-is.","cacheWrite records the 5-minute TTL rate (1.25x input). The schema has one cacheWrite field, so it does not separately record the 1-hour write rate (2x input)."]},
    ],
    source: {"url":"https://platform.claude.com/docs/en/about-claude/pricing","observedAt":"2026-10-03"},
  },
  {
    canonicalId: "claude-mythos-5-1",
    provider: "anthropic",
    aliases: [],
    family: "mythos",
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"10.00","output":"50.00","cachedInput":"0.25","cacheWrite":"12.50","batchMultiplier":"0.5","sourceUrl":"https://platform.claude.com/docs/en/about-claude/pricing","observedAt":"2026-10-03","notes":["Anthropic did not publish an effective date for this rate. effectiveFrom uses 2026-01-01 as a conservative placeholder until the rollout date is confirmed.","Limited availability model (page links it to anthropic.com/glasswing); its published rate is recorded as-is.","Cache hits are priced at 0.025x base input on this model (page footnote 1), not the 0.1x every other model uses - cachedInput is read from the table, not derived.","cacheWrite records the 5-minute TTL rate (1.25x input). The schema has one cacheWrite field, so it does not separately record the 1-hour write rate (2x input)."]},
    ],
    source: {"url":"https://platform.claude.com/docs/en/about-claude/pricing","observedAt":"2026-10-03"},
  },
  {
    canonicalId: "claude-opus-4",
    provider: "anthropic",
    aliases: [],
    family: "opus",
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"15.00","output":"75.00","cachedInput":"1.50","cacheWrite":"18.75","batchMultiplier":"0.5","sourceUrl":"https://platform.claude.com/docs/en/about-claude/pricing","observedAt":"2026-10-03","notes":["Anthropic did not publish an effective date for this rate. effectiveFrom uses 2026-01-01 as a conservative placeholder until the rollout date is confirmed.","Retired on Anthropic-operated platforms; the pricing page still publishes its rate and notes it remains available on Google Cloud. Included so historical usage can still be priced.","This model predates 2026, so the conservative 2026-01-01 effectiveFrom cannot price usage from its actual lifetime; no rollout date was published on the source page. A future pass should source real dates before relying on historical lookups for it.","cacheWrite records the 5-minute TTL rate (1.25x input). The schema has one cacheWrite field, so it does not separately record the 1-hour write rate (2x input)."]},
    ],
    source: {"url":"https://platform.claude.com/docs/en/about-claude/pricing","observedAt":"2026-10-03"},
  },
  {
    canonicalId: "claude-opus-4-1",
    provider: "anthropic",
    aliases: [],
    family: "opus",
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"15.00","output":"75.00","cachedInput":"1.50","cacheWrite":"18.75","batchMultiplier":"0.5","sourceUrl":"https://platform.claude.com/docs/en/about-claude/pricing","observedAt":"2026-10-03","notes":["Anthropic did not publish an effective date for this rate. effectiveFrom uses 2026-01-01 as a conservative placeholder until the rollout date is confirmed.","Retired on Anthropic-operated platforms; the pricing page still publishes its rate and notes it remains available on Amazon Bedrock and Google Cloud. Included so historical usage can still be priced.","This model predates 2026, so the conservative 2026-01-01 effectiveFrom cannot price usage from its actual lifetime; no rollout date was published on the source page. A future pass should source real dates before relying on historical lookups for it.","cacheWrite records the 5-minute TTL rate (1.25x input). The schema has one cacheWrite field, so it does not separately record the 1-hour write rate (2x input)."]},
    ],
    source: {"url":"https://platform.claude.com/docs/en/about-claude/pricing","observedAt":"2026-10-03"},
  },
  {
    canonicalId: "claude-opus-4-5",
    provider: "anthropic",
    aliases: [],
    family: "opus",
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"5.00","output":"25.00","cachedInput":"0.50","cacheWrite":"6.25","batchMultiplier":"0.5","sourceUrl":"https://platform.claude.com/docs/en/about-claude/pricing","observedAt":"2026-10-03","notes":["Anthropic did not publish an effective date for this rate. effectiveFrom uses 2026-01-01 as a conservative placeholder until the rollout date is confirmed.","cacheWrite records the 5-minute TTL rate (1.25x input). The schema has one cacheWrite field, so it does not separately record the 1-hour write rate (2x input)."]},
    ],
    source: {"url":"https://platform.claude.com/docs/en/about-claude/pricing","observedAt":"2026-10-03"},
  },
  {
    canonicalId: "claude-opus-4-6",
    provider: "anthropic",
    aliases: [],
    family: "opus",
    contextWindow: 1000000,
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"5.00","output":"25.00","cachedInput":"0.50","cacheWrite":"6.25","batchMultiplier":"0.5","sourceUrl":"https://platform.claude.com/docs/en/about-claude/pricing","observedAt":"2026-10-03","notes":["Anthropic did not publish an effective date for this rate. effectiveFrom uses 2026-01-01 as a conservative placeholder until the rollout date is confirmed.","cacheWrite records the 5-minute TTL rate (1.25x input). The schema has one cacheWrite field, so it does not separately record the 1-hour write rate (2x input)."]},
    ],
    source: {"url":"https://platform.claude.com/docs/en/about-claude/pricing","observedAt":"2026-10-03"},
  },
  {
    canonicalId: "claude-opus-4-7",
    provider: "anthropic",
    aliases: [],
    family: "opus",
    contextWindow: 1000000,
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"5.00","output":"25.00","cachedInput":"0.50","cacheWrite":"6.25","batchMultiplier":"0.5","sourceUrl":"https://platform.claude.com/docs/en/about-claude/pricing","observedAt":"2026-10-03","notes":["Anthropic did not publish an effective date for this rate. effectiveFrom uses 2026-01-01 as a conservative placeholder until the rollout date is confirmed.","cacheWrite records the 5-minute TTL rate (1.25x input). The schema has one cacheWrite field, so it does not separately record the 1-hour write rate (2x input)."]},
    ],
    source: {"url":"https://platform.claude.com/docs/en/about-claude/pricing","observedAt":"2026-10-03"},
  },
  {
    canonicalId: "claude-opus-4-8",
    provider: "anthropic",
    aliases: [],
    family: "opus",
    contextWindow: 1000000,
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"5.00","output":"25.00","cachedInput":"0.50","cacheWrite":"6.25","batchMultiplier":"0.5","sourceUrl":"https://platform.claude.com/docs/en/about-claude/pricing","observedAt":"2026-10-03","notes":["Anthropic did not publish an effective date for this rate. effectiveFrom uses 2026-01-01 as a conservative placeholder until the rollout date is confirmed.","cacheWrite records the 5-minute TTL rate (1.25x input). The schema has one cacheWrite field, so it does not separately record the 1-hour write rate (2x input)."]},
    ],
    source: {"url":"https://platform.claude.com/docs/en/about-claude/pricing","observedAt":"2026-10-03"},
  },
  {
    canonicalId: "claude-opus-5",
    provider: "anthropic",
    aliases: [],
    family: "opus",
    contextWindow: 1000000,
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"5.00","output":"25.00","cachedInput":"0.50","cacheWrite":"6.25","batchMultiplier":"0.5","sourceUrl":"https://platform.claude.com/docs/en/about-claude/pricing","observedAt":"2026-10-03","notes":["Anthropic did not publish an effective date for this rate. effectiveFrom uses 2026-01-01 as a conservative placeholder until the rollout date is confirmed.","cacheWrite records the 5-minute TTL rate (1.25x input). The schema has one cacheWrite field, so it does not separately record the 1-hour write rate (2x input)."]},
    ],
    source: {"url":"https://platform.claude.com/docs/en/about-claude/pricing","observedAt":"2026-10-03"},
  },
  {
    canonicalId: "claude-opus-5-5",
    provider: "anthropic",
    aliases: [],
    family: "opus",
    contextWindow: 1000000,
    pricing: [
      {"effectiveFrom":"2026-10-03","currency":"USD","unit":"per-million-tokens","input":"4.00","output":"20.00","cachedInput":"0.20","cacheWrite":"5.00","batchMultiplier":"0.5","sourceUrl":"https://platform.claude.com/docs/en/about-claude/pricing","observedAt":"2026-10-03","notes":["New model: absent from the pricing page on 2026-09-07, present on 2026-10-03. No effective date is published, so effectiveFrom is the observation date rather than this file's usual conservative 2026-01-01 - the model was not on the page at all a month earlier, so backdating it would invent a period.","Cache hits are priced at 0.05x base input on this model (page footnote 2), not the 0.1x most models use - cachedInput is read from the table, not derived.","contextWindow (1M tokens) and the dateless id claude-opus-5-5 are from the models overview page, which lists it in the current lineup.","cacheWrite records the 5-minute TTL rate (1.25x input). The schema has one cacheWrite field, so it does not separately record the 1-hour write rate (2x input)."]},
    ],
    source: {"url":"https://platform.claude.com/docs/en/about-claude/pricing","observedAt":"2026-10-03"},
  },
  {
    canonicalId: "claude-sonnet-4",
    provider: "anthropic",
    aliases: [],
    family: "sonnet",
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"3.00","output":"15.00","cachedInput":"0.30","cacheWrite":"3.75","batchMultiplier":"0.5","sourceUrl":"https://platform.claude.com/docs/en/about-claude/pricing","observedAt":"2026-10-03","notes":["Anthropic did not publish an effective date for this rate. effectiveFrom uses 2026-01-01 as a conservative placeholder until the rollout date is confirmed.","Retired on Anthropic-operated platforms; the pricing page still publishes its rate and notes it remains available on Amazon Bedrock and Google Cloud. Included so historical usage can still be priced.","This model predates 2026, so the conservative 2026-01-01 effectiveFrom cannot price usage from its actual lifetime; no rollout date was published on the source page. A future pass should source real dates before relying on historical lookups for it.","cacheWrite records the 5-minute TTL rate (1.25x input). The schema has one cacheWrite field, so it does not separately record the 1-hour write rate (2x input)."]},
    ],
    source: {"url":"https://platform.claude.com/docs/en/about-claude/pricing","observedAt":"2026-10-03"},
  },
  {
    canonicalId: "claude-sonnet-4-5",
    provider: "anthropic",
    aliases: [],
    family: "sonnet",
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"3.00","output":"15.00","cachedInput":"0.30","cacheWrite":"3.75","batchMultiplier":"0.5","sourceUrl":"https://platform.claude.com/docs/en/about-claude/pricing","observedAt":"2026-10-03","notes":["Anthropic did not publish an effective date for this rate. effectiveFrom uses 2026-01-01 as a conservative placeholder until the rollout date is confirmed.","cacheWrite records the 5-minute TTL rate (1.25x input). The schema has one cacheWrite field, so it does not separately record the 1-hour write rate (2x input)."]},
    ],
    source: {"url":"https://platform.claude.com/docs/en/about-claude/pricing","observedAt":"2026-10-03"},
  },
  {
    canonicalId: "claude-sonnet-4-6",
    provider: "anthropic",
    aliases: [],
    family: "sonnet",
    contextWindow: 1000000,
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"3.00","output":"15.00","cachedInput":"0.30","cacheWrite":"3.75","batchMultiplier":"0.5","sourceUrl":"https://platform.claude.com/docs/en/about-claude/pricing","observedAt":"2026-10-03","notes":["Anthropic did not publish an effective date for this rate. effectiveFrom uses 2026-01-01 as a conservative placeholder until the rollout date is confirmed.","cacheWrite records the 5-minute TTL rate (1.25x input). The schema has one cacheWrite field, so it does not separately record the 1-hour write rate (2x input)."]},
    ],
    source: {"url":"https://platform.claude.com/docs/en/about-claude/pricing","observedAt":"2026-10-03"},
  },
  {
    canonicalId: "claude-sonnet-5",
    provider: "anthropic",
    aliases: [],
    family: "sonnet",
    contextWindow: 1000000,
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"2.00","output":"10.00","cachedInput":"0.20","cacheWrite":"2.50","batchMultiplier":"0.5","sourceUrl":"https://platform.claude.com/docs/en/about-claude/pricing","observedAt":"2026-10-03","notes":["$2.00/$10.00 launched as an introductory rate through 2026-08-31. On 2026-09-07 the pricing page states it \"is now the standard price\" and that \"the previously scheduled increase to $3/$15 per million input/output tokens on September 1, 2026 will not occur\", so the rate continues open-ended rather than ending 2026-08-31.","Supersedes the two-period shape recorded on 2026-08-05 (introductory $2.00/$10.00 to 2026-09-01, then standard $3.00/$15.00). That second period was removed, not closed: the higher rate never took effect, so no date range may report it.","Anthropic did not publish an effective date for this rate. effectiveFrom uses 2026-01-01 as a conservative placeholder until the rollout date is confirmed.","cacheWrite records the 5-minute TTL rate (1.25x input). The schema has one cacheWrite field, so it does not separately record the 1-hour write rate (2x input)."]},
    ],
    source: {"url":"https://platform.claude.com/docs/en/about-claude/pricing","observedAt":"2026-10-03"},
  },
  {
    canonicalId: "claude-sonnet-5-5",
    provider: "anthropic",
    aliases: [],
    family: "sonnet",
    contextWindow: 1000000,
    pricing: [
      {"effectiveFrom":"2026-10-03","currency":"USD","unit":"per-million-tokens","input":"2.00","output":"10.00","cachedInput":"0.20","cacheWrite":"2.50","batchMultiplier":"0.5","sourceUrl":"https://platform.claude.com/docs/en/about-claude/pricing","observedAt":"2026-10-03","notes":["New model: absent from the pricing page on 2026-09-07, present on 2026-10-03. No effective date is published, so effectiveFrom is the observation date rather than this file's usual conservative 2026-01-01 - the model was not on the page at all a month earlier, so backdating it would invent a period.","contextWindow (1M tokens) and the dateless id claude-sonnet-5-5 are from the models overview page, which lists it in the current lineup.","cacheWrite records the 5-minute TTL rate (1.25x input). The schema has one cacheWrite field, so it does not separately record the 1-hour write rate (2x input)."]},
    ],
    source: {"url":"https://platform.claude.com/docs/en/about-claude/pricing","observedAt":"2026-10-03"},
  },
  {
    canonicalId: "amazon-nova-lite",
    provider: "aws-bedrock",
    aliases: [],
    family: "amazon-nova",
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"0.60","output":"2.40","sourceUrl":"https://aws.amazon.com/bedrock/pricing/","observedAt":"2026-08-05","notes":["No effective date is published for this rate. effectiveFrom uses 2026-01-01 as a conservative placeholder.","Same cross-region/in-region caveat as amazon-nova-micro.","The accessible sections of the 2026-09-07 page fetch did not show this model. The rate was not re-observed, so observedAt remains 2026-08-05; one missing listing does not establish a withdrawal.","Also not surfaced by the 2026-10-03 fetch of the same page, which showed the Amazon Nova section headers but no Nova price rows. observedAt stays at 2026-08-05 for the same reason."]},
    ],
    source: {"url":"https://aws.amazon.com/bedrock/pricing/","observedAt":"2026-08-05"},
  },
  {
    canonicalId: "amazon-nova-micro",
    provider: "aws-bedrock",
    aliases: [],
    family: "amazon-nova",
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"0.30","output":"1.20","sourceUrl":"https://aws.amazon.com/bedrock/pricing/","observedAt":"2026-08-05","notes":["AWS's own first-party model (Amazon publishes both Bedrock and Nova), so \"aws-bedrock\" is effectively first-party pricing here, unlike the resold third-party models in this file.","No explicit effective date published for this specific rate (unlike the Claude 3.5 Sonnet rows above, which do carry a stated Dec 2025 date); effectiveFrom is set conservatively to 2026-01-01.","Bedrock's pricing page also distinguishes \"Global cross-region\" vs \"in-region\" inference pricing for Nova; this rate was not confirmed to be specifically the in-region (vs cross-region) figure — treat as the headline on-demand rate observed.","The accessible sections of the 2026-09-07 page fetch did not show this model. The rate was not re-observed, so observedAt remains 2026-08-05; one missing listing does not establish a withdrawal.","Also not surfaced by the 2026-10-03 fetch of the same page, which showed the Amazon Nova section headers but no Nova price rows. observedAt stays at 2026-08-05 for the same reason."]},
    ],
    source: {"url":"https://aws.amazon.com/bedrock/pricing/","observedAt":"2026-08-05"},
  },
  {
    canonicalId: "amazon-nova-pro",
    provider: "aws-bedrock",
    aliases: [],
    family: "amazon-nova",
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"1.20","output":"4.80","sourceUrl":"https://aws.amazon.com/bedrock/pricing/","observedAt":"2026-08-05","notes":["No effective date is published for this rate. effectiveFrom uses 2026-01-01 as a conservative placeholder.","Same cross-region/in-region caveat as amazon-nova-micro.","The accessible sections of the 2026-09-07 page fetch did not show this model. The rate was not re-observed, so observedAt remains 2026-08-05; one missing listing does not establish a withdrawal.","Also not surfaced by the 2026-10-03 fetch of the same page, which showed the Amazon Nova section headers but no Nova price rows. observedAt stays at 2026-08-05 for the same reason."]},
    ],
    source: {"url":"https://aws.amazon.com/bedrock/pricing/","observedAt":"2026-08-05"},
  },
  {
    canonicalId: "claude-3.5-sonnet",
    provider: "aws-bedrock",
    aliases: [],
    family: "anthropic-claude",
    pricing: [
      {"effectiveFrom":"2025-12-01","currency":"USD","unit":"per-million-tokens","input":"6.00","output":"30.00","batchMultiplier":"0.5","sourceUrl":"https://aws.amazon.com/bedrock/pricing/","observedAt":"2026-10-03","notes":["AWS Bedrock's own rate card for this Anthropic model, explicitly labeled \"Effective 1 Dec 2025\" on the pricing page — a real, confirmed effective date, not the conservative default used elsewhere in this file.","Batch: $3.00/$15.00 (confirmed 0.5x standard) as observed on the same page.","This is Bedrock's own price for an older Claude generation (3.5 Sonnet), not the current claude-sonnet-5 model in anthropic.json — no comparable first-party entry exists in this registry for the same model, so no direct parity claim is possible or intended. Bedrock and Azure resell other vendors' models under their own rate cards, so a first-party price is never a safe proxy for theirs.","The same page showed no rate change on 2026-09-07.","The same page showed no rate change on 2026-10-03."]},
    ],
    source: {"url":"https://aws.amazon.com/bedrock/pricing/","observedAt":"2026-10-03"},
  },
  {
    canonicalId: "claude-3.5-sonnet-v2",
    provider: "aws-bedrock",
    aliases: [],
    family: "anthropic-claude",
    pricing: [
      {"effectiveFrom":"2025-12-01","currency":"USD","unit":"per-million-tokens","input":"6.00","output":"30.00","cachedInput":"0.60","cacheWrite":"7.50","batchMultiplier":"0.5","sourceUrl":"https://aws.amazon.com/bedrock/pricing/","observedAt":"2026-10-03","notes":["AWS Bedrock's own rate card, explicitly labeled \"Effective 1 Dec 2025\" on the pricing page.","Batch: $3.00/$15.00 (confirmed 0.5x standard) as observed on the same page.","Bedrock's own price for an older Claude generation; not comparable to any first-party entry currently in anthropic.json (which covers 4.x/5.x models only).","The same page showed no rate change on 2026-09-07.","The same page showed no rate change on 2026-10-03."]},
    ],
    source: {"url":"https://aws.amazon.com/bedrock/pricing/","observedAt":"2026-10-03"},
  },
  {
    canonicalId: "gemma-3-12b",
    provider: "aws-bedrock",
    aliases: [],
    family: "gemma",
    pricing: [
      {"effectiveFrom":"2026-09-07","currency":"USD","unit":"per-million-tokens","input":"0.09","output":"0.29","sourceUrl":"https://aws.amazon.com/bedrock/pricing/","observedAt":"2026-10-03","notes":["This google model's resale rate comes from Bedrock's pricing page, independently of the vendor's first-party file.","Added from the 2026-09-07 fetch; effectiveFrom is the observation date, since the 2026-08-05 fetch of the same page did not surface it.","This is the published US East on-demand rate. Bedrock prices some models by region, but this schema has no region dimension.","The same page showed no rate change on 2026-10-03."]},
    ],
    source: {"url":"https://aws.amazon.com/bedrock/pricing/","observedAt":"2026-10-03"},
  },
  {
    canonicalId: "gemma-3-27b",
    provider: "aws-bedrock",
    aliases: [],
    family: "gemma",
    pricing: [
      {"effectiveFrom":"2026-09-07","currency":"USD","unit":"per-million-tokens","input":"0.23","output":"0.38","sourceUrl":"https://aws.amazon.com/bedrock/pricing/","observedAt":"2026-10-03","notes":["This google model's resale rate comes from Bedrock's pricing page, independently of the vendor's first-party file.","Added from the 2026-09-07 fetch; effectiveFrom is the observation date, since the 2026-08-05 fetch of the same page did not surface it.","This is the published US East on-demand rate. Bedrock prices some models by region, but this schema has no region dimension.","The same page showed no rate change on 2026-10-03."]},
    ],
    source: {"url":"https://aws.amazon.com/bedrock/pricing/","observedAt":"2026-10-03"},
  },
  {
    canonicalId: "gemma-3-4b",
    provider: "aws-bedrock",
    aliases: [],
    family: "gemma",
    pricing: [
      {"effectiveFrom":"2026-10-03","currency":"USD","unit":"per-million-tokens","input":"0.04","output":"0.08","sourceUrl":"https://aws.amazon.com/bedrock/pricing/","observedAt":"2026-10-03","notes":["This google model's resale rate comes from Bedrock's pricing page, independently of the vendor's first-party file.","Added from the 2026-10-03 fetch, which printed the row \"Gemma 3 4B | $ 0.04 | $ 0.08\" under US East (N. Virginia), US East (Ohio) and US West (Oregon), per 1M tokens. The page gives no effective date, so effectiveFrom is the observation date.","This is the published US East on-demand rate. Bedrock prices some models by region, but this schema has no region dimension."]},
    ],
    source: {"url":"https://aws.amazon.com/bedrock/pricing/","observedAt":"2026-10-03"},
  },
  {
    canonicalId: "gemma-4-26b-a4b",
    provider: "aws-bedrock",
    aliases: [],
    family: "gemma",
    pricing: [
      {"effectiveFrom":"2026-10-03","currency":"USD","unit":"per-million-tokens","input":"0.13","output":"0.40","sourceUrl":"https://aws.amazon.com/bedrock/pricing/","observedAt":"2026-10-03","notes":["This google model's resale rate comes from Bedrock's pricing page, independently of the vendor's first-party file.","Added from the 2026-10-03 fetch, which printed the row \"Gemma 4 26B A4B | $0.13 | $ 0.40\" under US East (N. Virginia), US East (Ohio) and US West (Oregon), per 1M tokens. The page gives no effective date, so effectiveFrom is the observation date.","This is the published US East on-demand rate. Bedrock prices some models by region, but this schema has no region dimension."]},
    ],
    source: {"url":"https://aws.amazon.com/bedrock/pricing/","observedAt":"2026-10-03"},
  },
  {
    canonicalId: "gemma-4-31b",
    provider: "aws-bedrock",
    aliases: [],
    family: "google-gemma",
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"0.14","output":"0.40","sourceUrl":"https://aws.amazon.com/bedrock/pricing/","observedAt":"2026-10-03","notes":["No effective date is published for this rate. effectiveFrom uses 2026-01-01 as a conservative placeholder.","This canonicalId is shared across providers: Together AI also lists \"Gemma 4 31B\" (together.json: gemma-4-31b) at a different, higher rate ($0.39/$0.97 as observed) — same underlying Google open-weight model, independently priced by each reseller; do not assume parity.","The same page showed no rate change on 2026-09-07.","The same page showed no rate change on 2026-10-03."]},
    ],
    source: {"url":"https://aws.amazon.com/bedrock/pricing/","observedAt":"2026-10-03"},
  },
  {
    canonicalId: "gemma-4-e2b",
    provider: "aws-bedrock",
    aliases: [],
    family: "gemma",
    pricing: [
      {"effectiveFrom":"2026-10-03","currency":"USD","unit":"per-million-tokens","input":"0.04","output":"0.08","sourceUrl":"https://aws.amazon.com/bedrock/pricing/","observedAt":"2026-10-03","notes":["This google model's resale rate comes from Bedrock's pricing page, independently of the vendor's first-party file.","Added from the 2026-10-03 fetch, which printed the row \"Gemma 4 E2B | $0.04 | $ 0.08\" under US East (N. Virginia), US East (Ohio) and US West (Oregon), per 1M tokens. The page gives no effective date, so effectiveFrom is the observation date.","This is the published US East on-demand rate. Bedrock prices some models by region, but this schema has no region dimension."]},
    ],
    source: {"url":"https://aws.amazon.com/bedrock/pricing/","observedAt":"2026-10-03"},
  },
  {
    canonicalId: "mistral-large-3",
    provider: "aws-bedrock",
    aliases: [],
    family: "mistral",
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"0.50","output":"1.50","sourceUrl":"https://aws.amazon.com/bedrock/pricing/","observedAt":"2026-10-03","notes":["No effective date is published for this rate. effectiveFrom uses 2026-01-01 as a conservative placeholder.","This canonicalId is shared across providers: Mistral's own first-party pricing (mistral.json: mistral-large-3) shows the identical $0.50/$1.50 figure as independently observed — coincidental agreement between the two independently fetched sources, not assumed; both were confirmed directly.","The same page showed no rate change on 2026-09-07.","The same page showed no rate change on 2026-10-03."]},
    ],
    source: {"url":"https://aws.amazon.com/bedrock/pricing/","observedAt":"2026-10-03"},
  },
  {
    canonicalId: "nemotron-3-nano-30b",
    provider: "aws-bedrock",
    aliases: [],
    family: "nemotron",
    pricing: [
      {"effectiveFrom":"2026-10-03","currency":"USD","unit":"per-million-tokens","input":"0.06","output":"0.24","sourceUrl":"https://aws.amazon.com/bedrock/pricing/","observedAt":"2026-10-03","notes":["This nvidia model's resale rate comes from Bedrock's pricing page, independently of the vendor's first-party file.","Added from the 2026-10-03 fetch, which printed the row \"NVIDIA Nemotron 3 Nano 30B A3B | $ 0.06 | $ 0.24\" under US East (N. Virginia), US East (Ohio) and US West (Oregon), per 1M tokens. The page gives no effective date, so effectiveFrom is the observation date.","This is the published US East on-demand rate. Bedrock prices some models by region, but this schema has no region dimension."]},
    ],
    source: {"url":"https://aws.amazon.com/bedrock/pricing/","observedAt":"2026-10-03"},
  },
  {
    canonicalId: "nemotron-3-super-120b",
    provider: "aws-bedrock",
    aliases: [],
    family: "nemotron",
    pricing: [
      {"effectiveFrom":"2026-09-07","currency":"USD","unit":"per-million-tokens","input":"0.15","output":"0.65","sourceUrl":"https://aws.amazon.com/bedrock/pricing/","observedAt":"2026-10-03","notes":["This nvidia model's resale rate comes from Bedrock's pricing page, independently of the vendor's first-party file.","Added from the 2026-09-07 fetch; effectiveFrom is the observation date, since the 2026-08-05 fetch of the same page did not surface it.","This is the published US East on-demand rate. Bedrock prices some models by region, but this schema has no region dimension.","The same page showed no rate change on 2026-10-03."]},
    ],
    source: {"url":"https://aws.amazon.com/bedrock/pricing/","observedAt":"2026-10-03"},
  },
  {
    canonicalId: "nemotron-nano-2",
    provider: "aws-bedrock",
    aliases: [],
    family: "nvidia-nemotron",
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"0.06","output":"0.23","sourceUrl":"https://aws.amazon.com/bedrock/pricing/","observedAt":"2026-10-03","notes":["No effective date is published for this rate. effectiveFrom uses 2026-01-01 as a conservative placeholder.","The accessible sections of the 2026-09-07 page fetch did not show this model. The rate was not re-observed, so observedAt remains 2026-08-05; one missing listing does not establish a withdrawal.","The same page showed no rate change on 2026-10-03."]},
    ],
    source: {"url":"https://aws.amazon.com/bedrock/pricing/","observedAt":"2026-10-03"},
  },
  {
    canonicalId: "gpt-3.5-turbo",
    provider: "azure-openai",
    aliases: [],
    family: "gpt-3.5",
    pricing: [
      {"effectiveFrom":"2025-03-01","currency":"USD","unit":"per-million-tokens","input":"0.50","output":"1.50","cheapestTier":true,"sourceUrl":"https://prices.azure.com/api/retail/prices?currencyCode='USD'&$filter=contains(productName,%20%27OpenAI%27)","observedAt":"2026-10-03","notes":["The Azure Retail Prices API quotes this meter per 1K tokens. Its per-million-token rate was calculated by shifting the decimal point three places in a string, without floating-point multiplication.","The Retail Prices API returned exactly one row for this legacy SKU (a single primary-meter-region price, no per-region breakdown) rather than the ~24-28 region-duplicated rows seen for actively-priced SKUs — a single global list price, which is consistent with (not contradictory to) Global-deployment region-independence, but could not be cross-region spot-checked the way other entries were.","The Retail Prices API response had no Batch API meter for this model/SKU, so batchMultiplier is omitted.","Azure Global matches the observed OpenAI rate for \"gpt-3.5-turbo\" in openai.json ($0.50/$1.50); no markup was found.","Azure resells the OpenAI model under the same canonicalId, \"gpt-3.5-turbo\". This follows the shared-ID convention used for \"mistral-large-3\" and \"gemma-4-31b\" in aws-bedrock.json; OpenRouter uses provider-prefixed slugs. A lookup without a provider qualifier is ambiguous and fails. openai.json has no matching cross-reference; a follow-up should add one.","Re-observed 2026-10-03 via a Retail Prices API query filtered to this model's meters (spaincentral (the only region returned)): \"gpt-35-turbo16K-0125 Inp-glbl\" 0.0005 per 1K, \"gpt-35-turbo16K-0125 Outp-glbl\" 0.0015 per 1K. Per-1K values converted by shifting the decimal point 3 places. No Global Batch meter was returned for this model. Unchanged."]},
    ],
    source: {"url":"https://prices.azure.com/api/retail/prices?currencyCode='USD'&$filter=contains(productName,%20%27OpenAI%27)","observedAt":"2026-10-03"},
  },
  {
    canonicalId: "gpt-4",
    provider: "azure-openai",
    aliases: [],
    family: "gpt-4",
    pricing: [
      {"effectiveFrom":"2025-03-01","currency":"USD","unit":"per-million-tokens","input":"30.00","output":"60.00","batchMultiplier":"0.5","cheapestTier":true,"sourceUrl":"https://prices.azure.com/api/retail/prices?currencyCode='USD'&$filter=contains(productName,%20%27OpenAI%27)","observedAt":"2026-10-03","notes":["The Azure Retail Prices API quotes this meter per 1K tokens. Its per-million-token rate was calculated by shifting the decimal point three places in a string, without floating-point multiplication.","The Retail Prices API returned exactly one row for this legacy SKU (a single primary-meter-region price, no per-region breakdown) rather than the ~24-28 region-duplicated rows seen for actively-priced SKUs — a single global list price, which is consistent with (not contradictory to) Global-deployment region-independence, but could not be cross-region spot-checked the way other entries were.","batchMultiplier 0.5 added 2026-10-03 from this model's own Global Batch meters (\"gpt-4-8K-Batch-Inp-glbl\" 0.015 per 1K, \"gpt-4-8K-Batch-Outp-glbl\" 0.03 per 1K), both exactly 0.5x the standard Global rate. The 2026-08-05 pass reported no Batch meter for this model; given the meter's start date it was most likely missed then rather than added since. The earliest effectiveStartDate among this meter's regional rows is 2024-08-01, before this period's effectiveFrom (2025-03-01), so the discount covers the whole period.","No comparable first-party entry exists in openai.json's 2026-08-05 snapshot for \"gpt-4\" (it is either a legacy/superseded model no longer on OpenAI's current pricing page, or a variant OpenAI does not sell directly) — Azure's own resale rate is recorded as observed with no parity claim possible or intended.","Re-observed 2026-10-03 via a Retail Prices API query filtered to this model's meters (spaincentral (the only region returned)): \"gpt-4-8K-Inp-glbl\" 0.03 per 1K, \"gpt-4-8K-Outp-glbl\" 0.06 per 1K. Per-1K values converted by shifting the decimal point 3 places. Global Batch meters \"gpt-4-8K-Batch-Inp-glbl\" 0.015 per 1K and \"gpt-4-8K-Batch-Outp-glbl\" 0.03 per 1K are exactly 0.5x the standard rates. Unchanged."]},
    ],
    source: {"url":"https://prices.azure.com/api/retail/prices?currencyCode='USD'&$filter=contains(productName,%20%27OpenAI%27)","observedAt":"2026-10-03"},
  },
  {
    canonicalId: "gpt-4-32k",
    provider: "azure-openai",
    aliases: [],
    family: "gpt-4",
    pricing: [
      {"effectiveFrom":"2025-03-01","currency":"USD","unit":"per-million-tokens","input":"60.00","output":"120.00","cheapestTier":true,"sourceUrl":"https://prices.azure.com/api/retail/prices?currencyCode='USD'&$filter=contains(productName,%20%27OpenAI%27)","observedAt":"2026-10-03","notes":["The Azure Retail Prices API quotes this meter per 1K tokens. Its per-million-token rate was calculated by shifting the decimal point three places in a string, without floating-point multiplication.","The Retail Prices API returned exactly one row for this legacy SKU (a single primary-meter-region price, no per-region breakdown) rather than the ~24-28 region-duplicated rows seen for actively-priced SKUs — a single global list price, which is consistent with (not contradictory to) Global-deployment region-independence, but could not be cross-region spot-checked the way other entries were.","The Retail Prices API response had no Batch API meter for this model/SKU, so batchMultiplier is omitted.","No comparable first-party entry exists in openai.json's 2026-08-05 snapshot for \"gpt-4-32k\" (it is either a legacy/superseded model no longer on OpenAI's current pricing page, or a variant OpenAI does not sell directly) — Azure's own resale rate is recorded as observed with no parity claim possible or intended.","Re-observed 2026-10-03 via a Retail Prices API query filtered to this model's meters (spaincentral (the only region returned)): \"gpt-4-32K-Inp-glbl\" 0.06 per 1K, \"gpt-4-32K-Outp-glbl\" 0.12 per 1K. Per-1K values converted by shifting the decimal point 3 places. No Global Batch meter was returned for this model. Unchanged."]},
    ],
    source: {"url":"https://prices.azure.com/api/retail/prices?currencyCode='USD'&$filter=contains(productName,%20%27OpenAI%27)","observedAt":"2026-10-03"},
  },
  {
    canonicalId: "gpt-4-turbo",
    provider: "azure-openai",
    aliases: [],
    family: "gpt-4-turbo",
    pricing: [
      {"effectiveFrom":"2024-06-01","currency":"USD","unit":"per-million-tokens","input":"10.00","output":"30.00","batchMultiplier":"0.5","cheapestTier":true,"sourceUrl":"https://prices.azure.com/api/retail/prices?currencyCode='USD'&$filter=contains(productName,%20%27OpenAI%27)","observedAt":"2026-10-03","notes":["The Azure Retail Prices API quotes this meter per 1K tokens. Its per-million-token rate was calculated by shifting the decimal point three places in a string, without floating-point multiplication.","A programmatic check found the same retailPrice in all 23 Azure regions returned for this Global SKU, with no regional variation.","batchMultiplier 0.5 added 2026-10-03 from this model's own Global Batch meters (\"gpt-4-Turbo-Batch-128K Inp-glbl\" 0.005 per 1K, \"gpt-4-Turbo-Batch-128K Outp-glbl\" 0.015 per 1K), both exactly 0.5x the standard Global rate. The 2026-08-05 pass reported no Batch meter for this model; given the meter's start date it was most likely missed then rather than added since. The earliest effectiveStartDate among this meter's regional rows is 2024-08-01, two months after this period's effectiveFrom (2024-06-01), so a Batch lookup dated June or July 2024 applies a discount the API does not show as available yet.","No comparable first-party entry exists in openai.json's 2026-08-05 snapshot for \"gpt-4-turbo\" (it is either a legacy/superseded model no longer on OpenAI's current pricing page, or a variant OpenAI does not sell directly) — Azure's own resale rate is recorded as observed with no parity claim possible or intended.","The Retail Prices API returned these meters for this model in eastus2 on 2026-10-03: \"gpt-4-turbo128K Inp-glbl\" 0.01 per 1K, \"gpt-4-turbo128K Outp-glbl\" 0.03 per 1K. Per-1K values converted by shifting the decimal point 3 places. Global Batch meters \"gpt-4-Turbo-Batch-128K Inp-glbl\" 0.005 per 1K and \"gpt-4-Turbo-Batch-128K Outp-glbl\" 0.015 per 1K are exactly 0.5x the standard rates. The rates were unchanged."]},
    ],
    source: {"url":"https://prices.azure.com/api/retail/prices?currencyCode='USD'&$filter=contains(productName,%20%27OpenAI%27)","observedAt":"2026-10-03"},
  },
  {
    canonicalId: "gpt-4.1",
    provider: "azure-openai",
    aliases: [],
    family: "gpt-4.1",
    pricing: [
      {"effectiveFrom":"2025-04-01","currency":"USD","unit":"per-million-tokens","input":"2.00","output":"8.00","cachedInput":"0.50","batchMultiplier":"0.5","cheapestTier":true,"sourceUrl":"https://prices.azure.com/api/retail/prices?currencyCode='USD'&$filter=contains(productName,%20%27OpenAI%27)","observedAt":"2026-10-03","notes":["The Azure Retail Prices API quotes this meter per 1K tokens. Its per-million-token rate was calculated by shifting the decimal point three places in a string, without floating-point multiplication.","A programmatic check found the same retailPrice in all 28 Azure regions returned for this Global SKU, with no regional variation.","This model's Azure Batch API input and output meters are each half its standard Global rate, confirming batchMultiplier 0.5.","Azure Global matches the observed OpenAI rate for \"gpt-4.1\" in openai.json ($2.00/$8.00/$0.50 cached); no markup was found.","Azure resells the OpenAI model under the same canonicalId, \"gpt-4.1\". This follows the shared-ID convention used for \"mistral-large-3\" and \"gemma-4-31b\" in aws-bedrock.json; OpenRouter uses provider-prefixed slugs. A lookup without a provider qualifier is ambiguous and fails. openai.json has no matching cross-reference; a follow-up should add one.","The Retail Prices API returned these meters for this model in eastus2 on 2026-10-03: \"gpt 4.1 Inp glbl\" 0.002 per 1K, \"gpt 4.1 Outp glbl\" 0.008 per 1K, \"gpt 4.1 cached Inp glbl\" 0.0005 per 1K. Per-1K values converted by shifting the decimal point 3 places. Global Batch meters \"gpt 4.1 Batch Inp glbl\" 0.001 per 1K and \"gpt 4.1 Batch Outp glbl\" 0.004 per 1K are exactly 0.5x the standard rates. The rates were unchanged."]},
    ],
    source: {"url":"https://prices.azure.com/api/retail/prices?currencyCode='USD'&$filter=contains(productName,%20%27OpenAI%27)","observedAt":"2026-10-03"},
  },
  {
    canonicalId: "gpt-4.1-mini",
    provider: "azure-openai",
    aliases: [],
    family: "gpt-4.1",
    pricing: [
      {"effectiveFrom":"2025-04-01","currency":"USD","unit":"per-million-tokens","input":"0.40","output":"1.60","cachedInput":"0.10","batchMultiplier":"0.5","cheapestTier":true,"sourceUrl":"https://prices.azure.com/api/retail/prices?currencyCode='USD'&$filter=contains(productName,%20%27OpenAI%27)","observedAt":"2026-10-03","notes":["The Azure Retail Prices API quotes this meter per 1K tokens. Its per-million-token rate was calculated by shifting the decimal point three places in a string, without floating-point multiplication.","A programmatic check found the same retailPrice in all 28 Azure regions returned for this Global SKU, with no regional variation.","This model's Azure Batch API input and output meters are each half its standard Global rate, confirming batchMultiplier 0.5.","Azure Global matches the observed OpenAI rate for \"gpt-4.1-mini\" in openai.json ($0.40/$1.60/$0.10 cached); no markup was found.","Azure resells the OpenAI model under the same canonicalId, \"gpt-4.1-mini\". This follows the shared-ID convention used for \"mistral-large-3\" and \"gemma-4-31b\" in aws-bedrock.json; OpenRouter uses provider-prefixed slugs. A lookup without a provider qualifier is ambiguous and fails. openai.json has no matching cross-reference; a follow-up should add one.","The Retail Prices API returned these meters for this model in eastus2 on 2026-10-03: \"gpt 4.1 mini Inp glbl\" 0.0004 per 1K, \"gpt 4.1 mini Outp glbl\" 0.0016 per 1K, \"gpt 4.1 mini cached Inp glbl\" 0.0001 per 1K. Per-1K values converted by shifting the decimal point 3 places. Global Batch meters \"gpt 4.1 mini Batch Inp glbl\" 0.0002 per 1K and \"gpt 4.1 mini Batch Outp glbl\" 0.0008 per 1K are exactly 0.5x the standard rates. The rates were unchanged."]},
    ],
    source: {"url":"https://prices.azure.com/api/retail/prices?currencyCode='USD'&$filter=contains(productName,%20%27OpenAI%27)","observedAt":"2026-10-03"},
  },
  {
    canonicalId: "gpt-4.1-nano",
    provider: "azure-openai",
    aliases: [],
    family: "gpt-4.1",
    pricing: [
      {"effectiveFrom":"2025-04-01","currency":"USD","unit":"per-million-tokens","input":"0.10","output":"0.40","cachedInput":"0.025","batchMultiplier":"0.5","cheapestTier":true,"sourceUrl":"https://prices.azure.com/api/retail/prices?currencyCode='USD'&$filter=contains(productName,%20%27OpenAI%27)","observedAt":"2026-10-03","notes":["The Azure Retail Prices API quotes this meter per 1K tokens. Its per-million-token rate was calculated by shifting the decimal point three places in a string, without floating-point multiplication.","A programmatic check found the same retailPrice in all 28 Azure regions returned for this Global SKU, with no regional variation.","This model's Azure Batch API input and output meters are each half its standard Global rate, confirming batchMultiplier 0.5.","Azure Global matches the observed OpenAI rate for \"gpt-4.1-nano\" in openai.json ($0.10/$0.40/$0.025 cached); no markup was found.","Azure resells the OpenAI model under the same canonicalId, \"gpt-4.1-nano\". This follows the shared-ID convention used for \"mistral-large-3\" and \"gemma-4-31b\" in aws-bedrock.json; OpenRouter uses provider-prefixed slugs. A lookup without a provider qualifier is ambiguous and fails. openai.json has no matching cross-reference; a follow-up should add one.","The Retail Prices API returned these meters for this model in eastus2 on 2026-10-03: \"gpt 4.1 nano Inp glbl\" 0.0001 per 1K, \"gpt 4.1 nano Outp glbl\" 0.0004 per 1K, \"gpt 4.1 nano cached Inp glbl\" 0.000025 per 1K. Per-1K values converted by shifting the decimal point 3 places. Global Batch meters \"gpt 4.1 nano Batch Inp glbl\" 0.00005 per 1K and \"gpt 4.1 nano Batch Outp glbl\" 0.0002 per 1K are exactly 0.5x the standard rates. The rates were unchanged."]},
    ],
    source: {"url":"https://prices.azure.com/api/retail/prices?currencyCode='USD'&$filter=contains(productName,%20%27OpenAI%27)","observedAt":"2026-10-03"},
  },
  {
    canonicalId: "gpt-4o",
    provider: "azure-openai",
    aliases: [],
    family: "gpt-4o",
    pricing: [
      {"effectiveFrom":"2024-12-01","currency":"USD","unit":"per-million-tokens","input":"2.50","output":"10.00","cachedInput":"1.25","batchMultiplier":"0.5","cheapestTier":true,"sourceUrl":"https://prices.azure.com/api/retail/prices?currencyCode='USD'&$filter=contains(productName,%20%27OpenAI%27)","observedAt":"2026-10-03","notes":["The Azure Retail Prices API quotes this meter per 1K tokens. Its per-million-token rate was calculated by shifting the decimal point three places in a string, without floating-point multiplication.","A programmatic check found the same retailPrice in all 27 Azure regions returned for this Global SKU, with no regional variation.","This model's Azure Batch API input and output meters are each half its standard Global rate, confirming batchMultiplier 0.5.","Azure Global matches the observed OpenAI rate for \"gpt-4o\" in openai.json ($2.50/$10.00/$1.25 cached); no markup was found.","Azure resells the OpenAI model under the same canonicalId, \"gpt-4o\". This follows the shared-ID convention used for \"mistral-large-3\" and \"gemma-4-31b\" in aws-bedrock.json; OpenRouter uses provider-prefixed slugs. A lookup without a provider qualifier is ambiguous and fails. openai.json has no matching cross-reference; a follow-up should add one.","The Retail Prices API returned these meters for this model in eastus2 on 2026-10-03: \"gpt 4o 1120 Inp glbl\" 0.0025 per 1K, \"gpt 4o 1120 Outp glbl\" 0.01 per 1K, \"gpt 4o 1120 cached Inp glbl\" 0.00125 per 1K. Per-1K values converted by shifting the decimal point 3 places. Global Batch meters \"gpt 4o 1120 Batch Inp glbl\" 0.00125 per 1K and \"gpt 4o 1120 Batch Outp glbl\" 0.005 per 1K are exactly 0.5x the standard rates. The rates were unchanged."]},
    ],
    source: {"url":"https://prices.azure.com/api/retail/prices?currencyCode='USD'&$filter=contains(productName,%20%27OpenAI%27)","observedAt":"2026-10-03"},
  },
  {
    canonicalId: "gpt-4o-mini",
    provider: "azure-openai",
    aliases: [],
    family: "gpt-4o",
    pricing: [
      {"effectiveFrom":"2024-07-01","currency":"USD","unit":"per-million-tokens","input":"0.15","output":"0.60","cachedInput":"0.075","batchMultiplier":"0.5","cheapestTier":true,"sourceUrl":"https://prices.azure.com/api/retail/prices?currencyCode='USD'&$filter=contains(productName,%20%27OpenAI%27)","observedAt":"2026-10-03","notes":["The Azure Retail Prices API quotes this meter per 1K tokens. Its per-million-token rate was calculated by shifting the decimal point three places in a string, without floating-point multiplication.","A programmatic check found the same retailPrice in all 28 Azure regions returned for this Global SKU, with no regional variation.","This model's Azure Batch API input and output meters are each half its standard Global rate, confirming batchMultiplier 0.5.","Azure Global matches the observed OpenAI rate for \"gpt-4o-mini\" in openai.json ($0.15/$0.60/$0.075 cached); no markup was found.","Azure resells the OpenAI model under the same canonicalId, \"gpt-4o-mini\". This follows the shared-ID convention used for \"mistral-large-3\" and \"gemma-4-31b\" in aws-bedrock.json; OpenRouter uses provider-prefixed slugs. A lookup without a provider qualifier is ambiguous and fails. openai.json has no matching cross-reference; a follow-up should add one.","The Retail Prices API returned these meters for this model in eastus2 on 2026-10-03: \"gpt-4o-mini-0718-Inp-glbl\" 0.00015 per 1K, \"gpt-4o-mini-0718-Outp-glbl\" 0.0006 per 1K, \"gpt 4o mini 0718 cached Inp glbl\" 0.000075 per 1K. Per-1K values converted by shifting the decimal point 3 places. Global Batch meters \"gpt-4o-mini-0718-Batch-Inp-glbl\" 0.000075 per 1K and \"gpt-4o-mini-0718-Batch-Outp-glbl\" 0.0003 per 1K are exactly 0.5x the standard rates. The rates were unchanged."]},
    ],
    source: {"url":"https://prices.azure.com/api/retail/prices?currencyCode='USD'&$filter=contains(productName,%20%27OpenAI%27)","observedAt":"2026-10-03"},
  },
  {
    canonicalId: "gpt-5",
    provider: "azure-openai",
    aliases: [],
    family: "gpt-5",
    pricing: [
      {"effectiveFrom":"2025-08-01","currency":"USD","unit":"per-million-tokens","input":"1.25","output":"10.00","cachedInput":"0.125","batchMultiplier":"0.5","cheapestTier":true,"sourceUrl":"https://prices.azure.com/api/retail/prices?currencyCode='USD'&$filter=contains(productName,%20%27OpenAI%27)","observedAt":"2026-10-03","notes":["A programmatic check found the same retailPrice in all 24 Azure regions returned for this Global SKU, with no regional variation.","This model's Azure Batch API input and output meters are each half its standard Global rate, confirming batchMultiplier 0.5.","Azure Global matches the observed OpenAI rate for \"gpt-5\" in openai.json ($1.25/$10.00/$0.125 cached); no markup was found.","Azure resells the OpenAI model under the same canonicalId, \"gpt-5\". This follows the shared-ID convention used for \"mistral-large-3\" and \"gemma-4-31b\" in aws-bedrock.json; OpenRouter uses provider-prefixed slugs. A lookup without a provider qualifier is ambiguous and fails. openai.json has no matching cross-reference; a follow-up should add one.","The Retail Prices API returned these meters for this model in eastus2 on 2026-10-03: \"GPT 5 Inpt Glbl\" 1.25 per 1M, \"GPT 5 outpt Glbl\" 10.0 per 1M, \"GPT 5 cchd Inpt Glbl\" 0.125 per 1M. Global Batch meters \"GPT 5 Batch Inpt Glbl\" 0.625 per 1M and \"GPT 5 Batch outpt Glbl\" 5.0 per 1M are exactly 0.5x the standard rates. The rates were unchanged."]},
    ],
    source: {"url":"https://prices.azure.com/api/retail/prices?currencyCode='USD'&$filter=contains(productName,%20%27OpenAI%27)","observedAt":"2026-10-03"},
  },
  {
    canonicalId: "gpt-5-mini",
    provider: "azure-openai",
    aliases: [],
    family: "gpt-5",
    pricing: [
      {"effectiveFrom":"2025-08-01","currency":"USD","unit":"per-million-tokens","input":"0.25","output":"2.00","cachedInput":"0.025","batchMultiplier":"0.5","cheapestTier":true,"sourceUrl":"https://prices.azure.com/api/retail/prices?currencyCode='USD'&$filter=contains(productName,%20%27OpenAI%27)","observedAt":"2026-10-03","notes":["A programmatic check found the same retailPrice in all 27 Azure regions returned for this Global SKU, with no regional variation.","This model's Azure Batch API input and output meters are each half its standard Global rate, confirming batchMultiplier 0.5.","Azure Global matches the observed OpenAI rate for \"gpt-5-mini\" in openai.json ($0.25/$2.00/$0.025 cached); no markup was found.","Azure resells the OpenAI model under the same canonicalId, \"gpt-5-mini\". This follows the shared-ID convention used for \"mistral-large-3\" and \"gemma-4-31b\" in aws-bedrock.json; OpenRouter uses provider-prefixed slugs. A lookup without a provider qualifier is ambiguous and fails. openai.json has no matching cross-reference; a follow-up should add one.","The Retail Prices API returned these meters for this model in eastus2 on 2026-10-03: \"GPT 5 Mini Inpt Glbl\" 0.25 per 1M, \"GPT 5 Mini outpt Glbl\" 2.0 per 1M, \"GPT 5 Mini cchd Inpt Glbl\" 0.025 per 1M. Global Batch meters \"GPT 5 Mini Batch Inpt Glbl\" 0.125 per 1M and \"GPT 5 Mini Batch outpt Glbl\" 1.0 per 1M are exactly 0.5x the standard rates. The rates were unchanged."]},
    ],
    source: {"url":"https://prices.azure.com/api/retail/prices?currencyCode='USD'&$filter=contains(productName,%20%27OpenAI%27)","observedAt":"2026-10-03"},
  },
  {
    canonicalId: "gpt-5-nano",
    provider: "azure-openai",
    aliases: [],
    family: "gpt-5",
    pricing: [
      {"effectiveFrom":"2025-08-01","currency":"USD","unit":"per-million-tokens","input":"0.05","output":"0.40","cachedInput":"0.005","batchMultiplier":"0.5","cheapestTier":true,"sourceUrl":"https://prices.azure.com/api/retail/prices?currencyCode='USD'&$filter=contains(productName,%20%27OpenAI%27)","observedAt":"2026-10-03","notes":["A programmatic check found the same retailPrice in all 27 Azure regions returned for this Global SKU, with no regional variation.","This model's Azure Batch API input and output meters are each half its standard Global rate, confirming batchMultiplier 0.5.","Azure Global matches the observed OpenAI rate for \"gpt-5-nano\" in openai.json ($0.05/$0.40/$0.005 cached); no markup was found.","Azure resells the OpenAI model under the same canonicalId, \"gpt-5-nano\". This follows the shared-ID convention used for \"mistral-large-3\" and \"gemma-4-31b\" in aws-bedrock.json; OpenRouter uses provider-prefixed slugs. A lookup without a provider qualifier is ambiguous and fails. openai.json has no matching cross-reference; a follow-up should add one.","The Retail Prices API returned these meters for this model in eastus2 on 2026-10-03: \"GPT 5 Nano Inpt Glbl\" 0.05 per 1M, \"GPT 5 Nano outpt Glbl\" 0.4 per 1M, \"GPT 5 Nano cchd Inpt Glbl\" 0.005 per 1M. Global Batch meters \"GPT 5 Nano Batch Inpt Glbl\" 0.025 per 1M and \"GPT 5 Nano Batch outpt Glbl\" 0.2 per 1M are exactly 0.5x the standard rates. The rates were unchanged."]},
    ],
    source: {"url":"https://prices.azure.com/api/retail/prices?currencyCode='USD'&$filter=contains(productName,%20%27OpenAI%27)","observedAt":"2026-10-03"},
  },
  {
    canonicalId: "gpt-5-pro",
    provider: "azure-openai",
    aliases: [],
    family: "gpt-5",
    pricing: [
      {"effectiveFrom":"2025-10-01","currency":"USD","unit":"per-million-tokens","input":"15.00","output":"120.00","batchMultiplier":"0.5","cheapestTier":true,"sourceUrl":"https://prices.azure.com/api/retail/prices?currencyCode='USD'&$filter=contains(productName,%20%27OpenAI%27)","observedAt":"2026-10-03","notes":["The Azure Retail Prices API quotes this meter per 1K tokens. Its per-million-token rate was calculated by shifting the decimal point three places in a string, without floating-point multiplication.","A programmatic check found the same retailPrice in all 24 Azure regions returned for this Global SKU, with no regional variation.","This model's Azure Batch API input and output meters are each half its standard Global rate, confirming batchMultiplier 0.5.","Azure Global matches the observed OpenAI rate for \"gpt-5-pro\" in openai.json ($15.00/$120.00); no markup was found.","Azure resells the OpenAI model under the same canonicalId, \"gpt-5-pro\". This follows the shared-ID convention used for \"mistral-large-3\" and \"gemma-4-31b\" in aws-bedrock.json; OpenRouter uses provider-prefixed slugs. A lookup without a provider qualifier is ambiguous and fails. openai.json has no matching cross-reference; a follow-up should add one.","The Retail Prices API returned these meters for this model in eastus2 on 2026-10-03: \"gpt 5 pro inp glbl\" 0.015 per 1K, \"gpt 5 pro out glbl\" 0.12 per 1K. Per-1K values converted by shifting the decimal point 3 places. Global Batch meters \"gpt 5 pro batch inp glbl\" 0.0075 per 1K and \"gpt 5 pro batch out glbl\" 0.06 per 1K are exactly 0.5x the standard rates. The rates were unchanged."]},
    ],
    source: {"url":"https://prices.azure.com/api/retail/prices?currencyCode='USD'&$filter=contains(productName,%20%27OpenAI%27)","observedAt":"2026-10-03"},
  },
  {
    canonicalId: "gpt-5.1",
    provider: "azure-openai",
    aliases: [],
    family: "gpt-5.1",
    pricing: [
      {"effectiveFrom":"2025-11-01","currency":"USD","unit":"per-million-tokens","input":"1.25","output":"10.00","cachedInput":"0.125","batchMultiplier":"0.5","cheapestTier":true,"sourceUrl":"https://prices.azure.com/api/retail/prices?currencyCode='USD'&$filter=contains(productName,%20%27OpenAI%27)","observedAt":"2026-10-03","notes":["A programmatic check found the same retailPrice in all 25 Azure regions returned for this Global SKU, with no regional variation.","This model's Azure Batch API input and output meters are each half its standard Global rate, confirming batchMultiplier 0.5.","Azure Global matches the observed OpenAI rate for \"gpt-5.1\" in openai.json ($1.25/$10.00/$0.125 cached); no markup was found.","Azure resells the OpenAI model under the same canonicalId, \"gpt-5.1\". This follows the shared-ID convention used for \"mistral-large-3\" and \"gemma-4-31b\" in aws-bedrock.json; OpenRouter uses provider-prefixed slugs. A lookup without a provider qualifier is ambiguous and fails. openai.json has no matching cross-reference; a follow-up should add one.","The Retail Prices API returned these meters for this model in eastus2 on 2026-10-03: \"GPT 5.1 inp Gl\" 1.25 per 1M, \"GPT 5.1 opt Gl\" 10.0 per 1M, \"GPT 5.1 cd inp Gl\" 0.125 per 1M. Global Batch meters \"GPT 5.1 Batch inp Gl\" 0.625 per 1M and \"GPT 5.1 Batch opt Gl\" 5.0 per 1M are exactly 0.5x the standard rates. The rates were unchanged."]},
    ],
    source: {"url":"https://prices.azure.com/api/retail/prices?currencyCode='USD'&$filter=contains(productName,%20%27OpenAI%27)","observedAt":"2026-10-03"},
  },
  {
    canonicalId: "gpt-5.2",
    provider: "azure-openai",
    aliases: [],
    family: "gpt-5.2",
    pricing: [
      {"effectiveFrom":"2025-12-01","currency":"USD","unit":"per-million-tokens","input":"1.75","output":"14.00","cachedInput":"0.175","batchMultiplier":"0.5","cheapestTier":true,"sourceUrl":"https://prices.azure.com/api/retail/prices?currencyCode='USD'&$filter=contains(productName,%20%27OpenAI%27)","observedAt":"2026-10-03","notes":["A programmatic check found the same retailPrice in all 24 Azure regions returned for this Global SKU, with no regional variation.","This model's Azure Batch API input and output meters are each half its standard Global rate, confirming batchMultiplier 0.5.","Azure Global matches the observed OpenAI rate for \"gpt-5.2\" in openai.json ($1.75/$14.00/$0.175 cached); no markup was found.","Azure resells the OpenAI model under the same canonicalId, \"gpt-5.2\". This follows the shared-ID convention used for \"mistral-large-3\" and \"gemma-4-31b\" in aws-bedrock.json; OpenRouter uses provider-prefixed slugs. A lookup without a provider qualifier is ambiguous and fails. openai.json has no matching cross-reference; a follow-up should add one.","The Retail Prices API returned these meters for this model in eastus2 on 2026-10-03: \"GPT 5.2 inp Gl\" 1.75 per 1M, \"GPT 5.2 opt Gl\" 14.0 per 1M, \"GPT 5.2 cd inp Gl\" 0.175 per 1M. Global Batch meters \"GPT 5.2 Batch inp Gl\" 0.875 per 1M and \"GPT 5.2 Batch opt Gl\" 7.0 per 1M are exactly 0.5x the standard rates. The rates were unchanged."]},
    ],
    source: {"url":"https://prices.azure.com/api/retail/prices?currencyCode='USD'&$filter=contains(productName,%20%27OpenAI%27)","observedAt":"2026-10-03"},
  },
  {
    canonicalId: "gpt-5.2-pro",
    provider: "azure-openai",
    aliases: [],
    family: "gpt-5.2",
    pricing: [
      {"effectiveFrom":"2025-12-01","currency":"USD","unit":"per-million-tokens","input":"21.00","output":"168.00","batchMultiplier":"0.5","cheapestTier":true,"sourceUrl":"https://prices.azure.com/api/retail/prices?currencyCode='USD'&$filter=contains(productName,%20%27OpenAI%27)","observedAt":"2026-10-03","notes":["A programmatic check found the same retailPrice in all 24 Azure regions returned for this Global SKU, with no regional variation.","This model's Azure Batch API input and output meters are each half its standard Global rate, confirming batchMultiplier 0.5.","Azure Global matches the observed OpenAI rate for \"gpt-5.2-pro\" in openai.json ($21.00/$168.00); no markup was found.","Azure resells the OpenAI model under the same canonicalId, \"gpt-5.2-pro\". This follows the shared-ID convention used for \"mistral-large-3\" and \"gemma-4-31b\" in aws-bedrock.json; OpenRouter uses provider-prefixed slugs. A lookup without a provider qualifier is ambiguous and fails. openai.json has no matching cross-reference; a follow-up should add one.","The Retail Prices API returned these meters for this model in eastus2 on 2026-10-03: \"GPT 5.2 pro inp Gl\" 21.0 per 1M, \"GPT 5.2 pro opt Gl\" 168.0 per 1M. Global Batch meters \"GPT 5.2 pro Batch inp Gl\" 10.5 per 1M and \"GPT 5.2 pro Batch opt Gl\" 84.0 per 1M are exactly 0.5x the standard rates. The rates were unchanged."]},
    ],
    source: {"url":"https://prices.azure.com/api/retail/prices?currencyCode='USD'&$filter=contains(productName,%20%27OpenAI%27)","observedAt":"2026-10-03"},
  },
  {
    canonicalId: "gpt-5.4",
    provider: "azure-openai",
    aliases: [],
    family: "gpt-5.4",
    pricing: [
      {"effectiveFrom":"2026-03-01","currency":"USD","unit":"per-million-tokens","input":"2.50","output":"15.00","cachedInput":"0.25","batchMultiplier":"0.5","cheapestTier":true,"sourceUrl":"https://prices.azure.com/api/retail/prices?currencyCode='USD'&$filter=contains(productName,%20%27OpenAI%27)","observedAt":"2026-10-03","notes":["A programmatic check found the same retailPrice in all 25 Azure regions returned for this Global SKU, with no regional variation.","This model's Azure Batch API input and output meters are each half its standard Global rate, confirming batchMultiplier 0.5.","Azure Global matches the observed OpenAI rate for \"gpt-5.4\" in openai.json ($2.50/$15.00/$0.25 cached); no markup was found.","Azure resells the OpenAI model under the same canonicalId, \"gpt-5.4\". This follows the shared-ID convention used for \"mistral-large-3\" and \"gemma-4-31b\" in aws-bedrock.json; OpenRouter uses provider-prefixed slugs. A lookup without a provider qualifier is ambiguous and fails. openai.json has no matching cross-reference; a follow-up should add one.","The Retail Prices API returned these meters for this model in eastus2 on 2026-10-03: \"5.4 inp Gl\" 2.5 per 1M, \"5.4 opt Gl\" 15.0 per 1M, \"5.4 cd inp Gl\" 0.25 per 1M. Global Batch meters \"5.4 Batch inp Gl\" 1.25 per 1M and \"5.4 Batch opt Gl\" 7.5 per 1M are exactly 0.5x the standard rates. The rates were unchanged."]},
    ],
    source: {"url":"https://prices.azure.com/api/retail/prices?currencyCode='USD'&$filter=contains(productName,%20%27OpenAI%27)","observedAt":"2026-10-03"},
  },
  {
    canonicalId: "gpt-5.4-mini",
    provider: "azure-openai",
    aliases: [],
    family: "gpt-5.4",
    pricing: [
      {"effectiveFrom":"2026-03-01","currency":"USD","unit":"per-million-tokens","input":"0.75","output":"4.50","cachedInput":"0.075","batchMultiplier":"0.5","cheapestTier":true,"sourceUrl":"https://prices.azure.com/api/retail/prices?currencyCode='USD'&$filter=contains(productName,%20%27OpenAI%27)","observedAt":"2026-10-03","notes":["A programmatic check found the same retailPrice in all 25 Azure regions returned for this Global SKU, with no regional variation.","This model's Azure Batch API input and output meters are each half its standard Global rate, confirming batchMultiplier 0.5.","Azure Global matches the observed OpenAI rate for \"gpt-5.4-mini\" in openai.json ($0.75/$4.50/$0.075 cached); no markup was found.","Azure resells the OpenAI model under the same canonicalId, \"gpt-5.4-mini\". This follows the shared-ID convention used for \"mistral-large-3\" and \"gemma-4-31b\" in aws-bedrock.json; OpenRouter uses provider-prefixed slugs. A lookup without a provider qualifier is ambiguous and fails. openai.json has no matching cross-reference; a follow-up should add one.","The Retail Prices API returned these meters for this model in eastus2 on 2026-10-03: \"5.4 mini Inp Gl\" 0.75 per 1M, \"5.4 mini Opt Gl\" 4.5 per 1M, \"5.4 mini cd Inp Gl\" 0.075 per 1M. Global Batch meters \"5.4 mini Batch Inp Gl\" 0.375 per 1M and \"5.4 mini Batch Opt Gl\" 2.25 per 1M are exactly 0.5x the standard rates. The rates were unchanged."]},
    ],
    source: {"url":"https://prices.azure.com/api/retail/prices?currencyCode='USD'&$filter=contains(productName,%20%27OpenAI%27)","observedAt":"2026-10-03"},
  },
  {
    canonicalId: "gpt-5.4-nano",
    provider: "azure-openai",
    aliases: [],
    family: "gpt-5.4",
    pricing: [
      {"effectiveFrom":"2026-03-01","currency":"USD","unit":"per-million-tokens","input":"0.20","output":"1.25","cachedInput":"0.02","batchMultiplier":"0.5","cheapestTier":true,"sourceUrl":"https://prices.azure.com/api/retail/prices?currencyCode='USD'&$filter=contains(productName,%20%27OpenAI%27)","observedAt":"2026-10-03","notes":["A programmatic check found the same retailPrice in all 25 Azure regions returned for this Global SKU, with no regional variation.","This model's Azure Batch API input and output meters are each half its standard Global rate, confirming batchMultiplier 0.5.","Azure Global matches the observed OpenAI rate for \"gpt-5.4-nano\" in openai.json ($0.20/$1.25/$0.02 cached); no markup was found.","Azure resells the OpenAI model under the same canonicalId, \"gpt-5.4-nano\". This follows the shared-ID convention used for \"mistral-large-3\" and \"gemma-4-31b\" in aws-bedrock.json; OpenRouter uses provider-prefixed slugs. A lookup without a provider qualifier is ambiguous and fails. openai.json has no matching cross-reference; a follow-up should add one.","The Retail Prices API returned these meters for this model in eastus2 on 2026-10-03: \"5.4 nano Inp Gl\" 0.2 per 1M, \"5.4 nano Opt Gl\" 1.25 per 1M, \"5.4 nano cd Inp Gl\" 0.02 per 1M. Global Batch meters \"5.4 nano Batch Inp Gl\" 0.1 per 1M and \"5.4 nano Batch Opt Gl\" 0.625 per 1M are exactly 0.5x the standard rates. The rates were unchanged."]},
    ],
    source: {"url":"https://prices.azure.com/api/retail/prices?currencyCode='USD'&$filter=contains(productName,%20%27OpenAI%27)","observedAt":"2026-10-03"},
  },
  {
    canonicalId: "gpt-5.4-pro",
    provider: "azure-openai",
    aliases: [],
    family: "gpt-5.4",
    pricing: [
      {"effectiveFrom":"2026-03-01","currency":"USD","unit":"per-million-tokens","input":"30.00","output":"180.00","batchMultiplier":"0.5","cheapestTier":true,"sourceUrl":"https://prices.azure.com/api/retail/prices?currencyCode='USD'&$filter=contains(productName,%20%27OpenAI%27)","observedAt":"2026-10-03","notes":["A programmatic check found the same retailPrice in all 25 Azure regions returned for this Global SKU, with no regional variation.","This model's Azure Batch API input and output meters are each half its standard Global rate, confirming batchMultiplier 0.5.","Azure Global matches the observed OpenAI rate for \"gpt-5.4-pro\" in openai.json ($30.00/$180.00); no markup was found.","Azure resells the OpenAI model under the same canonicalId, \"gpt-5.4-pro\". This follows the shared-ID convention used for \"mistral-large-3\" and \"gemma-4-31b\" in aws-bedrock.json; OpenRouter uses provider-prefixed slugs. A lookup without a provider qualifier is ambiguous and fails. openai.json has no matching cross-reference; a follow-up should add one.","The Retail Prices API returned these meters for this model in eastus2 on 2026-10-03: \"5.4 pro inp Gl\" 30.0 per 1M, \"5.4 pro opt Gl\" 180.0 per 1M. Global Batch meters \"5.4 pro Batch inp Gl\" 15.0 per 1M and \"5.4 pro Batch opt Gl\" 90.0 per 1M are exactly 0.5x the standard rates. The rates were unchanged."]},
    ],
    source: {"url":"https://prices.azure.com/api/retail/prices?currencyCode='USD'&$filter=contains(productName,%20%27OpenAI%27)","observedAt":"2026-10-03"},
  },
  {
    canonicalId: "gpt-5.5",
    provider: "azure-openai",
    aliases: [],
    family: "gpt-5.5",
    pricing: [
      {"effectiveFrom":"2026-05-01","currency":"USD","unit":"per-million-tokens","input":"5.00","output":"30.00","cachedInput":"0.50","batchMultiplier":"0.5","cheapestTier":true,"sourceUrl":"https://prices.azure.com/api/retail/prices?currencyCode='USD'&$filter=contains(productName,%20%27OpenAI%27)","observedAt":"2026-10-03","notes":["A programmatic check found the same retailPrice in all 25 Azure regions returned for this Global SKU, with no regional variation.","This model's Azure Batch API input and output meters are each half its standard Global rate, confirming batchMultiplier 0.5.","Azure Global matches the observed OpenAI rate for \"gpt-5.5\" in openai.json ($5.00/$30.00/$0.50 cached); no markup was found.","Azure resells the OpenAI model under the same canonicalId, \"gpt-5.5\". This follows the shared-ID convention used for \"mistral-large-3\" and \"gemma-4-31b\" in aws-bedrock.json; OpenRouter uses provider-prefixed slugs. A lookup without a provider qualifier is ambiguous and fails. openai.json has no matching cross-reference; a follow-up should add one.","The Retail Prices API returned these meters for this model in eastus2 on 2026-10-03: \"5.5 ShortCo inp Gl\" 5.0 per 1M, \"5.5 ShortCo opt Gl\" 30.0 per 1M, \"5.5 ShortCo cd inp Gl\" 0.5 per 1M. Global Batch meters \"5.5 ShortCo Batch inp Gl\" 2.5 per 1M and \"5.5 ShortCo Batch opt Gl\" 15.0 per 1M are exactly 0.5x the standard rates. The rates were unchanged."]},
    ],
    source: {"url":"https://prices.azure.com/api/retail/prices?currencyCode='USD'&$filter=contains(productName,%20%27OpenAI%27)","observedAt":"2026-10-03"},
  },
  {
    canonicalId: "gpt-5.6-luna",
    provider: "azure-openai",
    aliases: [],
    family: "gpt-5.6",
    pricing: [
      {"effectiveFrom":"2026-07-01","effectiveTo":"2026-10-03","currency":"USD","unit":"per-million-tokens","input":"1.00","output":"6.00","cachedInput":"0.10","cacheWrite":"1.25","cheapestTier":true,"sourceUrl":"https://prices.azure.com/api/retail/prices?currencyCode='USD'&$filter=contains(productName,%20%27OpenAI%27)","observedAt":"2026-08-05","notes":["A programmatic check found the same retailPrice in all 24 Azure regions returned for this Global SKU, with no regional variation.","The Retail Prices API response had no Batch API meter for this model/SKU, so batchMultiplier is omitted.","DIFFERS from OpenAI's own first-party rate recorded in openai.json for the same canonicalId \"gpt-5.6-luna\": OpenAI first-party is $0.20/$1.20 input/output (cached $0.02), Azure Global is $1.00/$6.00 (cached $0.10). Both independently observed on 2026-08-05; this is a genuine, confirmed pricing divergence between the two channels for the same named model, not a transcription error — this is exactly the kind of difference this provider file exists to capture.","Azure resells the OpenAI model under the same canonicalId, \"gpt-5.6-luna\". This follows the shared-ID convention used for \"mistral-large-3\" and \"gemma-4-31b\" in aws-bedrock.json; OpenRouter uses provider-prefixed slugs. A lookup without a provider qualifier is ambiguous and fails. openai.json has no matching cross-reference; a follow-up should add one.","Closed on 2026-10-03: the Retail Prices API now returns lower Global Standard ShortCo meters for this model (0.20 input / 1.20 output / 0.02 cached input / 0.25 cache write, was 1.00 / 6.00 / 0.10 / 1.25) and an effectiveStartDate of 2026-08-01. This rate was last observed on 2026-08-05, after that date, so Azure dated the change earlier than its API first showed it. effectiveTo is the 2026-10-03 observation date instead, which keeps every confirmed observation correct and approximates only the unobserved gap, toward the last confirmed value."]},
      {"effectiveFrom":"2026-10-03","currency":"USD","unit":"per-million-tokens","input":"0.20","output":"1.20","cachedInput":"0.02","cacheWrite":"0.25","cheapestTier":true,"sourceUrl":"https://prices.azure.com/api/retail/prices?currencyCode='USD'&$filter=contains(productName,%20%27OpenAI%27)","observedAt":"2026-10-03","notes":["Observed 2026-10-03 via a Retail Prices API query filtered to meterName containing \"5.6\": \"5.6 luna ShortCo Inp Std Gl\" 0.2, \"5.6 luna ShortCo Opt Std Gl\" 1.2, \"5.6 luna ShortCo Cd Inp Std Gl\" 0.02, \"5.6 luna ShortCo Cd Wr Std Gl\" 0.25 (all per 1M tokens, effectiveStartDate 2026-08-01T00:00:00Z). effectiveFrom is the 2026-10-03 observation date, not that effectiveStartDate: the old rate was still observed on 2026-08-05, after 2026-08-01.","retailPrice identical in the two regions queried on 2026-10-03 (eastus2, swedencentral); not re-checked across every region.","The Retail Prices API returned no Batch API meter for this model, so batchMultiplier is omitted.","Matches OpenAI's own first-party rate for \"gpt-5.6-luna\" in openai.json exactly as observed on 2026-10-03 ($0.20/$1.20/$0.02 cached/$0.25 cache write). The same-id price divergence recorded in the previous period is gone: Azure now charges the first-party rate.","The API also exposes \"LongCo\" (long-context) Global Standard meters at $0.4 input / $1.8 output / $0.04 cached input / $0.5 cache write. This schema has no context-length dimension, so only the ShortCo tier is recorded.","Azure resells the OpenAI model under the same canonicalId, \"gpt-5.6-luna\". This follows the shared-ID convention used for \"mistral-large-3\" and \"gemma-4-31b\" in aws-bedrock.json; OpenRouter uses provider-prefixed slugs. A lookup without a provider qualifier is ambiguous and fails. openai.json has no matching cross-reference; a follow-up should add one."]},
    ],
    source: {"url":"https://prices.azure.com/api/retail/prices?currencyCode='USD'&$filter=contains(productName,%20%27OpenAI%27)","observedAt":"2026-10-03"},
  },
  {
    canonicalId: "gpt-5.6-sol",
    provider: "azure-openai",
    aliases: [],
    family: "gpt-5.6",
    pricing: [
      {"effectiveFrom":"2026-07-01","effectiveTo":"2026-10-03","currency":"USD","unit":"per-million-tokens","input":"5.00","output":"30.00","cachedInput":"0.50","cacheWrite":"6.25","cheapestTier":true,"sourceUrl":"https://prices.azure.com/api/retail/prices?currencyCode='USD'&$filter=contains(productName,%20%27OpenAI%27)","observedAt":"2026-09-07","notes":["A programmatic check found the same retailPrice in all 24 Azure regions returned for this Global SKU, with no regional variation.","The Retail Prices API response had no Batch API meter for this model/SKU, so batchMultiplier is omitted.","Azure resells the OpenAI model under the same canonicalId, \"gpt-5.6-sol\". This follows the shared-ID convention used for \"mistral-large-3\" and \"gemma-4-31b\" in aws-bedrock.json; OpenRouter uses provider-prefixed slugs. A lookup without a provider qualifier is ambiguous and fails. openai.json has no matching cross-reference; a follow-up should add one.","Re-observed 2026-09-07 via the Retail Prices API filtered to this model's meters (\"5.6 sol ShortCo Inp Std Gl\" $5.00, \"5.6 sol ShortCo Opt Std Gl\" $30.00, \"5.6 sol ShortCo Cd Inp Std Gl\" $0.50): unchanged.","NOW DIFFERS from OpenAI's own first-party rate in openai.json for the same canonicalId \"gpt-5.6-sol\". Both files recorded $5.00/$30.00/$0.50 on 2026-08-05; on 2026-09-07 OpenAI's pricing page published $4.00/$20.00/$0.40 while Azure's meters stayed at $5.00/$30.00/$0.50. Azure did not follow the first-party cut, so this joins gpt-5.6-terra and gpt-5.6-luna as a confirmed same-id price divergence rather than a transcription error.","The API also exposes \"LongCo\" (long-context) meters for this model at $10.00 input / $45.00 output Global Standard, alongside the \"ShortCo\" rates recorded here - the same context tiering OpenAI's page labels \"<272K\". This schema has no context-length dimension, so only the ShortCo tier is recorded.","Closed on 2026-10-03: the Retail Prices API now returns lower Global Standard ShortCo meters for this model (4.00 input / 20.00 output / 0.40 cached input / 5.00 cache write, was 5.00 / 30.00 / 0.50 / 6.25) and an effectiveStartDate of 2026-09-01. This rate was last observed on 2026-09-07, after that date, so Azure dated the change earlier than its API first showed it. effectiveTo is the 2026-10-03 observation date instead, which keeps every confirmed observation correct and approximates only the unobserved gap, toward the last confirmed value."]},
      {"effectiveFrom":"2026-10-03","currency":"USD","unit":"per-million-tokens","input":"4.00","output":"20.00","cachedInput":"0.40","cacheWrite":"5.00","cheapestTier":true,"sourceUrl":"https://prices.azure.com/api/retail/prices?currencyCode='USD'&$filter=contains(productName,%20%27OpenAI%27)","observedAt":"2026-10-03","notes":["Observed 2026-10-03 via a Retail Prices API query filtered to meterName containing \"5.6\": \"5.6 sol ShortCo Inp Std Gl\" 4.0, \"5.6 sol ShortCo Opt Std Gl\" 20.0, \"5.6 sol ShortCo Cd Inp Std Gl\" 0.4, \"5.6 sol ShortCo Cd Wr Std Gl\" 5.0 (all per 1M tokens, effectiveStartDate 2026-09-01T00:00:00Z). effectiveFrom is the 2026-10-03 observation date, not that effectiveStartDate: the old rate was still observed on 2026-09-07, after 2026-09-01.","retailPrice identical in the two regions queried on 2026-10-03 (eastus2, swedencentral); not re-checked across every region.","The Retail Prices API returned no Batch API meter for this model, so batchMultiplier is omitted.","Matches OpenAI's own first-party rate for \"gpt-5.6-sol\" in openai.json exactly as observed on 2026-10-03 ($4.00/$20.00/$0.40 cached/$5.00 cache write). The same-id price divergence recorded in the previous period is gone: Azure now charges the first-party rate.","The API also exposes \"LongCo\" (long-context) Global Standard meters at $8.0 input / $30.0 output / $0.8 cached input / $10.0 cache write. This schema has no context-length dimension, so only the ShortCo tier is recorded.","Azure resells the OpenAI model under the same canonicalId, \"gpt-5.6-sol\". This follows the shared-ID convention used for \"mistral-large-3\" and \"gemma-4-31b\" in aws-bedrock.json; OpenRouter uses provider-prefixed slugs. A lookup without a provider qualifier is ambiguous and fails. openai.json has no matching cross-reference; a follow-up should add one."]},
    ],
    source: {"url":"https://prices.azure.com/api/retail/prices?currencyCode='USD'&$filter=contains(productName,%20%27OpenAI%27)","observedAt":"2026-10-03"},
  },
  {
    canonicalId: "gpt-5.6-terra",
    provider: "azure-openai",
    aliases: [],
    family: "gpt-5.6",
    pricing: [
      {"effectiveFrom":"2026-07-01","effectiveTo":"2026-10-03","currency":"USD","unit":"per-million-tokens","input":"2.50","output":"15.00","cachedInput":"0.25","cacheWrite":"3.125","cheapestTier":true,"sourceUrl":"https://prices.azure.com/api/retail/prices?currencyCode='USD'&$filter=contains(productName,%20%27OpenAI%27)","observedAt":"2026-08-05","notes":["A programmatic check found the same retailPrice in all 24 Azure regions returned for this Global SKU, with no regional variation.","The Retail Prices API response had no Batch API meter for this model/SKU, so batchMultiplier is omitted.","DIFFERS from OpenAI's own first-party rate recorded in openai.json for the same canonicalId \"gpt-5.6-terra\": OpenAI first-party is $2.00/$12.00 input/output (cached $0.20), Azure Global is $2.50/$15.00 (cached $0.25). Both independently observed on 2026-08-05; this is a genuine, confirmed pricing divergence between the two channels for the same named model, not a transcription error — this is exactly the kind of difference this provider file exists to capture.","Azure resells the OpenAI model under the same canonicalId, \"gpt-5.6-terra\". This follows the shared-ID convention used for \"mistral-large-3\" and \"gemma-4-31b\" in aws-bedrock.json; OpenRouter uses provider-prefixed slugs. A lookup without a provider qualifier is ambiguous and fails. openai.json has no matching cross-reference; a follow-up should add one.","Closed on 2026-10-03: the Retail Prices API now returns lower Global Standard ShortCo meters for this model (2.00 input / 12.00 output / 0.20 cached input / 2.50 cache write, was 2.50 / 15.00 / 0.25 / 3.125) and an effectiveStartDate of 2026-08-01. This rate was last observed on 2026-08-05, after that date, so Azure dated the change earlier than its API first showed it. effectiveTo is the 2026-10-03 observation date instead, which keeps every confirmed observation correct and approximates only the unobserved gap, toward the last confirmed value."]},
      {"effectiveFrom":"2026-10-03","currency":"USD","unit":"per-million-tokens","input":"2.00","output":"12.00","cachedInput":"0.20","cacheWrite":"2.50","cheapestTier":true,"sourceUrl":"https://prices.azure.com/api/retail/prices?currencyCode='USD'&$filter=contains(productName,%20%27OpenAI%27)","observedAt":"2026-10-03","notes":["Observed 2026-10-03 via a Retail Prices API query filtered to meterName containing \"5.6\": \"5.6 terra ShortCo Inp Std Gl\" 2.0, \"5.6 terra ShortCo Opt Std Gl\" 12.0, \"5.6 terra ShortCo Cd Inp Std Gl\" 0.2, \"5.6 terra ShortCo Cd Wr Std Gl\" 2.5 (all per 1M tokens, effectiveStartDate 2026-08-01T00:00:00Z). effectiveFrom is the 2026-10-03 observation date, not that effectiveStartDate: the old rate was still observed on 2026-08-05, after 2026-08-01.","retailPrice identical in the two regions queried on 2026-10-03 (eastus2, swedencentral); not re-checked across every region.","The Retail Prices API returned no Batch API meter for this model, so batchMultiplier is omitted.","Matches OpenAI's own first-party rate for \"gpt-5.6-terra\" in openai.json exactly as observed on 2026-10-03 ($2.00/$12.00/$0.20 cached/$2.50 cache write). The same-id price divergence recorded in the previous period is gone: Azure now charges the first-party rate.","The API also exposes \"LongCo\" (long-context) Global Standard meters at $4.0 input / $18.0 output / $0.4 cached input / $5.0 cache write. This schema has no context-length dimension, so only the ShortCo tier is recorded.","Azure resells the OpenAI model under the same canonicalId, \"gpt-5.6-terra\". This follows the shared-ID convention used for \"mistral-large-3\" and \"gemma-4-31b\" in aws-bedrock.json; OpenRouter uses provider-prefixed slugs. A lookup without a provider qualifier is ambiguous and fails. openai.json has no matching cross-reference; a follow-up should add one."]},
    ],
    source: {"url":"https://prices.azure.com/api/retail/prices?currencyCode='USD'&$filter=contains(productName,%20%27OpenAI%27)","observedAt":"2026-10-03"},
  },
  {
    canonicalId: "gpt-6-astra",
    provider: "azure-openai",
    aliases: [],
    family: "gpt-6",
    pricing: [
      {"effectiveFrom":"2026-09-01","currency":"USD","unit":"per-million-tokens","input":"10.00","output":"50.00","cachedInput":"1.00","cacheWrite":"12.50","cheapestTier":true,"sourceUrl":"https://prices.azure.com/api/retail/prices?currencyCode='USD'&$filter=contains(productName,%20%27OpenAI%27)","observedAt":"2026-10-03","notes":["New model, observed 2026-10-03 under the Retail Prices API product \"Azure OpenAI GPT6\" (absent on 2026-09-07): \"6-astra ShortCo Inp Std Gl\" 10.0, \"6-astra ShortCo Opt Std Gl\" 50.0, \"6-astra ShortCo Cd Inp Std Gl\" 1.0, \"6-astra ShortCo Cd Wr Std Gl\" 12.5 (all per 1M tokens, effectiveStartDate 2026-09-01T00:00:00Z). effectiveFrom is that effectiveStartDate.","retailPrice identical in the two regions queried on 2026-10-03 (eastus2, swedencentral); not checked across every region.","The Retail Prices API returned no Batch API meter for this model, so batchMultiplier is omitted.","Matches OpenAI's own first-party rate for \"gpt-6-astra\" in openai.json exactly as observed on 2026-10-03 ($10.00/$50.00/$1.00 cached/$12.50 cache write). openai.json's effectiveFrom for this model (2026-09-07) is its own observation date; Azure's 2026-09-01 is the meter's published start date.","The API also exposes \"LongCo\" (long-context) Global Standard meters at $20.00 input / $75.00 output / $2.00 cached input / $25.00 cache write, the same long-context rates openai.json records in its notes. This schema has no context-length dimension, so only the ShortCo tier is recorded.","Azure resells the OpenAI model under the same canonicalId, \"gpt-6-astra\". This follows the shared-ID convention used for \"mistral-large-3\" and \"gemma-4-31b\" in aws-bedrock.json; OpenRouter uses provider-prefixed slugs. A lookup without a provider qualifier is ambiguous and fails. openai.json has no matching cross-reference; a follow-up should add one."]},
    ],
    source: {"url":"https://prices.azure.com/api/retail/prices?currencyCode='USD'&$filter=contains(productName,%20%27OpenAI%27)","observedAt":"2026-10-03"},
  },
  {
    canonicalId: "o1",
    provider: "azure-openai",
    aliases: [],
    family: "o-series",
    pricing: [
      {"effectiveFrom":"2024-12-01","currency":"USD","unit":"per-million-tokens","input":"15.00","output":"60.00","cachedInput":"7.50","batchMultiplier":"0.5","cheapestTier":true,"sourceUrl":"https://prices.azure.com/api/retail/prices?currencyCode='USD'&$filter=contains(productName,%20%27OpenAI%27)","observedAt":"2026-10-03","notes":["The Azure Retail Prices API quotes this meter per 1K tokens. Its per-million-token rate was calculated by shifting the decimal point three places in a string, without floating-point multiplication.","A programmatic check found the same retailPrice in all 26 Azure regions returned for this Global SKU, with no regional variation.","This model's Azure Batch API input and output meters are each half its standard Global rate, confirming batchMultiplier 0.5.","Azure Global matches the observed OpenAI rate for \"o1\" in openai.json ($15.00/$60.00/$7.50 cached); no markup was found.","Azure resells the OpenAI model under the same canonicalId, \"o1\". This follows the shared-ID convention used for \"mistral-large-3\" and \"gemma-4-31b\" in aws-bedrock.json; OpenRouter uses provider-prefixed slugs. A lookup without a provider qualifier is ambiguous and fails. openai.json has no matching cross-reference; a follow-up should add one.","The Retail Prices API returned these meters for this model in eastus2 on 2026-10-03: \"o1 1217 Inp glbl\" 0.015 per 1K, \"o1 1217 Outp glbl\" 0.06 per 1K, \"o1 1217 cached Inp glbl\" 0.0075 per 1K. Per-1K values converted by shifting the decimal point 3 places. Global Batch meters \"o1 1217 Batch Inp glbl\" 0.0075 per 1K and \"o1 1217 Batch Outp glbl\" 0.03 per 1K are exactly 0.5x the standard rates. The rates were unchanged."]},
    ],
    source: {"url":"https://prices.azure.com/api/retail/prices?currencyCode='USD'&$filter=contains(productName,%20%27OpenAI%27)","observedAt":"2026-10-03"},
  },
  {
    canonicalId: "o1-mini",
    provider: "azure-openai",
    aliases: [],
    family: "o-series",
    pricing: [
      {"effectiveFrom":"2025-04-01","currency":"USD","unit":"per-million-tokens","input":"1.10","output":"4.40","cachedInput":"0.55","batchMultiplier":"0.5","cheapestTier":true,"sourceUrl":"https://prices.azure.com/api/retail/prices?currencyCode='USD'&$filter=contains(productName,%20%27OpenAI%27)","observedAt":"2026-10-03","notes":["The Azure Retail Prices API quotes this meter per 1K tokens. Its per-million-token rate was calculated by shifting the decimal point three places in a string, without floating-point multiplication.","A programmatic check found the same retailPrice in all 25 Azure regions returned for this Global SKU, with no regional variation.","This model's Azure Batch API input and output meters are each half its standard Global rate, confirming batchMultiplier 0.5.","No comparable first-party entry exists in openai.json's 2026-08-05 snapshot for \"o1-mini\" (it is either a legacy/superseded model no longer on OpenAI's current pricing page, or a variant OpenAI does not sell directly) — Azure's own resale rate is recorded as observed with no parity claim possible or intended.","The Retail Prices API returned these meters for this model in eastus2 on 2026-10-03: \"o1 mini input glbl\" 0.0011 per 1K, \"o1 mini output glbl\" 0.0044 per 1K, \"o1 mini cached input glbl\" 0.00055 per 1K. Per-1K values converted by shifting the decimal point 3 places. Global Batch meters \"o1 mini Batch Inp glbl\" 0.00055 per 1K and \"o1 mini Batch Outp glbl\" 0.0022 per 1K are exactly 0.5x the standard rates. The rates were unchanged."]},
    ],
    source: {"url":"https://prices.azure.com/api/retail/prices?currencyCode='USD'&$filter=contains(productName,%20%27OpenAI%27)","observedAt":"2026-10-03"},
  },
  {
    canonicalId: "o1-preview",
    provider: "azure-openai",
    aliases: [],
    family: "o-series",
    pricing: [
      {"effectiveFrom":"2024-10-01","currency":"USD","unit":"per-million-tokens","input":"15.00","output":"60.00","cachedInput":"7.50","cheapestTier":true,"sourceUrl":"https://prices.azure.com/api/retail/prices?currencyCode='USD'&$filter=contains(productName,%20%27OpenAI%27)","observedAt":"2026-10-03","notes":["The Azure Retail Prices API quotes this meter per 1K tokens. Its per-million-token rate was calculated by shifting the decimal point three places in a string, without floating-point multiplication.","A programmatic check found the same retailPrice in all 3 Azure regions returned for this Global SKU, with no regional variation.","The Retail Prices API response had no Batch API meter for this model/SKU, so batchMultiplier is omitted.","No comparable first-party entry exists in openai.json's 2026-08-05 snapshot for \"o1-preview\" (it is either a legacy/superseded model no longer on OpenAI's current pricing page, or a variant OpenAI does not sell directly) — Azure's own resale rate is recorded as observed with no parity claim possible or intended.","The Retail Prices API returned these meters for this model in eastus2 on 2026-10-03: \"o1 preview input glbl\" 0.015 per 1K, \"o1 preview output glbl\" 0.06 per 1K, \"o1 preview cached input glbl\" 0.0075 per 1K. Per-1K values converted by shifting the decimal point 3 places. No Global Batch meter was returned for this model. The rates were unchanged."]},
    ],
    source: {"url":"https://prices.azure.com/api/retail/prices?currencyCode='USD'&$filter=contains(productName,%20%27OpenAI%27)","observedAt":"2026-10-03"},
  },
  {
    canonicalId: "o1-pro",
    provider: "azure-openai",
    aliases: [],
    family: "o-series",
    pricing: [
      {"effectiveFrom":"2025-03-01","currency":"USD","unit":"per-million-tokens","input":"150.00","output":"600.00","cachedInput":"75.00","batchMultiplier":"0.5","cheapestTier":true,"sourceUrl":"https://prices.azure.com/api/retail/prices?currencyCode='USD'&$filter=contains(productName,%20%27OpenAI%27)","observedAt":"2026-10-03","notes":["The Azure Retail Prices API quotes this meter per 1K tokens. Its per-million-token rate was calculated by shifting the decimal point three places in a string, without floating-point multiplication.","A programmatic check found the same retailPrice in all 25 Azure regions returned for this Global SKU, with no regional variation.","This model's Azure Batch API input and output meters are each half its standard Global rate, confirming batchMultiplier 0.5.","Azure Global matches the observed OpenAI rate for \"o1-pro\" in openai.json ($150.00/$600.00); no markup was found.","Azure resells the OpenAI model under the same canonicalId, \"o1-pro\". This follows the shared-ID convention used for \"mistral-large-3\" and \"gemma-4-31b\" in aws-bedrock.json; OpenRouter uses provider-prefixed slugs. A lookup without a provider qualifier is ambiguous and fails. openai.json has no matching cross-reference; a follow-up should add one.","Re-observed 2026-10-03 via a Retail Prices API query filtered to this model's meters (all Global regions returned (the cached-input meter appeared only in westus2 and northeurope)): \"o1-pro Inp glbl\" 0.15 per 1K, \"o1-pro Outp glbl\" 0.6 per 1K, \"o1-pro cached Inp glbl\" 0.075 per 1K. Per-1K values converted by shifting the decimal point 3 places. Global Batch meters \"o1-pro Batch Inp glbl\" 0.075 per 1K and \"o1-pro Batch Outp glbl\" 0.3 per 1K are exactly 0.5x the standard rates. Unchanged."]},
    ],
    source: {"url":"https://prices.azure.com/api/retail/prices?currencyCode='USD'&$filter=contains(productName,%20%27OpenAI%27)","observedAt":"2026-10-03"},
  },
  {
    canonicalId: "o3",
    provider: "azure-openai",
    aliases: [],
    family: "o-series",
    pricing: [
      {"effectiveFrom":"2025-06-01","currency":"USD","unit":"per-million-tokens","input":"2.00","output":"8.00","cachedInput":"0.50","batchMultiplier":"0.5","cheapestTier":true,"sourceUrl":"https://prices.azure.com/api/retail/prices?currencyCode='USD'&$filter=contains(productName,%20%27OpenAI%27)","observedAt":"2026-10-03","notes":["The Azure Retail Prices API quotes this meter per 1K tokens. Its per-million-token rate was calculated by shifting the decimal point three places in a string, without floating-point multiplication.","A programmatic check found the same retailPrice in all 24 Azure regions returned for this Global SKU, with no regional variation.","This model's Azure Batch API input and output meters are each half its standard Global rate, confirming batchMultiplier 0.5.","Azure Global matches the observed OpenAI rate for \"o3\" in openai.json ($2.00/$8.00/$0.50 cached); no markup was found.","Azure resells the OpenAI model under the same canonicalId, \"o3\". This follows the shared-ID convention used for \"mistral-large-3\" and \"gemma-4-31b\" in aws-bedrock.json; OpenRouter uses provider-prefixed slugs. A lookup without a provider qualifier is ambiguous and fails. openai.json has no matching cross-reference; a follow-up should add one.","The Retail Prices API returned these meters for this model in eastus2 on 2026-10-03: \"o3 0416 Inp glbl\" 0.002 per 1K, \"o3 0416 Outp glbl\" 0.008 per 1K, \"o3 0416 cached Inp glbl\" 0.0005 per 1K. Per-1K values converted by shifting the decimal point 3 places. Global Batch meters \"o3 0416 Batch Inp glbl\" 0.001 per 1K and \"o3 0416 Batch Outp glbl\" 0.004 per 1K are exactly 0.5x the standard rates. The rates were unchanged."]},
    ],
    source: {"url":"https://prices.azure.com/api/retail/prices?currencyCode='USD'&$filter=contains(productName,%20%27OpenAI%27)","observedAt":"2026-10-03"},
  },
  {
    canonicalId: "o3-mini",
    provider: "azure-openai",
    aliases: [],
    family: "o-series",
    pricing: [
      {"effectiveFrom":"2025-02-01","currency":"USD","unit":"per-million-tokens","input":"1.10","output":"4.40","cachedInput":"0.55","batchMultiplier":"0.5","cheapestTier":true,"sourceUrl":"https://prices.azure.com/api/retail/prices?currencyCode='USD'&$filter=contains(productName,%20%27OpenAI%27)","observedAt":"2026-10-03","notes":["The Azure Retail Prices API quotes this meter per 1K tokens. Its per-million-token rate was calculated by shifting the decimal point three places in a string, without floating-point multiplication.","A programmatic check found the same retailPrice in all 27 Azure regions returned for this Global SKU, with no regional variation.","This model's Azure Batch API input and output meters are each half its standard Global rate, confirming batchMultiplier 0.5.","Azure Global matches the observed OpenAI rate for \"o3-mini\" in openai.json ($1.10/$4.40/$0.55 cached); no markup was found.","Azure resells the OpenAI model under the same canonicalId, \"o3-mini\". This follows the shared-ID convention used for \"mistral-large-3\" and \"gemma-4-31b\" in aws-bedrock.json; OpenRouter uses provider-prefixed slugs. A lookup without a provider qualifier is ambiguous and fails. openai.json has no matching cross-reference; a follow-up should add one.","The Retail Prices API returned these meters for this model in eastus2 on 2026-10-03: \"o3 mini 0131 input glbl\" 0.0011 per 1K, \"o3 mini 0131 output glbl\" 0.0044 per 1K, \"o3 mini 0131 cached input glbl\" 0.00055 per 1K. Per-1K values converted by shifting the decimal point 3 places. Global Batch meters \"o3 mini 0131 Batch Inp glbl\" 0.00055 per 1K and \"o3 mini 0131 Batch Outp glbl\" 0.0022 per 1K are exactly 0.5x the standard rates. The rates were unchanged."]},
    ],
    source: {"url":"https://prices.azure.com/api/retail/prices?currencyCode='USD'&$filter=contains(productName,%20%27OpenAI%27)","observedAt":"2026-10-03"},
  },
  {
    canonicalId: "o3-pro",
    provider: "azure-openai",
    aliases: [],
    family: "o-series",
    pricing: [
      {"effectiveFrom":"2025-06-01","currency":"USD","unit":"per-million-tokens","input":"20.00","output":"80.00","batchMultiplier":"0.5","cheapestTier":true,"sourceUrl":"https://prices.azure.com/api/retail/prices?currencyCode='USD'&$filter=contains(productName,%20%27OpenAI%27)","observedAt":"2026-10-03","notes":["The Azure Retail Prices API quotes this meter per 1K tokens. Its per-million-token rate was calculated by shifting the decimal point three places in a string, without floating-point multiplication.","A programmatic check found the same retailPrice in all 24 Azure regions returned for this Global SKU, with no regional variation.","This model's Azure Batch API input and output meters are each half its standard Global rate, confirming batchMultiplier 0.5.","Azure Global matches the observed OpenAI rate for \"o3-pro\" in openai.json ($20.00/$80.00); no markup was found.","Azure resells the OpenAI model under the same canonicalId, \"o3-pro\". This follows the shared-ID convention used for \"mistral-large-3\" and \"gemma-4-31b\" in aws-bedrock.json; OpenRouter uses provider-prefixed slugs. A lookup without a provider qualifier is ambiguous and fails. openai.json has no matching cross-reference; a follow-up should add one.","The Retail Prices API returned these meters for this model in eastus2 on 2026-10-03: \"o3-pro Inp glbl\" 0.02 per 1K, \"o3-pro Outp glbl\" 0.08 per 1K. Per-1K values converted by shifting the decimal point 3 places. Global Batch meters \"o3-pro Batch Inp glbl\" 0.01 per 1K and \"o3-pro Batch Outp glbl\" 0.04 per 1K are exactly 0.5x the standard rates. The rates were unchanged."]},
    ],
    source: {"url":"https://prices.azure.com/api/retail/prices?currencyCode='USD'&$filter=contains(productName,%20%27OpenAI%27)","observedAt":"2026-10-03"},
  },
  {
    canonicalId: "o4-mini",
    provider: "azure-openai",
    aliases: [],
    family: "o-series",
    pricing: [
      {"effectiveFrom":"2025-04-01","currency":"USD","unit":"per-million-tokens","input":"1.10","output":"4.40","cachedInput":"0.275","batchMultiplier":"0.5","cheapestTier":true,"sourceUrl":"https://prices.azure.com/api/retail/prices?currencyCode='USD'&$filter=contains(productName,%20%27OpenAI%27)","observedAt":"2026-10-03","notes":["The Azure Retail Prices API quotes this meter per 1K tokens. Its per-million-token rate was calculated by shifting the decimal point three places in a string, without floating-point multiplication.","A programmatic check found the same retailPrice in all 26 Azure regions returned for this Global SKU, with no regional variation.","This model's Azure Batch API input and output meters are each half its standard Global rate, confirming batchMultiplier 0.5.","Azure Global matches the observed OpenAI rate for \"o4-mini\" in openai.json ($1.10/$4.40/$0.275 cached); no markup was found.","Azure resells the OpenAI model under the same canonicalId, \"o4-mini\". This follows the shared-ID convention used for \"mistral-large-3\" and \"gemma-4-31b\" in aws-bedrock.json; OpenRouter uses provider-prefixed slugs. A lookup without a provider qualifier is ambiguous and fails. openai.json has no matching cross-reference; a follow-up should add one.","The Retail Prices API returned these meters for this model in eastus2 on 2026-10-03: \"o4-mini 0416 Inp glbl\" 0.0011 per 1K, \"o4-mini 0416 Outp glbl\" 0.0044 per 1K, \"o4-mini 0416 cached Inp glbl\" 0.000275 per 1K. Per-1K values converted by shifting the decimal point 3 places. Global Batch meters \"o4-mini 0416 Batch Inp glbl\" 0.00055 per 1K and \"o4-mini 0416 Batch Outp glbl\" 0.0022 per 1K are exactly 0.5x the standard rates. The rates were unchanged."]},
    ],
    source: {"url":"https://prices.azure.com/api/retail/prices?currencyCode='USD'&$filter=contains(productName,%20%27OpenAI%27)","observedAt":"2026-10-03"},
  },
  {
    canonicalId: "aya-expanse-32b",
    provider: "cohere",
    aliases: [],
    family: "aya-expanse",
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"0.50","output":"1.50","sourceUrl":"https://cohere.com/pricing","observedAt":"2026-10-03","notes":["Cohere's pricing page publishes an identical $0.50/$1.50 rate for both the 8B and 32B Aya Expanse sizes (confirmed by two independent re-fetches of the same page); this was double-checked rather than assumed to be an extraction error.","effectiveFrom set conservatively to 2026-01-01; exact rate-effective date not published.","The same page showed no rate change on 2026-09-07 or 2026-10-03."]},
    ],
    source: {"url":"https://cohere.com/pricing","observedAt":"2026-10-03"},
  },
  {
    canonicalId: "command",
    provider: "cohere",
    aliases: [],
    family: "command",
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"1.00","output":"2.00","sourceUrl":"https://cohere.com/pricing","observedAt":"2026-10-03","notes":["Cohere's pricing page does not publish an effective date for this rate; effectiveFrom is set conservatively to 2026-01-01.","This rate appears in the pricing page's FAQ/legacy-rates section, not a headline pricing table; it is nonetheless the only per-token price Cohere currently publishes for this model.","The same page showed no rate change on 2026-09-07 or 2026-10-03.","https://docs.cohere.com/docs/models (fetched 2026-10-03) marks command \"Deprecated Sept 15, 2025\". The pricing page still prints this rate under \"Where do I find pricing for our legacy models? For existing customers:\", so the period is kept open as published."]},
    ],
    source: {"url":"https://cohere.com/pricing","observedAt":"2026-10-03"},
  },
  {
    canonicalId: "command-light",
    provider: "cohere",
    aliases: [],
    family: "command",
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"0.30","output":"0.60","sourceUrl":"https://cohere.com/pricing","observedAt":"2026-10-03","notes":["Cohere's pricing page does not publish an effective date for this rate; effectiveFrom is set conservatively to 2026-01-01.","FAQ/legacy-rates section pricing, per the same caveat as \"command\".","The same page showed no rate change on 2026-09-07 or 2026-10-03.","https://docs.cohere.com/docs/models (fetched 2026-10-03) marks command-light \"Deprecated Sept 15, 2025\". The pricing page still prints this rate under \"Where do I find pricing for our legacy models? For existing customers:\", so the period is kept open as published."]},
    ],
    source: {"url":"https://cohere.com/pricing","observedAt":"2026-10-03"},
  },
  {
    canonicalId: "command-r-03-2024",
    provider: "cohere",
    aliases: [],
    family: "command-r",
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"0.50","output":"1.50","sourceUrl":"https://cohere.com/pricing","observedAt":"2026-10-03","notes":["\"03-2024\" is Cohere's own dated-snapshot naming for this model, not a confirmed price-effective date; effectiveFrom is set conservatively to 2026-01-01 per this repository's convention (a too-early effectiveFrom is safe; the price could have applied earlier than 2026 but was not independently confirmed).","FAQ/legacy-rates section pricing.","The same page showed no rate change on 2026-09-07 or 2026-10-03.","https://docs.cohere.com/docs/models (fetched 2026-10-03) marks command-r-03-2024 \"Deprecated Sept 15, 2025\". The pricing page still prints this rate under \"Where do I find pricing for our legacy models? For existing customers:\", so the period is kept open as published."]},
    ],
    source: {"url":"https://cohere.com/pricing","observedAt":"2026-10-03"},
  },
  {
    canonicalId: "command-r-08-2024",
    provider: "cohere",
    aliases: [],
    family: "command-r",
    pricing: [
      {"effectiveFrom":"2026-10-03","currency":"USD","unit":"per-million-tokens","input":"0.15","output":"0.60","sourceUrl":"https://cohere.com/pricing","observedAt":"2026-10-03","notes":["New in this file on 2026-10-03: the pricing page's \"Generative models\" tab prints \"Command R\" at \"Input $0.15 / 1M tokens\" and \"Output $0.60 / 1M tokens\". That tab is not part of the page's default view, which may be why earlier fetches reported no per-token price for Cohere's current Command models. The page publishes no effective date, so effectiveFrom is the observation date rather than a guess at when the rate was first published.","ID mapping, review before relying on it: the pricing page names the model only \"Command R\". https://docs.cohere.com/docs/models lists command-r-08-2024 as the only \"Live\" Command R model (128k context, 4k maximum output, matching the page's \"128K token context window\" and \"4K maximum output tokens\"). The bare \"command-r\" API name is documented there as \"Alias for command-r-03-2024\" (Deprecated Sept 15, 2025), a different model whose legacy rate is 0.50 / 1.50, so \"command-r\" is deliberately not an alias of this entry.","No cached-input rate or batch discount is published for this model, so both fields are omitted."]},
    ],
    source: {"url":"https://cohere.com/pricing","observedAt":"2026-10-03"},
  },
  {
    canonicalId: "command-r-plus-04-2024",
    provider: "cohere",
    aliases: [],
    family: "command-r-plus",
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"3.00","output":"15.00","sourceUrl":"https://cohere.com/pricing","observedAt":"2026-10-03","notes":["\"04-2024\" is Cohere's own dated-snapshot naming for this model, not a confirmed price-effective date; effectiveFrom is set conservatively to 2026-01-01.","FAQ/legacy-rates section pricing. Superseded in Cohere's catalogue by \"Command R+ 08-2024\" (below), a distinct dated snapshot with its own price — the two are not the same PricingPeriod for one model, they are two different canonicalIds, matching how Cohere itself lists them.","The same page showed no rate change on 2026-09-07 or 2026-10-03.","https://docs.cohere.com/docs/models (fetched 2026-10-03) marks command-r-plus-04-2024 \"Deprecated Sept 15, 2025\". The pricing page still prints this rate under \"Where do I find pricing for our legacy models? For existing customers:\", so the period is kept open as published."]},
    ],
    source: {"url":"https://cohere.com/pricing","observedAt":"2026-10-03"},
  },
  {
    canonicalId: "command-r-plus-08-2024",
    provider: "cohere",
    aliases: [],
    family: "command-r-plus",
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"2.50","output":"10.00","sourceUrl":"https://cohere.com/pricing","observedAt":"2026-10-03","notes":["\"08-2024\" is Cohere's own dated-snapshot naming for this model, not a confirmed price-effective date; effectiveFrom is set conservatively to 2026-01-01.","FAQ/legacy-rates section pricing.","The same page showed no rate change on 2026-09-07 or 2026-10-03."]},
    ],
    source: {"url":"https://cohere.com/pricing","observedAt":"2026-10-03"},
  },
  {
    canonicalId: "command-r7b-12-2024",
    provider: "cohere",
    aliases: [],
    family: "command-r7b",
    pricing: [
      {"effectiveFrom":"2026-10-03","currency":"USD","unit":"per-million-tokens","input":"0.0375","output":"0.15","sourceUrl":"https://cohere.com/pricing","observedAt":"2026-10-03","notes":["New in this file on 2026-10-03: the pricing page's \"Generative models\" tab prints \"Command R7B\" at \"Input $0.0375 / 1M tokens\" and \"Output $0.15 / 1M tokens\". That tab is not part of the page's default view, which may be why earlier fetches reported no per-token price for Cohere's current Command models. The page publishes no effective date, so effectiveFrom is the observation date rather than a guess at when the rate was first published.","The pricing page names the model only \"Command R7B\". command-r7b-12-2024 is the only Command R7B model in https://docs.cohere.com/docs/models (status \"Live\", 128k context, 4k maximum output), matching the page's \"128K token context window\" and \"4K maximum output tokens\".","No cached-input rate or batch discount is published for this model, so both fields are omitted."]},
    ],
    source: {"url":"https://cohere.com/pricing","observedAt":"2026-10-03"},
  },
  {
    canonicalId: "gemini-2.5-flash",
    provider: "google",
    aliases: [],
    family: "gemini-2.5",
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"0.30","output":"2.50","cachedInput":"0.03","batchMultiplier":"0.5","sourceUrl":"https://ai.google.dev/gemini-api/docs/pricing","observedAt":"2026-10-03","notes":["Google does not state when this rate took effect. effectiveFrom uses 2026-01-01 as a conservative placeholder.","Input and context-caching rates are the text/image/video rates. The page prices audio input separately ($1.00 input, $0.10 context caching); this schema has no per-modality dimension, so the audio rate is not recorded.","This model's Batch rows ($0.15 / $1.25) confirm batchMultiplier 0.5.","cachedInput records this model's published context-caching rate. The schema does not cover the separate per-hour cache storage fee."]},
    ],
    source: {"url":"https://ai.google.dev/gemini-api/docs/pricing","observedAt":"2026-10-03"},
  },
  {
    canonicalId: "gemini-2.5-flash-lite",
    provider: "google",
    aliases: [],
    family: "gemini-2.5",
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"0.10","output":"0.40","cachedInput":"0.01","batchMultiplier":"0.5","sourceUrl":"https://ai.google.dev/gemini-api/docs/pricing","observedAt":"2026-10-03","notes":["Google does not state when this rate took effect. effectiveFrom uses 2026-01-01 as a conservative placeholder.","Input and context-caching rates are the text/image/video rates. The page prices audio input separately ($0.30 input, $0.03 context caching); this schema has no per-modality dimension, so the audio rate is not recorded.","This model's Batch rows ($0.05 / $0.20) confirm batchMultiplier 0.5.","cachedInput records this model's published context-caching rate. The schema does not cover the separate per-hour cache storage fee."]},
    ],
    source: {"url":"https://ai.google.dev/gemini-api/docs/pricing","observedAt":"2026-10-03"},
  },
  {
    canonicalId: "gemini-2.5-pro",
    provider: "google",
    aliases: [],
    family: "gemini-2.5",
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"1.25","output":"10.00","cachedInput":"0.125","batchMultiplier":"0.5","cheapestTier":true,"sourceUrl":"https://ai.google.dev/gemini-api/docs/pricing","observedAt":"2026-10-03","notes":["Google does not state when this rate took effect. effectiveFrom uses 2026-01-01 as a conservative placeholder.","The page prices prompts >200k tokens higher ($2.50 input / $15.00 output / $0.25 context caching); only the <=200k tier is recorded, since this schema has no context-length dimension.","This model's Batch rows ($0.625 / $5.00) confirm batchMultiplier 0.5.","cachedInput records this model's published context-caching rate. The schema does not cover the separate per-hour cache storage fee.","batchMultiplier and cachedInput added on 2026-09-07: the page now publishes this model's own Batch and context-caching rows, which were not confirmed per-model on 2026-08-05."]},
    ],
    source: {"url":"https://ai.google.dev/gemini-api/docs/pricing","observedAt":"2026-10-03"},
  },
  {
    canonicalId: "gemini-3-flash-preview",
    provider: "google",
    aliases: [],
    family: "gemini-3",
    pricing: [
      {"effectiveFrom":"2026-10-03","currency":"USD","unit":"per-million-tokens","input":"0.50","output":"3.00","cachedInput":"0.05","batchMultiplier":"0.5","sourceUrl":"https://ai.google.dev/gemini-api/docs/pricing","observedAt":"2026-10-03","notes":["New model: not recorded by the 2026-09-07 refresh, present on the page on 2026-10-03 (described there as \"Our legacy Flash model\"). effectiveFrom is the observation date rather than a backdated guess.","Input and context-caching rates are the text/image/video rates. The page prices audio input separately ($1.00 input, $0.10 context caching); this schema has no per-modality dimension, so the audio rate is not recorded.","This model's Batch rows ($0.25 / $1.50) confirm batchMultiplier 0.5.","cachedInput records this model's published context-caching rate. The schema does not cover the separate per-hour cache storage fee."]},
    ],
    source: {"url":"https://ai.google.dev/gemini-api/docs/pricing","observedAt":"2026-10-03"},
  },
  {
    canonicalId: "gemini-3.1-flash-lite",
    provider: "google",
    aliases: [],
    family: "gemini-3.1",
    pricing: [
      {"effectiveFrom":"2026-09-07","currency":"USD","unit":"per-million-tokens","input":"0.25","output":"1.50","cachedInput":"0.025","batchMultiplier":"0.5","sourceUrl":"https://ai.google.dev/gemini-api/docs/pricing","observedAt":"2026-10-03","notes":["New model: absent from the pricing page on 2026-08-05, present on 2026-09-07. effectiveFrom is the observation date rather than a backdated guess.","Input and context-caching rates are the text/image/video rates. The page prices audio input separately ($0.50 input, $0.05 context caching); this schema has no per-modality dimension, so the audio rate is not recorded.","This model's Batch rows ($0.125 / $0.75) confirm batchMultiplier 0.5.","cachedInput records this model's published context-caching rate. The schema does not cover the separate per-hour cache storage fee."]},
    ],
    source: {"url":"https://ai.google.dev/gemini-api/docs/pricing","observedAt":"2026-10-03"},
  },
  {
    canonicalId: "gemini-3.1-pro-preview",
    provider: "google",
    aliases: [],
    family: "gemini-3.1",
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"2.00","output":"12.00","cachedInput":"0.20","batchMultiplier":"0.5","cheapestTier":true,"sourceUrl":"https://ai.google.dev/gemini-api/docs/pricing","observedAt":"2026-10-03","notes":["Google does not state when this rate took effect. effectiveFrom uses 2026-01-01 as a conservative placeholder.","The page prices prompts >200k tokens higher ($4.00 input / $18.00 output / $0.40 context caching); only the <=200k tier is recorded, since this schema has no context-length dimension.","This model's Batch rows ($1.00 / $6.00) confirm batchMultiplier 0.5.","cachedInput records this model's published context-caching rate. The schema does not cover the separate per-hour cache storage fee.","batchMultiplier and cachedInput added on 2026-09-07: the page now publishes this model's own Batch and context-caching rows, which were not confirmed per-model on 2026-08-05."]},
    ],
    source: {"url":"https://ai.google.dev/gemini-api/docs/pricing","observedAt":"2026-10-03"},
  },
  {
    canonicalId: "gemini-3.5-flash",
    provider: "google",
    aliases: [],
    family: "gemini-3.5",
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"1.50","output":"9.00","cachedInput":"0.15","batchMultiplier":"0.5","sourceUrl":"https://ai.google.dev/gemini-api/docs/pricing","observedAt":"2026-10-03","notes":["Google does not state when this rate took effect. effectiveFrom uses 2026-01-01 as a conservative placeholder.","This model's Batch rows ($0.75 / $4.50) confirm batchMultiplier 0.5.","cachedInput records this model's published context-caching rate. The schema does not cover the separate per-hour cache storage fee.","cachedInput added on 2026-09-07: the page now publishes a per-model context-caching rate, which it did not on 2026-08-05."]},
    ],
    source: {"url":"https://ai.google.dev/gemini-api/docs/pricing","observedAt":"2026-10-03"},
  },
  {
    canonicalId: "gemini-3.5-flash-lite",
    provider: "google",
    aliases: [],
    family: "gemini-3.5",
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"0.30","output":"2.50","cachedInput":"0.03","batchMultiplier":"0.5","sourceUrl":"https://ai.google.dev/gemini-api/docs/pricing","observedAt":"2026-10-03","notes":["Google does not state when this rate took effect. effectiveFrom uses 2026-01-01 as a conservative placeholder.","This model's Batch rows ($0.15 / $1.25) confirm batchMultiplier 0.5.","cachedInput records this model's published context-caching rate. The schema does not cover the separate per-hour cache storage fee.","cachedInput added on 2026-10-03: the page now publishes a per-model context-caching rate ($0.03) for this model, which it did not on 2026-09-07."]},
    ],
    source: {"url":"https://ai.google.dev/gemini-api/docs/pricing","observedAt":"2026-10-03"},
  },
  {
    canonicalId: "gemini-3.6-flash",
    provider: "google",
    aliases: [],
    family: "gemini-3.6",
    pricing: [
      {"effectiveFrom":"2026-01-01","effectiveTo":"2026-09-07","currency":"USD","unit":"per-million-tokens","input":"1.50","output":"7.50","batchMultiplier":"0.5","sourceUrl":"https://ai.google.dev/gemini-api/docs/pricing","observedAt":"2026-09-07","notes":["Supersedes the single $1.50 / $7.50 period recorded on 2026-08-05. That rate was live then and is scheduled to return on 2027-01-01, so it is kept as a closed historical period rather than deleted.","Recorded 2026-08-05 at $1.50 / $7.50 with no cachedInput; the page did not then publish a per-model context-caching rate. Closed at the 2026-09-07 observation date, the last date the promotional rate is known not to have applied being 2026-08-05.","Google does not state when this rate took effect. effectiveFrom uses 2026-01-01 as a conservative placeholder."]},
      {"effectiveFrom":"2026-09-07","effectiveTo":"2027-01-01","currency":"USD","unit":"per-million-tokens","input":"0.75","output":"3.75","cachedInput":"0.075","batchMultiplier":"0.5","sourceUrl":"https://ai.google.dev/gemini-api/docs/pricing","observedAt":"2026-10-03","notes":["Promotional rate published as running through 2026-12-31, with the standard rate resuming 2027-01-01 - both dates are stated on the page, so this period's effectiveTo and the next period's effectiveFrom are sourced, not conservative placeholders.","This model's Batch rows ($0.375 / $1.875 promo, $0.75 / $3.75 standard) confirm batchMultiplier 0.5.","cachedInput records this model's published context-caching rate. The schema does not cover the separate per-hour cache storage fee."]},
      {"effectiveFrom":"2027-01-01","currency":"USD","unit":"per-million-tokens","input":"1.50","output":"7.50","cachedInput":"0.15","batchMultiplier":"0.5","sourceUrl":"https://ai.google.dev/gemini-api/docs/pricing","observedAt":"2026-10-03","notes":["Standard rate resuming 2027-01-01, the date the page publishes for the end of the promotional rate.","This model's Batch rows ($0.375 / $1.875 promo, $0.75 / $3.75 standard) confirm batchMultiplier 0.5.","cachedInput records this model's published context-caching rate. The schema does not cover the separate per-hour cache storage fee."]},
    ],
    source: {"url":"https://ai.google.dev/gemini-api/docs/pricing","observedAt":"2026-10-03","notes":["Three periods: the $1.50/$7.50 rate observed 2026-08-05, the $0.75/$3.75 promotional rate observed 2026-09-07 and published as running through 2026-12-31, then the standard rate resuming 2027-01-01."]},
  },
  {
    canonicalId: "gemini-3.7-flash",
    provider: "google",
    aliases: [],
    family: "gemini-3.7",
    pricing: [
      {"effectiveFrom":"2026-09-07","effectiveTo":"2027-01-01","currency":"USD","unit":"per-million-tokens","input":"0.75","output":"3.75","cachedInput":"0.075","batchMultiplier":"0.5","sourceUrl":"https://ai.google.dev/gemini-api/docs/pricing","observedAt":"2026-10-03","notes":["New model: absent from the pricing page on 2026-08-05, present on 2026-09-07. effectiveFrom is the observation date rather than a backdated guess.","Promotional rate published as running through 2026-12-31, with the standard rate resuming 2027-01-01 - both dates are stated on the page, so this period's effectiveTo and the next period's effectiveFrom are sourced, not conservative placeholders.","This model's Batch rows ($0.375 / $1.875 promo, $0.75 / $3.75 standard) confirm batchMultiplier 0.5.","cachedInput records this model's published context-caching rate. The schema does not cover the separate per-hour cache storage fee."]},
      {"effectiveFrom":"2027-01-01","currency":"USD","unit":"per-million-tokens","input":"1.50","output":"7.50","cachedInput":"0.15","batchMultiplier":"0.5","sourceUrl":"https://ai.google.dev/gemini-api/docs/pricing","observedAt":"2026-10-03","notes":["Standard rate resuming 2027-01-01, the date the page publishes for the end of the promotional rate.","This model's Batch rows ($0.375 / $1.875 promo, $0.75 / $3.75 standard) confirm batchMultiplier 0.5.","cachedInput records this model's published context-caching rate. The schema does not cover the separate per-hour cache storage fee."]},
    ],
    source: {"url":"https://ai.google.dev/gemini-api/docs/pricing","observedAt":"2026-10-03"},
  },
  {
    canonicalId: "gemini-3.8-flash",
    provider: "google",
    aliases: [],
    family: "gemini-3.8",
    pricing: [
      {"effectiveFrom":"2026-09-07","effectiveTo":"2027-01-01","currency":"USD","unit":"per-million-tokens","input":"0.75","output":"3.75","cachedInput":"0.075","batchMultiplier":"0.5","sourceUrl":"https://ai.google.dev/gemini-api/docs/pricing","observedAt":"2026-10-03","notes":["New model: absent from the pricing page on 2026-08-05, present on 2026-09-07. effectiveFrom is the observation date rather than a backdated guess.","Promotional rate published as running through 2026-12-31, with the standard rate resuming 2027-01-01 - both dates are stated on the page, so this period's effectiveTo and the next period's effectiveFrom are sourced, not conservative placeholders.","This model's Batch rows ($0.375 / $1.875 promo, $0.75 / $3.75 standard) confirm batchMultiplier 0.5.","cachedInput records this model's published context-caching rate. The schema does not cover the separate per-hour cache storage fee."]},
      {"effectiveFrom":"2027-01-01","currency":"USD","unit":"per-million-tokens","input":"1.50","output":"7.50","cachedInput":"0.15","batchMultiplier":"0.5","sourceUrl":"https://ai.google.dev/gemini-api/docs/pricing","observedAt":"2026-10-03","notes":["Standard rate resuming 2027-01-01, the date the page publishes for the end of the promotional rate.","This model's Batch rows ($0.375 / $1.875 promo, $0.75 / $3.75 standard) confirm batchMultiplier 0.5.","cachedInput records this model's published context-caching rate. The schema does not cover the separate per-hour cache storage fee."]},
    ],
    source: {"url":"https://ai.google.dev/gemini-api/docs/pricing","observedAt":"2026-10-03"},
  },
  {
    canonicalId: "gemini-omni-1.1-flash",
    provider: "google",
    aliases: [],
    family: "gemini-omni",
    pricing: [
      {"effectiveFrom":"2026-10-03","currency":"USD","unit":"per-million-tokens","input":"1.50","output":"9.00","cheapestTier":true,"sourceUrl":"https://ai.google.dev/gemini-api/docs/pricing","observedAt":"2026-10-03","notes":["Added 2026-10-03. It is not known whether this model was on the page on 2026-09-07, so effectiveFrom is the observation date.","Quoted paid Standard rows for gemini-omni-1.1-flash: input \"$1.50 (text / image / video / audio)\", output \"$9.00 (text)\" and \"$17.50 (video)*\", with the footnote \"Billing is based on total output token consumption, calculated at a rate of 5,792 tokens per second of 720p video.\"","output is the text rate. Video output costs $17.50 per million tokens, so this period is flagged cheapestTier and every calculation carries a PARTIAL_TIER_PRICING warning: video generation costs more than reported.","The page publishes no context-caching or Batch rate for this model."]},
    ],
    source: {"url":"https://ai.google.dev/gemini-api/docs/pricing","observedAt":"2026-10-03"},
  },
  {
    canonicalId: "gemini-omni-flash-preview",
    provider: "google",
    aliases: [],
    family: "gemini-omni",
    pricing: [
      {"effectiveFrom":"2026-10-03","currency":"USD","unit":"per-million-tokens","input":"1.50","output":"9.00","cheapestTier":true,"sourceUrl":"https://ai.google.dev/gemini-api/docs/pricing","observedAt":"2026-10-03","notes":["Added 2026-10-03. It is not known whether this model was on the page on 2026-09-07, so effectiveFrom is the observation date.","Quoted paid Standard rows for gemini-omni-flash-preview: input \"$1.50 (text / image / video / audio)\", output \"$9.00 (text)\" and \"$17.50 (video)*\", with the footnote \"Billing is based on total output token consumption, calculated at a rate of 5,792 tokens per second of 720p video.\"","output is the text rate. Video output costs $17.50 per million tokens, so this period is flagged cheapestTier and every calculation carries a PARTIAL_TIER_PRICING warning: video generation costs more than reported.","The page publishes no context-caching or Batch rate for this model."]},
    ],
    source: {"url":"https://ai.google.dev/gemini-api/docs/pricing","observedAt":"2026-10-03"},
  },
  {
    canonicalId: "gemini-robotics-er-2-preview",
    provider: "google",
    aliases: [],
    family: "gemini-robotics",
    pricing: [
      {"effectiveFrom":"2026-10-03","effectiveTo":"2027-01-01","currency":"USD","unit":"per-million-tokens","input":"1.00","output":"5.00","cachedInput":"0.10","batchMultiplier":"0.5","sourceUrl":"https://ai.google.dev/gemini-api/docs/pricing","observedAt":"2026-10-03","notes":["Added 2026-10-03. It is not known whether this model was on the page on 2026-09-07, so effectiveFrom is the observation date.","Promotional rate for gemini-robotics-er-2-preview: input \"$1.00 (text / image / video / audio) through December 31, 2026\", output \"$5.00 through December 31, 2026\". The end date is published, so effectiveTo is sourced.","Batch rows ($0.50 / $2.50 through 2026-12-31, $1.00 / $5.00 from 2027-01-01) are exactly half the Standard rates, so batchMultiplier is 0.5.","cachedInput records this model's published context-caching rate. The separate per-hour cache storage fee is outside this schema."]},
      {"effectiveFrom":"2027-01-01","currency":"USD","unit":"per-million-tokens","input":"2.00","output":"10.00","cachedInput":"0.20","batchMultiplier":"0.5","sourceUrl":"https://ai.google.dev/gemini-api/docs/pricing","observedAt":"2026-10-03","notes":["Standard rate published as \"$2.00 starting January 1, 2027\" input and \"$10.00 starting January 1, 2027\" output.","Batch rows ($0.50 / $2.50 through 2026-12-31, $1.00 / $5.00 from 2027-01-01) are exactly half the Standard rates, so batchMultiplier is 0.5.","cachedInput records this model's published context-caching rate. The separate per-hour cache storage fee is outside this schema."]},
    ],
    source: {"url":"https://ai.google.dev/gemini-api/docs/pricing","observedAt":"2026-10-03"},
  },
  {
    canonicalId: "gemini-robotics-er-2-streaming-preview",
    provider: "google",
    aliases: [],
    family: "gemini-robotics",
    pricing: [
      {"effectiveFrom":"2026-10-03","effectiveTo":"2027-01-01","currency":"USD","unit":"per-million-tokens","input":"1.00","output":"5.00","sourceUrl":"https://ai.google.dev/gemini-api/docs/pricing","observedAt":"2026-10-03","notes":["Added 2026-10-03. It is not known whether this model was on the page on 2026-09-07, so effectiveFrom is the observation date.","Promotional rate for gemini-robotics-er-2-streaming-preview: input \"$1.00 (text / image / video / audio) through December 31, 2026\", output \"$5.00 through December 31, 2026\". The end date is published, so effectiveTo is sourced.","The page publishes no context-caching or Batch rate for this model."]},
      {"effectiveFrom":"2027-01-01","currency":"USD","unit":"per-million-tokens","input":"2.00","output":"10.00","sourceUrl":"https://ai.google.dev/gemini-api/docs/pricing","observedAt":"2026-10-03","notes":["Standard rate published as \"$2.00 starting January 1, 2027\" input and \"$10.00 starting January 1, 2027\" output.","The page publishes no context-caching or Batch rate for this model."]},
    ],
    source: {"url":"https://ai.google.dev/gemini-api/docs/pricing","observedAt":"2026-10-03"},
  },
  {
    canonicalId: "gpt-oss-120b",
    provider: "groq",
    aliases: [],
    family: "gpt-oss",
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"0.15","output":"0.60","sourceUrl":"https://console.groq.com/docs/models","observedAt":"2026-10-03","notes":["Groq's docs page does not publish an effective date for this rate; effectiveFrom is set conservatively to 2026-01-01.","No prompt-caching or Batch API discount is documented for Groq in the fetched page.","OpenAI's open-weight gpt-oss-120b model, hosted independently by Groq under Groq's own rate card (also hosted by Together AI, at the same $0.15/$0.60 rate as observed — coincidental agreement, not assumed parity).","The same page showed no rate change on 2026-09-07 or 2026-10-03."]},
    ],
    source: {"url":"https://console.groq.com/docs/models","observedAt":"2026-10-03"},
  },
  {
    canonicalId: "gpt-oss-20b",
    provider: "groq",
    aliases: [],
    family: "gpt-oss",
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"0.075","output":"0.30","sourceUrl":"https://console.groq.com/docs/models","observedAt":"2026-10-03","notes":["Groq's docs page does not publish an effective date for this rate; effectiveFrom is set conservatively to 2026-01-01.","No prompt-caching or Batch API discount is documented for Groq in the fetched page.","Also hosted by Together AI at a different rate ($0.05/$0.20 as observed) — each host prices it independently; do not assume parity.","The same page showed no rate change on 2026-09-07 or 2026-10-03."]},
    ],
    source: {"url":"https://console.groq.com/docs/models","observedAt":"2026-10-03"},
  },
  {
    canonicalId: "qwen3.8-27b",
    provider: "groq",
    aliases: ["qwen/qwen3.8-27b"],
    family: "qwen3.8",
    pricing: [
      {"effectiveFrom":"2026-09-07","currency":"USD","unit":"per-million-tokens","input":"0.80","output":"4.00","sourceUrl":"https://console.groq.com/docs/models","observedAt":"2026-10-03","notes":["New model: absent from this page on 2026-08-05, present on 2026-09-07. effectiveFrom is the observation date rather than this file's conservative 2026-01-01, since the earlier fetch proves it was not listed then.","Marked Preview on Groq's page - less stable than a Production model, and its price may move accordingly.","Groq publishes no cached-input rate or batch discount for these models, so both fields are omitted.","Re-confirmed unchanged on 2026-10-03 against the same page, still in the Preview table: \"$0.80 input $4.00 output\"."]},
    ],
    source: {"url":"https://console.groq.com/docs/models","observedAt":"2026-10-03"},
  },
  {
    canonicalId: "codestral",
    provider: "mistral",
    aliases: ["codestral-latest"],
    family: "codestral",
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"0.30","output":"0.90","cachedInput":"0.03","batchMultiplier":"0.5","sourceUrl":"https://mistral.ai/pricing/api","observedAt":"2026-10-03","notes":["Mistral does not publish an effective date for this rate. effectiveFrom uses 2026-01-01 as a conservative placeholder.","Re-confirmed unchanged on 2026-09-07 against the same page, which prints the API id as 'codestral-latest' (recorded as an alias).","On 2026-10-03, the same page still listed: the \"Codestral\" card prints Input (/M tokens) $0.3 and Output (/M tokens) $0.9; with the page's \"Cached input tokens\" option applied it prints $0.03 cached input, and the Batch tab prints $0.15 / $0.45, exactly half of both standard rates. cachedInput and batchMultiplier added on 2026-10-03 from those printed per-model figures (cachedInput is the page's own $0.03, not computed; batchMultiplier 0.5 is the ratio the Batch tab prints for both fields)."]},
    ],
    source: {"url":"https://mistral.ai/pricing/api","observedAt":"2026-10-03"},
  },
  {
    canonicalId: "ministral-3-14b",
    provider: "mistral",
    aliases: ["ministral-14b-latest"],
    family: "ministral-3",
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"0.20","output":"0.20","cachedInput":"0.02","batchMultiplier":"0.5","sourceUrl":"https://mistral.ai/pricing/api","observedAt":"2026-10-03","notes":["Mistral does not publish an effective date for this rate. effectiveFrom uses 2026-01-01 as a conservative placeholder.","AWS Bedrock resells a \"Ministral 14B 3.0\" at the same $0.20/$0.20 figure as independently observed on Bedrock's pricing page — likely the same model, coincidental agreement not assumed; Bedrock's variant was not added to aws-bedrock.json in this pass since the version suffix (\"3.0\") was not cross-checked against this \"ministral-3-14b\" naming.","Re-confirmed unchanged on 2026-09-07 against the same page, which prints the API id as 'ministral-14b-latest' (recorded as an alias).","On 2026-10-03, the same page still listed: the \"Ministral 3 (14B)\" card prints Input (/M tokens) $0.2 and Output (/M tokens) $0.2; with the page's \"Cached input tokens\" option applied it prints $0.02 cached input, and the Batch tab prints $0.1 / $0.1, exactly half of both standard rates. cachedInput and batchMultiplier added on 2026-10-03 from those printed per-model figures (cachedInput is the page's own $0.02, not computed; batchMultiplier 0.5 is the ratio the Batch tab prints for both fields)."]},
    ],
    source: {"url":"https://mistral.ai/pricing/api","observedAt":"2026-10-03"},
  },
  {
    canonicalId: "ministral-3-3b",
    provider: "mistral",
    aliases: ["ministral-3b-latest"],
    family: "ministral-3",
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"0.10","output":"0.10","cachedInput":"0.01","batchMultiplier":"0.5","sourceUrl":"https://mistral.ai/pricing/api","observedAt":"2026-10-03","notes":["Mistral does not publish an effective date for this rate. effectiveFrom uses 2026-01-01 as a conservative placeholder.","Re-confirmed unchanged on 2026-09-07 against the same page, which prints the API id as 'ministral-3b-latest' (recorded as an alias).","On 2026-10-03, the same page still listed: the \"Ministral 3 (3B)\" card prints Input (/M tokens) $0.1 and Output (/M tokens) $0.1; with the page's \"Cached input tokens\" option applied it prints $0.01 cached input, and the Batch tab prints $0.05 / $0.05, exactly half of both standard rates. cachedInput and batchMultiplier added on 2026-10-03 from those printed per-model figures (cachedInput is the page's own $0.01, not computed; batchMultiplier 0.5 is the ratio the Batch tab prints for both fields)."]},
    ],
    source: {"url":"https://mistral.ai/pricing/api","observedAt":"2026-10-03"},
  },
  {
    canonicalId: "ministral-3-8b",
    provider: "mistral",
    aliases: ["ministral-8b-latest"],
    family: "ministral-3",
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"0.15","output":"0.15","cachedInput":"0.015","batchMultiplier":"0.5","sourceUrl":"https://mistral.ai/pricing/api","observedAt":"2026-10-03","notes":["Mistral does not publish an effective date for this rate. effectiveFrom uses 2026-01-01 as a conservative placeholder.","Re-confirmed unchanged on 2026-09-07 against the same page, which prints the API id as 'ministral-8b-latest' (recorded as an alias).","On 2026-10-03, the same page still listed: the \"Ministral 3 (8B)\" card prints Input (/M tokens) $0.15 and Output (/M tokens) $0.15; with the page's \"Cached input tokens\" option applied it prints $0.015 cached input, and the Batch tab prints $0.075 / $0.075, exactly half of both standard rates. cachedInput and batchMultiplier added on 2026-10-03 from those printed per-model figures (cachedInput is the page's own $0.015, not computed; batchMultiplier 0.5 is the ratio the Batch tab prints for both fields)."]},
    ],
    source: {"url":"https://mistral.ai/pricing/api","observedAt":"2026-10-03"},
  },
  {
    canonicalId: "mistral-large-3",
    provider: "mistral",
    aliases: ["mistral-large-latest"],
    family: "mistral-large",
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"0.50","output":"1.50","cachedInput":"0.05","batchMultiplier":"0.5","sourceUrl":"https://mistral.ai/pricing/api","observedAt":"2026-10-03","notes":["Mistral does not publish an effective date for this rate. effectiveFrom uses 2026-01-01 as a conservative placeholder.","This is Mistral's own first-party rate. AWS Bedrock also resells \"Mistral Large 3\" under its own rate card at the same $0.50/$1.50 figure as independently observed on Bedrock's pricing page — coincidental agreement between the two sources, not assumed; see aws-bedrock.json.","Re-confirmed unchanged on 2026-09-07 against the same page, which prints the API id as 'mistral-large-latest' (recorded as an alias).","cachedInput and batchMultiplier added on 2026-09-07: the page publishes \"Cached input: 90% discount\" and \"Batch: 50% discount\" for this model, so cachedInput is 0.1x this model's own input rate (0.50 -> 0.05), computed as an exact decimal, and batchMultiplier is 0.5. Both come from this model's own row, not from a sibling's rate.","On 2026-10-03, the same page still listed: the \"Mistral Large 3\" card prints Input (/M tokens) $0.5 and Output (/M tokens) $1.5; with the page's \"Cached input tokens\" option applied it prints $0.05 cached input, and the Batch tab prints $0.25 / $0.75, exactly half of both standard rates."]},
    ],
    source: {"url":"https://mistral.ai/pricing/api","observedAt":"2026-10-03"},
  },
  {
    canonicalId: "mistral-medium-3.5",
    provider: "mistral",
    aliases: ["mistral-medium-latest"],
    family: "mistral-medium",
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"1.50","output":"7.50","cachedInput":"0.15","batchMultiplier":"0.5","sourceUrl":"https://mistral.ai/pricing/api","observedAt":"2026-10-03","notes":["Mistral does not publish an effective date for this rate. effectiveFrom uses 2026-01-01 as a conservative placeholder.","No cachedInput or batchMultiplier is documented on the fetched page for this model; omitted rather than assumed.","Re-confirmed unchanged on 2026-09-07 against the same page, which prints the API id as 'mistral-medium-latest' (recorded as an alias).","cachedInput and batchMultiplier added on 2026-09-07: the page publishes \"Cached input: 90% discount\" and \"Batch: 50% discount\" for this model, so cachedInput is 0.1x this model's own input rate (1.50 -> 0.15), computed as an exact decimal, and batchMultiplier is 0.5. Both come from this model's own row, not from a sibling's rate.","On 2026-10-03, the same page still listed: the \"Mistral Medium 3.5\" card prints Input (/M tokens) $1.5 and Output (/M tokens) $7.5; with the page's \"Cached input tokens\" option applied it prints $0.15 cached input, and the Batch tab prints $0.75 / $3.75, exactly half of both standard rates."]},
    ],
    source: {"url":"https://mistral.ai/pricing/api","observedAt":"2026-10-03"},
  },
  {
    canonicalId: "mistral-small-4",
    provider: "mistral",
    aliases: ["mistral-small-latest"],
    family: "mistral-small",
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"0.15","output":"0.60","cachedInput":"0.015","batchMultiplier":"0.5","sourceUrl":"https://mistral.ai/pricing/api","observedAt":"2026-10-03","notes":["Mistral does not publish an effective date for this rate. effectiveFrom uses 2026-01-01 as a conservative placeholder.","Re-confirmed unchanged on 2026-09-07 against the same page, which prints the API id as 'mistral-small-latest' (recorded as an alias).","cachedInput and batchMultiplier added on 2026-09-07: the page publishes \"Cached input: 90% discount\" and \"Batch: 50% discount\" for this model, so cachedInput is 0.1x this model's own input rate (0.15 -> 0.015), computed as an exact decimal, and batchMultiplier is 0.5. Both come from this model's own row, not from a sibling's rate.","On 2026-10-03, the same page still listed: the \"Mistral Small 4\" card prints Input (/M tokens) $0.15 and Output (/M tokens) $0.6; with the page's \"Cached input tokens\" option applied it prints $0.015 cached input, and the Batch tab prints $0.075 / $0.3, exactly half of both standard rates."]},
    ],
    source: {"url":"https://mistral.ai/pricing/api","observedAt":"2026-10-03"},
  },
  {
    canonicalId: "zai-glm-5-2",
    provider: "mistral",
    aliases: [],
    family: "glm",
    pricing: [
      {"effectiveFrom":"2026-09-07","currency":"USD","unit":"per-million-tokens","input":"1.40","output":"4.40","cachedInput":"0.14","batchMultiplier":"0.5","sourceUrl":"https://mistral.ai/pricing/api","observedAt":"2026-10-03","notes":["New entry: absent from this page on 2026-08-05, present on 2026-09-07. effectiveFrom is the observation date rather than this file's conservative 2026-01-01.","Listed under \"Third-Party Models\" on Mistral's own pricing page - a Z.ai GLM model resold through La Plateforme, so this is Mistral's resale rate, not Z.ai's first-party rate.","All three rates are printed per-model on the page. No batch discount is stated for the third-party section, so batchMultiplier is omitted rather than assumed from the first-party models' 50%.","On 2026-10-03, the same page still listed: the \"GLM 5.2\" card prints Input (/M tokens) $1.4 and Output (/M tokens) $4.4; with the page's \"Cached input tokens\" option applied it prints $0.14 cached input, and the Batch tab prints $0.7 / $2.2, exactly half of both standard rates. batchMultiplier added on 2026-10-03 from those printed per-model figures (cachedInput is the page's own $0.14, not computed; batchMultiplier 0.5 is the ratio the Batch tab prints for both fields).","The earlier \"no batch discount is stated\" note is superseded: the 2026-10-03 page has a Batch tab that prints this model at $0.7 / $2.2.","Mistral's model catalogue (https://docs.mistral.ai/getting-started/models) lists \"Z.ai GLM 5.2\" (zai-glm-5-2) as deprecated: \"Deprecation 9/29/2026, Retirement 10/31/2026\", replaced by Z.ai GLM 5.3. The pricing page still prints its rate on 2026-10-03, so the period stays open; close it if the page drops the model after retirement."]},
    ],
    source: {"url":"https://mistral.ai/pricing/api","observedAt":"2026-10-03"},
  },
  {
    canonicalId: "zai-glm-5-3",
    provider: "mistral",
    aliases: [],
    family: "glm",
    pricing: [
      {"effectiveFrom":"2026-10-03","currency":"USD","unit":"per-million-tokens","input":"1.40","output":"4.40","cachedInput":"0.14","batchMultiplier":"0.5","sourceUrl":"https://mistral.ai/pricing/api","observedAt":"2026-10-03","notes":["New entry: absent from this page on 2026-09-07, present on 2026-10-03 as \"GLM 5.3\" (marked New). effectiveFrom is the observation date: the pricing page states no effective date. The model's docs page (https://docs.mistral.ai/models/zai-glm-5-3) gives a release date of September 15, 2026, but no price was observed before 2026-10-03, so lookups dated earlier are left unpriced rather than assumed.","Listed as \"Third-party\" on Mistral's own pricing page - a Z.ai GLM model resold through Mistral, so this is Mistral's resale rate, not Z.ai's first-party rate. API id zai-glm-5-3 per Mistral's model catalogue.","The card prints Input (/M tokens) $1.4 and Output (/M tokens) $4.4; with the page's \"Cached input tokens\" option applied it prints $0.14 cached input (the docs page also states \"$0.14 Cached input/M Tokens\"), and the Batch tab prints $0.7 / $2.2, exactly half of both standard rates, hence batchMultiplier 0.5.","together.json carries the same Z.ai model as glm-5.3. The ids differ, so the resolver sees no ambiguity between them; rates there were fetched independently from Together's own page."]},
    ],
    source: {"url":"https://mistral.ai/pricing/api","observedAt":"2026-10-03"},
  },
  {
    canonicalId: "chat-latest",
    provider: "openai",
    aliases: [],
    family: "chat",
    pricing: [
      {"effectiveFrom":"2026-10-03","currency":"USD","unit":"per-million-tokens","input":"5.00","output":"30.00","cachedInput":"0.50","sourceUrl":"https://developers.openai.com/api/docs/pricing","observedAt":"2026-10-03","notes":["Added 2026-10-03 from the page's \"Specialized models\" table. It is not known whether that table was on the page on 2026-09-07, so effectiveFrom is the observation date.","Quoted row: \"| ChatGPT | chat-latest | $5.00 | $0.50 | $30.00 |\".","chat-latest is a moving alias for the model currently used in ChatGPT; OpenAI may repoint it, so a later refresh can change this rate without a model rename.","No cache-write rate is published for this model.","The page has no Batch row for this model, so batchMultiplier is omitted."]},
    ],
    source: {"url":"https://developers.openai.com/api/docs/pricing","observedAt":"2026-10-03"},
  },
  {
    canonicalId: "gpt-3.5-turbo",
    provider: "openai",
    aliases: [],
    family: "gpt-3.5",
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"0.50","output":"1.50","sourceUrl":"https://developers.openai.com/api/docs/pricing","observedAt":"2026-10-03","notes":["Found on https://developers.openai.com/api/docs/pricing during a second confirmation pass.","The pricing page publishes no cached-input rate for gpt-3.5-turbo, so cachedInput is omitted.","OpenAI does not publish an effective date for this rate. effectiveFrom uses 2026-01-01 as a conservative placeholder until the rollout date is confirmed.","batchMultiplier removed on 2026-10-03: the Batch table no longer lists gpt-3.5-turbo (only the dated gpt-3.5-turbo-0125 snapshot), and the all-models Batch statement is gone from the page. A batch request for this model now falls back to Standard rates with a BATCH_PRICING_UNAVAILABLE warning, which never under-reports."]},
    ],
    source: {"url":"https://developers.openai.com/api/docs/pricing","observedAt":"2026-10-03"},
  },
  {
    canonicalId: "gpt-4.1",
    provider: "openai",
    aliases: [],
    family: "gpt-4.1",
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"2.00","output":"8.00","cachedInput":"0.50","batchMultiplier":"0.5","sourceUrl":"https://developers.openai.com/api/docs/pricing","observedAt":"2026-10-03","notes":["OpenAI does not publish an effective date for this rate. effectiveFrom uses 2026-01-01 as a conservative placeholder until the rollout date is confirmed.","The 2026-10-03 Batch table lists gpt-4.1 at $1.00 input / $4.00 output, half the Standard rates. This per-model table replaced the all-models Batch statement quoted on 2026-09-07. The Batch table publishes no cached-input rate for this model, so a batch request's cached tokens are priced here at half the Standard cached rate, which the page neither confirms nor contradicts."]},
    ],
    source: {"url":"https://developers.openai.com/api/docs/pricing","observedAt":"2026-10-03"},
  },
  {
    canonicalId: "gpt-4.1-mini",
    provider: "openai",
    aliases: [],
    family: "gpt-4.1",
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"0.40","output":"1.60","cachedInput":"0.10","batchMultiplier":"0.5","sourceUrl":"https://developers.openai.com/api/docs/pricing","observedAt":"2026-10-03","notes":["OpenAI does not publish an effective date for this rate. effectiveFrom uses 2026-01-01 as a conservative placeholder until the rollout date is confirmed.","The 2026-10-03 Batch table lists gpt-4.1-mini at $0.20 input / $0.80 output, half the Standard rates. This per-model table replaced the all-models Batch statement quoted on 2026-09-07. The Batch table publishes no cached-input rate for this model, so a batch request's cached tokens are priced here at half the Standard cached rate, which the page neither confirms nor contradicts."]},
    ],
    source: {"url":"https://developers.openai.com/api/docs/pricing","observedAt":"2026-10-03"},
  },
  {
    canonicalId: "gpt-4.1-nano",
    provider: "openai",
    aliases: [],
    family: "gpt-4.1",
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"0.10","output":"0.40","cachedInput":"0.025","batchMultiplier":"0.5","sourceUrl":"https://developers.openai.com/api/docs/pricing","observedAt":"2026-10-03","notes":["OpenAI does not publish an effective date for this rate. effectiveFrom uses 2026-01-01 as a conservative placeholder until the rollout date is confirmed.","The 2026-10-03 Batch table lists gpt-4.1-nano at $0.05 input / $0.20 output, half the Standard rates. This per-model table replaced the all-models Batch statement quoted on 2026-09-07. The Batch table publishes no cached-input rate for this model, so a batch request's cached tokens are priced here at half the Standard cached rate, which the page neither confirms nor contradicts."]},
    ],
    source: {"url":"https://developers.openai.com/api/docs/pricing","observedAt":"2026-10-03"},
  },
  {
    canonicalId: "gpt-4o",
    provider: "openai",
    aliases: [],
    family: "gpt-4o",
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"2.50","output":"10.00","cachedInput":"1.25","batchMultiplier":"0.5","sourceUrl":"https://developers.openai.com/api/docs/pricing","observedAt":"2026-10-03","notes":["OpenAI does not publish an effective date for this rate. effectiveFrom uses 2026-01-01 as a conservative placeholder until the rollout date is confirmed.","The 2026-10-03 Batch table lists gpt-4o at $1.25 input / $5.00 output, half the Standard rates. This per-model table replaced the all-models Batch statement quoted on 2026-09-07. The Batch table publishes no cached-input rate for this model, so a batch request's cached tokens are priced here at half the Standard cached rate, which the page neither confirms nor contradicts."]},
    ],
    source: {"url":"https://developers.openai.com/api/docs/pricing","observedAt":"2026-10-03"},
  },
  {
    canonicalId: "gpt-4o-mini",
    provider: "openai",
    aliases: [],
    family: "gpt-4o",
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"0.15","output":"0.60","cachedInput":"0.075","batchMultiplier":"0.5","sourceUrl":"https://developers.openai.com/api/docs/pricing","observedAt":"2026-10-03","notes":["OpenAI does not publish an effective date for this rate. effectiveFrom uses 2026-01-01 as a conservative placeholder until the rollout date is confirmed.","The 2026-10-03 Batch table lists gpt-4o-mini at $0.075 input / $0.30 output, half the Standard rates. This per-model table replaced the all-models Batch statement quoted on 2026-09-07. The Batch table publishes no cached-input rate for this model, so a batch request's cached tokens are priced here at half the Standard cached rate, which the page neither confirms nor contradicts."]},
    ],
    source: {"url":"https://developers.openai.com/api/docs/pricing","observedAt":"2026-10-03"},
  },
  {
    canonicalId: "gpt-5",
    provider: "openai",
    aliases: [],
    family: "gpt-5",
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"1.25","output":"10.00","cachedInput":"0.125","batchMultiplier":"0.5","sourceUrl":"https://developers.openai.com/api/docs/pricing","observedAt":"2026-10-03","notes":["OpenAI does not publish an effective date for this rate. effectiveFrom uses 2026-01-01 as a conservative placeholder until the rollout date is confirmed.","The 2026-10-03 Batch table lists gpt-5 at $0.625 input / $5.00 output, half the Standard rates. This per-model table replaced the all-models Batch statement quoted on 2026-09-07.","Lead-supplied verified table (observed 2026-08-05) matches this rate exactly; independently re-confirmed against https://developers.openai.com/api/docs/pricing on the same date."]},
    ],
    source: {"url":"https://developers.openai.com/api/docs/pricing","observedAt":"2026-10-03"},
  },
  {
    canonicalId: "gpt-5-mini",
    provider: "openai",
    aliases: [],
    family: "gpt-5",
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"0.25","output":"2.00","cachedInput":"0.025","batchMultiplier":"0.5","sourceUrl":"https://developers.openai.com/api/docs/pricing","observedAt":"2026-10-03","notes":["OpenAI does not publish an effective date for this rate. effectiveFrom uses 2026-01-01 as a conservative placeholder until the rollout date is confirmed.","The 2026-10-03 Batch table lists gpt-5-mini at $0.125 input / $1.00 output, half the Standard rates. This per-model table replaced the all-models Batch statement quoted on 2026-09-07."]},
    ],
    source: {"url":"https://developers.openai.com/api/docs/pricing","observedAt":"2026-10-03"},
  },
  {
    canonicalId: "gpt-5-nano",
    provider: "openai",
    aliases: [],
    family: "gpt-5",
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"0.05","output":"0.40","cachedInput":"0.005","batchMultiplier":"0.5","sourceUrl":"https://developers.openai.com/api/docs/pricing","observedAt":"2026-10-03","notes":["OpenAI does not publish an effective date for this rate. effectiveFrom uses 2026-01-01 as a conservative placeholder until the rollout date is confirmed.","The 2026-10-03 Batch table lists gpt-5-nano at $0.025 input / $0.20 output, half the Standard rates. This per-model table replaced the all-models Batch statement quoted on 2026-09-07."]},
    ],
    source: {"url":"https://developers.openai.com/api/docs/pricing","observedAt":"2026-10-03"},
  },
  {
    canonicalId: "gpt-5-pro",
    provider: "openai",
    aliases: [],
    family: "gpt-5",
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"15.00","output":"120.00","batchMultiplier":"0.5","sourceUrl":"https://developers.openai.com/api/docs/pricing","observedAt":"2026-10-03","notes":["The pricing page shows \"—\" for gpt-5-pro cached input, so cachedInput is omitted.","OpenAI does not publish an effective date for this rate. effectiveFrom uses 2026-01-01 as a conservative placeholder until the rollout date is confirmed.","The 2026-10-03 Batch table lists gpt-5-pro at $7.50 input / $60.00 output, half the Standard rates. This per-model table replaced the all-models Batch statement quoted on 2026-09-07."]},
    ],
    source: {"url":"https://developers.openai.com/api/docs/pricing","observedAt":"2026-10-03"},
  },
  {
    canonicalId: "gpt-5-search-api",
    provider: "openai",
    aliases: [],
    family: "gpt-5",
    pricing: [
      {"effectiveFrom":"2026-10-03","currency":"USD","unit":"per-million-tokens","input":"1.25","output":"10.00","cachedInput":"0.125","sourceUrl":"https://developers.openai.com/api/docs/pricing","observedAt":"2026-10-03","notes":["Added 2026-10-03 from the page's \"Specialized models\" table. It is not known whether that table was on the page on 2026-09-07, so effectiveFrom is the observation date.","Quoted row: \"| Search | gpt-5-search-api | $1.25 | $0.125 | $10.00 |\".","Token rates only: any per-call web search charge is not modelled by this schema.","No cache-write rate is published for this model.","The page has no Batch row for this model, so batchMultiplier is omitted."]},
    ],
    source: {"url":"https://developers.openai.com/api/docs/pricing","observedAt":"2026-10-03"},
  },
  {
    canonicalId: "gpt-5.1",
    provider: "openai",
    aliases: [],
    family: "gpt-5.1",
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"1.25","output":"10.00","cachedInput":"0.125","batchMultiplier":"0.5","sourceUrl":"https://developers.openai.com/api/docs/pricing","observedAt":"2026-10-03","notes":["OpenAI does not publish an effective date for this rate. effectiveFrom uses 2026-01-01 as a conservative placeholder until the rollout date is confirmed.","The 2026-10-03 Batch table lists gpt-5.1 at $0.625 input / $5.00 output, half the Standard rates. This per-model table replaced the all-models Batch statement quoted on 2026-09-07."]},
    ],
    source: {"url":"https://developers.openai.com/api/docs/pricing","observedAt":"2026-10-03"},
  },
  {
    canonicalId: "gpt-5.2",
    provider: "openai",
    aliases: [],
    family: "gpt-5.2",
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"1.75","output":"14.00","cachedInput":"0.175","batchMultiplier":"0.5","sourceUrl":"https://developers.openai.com/api/docs/pricing","observedAt":"2026-10-03","notes":["OpenAI does not publish an effective date for this rate. effectiveFrom uses 2026-01-01 as a conservative placeholder until the rollout date is confirmed.","The 2026-10-03 Batch table lists gpt-5.2 at $0.875 input / $7.00 output, half the Standard rates. This per-model table replaced the all-models Batch statement quoted on 2026-09-07."]},
    ],
    source: {"url":"https://developers.openai.com/api/docs/pricing","observedAt":"2026-10-03"},
  },
  {
    canonicalId: "gpt-5.2-pro",
    provider: "openai",
    aliases: [],
    family: "gpt-5.2",
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"21.00","output":"168.00","batchMultiplier":"0.5","sourceUrl":"https://developers.openai.com/api/docs/pricing","observedAt":"2026-10-03","notes":["The pricing page shows \"—\" for gpt-5.2-pro cached input, so cachedInput is omitted.","OpenAI does not publish an effective date for this rate. effectiveFrom uses 2026-01-01 as a conservative placeholder until the rollout date is confirmed.","The 2026-10-03 Batch table lists gpt-5.2-pro at $10.50 input / $84.00 output, half the Standard rates. This per-model table replaced the all-models Batch statement quoted on 2026-09-07."]},
    ],
    source: {"url":"https://developers.openai.com/api/docs/pricing","observedAt":"2026-10-03"},
  },
  {
    canonicalId: "gpt-5.3-codex",
    provider: "openai",
    aliases: [],
    family: "gpt-5.3",
    pricing: [
      {"effectiveFrom":"2026-10-03","currency":"USD","unit":"per-million-tokens","input":"1.75","output":"14.00","cachedInput":"0.175","sourceUrl":"https://developers.openai.com/api/docs/pricing","observedAt":"2026-10-03","notes":["Added 2026-10-03 from the page's \"Specialized models\" table. It is not known whether that table was on the page on 2026-09-07, so effectiveFrom is the observation date.","Quoted row: \"| Codex | gpt-5.3-codex | $1.75 | $0.175 | $14.00 |\".","The page also prices a Fast tier for this model ($3.50 input / $0.35 cached input / $28.00 output); only the Standard tier is recorded.","No cache-write rate is published for this model.","The page has no Batch row for this model, so batchMultiplier is omitted."]},
    ],
    source: {"url":"https://developers.openai.com/api/docs/pricing","observedAt":"2026-10-03"},
  },
  {
    canonicalId: "gpt-5.4",
    provider: "openai",
    aliases: [],
    family: "gpt-5.4",
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"2.50","output":"15.00","cachedInput":"0.25","batchMultiplier":"0.5","sourceUrl":"https://developers.openai.com/api/docs/pricing","observedAt":"2026-10-03","notes":["OpenAI does not publish an effective date for this rate. effectiveFrom uses 2026-01-01 as a conservative placeholder until the rollout date is confirmed.","The 2026-10-03 Batch table lists gpt-5.4 at $1.25 input / $7.50 output, half the Standard rates. This per-model table replaced the all-models Batch statement quoted on 2026-09-07. Its Batch cached-input rate is shown as $0.13, half of $0.25 rounded to the cent.","The schema has no context-length dimension, so this period records the page's short-context rate (<=272K input tokens). The published long-context rates (>272K) on 2026-10-03 were: $5.00 input / $0.50 cached input / no cache writes / $22.50 output."]},
    ],
    source: {"url":"https://developers.openai.com/api/docs/pricing","observedAt":"2026-10-03"},
  },
  {
    canonicalId: "gpt-5.4-mini",
    provider: "openai",
    aliases: [],
    family: "gpt-5.4",
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"0.75","output":"4.50","cachedInput":"0.075","batchMultiplier":"0.5","sourceUrl":"https://developers.openai.com/api/docs/pricing","observedAt":"2026-10-03","notes":["OpenAI does not publish an effective date for this rate. effectiveFrom uses 2026-01-01 as a conservative placeholder until the rollout date is confirmed.","The 2026-10-03 Batch table lists gpt-5.4-mini at $0.375 input / $2.25 output, half the Standard rates. This per-model table replaced the all-models Batch statement quoted on 2026-09-07."]},
    ],
    source: {"url":"https://developers.openai.com/api/docs/pricing","observedAt":"2026-10-03"},
  },
  {
    canonicalId: "gpt-5.4-nano",
    provider: "openai",
    aliases: [],
    family: "gpt-5.4",
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"0.20","output":"1.25","cachedInput":"0.02","batchMultiplier":"0.5","sourceUrl":"https://developers.openai.com/api/docs/pricing","observedAt":"2026-10-03","notes":["OpenAI does not publish an effective date for this rate. effectiveFrom uses 2026-01-01 as a conservative placeholder until the rollout date is confirmed.","The 2026-10-03 Batch table lists gpt-5.4-nano at $0.10 input / $0.625 output, half the Standard rates. This per-model table replaced the all-models Batch statement quoted on 2026-09-07."]},
    ],
    source: {"url":"https://developers.openai.com/api/docs/pricing","observedAt":"2026-10-03"},
  },
  {
    canonicalId: "gpt-5.4-pro",
    provider: "openai",
    aliases: [],
    family: "gpt-5.4",
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"30.00","output":"180.00","batchMultiplier":"0.5","sourceUrl":"https://developers.openai.com/api/docs/pricing","observedAt":"2026-10-03","notes":["The pricing page shows \"—\" for gpt-5.4-pro cached input, so cachedInput is omitted.","OpenAI does not publish an effective date for this rate. effectiveFrom uses 2026-01-01 as a conservative placeholder until the rollout date is confirmed.","The 2026-10-03 Batch table lists gpt-5.4-pro at $15.00 input / $90.00 output, half the Standard rates. This per-model table replaced the all-models Batch statement quoted on 2026-09-07.","The schema has no context-length dimension, so this period records the page's short-context rate (<=272K input tokens). The published long-context rates (>272K) on 2026-10-03 were: $60.00 input / no cached input / no cache writes / $270.00 output."]},
    ],
    source: {"url":"https://developers.openai.com/api/docs/pricing","observedAt":"2026-10-03"},
  },
  {
    canonicalId: "gpt-5.5",
    provider: "openai",
    aliases: [],
    family: "gpt-5.5",
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"5.00","output":"30.00","cachedInput":"0.50","batchMultiplier":"0.5","sourceUrl":"https://developers.openai.com/api/docs/pricing","observedAt":"2026-10-03","notes":["OpenAI does not publish an effective date for this rate. effectiveFrom uses 2026-01-01 as a conservative placeholder until the rollout date is confirmed.","The 2026-10-03 Batch table lists gpt-5.5 at $2.50 input / $15.00 output, half the Standard rates. This per-model table replaced the all-models Batch statement quoted on 2026-09-07.","The schema has no context-length dimension, so this period records the page's short-context rate (<=272K input tokens). The published long-context rates (>272K) on 2026-10-03 were: $10.00 input / $1.00 cached input / no cache writes / $45.00 output."]},
    ],
    source: {"url":"https://developers.openai.com/api/docs/pricing","observedAt":"2026-10-03"},
  },
  {
    canonicalId: "gpt-5.5-cyber",
    provider: "openai",
    aliases: [],
    family: "gpt-5.5",
    pricing: [
      {"effectiveFrom":"2026-10-03","currency":"USD","unit":"per-million-tokens","input":"12.50","output":"75.00","cachedInput":"1.25","sourceUrl":"https://developers.openai.com/api/docs/pricing","observedAt":"2026-10-03","notes":["Added 2026-10-03 from the page's \"Cyber models\" table. It is not known whether that table was on the page on 2026-09-07, so effectiveFrom is the observation date.","Quoted row: \"| gpt-5.5-cyber | $12.50 | $1.25 | - | $75.00 | - | - | - | - |\". No cache-write or long-context rate is published.","Listed beside gpt-5.6-cyber, which requires separate approval; this model's own access terms were not fetched.","The page has no Batch row for this model, so batchMultiplier is omitted."]},
    ],
    source: {"url":"https://developers.openai.com/api/docs/pricing","observedAt":"2026-10-03"},
  },
  {
    canonicalId: "gpt-5.5-pro",
    provider: "openai",
    aliases: [],
    family: "gpt-5.5",
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"30.00","output":"180.00","batchMultiplier":"0.5","sourceUrl":"https://developers.openai.com/api/docs/pricing","observedAt":"2026-10-03","notes":["The pricing page shows \"—\" for gpt-5.5-pro cached input, so cachedInput is omitted.","OpenAI does not publish an effective date for this rate. effectiveFrom uses 2026-01-01 as a conservative placeholder until the rollout date is confirmed.","The 2026-10-03 Batch table lists gpt-5.5-pro at $15.00 input / $90.00 output, half the Standard rates. This per-model table replaced the all-models Batch statement quoted on 2026-09-07.","The schema has no context-length dimension, so this period records the page's short-context rate (<=272K input tokens). The published long-context rates (>272K) on 2026-10-03 were: $60.00 input / no cached input / no cache writes / $270.00 output."]},
    ],
    source: {"url":"https://developers.openai.com/api/docs/pricing","observedAt":"2026-10-03"},
  },
  {
    canonicalId: "gpt-5.6-cyber",
    provider: "openai",
    aliases: [],
    family: "gpt-5.6",
    pricing: [
      {"effectiveFrom":"2026-10-03","currency":"USD","unit":"per-million-tokens","input":"12.50","output":"75.00","cachedInput":"1.25","cacheWrite":"15.625","sourceUrl":"https://developers.openai.com/api/docs/pricing","observedAt":"2026-10-03","notes":["Added 2026-10-03 from the page's \"Cyber models\" table. It is not known whether that table was on the page on 2026-09-07, so effectiveFrom is the observation date.","Quoted row: \"| gpt-5.6-cyber | $12.50 | $1.25 | $15.625 | $75.00 | - | - | - | - |\". No long-context tier is published.","Access-limited: the model page (https://developers.openai.com/api/docs/models/gpt-5.6-cyber) says \"This model requires separate approval and provisioning\" through the Daybreak program, and supports the Responses API only.","The page has no Batch row for this model, so batchMultiplier is omitted."]},
    ],
    source: {"url":"https://developers.openai.com/api/docs/pricing","observedAt":"2026-10-03"},
  },
  {
    canonicalId: "gpt-5.6-luna",
    provider: "openai",
    aliases: [],
    family: "gpt-5.6",
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"0.20","output":"1.20","cachedInput":"0.02","cacheWrite":"0.25","batchMultiplier":"0.5","sourceUrl":"https://developers.openai.com/api/docs/pricing","observedAt":"2026-10-03","notes":["OpenAI does not publish an effective date for this rate. effectiveFrom uses 2026-01-01 as a conservative placeholder until the rollout date is confirmed.","The 2026-10-03 Batch table lists gpt-5.6-luna at $0.10 input / $0.60 output, half the Standard rates. This per-model table replaced the all-models Batch statement quoted on 2026-09-07.","cacheWrite records the $0.25 rate from the 2026-10-03 \"Short context cache writes\" column. Earlier refreshes recorded no cache-write rate; whether the page published one then is unknown.","The schema has no context-length dimension, so this period records the page's short-context rate (<=272K input tokens). The published long-context rates (>272K) on 2026-10-03 were: $0.40 input / $0.04 cached input / $0.50 cache writes / $1.80 output."]},
    ],
    source: {"url":"https://developers.openai.com/api/docs/pricing","observedAt":"2026-10-03"},
  },
  {
    canonicalId: "gpt-5.6-sol",
    provider: "openai",
    aliases: [],
    family: "gpt-5.6",
    pricing: [
      {"effectiveFrom":"2026-01-01","effectiveTo":"2026-09-07","currency":"USD","unit":"per-million-tokens","input":"5.00","output":"30.00","cachedInput":"0.50","batchMultiplier":"0.5","sourceUrl":"https://developers.openai.com/api/docs/pricing","observedAt":"2026-08-05","notes":["OpenAI's pricing page does not publish an effective date for this rate; effectiveFrom is set conservatively to 2026-01-01 pending confirmation of the true rollout date (this model's naming implies a later release, but a conservative too-early effectiveFrom only ever makes a historical lookup succeed when it should return \"no period found\", never the reverse).","batchMultiplier reflects OpenAI's general Batch API policy (\"a 50% discount to Standard pricing rates across all models\") as stated on the pricing page; not independently confirmed per-model.","Closed on 2026-09-07: the pricing page published a lower rate (4.00 input / 20.00 output) on that date. The old rate was last confirmed 2026-08-05, so the true change date lies in (2026-08-05, 2026-09-07]; effectiveTo is the observation date, which keeps every confirmed observation correct and approximates only the unobserved gap, toward the last confirmed value."]},
      {"effectiveFrom":"2026-09-07","currency":"USD","unit":"per-million-tokens","input":"4.00","output":"20.00","cachedInput":"0.40","cacheWrite":"5.00","batchMultiplier":"0.5","sourceUrl":"https://developers.openai.com/api/docs/pricing","observedAt":"2026-10-03","notes":["Price cut observed on 2026-09-07: input 5.00 -> 4.00, output 30.00 -> 20.00, cached input 0.50 -> 0.40. OpenAI publishes no effective date, so effectiveFrom is the observation date rather than a guess at when the cut actually landed.","The 2026-10-03 Batch table lists gpt-5.6-sol at $2.00 input / $10.00 output, half the Standard rates. This per-model table replaced the all-models Batch statement quoted on 2026-09-07.","cacheWrite records the $5.00 rate from the 2026-10-03 \"Short context cache writes\" column. Earlier refreshes recorded no cache-write rate; whether the page published one then is unknown.","The schema has no context-length dimension, so this period records the page's short-context rate (<=272K input tokens). The published long-context rates (>272K) on 2026-10-03 were: $8.00 input / $0.80 cached input / $10.00 cache writes / $30.00 output.","The 2026-10-03 page calls this rate promotional: \"GPT-5.6 Sol’s promotional pricing is available at least through November 21, 2026.\" No end date is published, so the period stays open; re-check after that date."]},
    ],
    source: {"url":"https://developers.openai.com/api/docs/pricing","observedAt":"2026-10-03"},
  },
  {
    canonicalId: "gpt-5.6-terra",
    provider: "openai",
    aliases: [],
    family: "gpt-5.6",
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"2.00","output":"12.00","cachedInput":"0.20","cacheWrite":"2.50","batchMultiplier":"0.5","sourceUrl":"https://developers.openai.com/api/docs/pricing","observedAt":"2026-10-03","notes":["OpenAI does not publish an effective date for this rate. effectiveFrom uses 2026-01-01 as a conservative placeholder until the rollout date is confirmed.","The 2026-10-03 Batch table lists gpt-5.6-terra at $1.00 input / $6.00 output, half the Standard rates. This per-model table replaced the all-models Batch statement quoted on 2026-09-07.","cacheWrite records the $2.50 rate from the 2026-10-03 \"Short context cache writes\" column. Earlier refreshes recorded no cache-write rate; whether the page published one then is unknown.","The schema has no context-length dimension, so this period records the page's short-context rate (<=272K input tokens). The published long-context rates (>272K) on 2026-10-03 were: $4.00 input / $0.40 cached input / $5.00 cache writes / $18.00 output."]},
    ],
    source: {"url":"https://developers.openai.com/api/docs/pricing","observedAt":"2026-10-03"},
  },
  {
    canonicalId: "gpt-6-astra",
    provider: "openai",
    aliases: [],
    family: "gpt-6",
    pricing: [
      {"effectiveFrom":"2026-09-07","currency":"USD","unit":"per-million-tokens","input":"10.00","output":"50.00","cachedInput":"1.00","cacheWrite":"12.50","batchMultiplier":"0.5","sourceUrl":"https://developers.openai.com/api/docs/pricing","observedAt":"2026-10-03","notes":["The pricing page did not list this model on 2026-08-05 and listed it on 2026-09-07. With no published effective date, effectiveFrom uses the latter observation date.","The 2026-10-03 Batch table lists gpt-6-astra at $5.00 input / $25.00 output, half the Standard rates. This per-model table replaced the all-models Batch statement quoted on 2026-09-07.","cacheWrite records the $12.50 rate from the 2026-10-03 \"Short context cache writes\" column. Earlier refreshes recorded no cache-write rate; whether the page published one then is unknown.","The schema has no context-length dimension, so this period records the page's short-context rate (<=272K input tokens). The published long-context rates (>272K) on 2026-10-03 were: $20.00 input / $2.00 cached input / $25.00 cache writes / $75.00 output."]},
    ],
    source: {"url":"https://developers.openai.com/api/docs/pricing","observedAt":"2026-10-03"},
  },
  {
    canonicalId: "gpt-6-luna",
    provider: "openai",
    aliases: [],
    family: "gpt-6",
    pricing: [
      {"effectiveFrom":"2026-10-03","currency":"USD","unit":"per-million-tokens","input":"0.10","output":"0.50","cachedInput":"0.01","cacheWrite":"0.125","batchMultiplier":"0.5","sourceUrl":"https://developers.openai.com/api/docs/pricing","observedAt":"2026-10-03","notes":["The pricing page did not list this model on 2026-09-07 and listed it on 2026-10-03. With no published effective date, effectiveFrom uses the latter observation date.","The Batch table lists gpt-6-luna at $0.05 input / $0.25 output, half the Standard rates; batchMultiplier is \"0.5\".","The schema has no context-length dimension, so this period records the page's short-context rate (<=272K input tokens). The published long-context rates (>272K) on 2026-10-03 were: $0.20 input / $0.02 cached input / $0.25 cache writes / $0.75 output."]},
    ],
    source: {"url":"https://developers.openai.com/api/docs/pricing","observedAt":"2026-10-03"},
  },
  {
    canonicalId: "gpt-6-sol",
    provider: "openai",
    aliases: [],
    family: "gpt-6",
    pricing: [
      {"effectiveFrom":"2026-10-03","currency":"USD","unit":"per-million-tokens","input":"2.00","output":"10.00","cachedInput":"0.20","cacheWrite":"2.50","batchMultiplier":"0.5","sourceUrl":"https://developers.openai.com/api/docs/pricing","observedAt":"2026-10-03","notes":["The pricing page did not list this model on 2026-09-07 and listed it on 2026-10-03. With no published effective date, effectiveFrom uses the latter observation date.","The Batch table lists gpt-6-sol at $1.00 input / $5.00 output, half the Standard rates; batchMultiplier is \"0.5\".","The schema has no context-length dimension, so this period records the page's short-context rate (<=272K input tokens). The published long-context rates (>272K) on 2026-10-03 were: $4.00 input / $0.40 cached input / $5.00 cache writes / $15.00 output."]},
    ],
    source: {"url":"https://developers.openai.com/api/docs/pricing","observedAt":"2026-10-03"},
  },
  {
    canonicalId: "gpt-6.1-sol",
    provider: "openai",
    aliases: [],
    family: "gpt-6.1",
    pricing: [
      {"effectiveFrom":"2026-10-03","currency":"USD","unit":"per-million-tokens","input":"2.00","output":"10.00","cachedInput":"0.10","cacheWrite":"2.50","batchMultiplier":"0.5","sourceUrl":"https://developers.openai.com/api/docs/pricing","observedAt":"2026-10-03","notes":["The pricing page did not list this model on 2026-09-07 and listed it on 2026-10-03. With no published effective date, effectiveFrom uses the latter observation date.","The Batch table lists gpt-6.1-sol at $1.00 input / $5.00 output, half the Standard rates; batchMultiplier is \"0.5\".","The schema has no context-length dimension, so this period records the page's short-context rate (<=272K input tokens). The published long-context rates (>272K) on 2026-10-03 were: $4.00 input / $0.20 cached input / $5.00 cache writes / $15.00 output."]},
    ],
    source: {"url":"https://developers.openai.com/api/docs/pricing","observedAt":"2026-10-03"},
  },
  {
    canonicalId: "gpt-rosalind-research",
    provider: "openai",
    aliases: [],
    family: "gpt-rosalind",
    pricing: [
      {"effectiveFrom":"2026-10-05","currency":"USD","unit":"per-million-tokens","input":"5.00","output":"25.00","cachedInput":"0.50","sourceUrl":"https://developers.openai.com/api/docs/pricing","observedAt":"2026-10-03","notes":["Added 2026-10-03 from the page's \"Specialized models\" table. effectiveFrom is the published billing start: \"Billing for gpt-rosalind-research begins on October 5, 2026.\"","Quoted row: \"| Life Sciences | gpt-rosalind-research | $5.00 | $0.50 | $25.00 |\".","Access-limited: \"Access is limited to approved internal research through the trusted-access program.\"","No cache-write rate: \"Cache-write pricing does not apply to this model.\"","The page has no Batch row for this model, so batchMultiplier is omitted."]},
    ],
    source: {"url":"https://developers.openai.com/api/docs/pricing","observedAt":"2026-10-03"},
  },
  {
    canonicalId: "o1",
    provider: "openai",
    aliases: [],
    family: "o-series",
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"15.00","output":"60.00","cachedInput":"7.50","batchMultiplier":"0.5","sourceUrl":"https://developers.openai.com/api/docs/pricing","observedAt":"2026-10-03","notes":["OpenAI does not publish an effective date for this rate. effectiveFrom uses 2026-01-01 as a conservative placeholder until the rollout date is confirmed.","The 2026-10-03 Batch table lists o1 at $7.50 input / $30.00 output, half the Standard rates. This per-model table replaced the all-models Batch statement quoted on 2026-09-07. The Batch table publishes no cached-input rate for this model, so a batch request's cached tokens are priced here at half the Standard cached rate, which the page neither confirms nor contradicts."]},
    ],
    source: {"url":"https://developers.openai.com/api/docs/pricing","observedAt":"2026-10-03"},
  },
  {
    canonicalId: "o1-pro",
    provider: "openai",
    aliases: [],
    family: "o-series",
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"150.00","output":"600.00","batchMultiplier":"0.5","sourceUrl":"https://developers.openai.com/api/docs/pricing","observedAt":"2026-10-03","notes":["Found on https://developers.openai.com/api/docs/pricing during a second confirmation pass.","The pricing page shows \"—\" for o1-pro cached input, so cachedInput is omitted.","OpenAI does not publish an effective date for this rate. effectiveFrom uses 2026-01-01 as a conservative placeholder until the rollout date is confirmed.","The 2026-10-03 Batch table lists o1-pro at $75.00 input / $300.00 output, half the Standard rates. This per-model table replaced the all-models Batch statement quoted on 2026-09-07."]},
    ],
    source: {"url":"https://developers.openai.com/api/docs/pricing","observedAt":"2026-10-03"},
  },
  {
    canonicalId: "o3",
    provider: "openai",
    aliases: [],
    family: "o-series",
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"2.00","output":"8.00","cachedInput":"0.50","batchMultiplier":"0.5","sourceUrl":"https://developers.openai.com/api/docs/pricing","observedAt":"2026-10-03","notes":["OpenAI does not publish an effective date for this rate. effectiveFrom uses 2026-01-01 as a conservative placeholder until the rollout date is confirmed.","The 2026-10-03 Batch table lists o3 at $1.00 input / $4.00 output, half the Standard rates. This per-model table replaced the all-models Batch statement quoted on 2026-09-07. The Batch table publishes no cached-input rate for this model, so a batch request's cached tokens are priced here at half the Standard cached rate, which the page neither confirms nor contradicts."]},
    ],
    source: {"url":"https://developers.openai.com/api/docs/pricing","observedAt":"2026-10-03"},
  },
  {
    canonicalId: "o3-mini",
    provider: "openai",
    aliases: [],
    family: "o-series",
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"1.10","output":"4.40","cachedInput":"0.55","batchMultiplier":"0.5","sourceUrl":"https://developers.openai.com/api/docs/pricing","observedAt":"2026-10-03","notes":["OpenAI does not publish an effective date for this rate. effectiveFrom uses 2026-01-01 as a conservative placeholder until the rollout date is confirmed.","The 2026-10-03 Batch table lists o3-mini at $0.55 input / $2.20 output, half the Standard rates. This per-model table replaced the all-models Batch statement quoted on 2026-09-07. The Batch table publishes no cached-input rate for this model, so a batch request's cached tokens are priced here at half the Standard cached rate, which the page neither confirms nor contradicts."]},
    ],
    source: {"url":"https://developers.openai.com/api/docs/pricing","observedAt":"2026-10-03"},
  },
  {
    canonicalId: "o3-pro",
    provider: "openai",
    aliases: [],
    family: "o-series",
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"20.00","output":"80.00","batchMultiplier":"0.5","sourceUrl":"https://developers.openai.com/api/docs/pricing","observedAt":"2026-10-03","notes":["The pricing page shows \"—\" for o3-pro cached input, so cachedInput is omitted.","OpenAI does not publish an effective date for this rate. effectiveFrom uses 2026-01-01 as a conservative placeholder until the rollout date is confirmed.","The 2026-10-03 Batch table lists o3-pro at $10.00 input / $40.00 output, half the Standard rates. This per-model table replaced the all-models Batch statement quoted on 2026-09-07."]},
    ],
    source: {"url":"https://developers.openai.com/api/docs/pricing","observedAt":"2026-10-03"},
  },
  {
    canonicalId: "o4-mini",
    provider: "openai",
    aliases: [],
    family: "o-series",
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"1.10","output":"4.40","cachedInput":"0.275","batchMultiplier":"0.5","sourceUrl":"https://developers.openai.com/api/docs/pricing","observedAt":"2026-10-03","notes":["OpenAI does not publish an effective date for this rate. effectiveFrom uses 2026-01-01 as a conservative placeholder until the rollout date is confirmed.","The 2026-10-03 Batch table lists o4-mini at $0.55 input / $2.20 output, half the Standard rates. This per-model table replaced the all-models Batch statement quoted on 2026-09-07. The Batch table publishes no cached-input rate for this model, so a batch request's cached tokens are priced here at half the Standard cached rate, which the page neither confirms nor contradicts."]},
    ],
    source: {"url":"https://developers.openai.com/api/docs/pricing","observedAt":"2026-10-03"},
  },
  {
    canonicalId: "anthropic/claude-sonnet-5",
    provider: "openrouter",
    aliases: [],
    family: "anthropic-proxy",
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"2.00","output":"10.00","cachedInput":"0.20","cacheWrite":"2.50","sourceUrl":"https://openrouter.ai/anthropic/claude-sonnet-5","observedAt":"2026-10-03","notes":["Recorded 2026-08-05 flagged UNCERTAIN: $2.00/$10.00 matched what anthropic.json then held as an introductory rate expiring 2026-08-31, so it was unclear whether OpenRouter had simply not updated its listing. Resolved on 2026-09-07 - Anthropic's pricing page states the scheduled $3.00/$15.00 increase will not occur and $2.00/$10.00 is the standard rate, so this listing was correct all along and the flag is withdrawn.","OpenRouter's model page does not publish an effective date. effectiveFrom uses 2026-01-01 as a conservative placeholder.","canonicalId uses OpenRouter's slug, which differs from Anthropic's \"claude-sonnet-5\" in anthropic.json and avoids a cross-provider collision.","The same model page showed no rate change on 2026-09-07.","cachedInput added on 2026-09-07: the model page now prints a Cache Read rate of 0.20 per million tokens for this model.","cacheWrite added on 2026-09-07: the model page prints a 5-minute Cache Write rate of 2.50 per million tokens (and $4.00 for the 1-hour TTL, which this single-field schema does not model).","Resolves the 2026-08-05 caveat on this entry: $2.00/$10.00 was flagged as possibly Anthropic's introductory rate, due to be superseded by $3.00/$15.00 on 2026-09-01. Anthropic's own pricing page now states that increase will not occur and $2.00/$10.00 is the standard rate, so OpenRouter's rate matches the first-party standard rate, not a stale introductory one.","The page notes Google Vertex (US/Europe) and Amazon Bedrock (US) upstreams charge $2.20/$11.00 through OpenRouter; the default cross-provider rate is recorded, since this schema has no upstream dimension.","The same model page showed no rate change on 2026-10-03.","On 2026-10-03 the page lists Amazon Bedrock, Azure and Google Vertex endpoints at $2.20/$11.00 (cache read $0.22) outside standard routing; the default $2.00/$10.00 rate is still the one recorded."]},
    ],
    source: {"url":"https://openrouter.ai/anthropic/claude-sonnet-5","observedAt":"2026-10-03"},
  },
  {
    canonicalId: "google/gemini-3.1-pro-preview",
    provider: "openrouter",
    aliases: [],
    family: "google-proxy",
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"2.00","output":"12.00","cachedInput":"0.20","cacheWrite":"0.375","cheapestTier":true,"sourceUrl":"https://openrouter.ai/google/gemini-3.1-pro-preview","observedAt":"2026-10-03","notes":["OpenRouter's model page does not publish an effective date. effectiveFrom uses 2026-01-01 as a conservative placeholder.","Matches Google's own first-party <=200k-token-tier rate for gemini-3.1-pro-preview ($2.00/$12.00, see google.json) exactly as observed. Google's >200k-token tier ($4.00/$18.00) is not represented here (or, evidently, distinguished by OpenRouter's listing either) — same context-length-tiering limitation as google.json.","canonicalId uses OpenRouter's own slug format, deliberately distinct from Google's first-party canonicalId \"gemini-3.1-pro-preview\" (google.json).","The same model page showed no rate change on 2026-09-07.","cachedInput added on 2026-09-07: the model page now prints a Cache Read rate of 0.20 per million tokens for this model.","The same model page showed no rate change on 2026-10-03.","cacheWrite added on 2026-10-03: the model page now states \"Cache Write at $0.375/M tokens\" for this model; the 2026-09-07 entry recorded none. Recorded on the existing period, as the 2026-09-07 refresh did for newly printed cache rates.","On 2026-10-03 the page also lists Flex ($1.00/$6.00) and Priority ($3.60/$21.60) endpoints outside standard routing; the standard rate is recorded."]},
    ],
    source: {"url":"https://openrouter.ai/google/gemini-3.1-pro-preview","observedAt":"2026-10-03"},
  },
  {
    canonicalId: "meta-llama/llama-3.3-70b-instruct",
    provider: "openrouter",
    aliases: [],
    family: "meta-proxy",
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"0.10","output":"0.32","sourceUrl":"https://openrouter.ai/meta-llama/llama-3.3-70b-instruct","observedAt":"2026-10-03","notes":["OpenRouter's model page does not publish an effective date. effectiveFrom uses 2026-01-01 as a conservative placeholder.","Meta does not sell first-party API access to Llama, so there is no first-party \"llama-3.3-70b\" entry in this registry to compare against; Together AI (together.json: llama-3.3-70b, $1.04/$1.04) hosts the same open-weight model at a different rate, as Groq did until its 2026-08-16 shutdown there. OpenRouter's rate here is the lower of the two, plausibly because OpenRouter itself proxies to one of several underlying hosts and shows a blended/lowest-cost route; not independently confirmed which underlying host this routes to.","The same model page showed no rate change on 2026-09-07.","The page labels this \"the average price customers actually pay\" and warns caching and discounts often put the effective price below it; recorded as printed.","The same model page showed no rate change on 2026-10-03.","Clarified on 2026-10-03: the recorded $0.10/$0.32 is the page's headline \"IN / OUT PRICE\", which equals the cheapest listed endpoint (DeepInfra (Turbo)). The \"average price customers actually pay\" label belongs to a separate weighted average shown on the same page ($0.2511/$0.553 on 2026-10-03), which is not recorded."]},
    ],
    source: {"url":"https://openrouter.ai/meta-llama/llama-3.3-70b-instruct","observedAt":"2026-10-03"},
  },
  {
    canonicalId: "openai/gpt-5",
    provider: "openrouter",
    aliases: [],
    family: "openai-proxy",
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"1.25","output":"10.00","cachedInput":"0.125","sourceUrl":"https://openrouter.ai/openai/gpt-5","observedAt":"2026-10-03","notes":["OpenRouter's model page does not publish an effective date. effectiveFrom uses 2026-01-01 as a conservative placeholder.","Matches OpenAI's own first-party rate for gpt-5 ($1.25/$10.00, see openai.json) exactly as observed — no markup detected for this model.","canonicalId uses OpenRouter's own slug format (\"openai/gpt-5\"), deliberately distinct from OpenAI's first-party canonicalId \"gpt-5\" (openai.json) — this avoids a canonicalId collision while still allowing a cross-provider alias collision if a caller looks up the bare id \"gpt-5\" without a provider qualifier; no bare \"gpt-5\" alias was added to this entry to keep that surface area minimal.","The same model page showed no rate change on 2026-09-07.","cachedInput added on 2026-09-07: the model page now prints a Cache Read rate of 0.125 per million tokens for this model.","The same model page showed no rate change on 2026-10-03."]},
    ],
    source: {"url":"https://openrouter.ai/openai/gpt-5","observedAt":"2026-10-03"},
  },
  {
    canonicalId: "cogito-v2.1-671b",
    provider: "together",
    aliases: [],
    family: "cogito",
    pricing: [
      {"effectiveFrom":"2026-10-03","currency":"USD","unit":"per-million-tokens","input":"1.25","output":"1.25","sourceUrl":"https://www.together.ai/pricing","observedAt":"2026-10-03","notes":["First recorded in the 2026-10-03 page fetch; earlier fetches did not record it. effectiveFrom uses the observation date instead of the usual 2026-01-01 placeholder.","Together publishes no cached-input rate for this model, so cachedInput is omitted. Together publishes no serverless batch discount percentage, so batchMultiplier is omitted."]},
    ],
    source: {"url":"https://www.together.ai/pricing","observedAt":"2026-10-03"},
  },
  {
    canonicalId: "deepseek-v4-flash-0731",
    provider: "together",
    aliases: [],
    family: "deepseek",
    pricing: [
      {"effectiveFrom":"2026-09-07","currency":"USD","unit":"per-million-tokens","input":"0.14","output":"0.28","cachedInput":"0.03","sourceUrl":"https://www.together.ai/pricing","observedAt":"2026-10-03","notes":["First recorded in the 2026-09-07 page fetch; the 2026-08-05 fetch did not list it. effectiveFrom uses the observation date instead of the usual 2026-01-01 placeholder.","Together publishes no cached-input rate or batch discount for serverless models, so cachedInput and batchMultiplier are omitted.","Re-confirmed unchanged on 2026-10-03 against the same page for input and output. cachedInput added on 2026-10-03: the page now prints a cached input rate of 0.03 per million tokens for this model. The 2026-09-07 entry recorded none (see the note above), so whether this rate applied before 2026-10-03 is not established; it is recorded on the existing period, as the 2026-09-07 refresh did for newly printed cache rates elsewhere."]},
    ],
    source: {"url":"https://www.together.ai/pricing","observedAt":"2026-10-03"},
  },
  {
    canonicalId: "deepseek-v4-pro",
    provider: "together",
    aliases: [],
    family: "deepseek",
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"1.74","output":"3.48","cachedInput":"0.20","sourceUrl":"https://www.together.ai/pricing","observedAt":"2026-08-05","notes":["Together does not publish an effective date for this rate. effectiveFrom uses 2026-01-01 as a conservative placeholder.","Not re-confirmed on 2026-09-07: that fetch listed \"DeepSeek V4 Pro 0813\" at $1.32 / $3.96 and no undated \"DeepSeek V4 Pro\" row. Whether the dated build is this same model repriced or a separate snapshot is not stated on the page, so this entry keeps its 2026-08-05 rate and the dated build is recorded separately as deepseek-v4-pro-0813 rather than silently overwriting this one.","Not shown by the 2026-10-03 fetch of the same page either. Rate and observedAt left unchanged."]},
    ],
    source: {"url":"https://www.together.ai/pricing","observedAt":"2026-08-05"},
  },
  {
    canonicalId: "deepseek-v4-pro-0813",
    provider: "together",
    aliases: [],
    family: "deepseek",
    pricing: [
      {"effectiveFrom":"2026-09-07","currency":"USD","unit":"per-million-tokens","input":"1.32","output":"3.96","cachedInput":"0.13","sourceUrl":"https://www.together.ai/pricing","observedAt":"2026-10-03","notes":["Dated build listed on the page on 2026-09-07; see deepseek-v4-pro's notes for why it is a separate entry rather than a reprice of that one.","First recorded in the 2026-09-07 page fetch; the 2026-08-05 fetch did not list it. effectiveFrom uses the observation date instead of the usual 2026-01-01 placeholder.","Together publishes no cached-input rate or batch discount for serverless models, so cachedInput and batchMultiplier are omitted.","Re-confirmed unchanged on 2026-10-03 against the same page for input and output. cachedInput added on 2026-10-03: the page now prints a cached input rate of 0.13 per million tokens for this model. The 2026-09-07 entry recorded none (see the note above), so whether this rate applied before 2026-10-03 is not established; it is recorded on the existing period, as the 2026-09-07 refresh did for newly printed cache rates elsewhere."]},
    ],
    source: {"url":"https://www.together.ai/pricing","observedAt":"2026-10-03"},
  },
  {
    canonicalId: "deepseek-v4.1-flash",
    provider: "together",
    aliases: [],
    family: "deepseek",
    pricing: [
      {"effectiveFrom":"2026-10-03","currency":"USD","unit":"per-million-tokens","input":"0.30","output":"1.20","cachedInput":"0.006","sourceUrl":"https://www.together.ai/pricing","observedAt":"2026-10-03","notes":["First recorded in the 2026-10-03 page fetch; earlier fetches did not record it. effectiveFrom uses the observation date instead of the usual 2026-01-01 placeholder.","Together publishes no serverless batch discount percentage, so batchMultiplier is omitted."]},
    ],
    source: {"url":"https://www.together.ai/pricing","observedAt":"2026-10-03"},
  },
  {
    canonicalId: "gemma-4-31b",
    provider: "together",
    aliases: [],
    family: "gemma",
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"0.39","output":"0.97","sourceUrl":"https://www.together.ai/pricing","observedAt":"2026-10-03","notes":["Together does not publish an effective date for this rate. effectiveFrom uses 2026-01-01 as a conservative placeholder.","This canonicalId is shared across providers: AWS Bedrock also lists \"Gemma 4 31B\" (aws-bedrock.json: gemma-4-31b) at a different, lower rate ($0.14/$0.40 as observed on Bedrock) — same underlying Google open-weight model, independently priced by each reseller; do not assume parity.","The same page showed no rate change on 2026-09-07.","The same page showed no rate change on 2026-10-03."]},
    ],
    source: {"url":"https://www.together.ai/pricing","observedAt":"2026-10-03"},
  },
  {
    canonicalId: "glm-5.2",
    provider: "together",
    aliases: [],
    family: "glm",
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"1.40","output":"4.40","cachedInput":"0.26","sourceUrl":"https://www.together.ai/pricing","observedAt":"2026-10-03","notes":["Together does not publish an effective date for this rate. effectiveFrom uses 2026-01-01 as a conservative placeholder.","The same page showed no rate change on 2026-09-07.","The same page showed no rate change on 2026-10-03."]},
    ],
    source: {"url":"https://www.together.ai/pricing","observedAt":"2026-10-03"},
  },
  {
    canonicalId: "glm-5.3",
    provider: "together",
    aliases: [],
    family: "glm",
    pricing: [
      {"effectiveFrom":"2026-09-07","currency":"USD","unit":"per-million-tokens","input":"1.40","output":"4.40","cachedInput":"0.26","sourceUrl":"https://www.together.ai/pricing","observedAt":"2026-10-03","notes":["First recorded in the 2026-09-07 page fetch; the 2026-08-05 fetch did not list it. effectiveFrom uses the observation date instead of the usual 2026-01-01 placeholder.","Together publishes no cached-input rate or batch discount for serverless models, so cachedInput and batchMultiplier are omitted.","Re-confirmed unchanged on 2026-10-03 against the same page for input and output. cachedInput added on 2026-10-03: the page now prints a cached input rate of 0.26 per million tokens for this model. The 2026-09-07 entry recorded none (see the note above), so whether this rate applied before 2026-10-03 is not established; it is recorded on the existing period, as the 2026-09-07 refresh did for newly printed cache rates elsewhere."]},
    ],
    source: {"url":"https://www.together.ai/pricing","observedAt":"2026-10-03"},
  },
  {
    canonicalId: "glm-5.3-flash",
    provider: "together",
    aliases: [],
    family: "glm",
    pricing: [
      {"effectiveFrom":"2026-09-07","currency":"USD","unit":"per-million-tokens","input":"0.15","output":"0.50","cachedInput":"0.03","sourceUrl":"https://www.together.ai/pricing","observedAt":"2026-10-03","notes":["First recorded in the 2026-09-07 page fetch; the 2026-08-05 fetch did not list it. effectiveFrom uses the observation date instead of the usual 2026-01-01 placeholder.","Together publishes no cached-input rate or batch discount for serverless models, so cachedInput and batchMultiplier are omitted.","Re-confirmed unchanged on 2026-10-03 against the same page for input and output. cachedInput added on 2026-10-03: the page now prints a cached input rate of 0.03 per million tokens for this model. The 2026-09-07 entry recorded none (see the note above), so whether this rate applied before 2026-10-03 is not established; it is recorded on the existing period, as the 2026-09-07 refresh did for newly printed cache rates elsewhere."]},
    ],
    source: {"url":"https://www.together.ai/pricing","observedAt":"2026-10-03"},
  },
  {
    canonicalId: "gpt-oss-120b",
    provider: "together",
    aliases: [],
    family: "gpt-oss",
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"0.15","output":"0.60","sourceUrl":"https://www.together.ai/pricing","observedAt":"2026-10-03","notes":["Together does not publish an effective date for this rate. effectiveFrom uses 2026-01-01 as a conservative placeholder.","This canonicalId is shared across providers: Groq also publishes a model with canonicalId \"gpt-oss-120b\" (groq.json), independently priced at the same $0.15/$0.60 figure as observed. The identical string \"gpt-oss-120b\" is used as the canonicalId on both providers because that is the actual model name each provider publishes; resolving \"gpt-oss-120b\" without a provider qualifier is ambiguous across providers by design and the resolver requires a provider qualifier to disambiguate it.","The same page showed no rate change on 2026-09-07.","The same page showed no rate change on 2026-10-03."]},
    ],
    source: {"url":"https://www.together.ai/pricing","observedAt":"2026-10-03"},
  },
  {
    canonicalId: "gpt-oss-20b",
    provider: "together",
    aliases: [],
    family: "gpt-oss",
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"0.05","output":"0.20","sourceUrl":"https://www.together.ai/pricing","observedAt":"2026-08-05","notes":["Together does not publish an effective date for this rate. effectiveFrom uses 2026-01-01 as a conservative placeholder.","This canonicalId is shared across providers: Groq also publishes \"gpt-oss-20b\" (groq.json) at a different rate ($0.075/$0.30 as observed) — same model name, independently priced by each host; do not assume parity.","The 2026-09-07 page fetch did not show this model. The rate was not re-observed, so observedAt remains 2026-08-05; one missing listing does not establish a withdrawal.","Not shown by the 2026-10-03 fetch of the same page either. Rate and observedAt left unchanged."]},
    ],
    source: {"url":"https://www.together.ai/pricing","observedAt":"2026-08-05"},
  },
  {
    canonicalId: "inkling",
    provider: "together",
    aliases: [],
    pricing: [
      {"effectiveFrom":"2026-10-03","currency":"USD","unit":"per-million-tokens","input":"1.00","output":"4.05","cachedInput":"0.17","sourceUrl":"https://www.together.ai/pricing","observedAt":"2026-10-03","notes":["First recorded in the 2026-10-03 page fetch; earlier fetches did not record it. effectiveFrom uses the observation date instead of the usual 2026-01-01 placeholder.","Listed on the page as \"Inkling\", with no size or version suffix.","Together publishes no serverless batch discount percentage, so batchMultiplier is omitted."]},
    ],
    source: {"url":"https://www.together.ai/pricing","observedAt":"2026-10-03"},
  },
  {
    canonicalId: "kimi-k3",
    provider: "together",
    aliases: [],
    family: "kimi",
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"3.00","output":"15.00","cachedInput":"0.30","sourceUrl":"https://www.together.ai/pricing","observedAt":"2026-10-03","notes":["Together does not publish an effective date for this rate. effectiveFrom uses 2026-01-01 as a conservative placeholder.","The same page showed no rate change on 2026-09-07.","The same page showed no rate change on 2026-10-03."]},
    ],
    source: {"url":"https://www.together.ai/pricing","observedAt":"2026-10-03"},
  },
  {
    canonicalId: "llama-3-8b-instruct-lite",
    provider: "together",
    aliases: [],
    family: "llama",
    pricing: [
      {"effectiveFrom":"2026-09-07","currency":"USD","unit":"per-million-tokens","input":"0.14","output":"0.14","sourceUrl":"https://www.together.ai/pricing","observedAt":"2026-10-03","notes":["First recorded in the 2026-09-07 page fetch; the 2026-08-05 fetch did not list it. effectiveFrom uses the observation date instead of the usual 2026-01-01 placeholder.","Together publishes no cached-input rate or batch discount for serverless models, so cachedInput and batchMultiplier are omitted.","The same page showed no rate change on 2026-10-03."]},
    ],
    source: {"url":"https://www.together.ai/pricing","observedAt":"2026-10-03"},
  },
  {
    canonicalId: "llama-3.3-70b",
    provider: "together",
    aliases: [],
    family: "llama-3.3",
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"1.04","output":"1.04","sourceUrl":"https://www.together.ai/pricing","observedAt":"2026-10-03","notes":["Together does not publish an effective date for this rate. effectiveFrom uses 2026-01-01 as a conservative placeholder.","Also hosted by Groq until its 2026-08-16 shutdown there (removed from groq.json on 2026-10-03) and resold by AWS Bedrock - each host prices this same open-weight model independently; do not assume parity across providers.","The same page showed no rate change on 2026-09-07.","The same page showed no rate change on 2026-10-03."]},
    ],
    source: {"url":"https://www.together.ai/pricing","observedAt":"2026-10-03"},
  },
  {
    canonicalId: "minimax-m2.7",
    provider: "together",
    aliases: [],
    family: "minimax",
    pricing: [
      {"effectiveFrom":"2026-10-03","currency":"USD","unit":"per-million-tokens","input":"0.30","output":"1.20","cachedInput":"0.06","sourceUrl":"https://www.together.ai/pricing","observedAt":"2026-10-03","notes":["First recorded in the 2026-10-03 page fetch; earlier fetches did not record it. effectiveFrom uses the observation date instead of the usual 2026-01-01 placeholder.","Groq lists MiniMax M2.7 without a price (groq.json omitted notes), so there is no cross-provider canonicalId collision.","Together publishes no serverless batch discount percentage, so batchMultiplier is omitted."]},
    ],
    source: {"url":"https://www.together.ai/pricing","observedAt":"2026-10-03"},
  },
  {
    canonicalId: "minimax-m3",
    provider: "together",
    aliases: [],
    family: "minimax",
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"0.30","output":"1.20","cachedInput":"0.06","sourceUrl":"https://www.together.ai/pricing","observedAt":"2026-10-03","notes":["Together does not publish an effective date for this rate. effectiveFrom uses 2026-01-01 as a conservative placeholder.","The same page showed no rate change on 2026-09-07.","The same page showed no rate change on 2026-10-03."]},
    ],
    source: {"url":"https://www.together.ai/pricing","observedAt":"2026-10-03"},
  },
  {
    canonicalId: "muse-glimmer-30b",
    provider: "together",
    aliases: [],
    pricing: [
      {"effectiveFrom":"2026-10-03","currency":"USD","unit":"per-million-tokens","input":"0.35","output":"1.50","cachedInput":"0.04","sourceUrl":"https://www.together.ai/pricing","observedAt":"2026-10-03","notes":["First recorded in the 2026-10-03 page fetch; earlier fetches did not record it. effectiveFrom uses the observation date instead of the usual 2026-01-01 placeholder.","Listed on the page as \"Muse Glimmer 30B\".","Together publishes no serverless batch discount percentage, so batchMultiplier is omitted."]},
    ],
    source: {"url":"https://www.together.ai/pricing","observedAt":"2026-10-03"},
  },
  {
    canonicalId: "qwen2.5-7b-instruct-turbo",
    provider: "together",
    aliases: [],
    family: "qwen",
    pricing: [
      {"effectiveFrom":"2026-09-07","currency":"USD","unit":"per-million-tokens","input":"0.30","output":"0.30","sourceUrl":"https://www.together.ai/pricing","observedAt":"2026-10-03","notes":["First recorded in the 2026-09-07 page fetch; the 2026-08-05 fetch did not list it. effectiveFrom uses the observation date instead of the usual 2026-01-01 placeholder.","Together publishes no cached-input rate or batch discount for serverless models, so cachedInput and batchMultiplier are omitted.","The same page showed no rate change on 2026-10-03."]},
    ],
    source: {"url":"https://www.together.ai/pricing","observedAt":"2026-10-03"},
  },
  {
    canonicalId: "qwen3-235b-a22b-instruct-2507-fp8",
    provider: "together",
    aliases: [],
    family: "qwen",
    pricing: [
      {"effectiveFrom":"2026-10-03","currency":"USD","unit":"per-million-tokens","input":"0.20","output":"0.60","sourceUrl":"https://www.together.ai/pricing","observedAt":"2026-10-03","notes":["First recorded in the 2026-10-03 page fetch; earlier fetches did not record it. effectiveFrom uses the observation date instead of the usual 2026-01-01 placeholder.","Listed on the page as \"Qwen3 235B A22B Instruct 2507 FP8\".","Together publishes no cached-input rate for this model, so cachedInput is omitted. Together publishes no serverless batch discount percentage, so batchMultiplier is omitted."]},
    ],
    source: {"url":"https://www.together.ai/pricing","observedAt":"2026-10-03"},
  },
  {
    canonicalId: "qwen3.5-397b-a17b",
    provider: "together",
    aliases: [],
    family: "qwen",
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"0.60","output":"3.60","cachedInput":"0.35","sourceUrl":"https://www.together.ai/pricing","observedAt":"2026-10-03","notes":["Together does not publish an effective date for this rate. effectiveFrom uses 2026-01-01 as a conservative placeholder.","The same page showed no rate change on 2026-09-07.","The same page showed no rate change on 2026-10-03."]},
    ],
    source: {"url":"https://www.together.ai/pricing","observedAt":"2026-10-03"},
  },
  {
    canonicalId: "qwen3.5-9b",
    provider: "together",
    aliases: [],
    family: "qwen",
    pricing: [
      {"effectiveFrom":"2026-09-07","currency":"USD","unit":"per-million-tokens","input":"0.17","output":"0.25","sourceUrl":"https://www.together.ai/pricing","observedAt":"2026-10-03","notes":["First recorded in the 2026-09-07 page fetch; the 2026-08-05 fetch did not list it. effectiveFrom uses the observation date instead of the usual 2026-01-01 placeholder.","Together publishes no cached-input rate or batch discount for serverless models, so cachedInput and batchMultiplier are omitted.","The same page showed no rate change on 2026-10-03."]},
    ],
    source: {"url":"https://www.together.ai/pricing","observedAt":"2026-10-03"},
  },
  {
    canonicalId: "qwen3.6-plus",
    provider: "together",
    aliases: [],
    family: "qwen",
    pricing: [
      {"effectiveFrom":"2026-09-07","currency":"USD","unit":"per-million-tokens","input":"0.50","output":"3.00","sourceUrl":"https://www.together.ai/pricing","observedAt":"2026-10-03","notes":["First recorded in the 2026-09-07 page fetch; the 2026-08-05 fetch did not list it. effectiveFrom uses the observation date instead of the usual 2026-01-01 placeholder.","Together publishes no cached-input rate or batch discount for serverless models, so cachedInput and batchMultiplier are omitted.","The same page showed no rate change on 2026-10-03."]},
    ],
    source: {"url":"https://www.together.ai/pricing","observedAt":"2026-10-03"},
  },
  {
    canonicalId: "qwen3.7-max",
    provider: "together",
    aliases: [],
    family: "qwen",
    pricing: [
      {"effectiveFrom":"2026-01-01","effectiveTo":"2026-10-03","currency":"USD","unit":"per-million-tokens","input":"1.25","output":"3.75","cachedInput":"0.13","sourceUrl":"https://www.together.ai/pricing","observedAt":"2026-09-07","notes":["Together does not publish an effective date for this rate. effectiveFrom uses 2026-01-01 as a conservative placeholder.","The same page showed no rate change on 2026-09-07.","Closed on 2026-10-03: the pricing page published a higher rate (1.50 input / 4.50 output / 0.30 cached input) on that date. The old rate was last confirmed 2026-09-07, so the true change date lies in (2026-09-07, 2026-10-03]; effectiveTo is the observation date, which keeps every confirmed observation correct and approximates only the unobserved gap, toward the last confirmed value."]},
      {"effectiveFrom":"2026-10-03","currency":"USD","unit":"per-million-tokens","input":"1.50","output":"4.50","cachedInput":"0.30","sourceUrl":"https://www.together.ai/pricing","observedAt":"2026-10-03","notes":["Together's pricing page does not publish an effective date for this change; effectiveFrom is the 2026-10-03 observation date, which closed the previous period.","Previous rate: 1.25 input / 3.75 output / 0.13 cached input."]},
    ],
    source: {"url":"https://www.together.ai/pricing","observedAt":"2026-10-03"},
  },
  {
    canonicalId: "qwen3.7-plus",
    provider: "together",
    aliases: [],
    family: "qwen",
    pricing: [
      {"effectiveFrom":"2026-09-07","currency":"USD","unit":"per-million-tokens","input":"0.32","output":"1.28","sourceUrl":"https://www.together.ai/pricing","observedAt":"2026-10-03","notes":["First recorded in the 2026-09-07 page fetch; the 2026-08-05 fetch did not list it. effectiveFrom uses the observation date instead of the usual 2026-01-01 placeholder.","Together publishes no cached-input rate or batch discount for serverless models, so cachedInput and batchMultiplier are omitted.","The same page showed no rate change on 2026-10-03."]},
    ],
    source: {"url":"https://www.together.ai/pricing","observedAt":"2026-10-03"},
  },
  {
    canonicalId: "qwen3.8-2.4t-a95b",
    provider: "together",
    aliases: [],
    family: "qwen",
    pricing: [
      {"effectiveFrom":"2026-09-07","currency":"USD","unit":"per-million-tokens","input":"2.00","output":"6.00","cachedInput":"0.25","sourceUrl":"https://www.together.ai/pricing","observedAt":"2026-10-03","notes":["First recorded in the 2026-09-07 page fetch; the 2026-08-05 fetch did not list it. effectiveFrom uses the observation date instead of the usual 2026-01-01 placeholder.","Together publishes no cached-input rate or batch discount for serverless models, so cachedInput and batchMultiplier are omitted.","Re-confirmed unchanged on 2026-10-03 against the same page for input and output. cachedInput added on 2026-10-03: the page now prints a cached input rate of 0.25 per million tokens for this model. The 2026-09-07 entry recorded none (see the note above), so whether this rate applied before 2026-10-03 is not established; it is recorded on the existing period, as the 2026-09-07 refresh did for newly printed cache rates elsewhere."]},
    ],
    source: {"url":"https://www.together.ai/pricing","observedAt":"2026-10-03"},
  },
  {
    canonicalId: "qwen3.8-flash",
    provider: "together",
    aliases: [],
    family: "qwen",
    pricing: [
      {"effectiveFrom":"2026-09-07","effectiveTo":"2026-10-03","currency":"USD","unit":"per-million-tokens","input":"0.15","output":"0.47","sourceUrl":"https://www.together.ai/pricing","observedAt":"2026-09-07","notes":["First recorded in the 2026-09-07 page fetch; the 2026-08-05 fetch did not list it. effectiveFrom uses the observation date instead of the usual 2026-01-01 placeholder.","Together publishes no cached-input rate or batch discount for serverless models, so cachedInput and batchMultiplier are omitted.","Closed on 2026-10-03: the pricing page published a lower rate (0.09 input / 0.28 output) on that date. The old rate was last confirmed 2026-09-07, so the true change date lies in (2026-09-07, 2026-10-03]; effectiveTo is the observation date, which keeps every confirmed observation correct and approximates only the unobserved gap, toward the last confirmed value."]},
      {"effectiveFrom":"2026-10-03","currency":"USD","unit":"per-million-tokens","input":"0.09","output":"0.28","sourceUrl":"https://www.together.ai/pricing","observedAt":"2026-10-03","notes":["Together's pricing page does not publish an effective date for this change; effectiveFrom is the 2026-10-03 observation date, which closed the previous period.","Previous rate: 0.15 input / 0.47 output.","Together prints no cached-input rate for this model and no batch discount percentage for serverless models; both fields are omitted rather than guessed."]},
    ],
    source: {"url":"https://www.together.ai/pricing","observedAt":"2026-10-03"},
  },
  {
    canonicalId: "rnj-1-instruct",
    provider: "together",
    aliases: [],
    pricing: [
      {"effectiveFrom":"2026-10-03","currency":"USD","unit":"per-million-tokens","input":"0.15","output":"0.15","sourceUrl":"https://www.together.ai/pricing","observedAt":"2026-10-03","notes":["First recorded in the 2026-10-03 page fetch; earlier fetches did not record it. effectiveFrom uses the observation date instead of the usual 2026-01-01 placeholder.","Listed on the page as \"Rnj-1 Instruct\".","Together publishes no cached-input rate for this model, so cachedInput is omitted. Together publishes no serverless batch discount percentage, so batchMultiplier is omitted."]},
    ],
    source: {"url":"https://www.together.ai/pricing","observedAt":"2026-10-03"},
  },
];
