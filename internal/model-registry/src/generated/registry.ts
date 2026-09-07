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

export const REGISTRY_VERSION = "registry-e5f4ec7eb681a235";

export const MODEL_REGISTRY: readonly ModelDescriptor[] = [
  {
    canonicalId: "claude-fable-5",
    provider: "anthropic",
    aliases: [],
    family: "fable",
    contextWindow: 1000000,
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"10.00","output":"50.00","cachedInput":"1.00","cacheWrite":"12.50","batchMultiplier":"0.5","sourceUrl":"https://platform.claude.com/docs/en/about-claude/pricing","observedAt":"2026-09-07","notes":["Anthropic did not publish an explicit effective date for this rate as observed; effectiveFrom is set conservatively to 2026-01-01 pending confirmation of the true rollout date.","cacheWrite reflects the 5-minute cache TTL (1.25x input). The 1-hour TTL write multiplier is 2x input and is not separately modeled by this schema (a single cacheWrite field)."]},
    ],
    source: {"url":"https://platform.claude.com/docs/en/about-claude/pricing","observedAt":"2026-09-07"},
  },
  {
    canonicalId: "claude-fable-5-1",
    provider: "anthropic",
    aliases: [],
    family: "fable",
    contextWindow: 1000000,
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"10.00","output":"50.00","cachedInput":"0.25","cacheWrite":"12.50","batchMultiplier":"0.5","sourceUrl":"https://platform.claude.com/docs/en/about-claude/pricing","observedAt":"2026-09-07","notes":["Anthropic did not publish an explicit effective date for this rate as observed; effectiveFrom is set conservatively to 2026-01-01 pending confirmation of the true rollout date.","Cache hits are priced at 0.025x base input on this model (page footnote 1), not the 0.1x every other model uses - cachedInput is read from the table, not derived.","cacheWrite reflects the 5-minute cache TTL (1.25x input). The 1-hour TTL write multiplier is 2x input and is not separately modeled by this schema (a single cacheWrite field)."]},
    ],
    source: {"url":"https://platform.claude.com/docs/en/about-claude/pricing","observedAt":"2026-09-07"},
  },
  {
    canonicalId: "claude-haiku-3-5",
    provider: "anthropic",
    aliases: [],
    family: "haiku",
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"0.80","output":"4.00","cachedInput":"0.08","cacheWrite":"1.00","batchMultiplier":"0.5","sourceUrl":"https://platform.claude.com/docs/en/about-claude/pricing","observedAt":"2026-09-07","notes":["Anthropic did not publish an explicit effective date for this rate as observed; effectiveFrom is set conservatively to 2026-01-01 pending confirmation of the true rollout date.","Retired on Anthropic-operated platforms; the pricing page still publishes its rate and notes it remains available on Amazon Bedrock and Google Cloud. Included so historical usage can still be priced.","This model predates 2026, so the conservative 2026-01-01 effectiveFrom cannot price usage from its actual lifetime; no rollout date was published on the source page. A future pass should source real dates before relying on historical lookups for it.","cacheWrite reflects the 5-minute cache TTL (1.25x input). The 1-hour TTL write multiplier is 2x input and is not separately modeled by this schema (a single cacheWrite field)."]},
    ],
    source: {"url":"https://platform.claude.com/docs/en/about-claude/pricing","observedAt":"2026-09-07"},
  },
  {
    canonicalId: "claude-haiku-4-5-20251001",
    provider: "anthropic",
    aliases: ["claude-haiku-4-5"],
    family: "haiku",
    contextWindow: 200000,
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"1.00","output":"5.00","cachedInput":"0.10","cacheWrite":"1.25","batchMultiplier":"0.5","sourceUrl":"https://platform.claude.com/docs/en/about-claude/pricing","observedAt":"2026-09-07","notes":["Anthropic did not publish an explicit effective date for this rate as observed; effectiveFrom is set conservatively to 2026-01-01 pending confirmation of the true rollout date.","cacheWrite reflects the 5-minute cache TTL (1.25x input). The 1-hour TTL write multiplier is 2x input and is not separately modeled by this schema (a single cacheWrite field)."]},
    ],
    source: {"url":"https://platform.claude.com/docs/en/about-claude/pricing","observedAt":"2026-09-07","notes":["canonicalId is the dated snapshot id published on the models overview page; claude-haiku-4-5 is the alias that resolves to it."]},
  },
  {
    canonicalId: "claude-mythos-5",
    provider: "anthropic",
    aliases: [],
    family: "mythos",
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"10.00","output":"50.00","cachedInput":"1.00","cacheWrite":"12.50","batchMultiplier":"0.5","sourceUrl":"https://platform.claude.com/docs/en/about-claude/pricing","observedAt":"2026-09-07","notes":["Anthropic did not publish an explicit effective date for this rate as observed; effectiveFrom is set conservatively to 2026-01-01 pending confirmation of the true rollout date.","Limited availability model (page links it to anthropic.com/glasswing); its published rate is recorded as-is.","cacheWrite reflects the 5-minute cache TTL (1.25x input). The 1-hour TTL write multiplier is 2x input and is not separately modeled by this schema (a single cacheWrite field)."]},
    ],
    source: {"url":"https://platform.claude.com/docs/en/about-claude/pricing","observedAt":"2026-09-07"},
  },
  {
    canonicalId: "claude-mythos-5-1",
    provider: "anthropic",
    aliases: [],
    family: "mythos",
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"10.00","output":"50.00","cachedInput":"0.25","cacheWrite":"12.50","batchMultiplier":"0.5","sourceUrl":"https://platform.claude.com/docs/en/about-claude/pricing","observedAt":"2026-09-07","notes":["Anthropic did not publish an explicit effective date for this rate as observed; effectiveFrom is set conservatively to 2026-01-01 pending confirmation of the true rollout date.","Limited availability model (page links it to anthropic.com/glasswing); its published rate is recorded as-is.","Cache hits are priced at 0.025x base input on this model (page footnote 1), not the 0.1x every other model uses - cachedInput is read from the table, not derived.","cacheWrite reflects the 5-minute cache TTL (1.25x input). The 1-hour TTL write multiplier is 2x input and is not separately modeled by this schema (a single cacheWrite field)."]},
    ],
    source: {"url":"https://platform.claude.com/docs/en/about-claude/pricing","observedAt":"2026-09-07"},
  },
  {
    canonicalId: "claude-opus-4",
    provider: "anthropic",
    aliases: [],
    family: "opus",
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"15.00","output":"75.00","cachedInput":"1.50","cacheWrite":"18.75","batchMultiplier":"0.5","sourceUrl":"https://platform.claude.com/docs/en/about-claude/pricing","observedAt":"2026-09-07","notes":["Anthropic did not publish an explicit effective date for this rate as observed; effectiveFrom is set conservatively to 2026-01-01 pending confirmation of the true rollout date.","Retired on Anthropic-operated platforms; the pricing page still publishes its rate and notes it remains available on Google Cloud. Included so historical usage can still be priced.","This model predates 2026, so the conservative 2026-01-01 effectiveFrom cannot price usage from its actual lifetime; no rollout date was published on the source page. A future pass should source real dates before relying on historical lookups for it.","cacheWrite reflects the 5-minute cache TTL (1.25x input). The 1-hour TTL write multiplier is 2x input and is not separately modeled by this schema (a single cacheWrite field)."]},
    ],
    source: {"url":"https://platform.claude.com/docs/en/about-claude/pricing","observedAt":"2026-09-07"},
  },
  {
    canonicalId: "claude-opus-4-1",
    provider: "anthropic",
    aliases: [],
    family: "opus",
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"15.00","output":"75.00","cachedInput":"1.50","cacheWrite":"18.75","batchMultiplier":"0.5","sourceUrl":"https://platform.claude.com/docs/en/about-claude/pricing","observedAt":"2026-09-07","notes":["Anthropic did not publish an explicit effective date for this rate as observed; effectiveFrom is set conservatively to 2026-01-01 pending confirmation of the true rollout date.","Retired on Anthropic-operated platforms; the pricing page still publishes its rate and notes it remains available on Amazon Bedrock and Google Cloud. Included so historical usage can still be priced.","This model predates 2026, so the conservative 2026-01-01 effectiveFrom cannot price usage from its actual lifetime; no rollout date was published on the source page. A future pass should source real dates before relying on historical lookups for it.","cacheWrite reflects the 5-minute cache TTL (1.25x input). The 1-hour TTL write multiplier is 2x input and is not separately modeled by this schema (a single cacheWrite field)."]},
    ],
    source: {"url":"https://platform.claude.com/docs/en/about-claude/pricing","observedAt":"2026-09-07"},
  },
  {
    canonicalId: "claude-opus-4-5",
    provider: "anthropic",
    aliases: [],
    family: "opus",
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"5.00","output":"25.00","cachedInput":"0.50","cacheWrite":"6.25","batchMultiplier":"0.5","sourceUrl":"https://platform.claude.com/docs/en/about-claude/pricing","observedAt":"2026-09-07","notes":["Anthropic did not publish an explicit effective date for this rate as observed; effectiveFrom is set conservatively to 2026-01-01 pending confirmation of the true rollout date.","cacheWrite reflects the 5-minute cache TTL (1.25x input). The 1-hour TTL write multiplier is 2x input and is not separately modeled by this schema (a single cacheWrite field)."]},
    ],
    source: {"url":"https://platform.claude.com/docs/en/about-claude/pricing","observedAt":"2026-09-07"},
  },
  {
    canonicalId: "claude-opus-4-6",
    provider: "anthropic",
    aliases: [],
    family: "opus",
    contextWindow: 1000000,
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"5.00","output":"25.00","cachedInput":"0.50","cacheWrite":"6.25","batchMultiplier":"0.5","sourceUrl":"https://platform.claude.com/docs/en/about-claude/pricing","observedAt":"2026-09-07","notes":["Anthropic did not publish an explicit effective date for this rate as observed; effectiveFrom is set conservatively to 2026-01-01 pending confirmation of the true rollout date.","cacheWrite reflects the 5-minute cache TTL (1.25x input). The 1-hour TTL write multiplier is 2x input and is not separately modeled by this schema (a single cacheWrite field)."]},
    ],
    source: {"url":"https://platform.claude.com/docs/en/about-claude/pricing","observedAt":"2026-09-07"},
  },
  {
    canonicalId: "claude-opus-4-7",
    provider: "anthropic",
    aliases: [],
    family: "opus",
    contextWindow: 1000000,
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"5.00","output":"25.00","cachedInput":"0.50","cacheWrite":"6.25","batchMultiplier":"0.5","sourceUrl":"https://platform.claude.com/docs/en/about-claude/pricing","observedAt":"2026-09-07","notes":["Anthropic did not publish an explicit effective date for this rate as observed; effectiveFrom is set conservatively to 2026-01-01 pending confirmation of the true rollout date.","cacheWrite reflects the 5-minute cache TTL (1.25x input). The 1-hour TTL write multiplier is 2x input and is not separately modeled by this schema (a single cacheWrite field)."]},
    ],
    source: {"url":"https://platform.claude.com/docs/en/about-claude/pricing","observedAt":"2026-09-07"},
  },
  {
    canonicalId: "claude-opus-4-8",
    provider: "anthropic",
    aliases: [],
    family: "opus",
    contextWindow: 1000000,
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"5.00","output":"25.00","cachedInput":"0.50","cacheWrite":"6.25","batchMultiplier":"0.5","sourceUrl":"https://platform.claude.com/docs/en/about-claude/pricing","observedAt":"2026-09-07","notes":["Anthropic did not publish an explicit effective date for this rate as observed; effectiveFrom is set conservatively to 2026-01-01 pending confirmation of the true rollout date.","cacheWrite reflects the 5-minute cache TTL (1.25x input). The 1-hour TTL write multiplier is 2x input and is not separately modeled by this schema (a single cacheWrite field)."]},
    ],
    source: {"url":"https://platform.claude.com/docs/en/about-claude/pricing","observedAt":"2026-09-07"},
  },
  {
    canonicalId: "claude-opus-5",
    provider: "anthropic",
    aliases: [],
    family: "opus",
    contextWindow: 1000000,
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"5.00","output":"25.00","cachedInput":"0.50","cacheWrite":"6.25","batchMultiplier":"0.5","sourceUrl":"https://platform.claude.com/docs/en/about-claude/pricing","observedAt":"2026-09-07","notes":["Anthropic did not publish an explicit effective date for this rate as observed; effectiveFrom is set conservatively to 2026-01-01 pending confirmation of the true rollout date.","cacheWrite reflects the 5-minute cache TTL (1.25x input). The 1-hour TTL write multiplier is 2x input and is not separately modeled by this schema (a single cacheWrite field)."]},
    ],
    source: {"url":"https://platform.claude.com/docs/en/about-claude/pricing","observedAt":"2026-09-07"},
  },
  {
    canonicalId: "claude-sonnet-4",
    provider: "anthropic",
    aliases: [],
    family: "sonnet",
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"3.00","output":"15.00","cachedInput":"0.30","cacheWrite":"3.75","batchMultiplier":"0.5","sourceUrl":"https://platform.claude.com/docs/en/about-claude/pricing","observedAt":"2026-09-07","notes":["Anthropic did not publish an explicit effective date for this rate as observed; effectiveFrom is set conservatively to 2026-01-01 pending confirmation of the true rollout date.","Retired on Anthropic-operated platforms; the pricing page still publishes its rate and notes it remains available on Amazon Bedrock and Google Cloud. Included so historical usage can still be priced.","This model predates 2026, so the conservative 2026-01-01 effectiveFrom cannot price usage from its actual lifetime; no rollout date was published on the source page. A future pass should source real dates before relying on historical lookups for it.","cacheWrite reflects the 5-minute cache TTL (1.25x input). The 1-hour TTL write multiplier is 2x input and is not separately modeled by this schema (a single cacheWrite field)."]},
    ],
    source: {"url":"https://platform.claude.com/docs/en/about-claude/pricing","observedAt":"2026-09-07"},
  },
  {
    canonicalId: "claude-sonnet-4-5",
    provider: "anthropic",
    aliases: [],
    family: "sonnet",
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"3.00","output":"15.00","cachedInput":"0.30","cacheWrite":"3.75","batchMultiplier":"0.5","sourceUrl":"https://platform.claude.com/docs/en/about-claude/pricing","observedAt":"2026-09-07","notes":["Anthropic did not publish an explicit effective date for this rate as observed; effectiveFrom is set conservatively to 2026-01-01 pending confirmation of the true rollout date.","cacheWrite reflects the 5-minute cache TTL (1.25x input). The 1-hour TTL write multiplier is 2x input and is not separately modeled by this schema (a single cacheWrite field)."]},
    ],
    source: {"url":"https://platform.claude.com/docs/en/about-claude/pricing","observedAt":"2026-09-07"},
  },
  {
    canonicalId: "claude-sonnet-4-6",
    provider: "anthropic",
    aliases: [],
    family: "sonnet",
    contextWindow: 1000000,
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"3.00","output":"15.00","cachedInput":"0.30","cacheWrite":"3.75","batchMultiplier":"0.5","sourceUrl":"https://platform.claude.com/docs/en/about-claude/pricing","observedAt":"2026-09-07","notes":["Anthropic did not publish an explicit effective date for this rate as observed; effectiveFrom is set conservatively to 2026-01-01 pending confirmation of the true rollout date.","cacheWrite reflects the 5-minute cache TTL (1.25x input). The 1-hour TTL write multiplier is 2x input and is not separately modeled by this schema (a single cacheWrite field)."]},
    ],
    source: {"url":"https://platform.claude.com/docs/en/about-claude/pricing","observedAt":"2026-09-07"},
  },
  {
    canonicalId: "claude-sonnet-5",
    provider: "anthropic",
    aliases: [],
    family: "sonnet",
    contextWindow: 1000000,
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"2.00","output":"10.00","cachedInput":"0.20","cacheWrite":"2.50","batchMultiplier":"0.5","sourceUrl":"https://platform.claude.com/docs/en/about-claude/pricing","observedAt":"2026-09-07","notes":["$2.00/$10.00 launched as an introductory rate through 2026-08-31. On 2026-09-07 the pricing page states it \"is now the standard price\" and that \"the previously scheduled increase to $3/$15 per million input/output tokens on September 1, 2026 will not occur\", so the rate continues open-ended rather than ending 2026-08-31.","Supersedes the two-period shape recorded on 2026-08-05 (introductory $2.00/$10.00 to 2026-09-01, then standard $3.00/$15.00). That second period was removed, not closed: the higher rate never took effect, so no date range may report it.","Anthropic did not publish an explicit effective date for this rate as observed; effectiveFrom is set conservatively to 2026-01-01 pending confirmation of the true rollout date.","cacheWrite reflects the 5-minute cache TTL (1.25x input). The 1-hour TTL write multiplier is 2x input and is not separately modeled by this schema (a single cacheWrite field)."]},
    ],
    source: {"url":"https://platform.claude.com/docs/en/about-claude/pricing","observedAt":"2026-09-07"},
  },
  {
    canonicalId: "amazon-nova-lite",
    provider: "aws-bedrock",
    aliases: [],
    family: "amazon-nova",
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"0.60","output":"2.40","sourceUrl":"https://aws.amazon.com/bedrock/pricing/","observedAt":"2026-08-05","notes":["No explicit effective date published for this rate; effectiveFrom is set conservatively to 2026-01-01.","Same cross-region/in-region caveat as amazon-nova-micro.","Not surfaced by the 2026-09-07 fetch of the same page, whose accessible sections did not include this model. observedAt is deliberately left at 2026-08-05: the rate was not re-observed, and an absence in one page fetch is not evidence of a withdrawal."]},
    ],
    source: {"url":"https://aws.amazon.com/bedrock/pricing/","observedAt":"2026-08-05"},
  },
  {
    canonicalId: "amazon-nova-micro",
    provider: "aws-bedrock",
    aliases: [],
    family: "amazon-nova",
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"0.30","output":"1.20","sourceUrl":"https://aws.amazon.com/bedrock/pricing/","observedAt":"2026-08-05","notes":["AWS's own first-party model (Amazon publishes both Bedrock and Nova), so \"aws-bedrock\" is effectively first-party pricing here, unlike the resold third-party models in this file.","No explicit effective date published for this specific rate (unlike the Claude 3.5 Sonnet rows above, which do carry a stated Dec 2025 date); effectiveFrom is set conservatively to 2026-01-01.","Bedrock's pricing page also distinguishes \"Global cross-region\" vs \"in-region\" inference pricing for Nova; this rate was not confirmed to be specifically the in-region (vs cross-region) figure — treat as the headline on-demand rate observed.","Not surfaced by the 2026-09-07 fetch of the same page, whose accessible sections did not include this model. observedAt is deliberately left at 2026-08-05: the rate was not re-observed, and an absence in one page fetch is not evidence of a withdrawal."]},
    ],
    source: {"url":"https://aws.amazon.com/bedrock/pricing/","observedAt":"2026-08-05"},
  },
  {
    canonicalId: "amazon-nova-pro",
    provider: "aws-bedrock",
    aliases: [],
    family: "amazon-nova",
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"1.20","output":"4.80","sourceUrl":"https://aws.amazon.com/bedrock/pricing/","observedAt":"2026-08-05","notes":["No explicit effective date published for this rate; effectiveFrom is set conservatively to 2026-01-01.","Same cross-region/in-region caveat as amazon-nova-micro.","Not surfaced by the 2026-09-07 fetch of the same page, whose accessible sections did not include this model. observedAt is deliberately left at 2026-08-05: the rate was not re-observed, and an absence in one page fetch is not evidence of a withdrawal."]},
    ],
    source: {"url":"https://aws.amazon.com/bedrock/pricing/","observedAt":"2026-08-05"},
  },
  {
    canonicalId: "claude-3.5-sonnet",
    provider: "aws-bedrock",
    aliases: [],
    family: "anthropic-claude",
    pricing: [
      {"effectiveFrom":"2025-12-01","currency":"USD","unit":"per-million-tokens","input":"6.00","output":"30.00","batchMultiplier":"0.5","sourceUrl":"https://aws.amazon.com/bedrock/pricing/","observedAt":"2026-09-07","notes":["AWS Bedrock's own rate card for this Anthropic model, explicitly labeled \"Effective 1 Dec 2025\" on the pricing page — a real, confirmed effective date, not the conservative default used elsewhere in this file.","Batch: $3.00/$15.00 (confirmed 0.5x standard) as observed on the same page.","This is Bedrock's own price for an older Claude generation (3.5 Sonnet), not the current claude-sonnet-5 model in anthropic.json — no comparable first-party entry exists in this registry for the same model, so no direct parity claim is possible or intended. Bedrock and Azure resell other vendors' models under their own rate cards, so a first-party price is never a safe proxy for theirs.","Re-confirmed unchanged on 2026-09-07 against the same page."]},
    ],
    source: {"url":"https://aws.amazon.com/bedrock/pricing/","observedAt":"2026-09-07"},
  },
  {
    canonicalId: "claude-3.5-sonnet-v2",
    provider: "aws-bedrock",
    aliases: [],
    family: "anthropic-claude",
    pricing: [
      {"effectiveFrom":"2025-12-01","currency":"USD","unit":"per-million-tokens","input":"6.00","output":"30.00","cachedInput":"0.60","cacheWrite":"7.50","batchMultiplier":"0.5","sourceUrl":"https://aws.amazon.com/bedrock/pricing/","observedAt":"2026-09-07","notes":["AWS Bedrock's own rate card, explicitly labeled \"Effective 1 Dec 2025\" on the pricing page.","Batch: $3.00/$15.00 (confirmed 0.5x standard) as observed on the same page.","Bedrock's own price for an older Claude generation; not comparable to any first-party entry currently in anthropic.json (which covers 4.x/5.x models only).","Re-confirmed unchanged on 2026-09-07 against the same page."]},
    ],
    source: {"url":"https://aws.amazon.com/bedrock/pricing/","observedAt":"2026-09-07"},
  },
  {
    canonicalId: "gemma-3-12b",
    provider: "aws-bedrock",
    aliases: [],
    family: "gemma",
    pricing: [
      {"effectiveFrom":"2026-09-07","currency":"USD","unit":"per-million-tokens","input":"0.09","output":"0.29","sourceUrl":"https://aws.amazon.com/bedrock/pricing/","observedAt":"2026-09-07","notes":["Bedrock's own resale rate for this google model, read from Bedrock's pricing page - never copied from that vendor's first-party file.","Added from the 2026-09-07 fetch; effectiveFrom is the observation date, since the 2026-08-05 fetch of the same page did not surface it.","US East on-demand rate as printed; Bedrock prices some models per region and this schema has no region dimension."]},
    ],
    source: {"url":"https://aws.amazon.com/bedrock/pricing/","observedAt":"2026-09-07"},
  },
  {
    canonicalId: "gemma-3-27b",
    provider: "aws-bedrock",
    aliases: [],
    family: "gemma",
    pricing: [
      {"effectiveFrom":"2026-09-07","currency":"USD","unit":"per-million-tokens","input":"0.23","output":"0.38","sourceUrl":"https://aws.amazon.com/bedrock/pricing/","observedAt":"2026-09-07","notes":["Bedrock's own resale rate for this google model, read from Bedrock's pricing page - never copied from that vendor's first-party file.","Added from the 2026-09-07 fetch; effectiveFrom is the observation date, since the 2026-08-05 fetch of the same page did not surface it.","US East on-demand rate as printed; Bedrock prices some models per region and this schema has no region dimension."]},
    ],
    source: {"url":"https://aws.amazon.com/bedrock/pricing/","observedAt":"2026-09-07"},
  },
  {
    canonicalId: "gemma-4-31b",
    provider: "aws-bedrock",
    aliases: [],
    family: "google-gemma",
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"0.14","output":"0.40","sourceUrl":"https://aws.amazon.com/bedrock/pricing/","observedAt":"2026-09-07","notes":["No explicit effective date published for this rate; effectiveFrom is set conservatively to 2026-01-01.","Cross-provider alias/canonicalId collision (allowed, not an error): Together AI also lists \"Gemma 4 31B\" (together.json: gemma-4-31b) at a different, higher rate ($0.39/$0.97 as observed) — same underlying Google open-weight model, independently priced by each reseller; do not assume parity.","Re-confirmed unchanged on 2026-09-07 against the same page."]},
    ],
    source: {"url":"https://aws.amazon.com/bedrock/pricing/","observedAt":"2026-09-07"},
  },
  {
    canonicalId: "mistral-large-3",
    provider: "aws-bedrock",
    aliases: [],
    family: "mistral",
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"0.50","output":"1.50","sourceUrl":"https://aws.amazon.com/bedrock/pricing/","observedAt":"2026-09-07","notes":["No explicit effective date published for this rate; effectiveFrom is set conservatively to 2026-01-01.","Cross-provider alias/canonicalId collision (allowed, not an error): Mistral's own first-party pricing (mistral.json: mistral-large-3) shows the identical $0.50/$1.50 figure as independently observed — coincidental agreement between the two independently fetched sources, not assumed; both were confirmed directly.","Re-confirmed unchanged on 2026-09-07 against the same page."]},
    ],
    source: {"url":"https://aws.amazon.com/bedrock/pricing/","observedAt":"2026-09-07"},
  },
  {
    canonicalId: "nemotron-3-super-120b",
    provider: "aws-bedrock",
    aliases: [],
    family: "nemotron",
    pricing: [
      {"effectiveFrom":"2026-09-07","currency":"USD","unit":"per-million-tokens","input":"0.15","output":"0.65","sourceUrl":"https://aws.amazon.com/bedrock/pricing/","observedAt":"2026-09-07","notes":["Bedrock's own resale rate for this nvidia model, read from Bedrock's pricing page - never copied from that vendor's first-party file.","Added from the 2026-09-07 fetch; effectiveFrom is the observation date, since the 2026-08-05 fetch of the same page did not surface it.","US East on-demand rate as printed; Bedrock prices some models per region and this schema has no region dimension."]},
    ],
    source: {"url":"https://aws.amazon.com/bedrock/pricing/","observedAt":"2026-09-07"},
  },
  {
    canonicalId: "nemotron-nano-2",
    provider: "aws-bedrock",
    aliases: [],
    family: "nvidia-nemotron",
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"0.06","output":"0.23","sourceUrl":"https://aws.amazon.com/bedrock/pricing/","observedAt":"2026-08-05","notes":["No explicit effective date published for this rate; effectiveFrom is set conservatively to 2026-01-01.","Not surfaced by the 2026-09-07 fetch of the same page, whose accessible sections did not include this model. observedAt is deliberately left at 2026-08-05: the rate was not re-observed, and an absence in one page fetch is not evidence of a withdrawal."]},
    ],
    source: {"url":"https://aws.amazon.com/bedrock/pricing/","observedAt":"2026-08-05"},
  },
  {
    canonicalId: "gpt-3.5-turbo",
    provider: "azure-openai",
    aliases: [],
    family: "gpt-3.5",
    pricing: [
      {"effectiveFrom":"2025-03-01","currency":"USD","unit":"per-million-tokens","input":"0.50","output":"1.50","cheapestTier":true,"sourceUrl":"https://prices.azure.com/api/retail/prices?currencyCode='USD'&$filter=contains(productName,%20%27OpenAI%27)","observedAt":"2026-08-05","notes":["Azure's Retail Prices API quotes this meter per 1K tokens; converted to per-million-tokens by shifting the decimal point 3 places as exact string manipulation (never float multiplication).","The Retail Prices API returned exactly one row for this legacy SKU (a single primary-meter-region price, no per-region breakdown) rather than the ~24-28 region-duplicated rows seen for actively-priced SKUs — a single global list price, which is consistent with (not contradictory to) Global-deployment region-independence, but could not be cross-region spot-checked the way other entries were.","No Batch API meter was found for this model/SKU in the Retail Prices API response; batchMultiplier is intentionally omitted rather than assumed.","Matches OpenAI's own first-party rate for \"gpt-3.5-turbo\" in openai.json exactly as observed ($0.50/$1.50) — no markup detected for this model on Azure's Global deployment tier.","canonicalId \"gpt-3.5-turbo\" is deliberately identical to the same model's entry in openai.json — Azure genuinely resells the identical first-party OpenAI model, unlike AWS Bedrock's or OpenRouter's differently-branded catalogues. Following the aws-bedrock.json precedent (e.g. its \"mistral-large-3\" and \"gemma-4-31b\" entries) rather than OpenRouter's provider-prefixed-slug convention: this is an intentional cross-provider canonicalId collision, not an error. A bare lookup of this id without a provider qualifier is ambiguous by design and must fail, exactly as already documented for the aws-bedrock.json collisions, since a lookup with a duplicated canonicalId requires a provider qualifier to resolve unambiguously. Per this task's ownership boundary, openai.json itself was not modified to cross-reference this note; a follow-up pass should add a mirroring note there."]},
    ],
    source: {"url":"https://prices.azure.com/api/retail/prices?currencyCode='USD'&$filter=contains(productName,%20%27OpenAI%27)","observedAt":"2026-08-05"},
  },
  {
    canonicalId: "gpt-4",
    provider: "azure-openai",
    aliases: [],
    family: "gpt-4",
    pricing: [
      {"effectiveFrom":"2025-03-01","currency":"USD","unit":"per-million-tokens","input":"30.00","output":"60.00","cheapestTier":true,"sourceUrl":"https://prices.azure.com/api/retail/prices?currencyCode='USD'&$filter=contains(productName,%20%27OpenAI%27)","observedAt":"2026-08-05","notes":["Azure's Retail Prices API quotes this meter per 1K tokens; converted to per-million-tokens by shifting the decimal point 3 places as exact string manipulation (never float multiplication).","The Retail Prices API returned exactly one row for this legacy SKU (a single primary-meter-region price, no per-region breakdown) rather than the ~24-28 region-duplicated rows seen for actively-priced SKUs — a single global list price, which is consistent with (not contradictory to) Global-deployment region-independence, but could not be cross-region spot-checked the way other entries were.","No Batch API meter was found for this model/SKU in the Retail Prices API response; batchMultiplier is intentionally omitted rather than assumed.","No comparable first-party entry exists in openai.json's 2026-08-05 snapshot for \"gpt-4\" (it is either a legacy/superseded model no longer on OpenAI's current pricing page, or a variant OpenAI does not sell directly) — Azure's own resale rate is recorded as observed with no parity claim possible or intended."]},
    ],
    source: {"url":"https://prices.azure.com/api/retail/prices?currencyCode='USD'&$filter=contains(productName,%20%27OpenAI%27)","observedAt":"2026-08-05"},
  },
  {
    canonicalId: "gpt-4-32k",
    provider: "azure-openai",
    aliases: [],
    family: "gpt-4",
    pricing: [
      {"effectiveFrom":"2025-03-01","currency":"USD","unit":"per-million-tokens","input":"60.00","output":"120.00","cheapestTier":true,"sourceUrl":"https://prices.azure.com/api/retail/prices?currencyCode='USD'&$filter=contains(productName,%20%27OpenAI%27)","observedAt":"2026-08-05","notes":["Azure's Retail Prices API quotes this meter per 1K tokens; converted to per-million-tokens by shifting the decimal point 3 places as exact string manipulation (never float multiplication).","The Retail Prices API returned exactly one row for this legacy SKU (a single primary-meter-region price, no per-region breakdown) rather than the ~24-28 region-duplicated rows seen for actively-priced SKUs — a single global list price, which is consistent with (not contradictory to) Global-deployment region-independence, but could not be cross-region spot-checked the way other entries were.","No Batch API meter was found for this model/SKU in the Retail Prices API response; batchMultiplier is intentionally omitted rather than assumed.","No comparable first-party entry exists in openai.json's 2026-08-05 snapshot for \"gpt-4-32k\" (it is either a legacy/superseded model no longer on OpenAI's current pricing page, or a variant OpenAI does not sell directly) — Azure's own resale rate is recorded as observed with no parity claim possible or intended."]},
    ],
    source: {"url":"https://prices.azure.com/api/retail/prices?currencyCode='USD'&$filter=contains(productName,%20%27OpenAI%27)","observedAt":"2026-08-05"},
  },
  {
    canonicalId: "gpt-4-turbo",
    provider: "azure-openai",
    aliases: [],
    family: "gpt-4-turbo",
    pricing: [
      {"effectiveFrom":"2024-06-01","currency":"USD","unit":"per-million-tokens","input":"10.00","output":"30.00","cheapestTier":true,"sourceUrl":"https://prices.azure.com/api/retail/prices?currencyCode='USD'&$filter=contains(productName,%20%27OpenAI%27)","observedAt":"2026-08-05","notes":["Azure's Retail Prices API quotes this meter per 1K tokens; converted to per-million-tokens by shifting the decimal point 3 places as exact string manipulation (never float multiplication).","retailPrice confirmed identical across all 23 Azure regions returned for this Global-deployment SKU (spot-checked programmatically, not just a couple of regions) — no regional price variation observed for the Global tier.","No Batch API meter was found for this model/SKU in the Retail Prices API response; batchMultiplier is intentionally omitted rather than assumed.","No comparable first-party entry exists in openai.json's 2026-08-05 snapshot for \"gpt-4-turbo\" (it is either a legacy/superseded model no longer on OpenAI's current pricing page, or a variant OpenAI does not sell directly) — Azure's own resale rate is recorded as observed with no parity claim possible or intended."]},
    ],
    source: {"url":"https://prices.azure.com/api/retail/prices?currencyCode='USD'&$filter=contains(productName,%20%27OpenAI%27)","observedAt":"2026-08-05"},
  },
  {
    canonicalId: "gpt-4.1",
    provider: "azure-openai",
    aliases: [],
    family: "gpt-4.1",
    pricing: [
      {"effectiveFrom":"2025-04-01","currency":"USD","unit":"per-million-tokens","input":"2.00","output":"8.00","cachedInput":"0.50","batchMultiplier":"0.5","cheapestTier":true,"sourceUrl":"https://prices.azure.com/api/retail/prices?currencyCode='USD'&$filter=contains(productName,%20%27OpenAI%27)","observedAt":"2026-08-05","notes":["Azure's Retail Prices API quotes this meter per 1K tokens; converted to per-million-tokens by shifting the decimal point 3 places as exact string manipulation (never float multiplication).","retailPrice confirmed identical across all 28 Azure regions returned for this Global-deployment SKU (spot-checked programmatically, not just a couple of regions) — no regional price variation observed for the Global tier.","batchMultiplier 0.5 independently confirmed from this model's own Batch-API meter on Azure (batch input and output rows both computed to exactly 0.5x the standard Global rate), not assumed from a blanket policy statement.","Matches OpenAI's own first-party rate for \"gpt-4.1\" in openai.json exactly as observed ($2.00/$8.00/$0.50 cached) — no markup detected for this model on Azure's Global deployment tier.","canonicalId \"gpt-4.1\" is deliberately identical to the same model's entry in openai.json — Azure genuinely resells the identical first-party OpenAI model, unlike AWS Bedrock's or OpenRouter's differently-branded catalogues. Following the aws-bedrock.json precedent (e.g. its \"mistral-large-3\" and \"gemma-4-31b\" entries) rather than OpenRouter's provider-prefixed-slug convention: this is an intentional cross-provider canonicalId collision, not an error. A bare lookup of this id without a provider qualifier is ambiguous by design and must fail, exactly as already documented for the aws-bedrock.json collisions, since a lookup with a duplicated canonicalId requires a provider qualifier to resolve unambiguously. Per this task's ownership boundary, openai.json itself was not modified to cross-reference this note; a follow-up pass should add a mirroring note there."]},
    ],
    source: {"url":"https://prices.azure.com/api/retail/prices?currencyCode='USD'&$filter=contains(productName,%20%27OpenAI%27)","observedAt":"2026-08-05"},
  },
  {
    canonicalId: "gpt-4.1-mini",
    provider: "azure-openai",
    aliases: [],
    family: "gpt-4.1",
    pricing: [
      {"effectiveFrom":"2025-04-01","currency":"USD","unit":"per-million-tokens","input":"0.40","output":"1.60","cachedInput":"0.10","batchMultiplier":"0.5","cheapestTier":true,"sourceUrl":"https://prices.azure.com/api/retail/prices?currencyCode='USD'&$filter=contains(productName,%20%27OpenAI%27)","observedAt":"2026-08-05","notes":["Azure's Retail Prices API quotes this meter per 1K tokens; converted to per-million-tokens by shifting the decimal point 3 places as exact string manipulation (never float multiplication).","retailPrice confirmed identical across all 28 Azure regions returned for this Global-deployment SKU (spot-checked programmatically, not just a couple of regions) — no regional price variation observed for the Global tier.","batchMultiplier 0.5 independently confirmed from this model's own Batch-API meter on Azure (batch input and output rows both computed to exactly 0.5x the standard Global rate), not assumed from a blanket policy statement.","Matches OpenAI's own first-party rate for \"gpt-4.1-mini\" in openai.json exactly as observed ($0.40/$1.60/$0.10 cached) — no markup detected for this model on Azure's Global deployment tier.","canonicalId \"gpt-4.1-mini\" is deliberately identical to the same model's entry in openai.json — Azure genuinely resells the identical first-party OpenAI model, unlike AWS Bedrock's or OpenRouter's differently-branded catalogues. Following the aws-bedrock.json precedent (e.g. its \"mistral-large-3\" and \"gemma-4-31b\" entries) rather than OpenRouter's provider-prefixed-slug convention: this is an intentional cross-provider canonicalId collision, not an error. A bare lookup of this id without a provider qualifier is ambiguous by design and must fail, exactly as already documented for the aws-bedrock.json collisions, since a lookup with a duplicated canonicalId requires a provider qualifier to resolve unambiguously. Per this task's ownership boundary, openai.json itself was not modified to cross-reference this note; a follow-up pass should add a mirroring note there."]},
    ],
    source: {"url":"https://prices.azure.com/api/retail/prices?currencyCode='USD'&$filter=contains(productName,%20%27OpenAI%27)","observedAt":"2026-08-05"},
  },
  {
    canonicalId: "gpt-4.1-nano",
    provider: "azure-openai",
    aliases: [],
    family: "gpt-4.1",
    pricing: [
      {"effectiveFrom":"2025-04-01","currency":"USD","unit":"per-million-tokens","input":"0.10","output":"0.40","cachedInput":"0.025","batchMultiplier":"0.5","cheapestTier":true,"sourceUrl":"https://prices.azure.com/api/retail/prices?currencyCode='USD'&$filter=contains(productName,%20%27OpenAI%27)","observedAt":"2026-08-05","notes":["Azure's Retail Prices API quotes this meter per 1K tokens; converted to per-million-tokens by shifting the decimal point 3 places as exact string manipulation (never float multiplication).","retailPrice confirmed identical across all 28 Azure regions returned for this Global-deployment SKU (spot-checked programmatically, not just a couple of regions) — no regional price variation observed for the Global tier.","batchMultiplier 0.5 independently confirmed from this model's own Batch-API meter on Azure (batch input and output rows both computed to exactly 0.5x the standard Global rate), not assumed from a blanket policy statement.","Matches OpenAI's own first-party rate for \"gpt-4.1-nano\" in openai.json exactly as observed ($0.10/$0.40/$0.025 cached) — no markup detected for this model on Azure's Global deployment tier.","canonicalId \"gpt-4.1-nano\" is deliberately identical to the same model's entry in openai.json — Azure genuinely resells the identical first-party OpenAI model, unlike AWS Bedrock's or OpenRouter's differently-branded catalogues. Following the aws-bedrock.json precedent (e.g. its \"mistral-large-3\" and \"gemma-4-31b\" entries) rather than OpenRouter's provider-prefixed-slug convention: this is an intentional cross-provider canonicalId collision, not an error. A bare lookup of this id without a provider qualifier is ambiguous by design and must fail, exactly as already documented for the aws-bedrock.json collisions, since a lookup with a duplicated canonicalId requires a provider qualifier to resolve unambiguously. Per this task's ownership boundary, openai.json itself was not modified to cross-reference this note; a follow-up pass should add a mirroring note there."]},
    ],
    source: {"url":"https://prices.azure.com/api/retail/prices?currencyCode='USD'&$filter=contains(productName,%20%27OpenAI%27)","observedAt":"2026-08-05"},
  },
  {
    canonicalId: "gpt-4o",
    provider: "azure-openai",
    aliases: [],
    family: "gpt-4o",
    pricing: [
      {"effectiveFrom":"2024-12-01","currency":"USD","unit":"per-million-tokens","input":"2.50","output":"10.00","cachedInput":"1.25","batchMultiplier":"0.5","cheapestTier":true,"sourceUrl":"https://prices.azure.com/api/retail/prices?currencyCode='USD'&$filter=contains(productName,%20%27OpenAI%27)","observedAt":"2026-08-05","notes":["Azure's Retail Prices API quotes this meter per 1K tokens; converted to per-million-tokens by shifting the decimal point 3 places as exact string manipulation (never float multiplication).","retailPrice confirmed identical across all 27 Azure regions returned for this Global-deployment SKU (spot-checked programmatically, not just a couple of regions) — no regional price variation observed for the Global tier.","batchMultiplier 0.5 independently confirmed from this model's own Batch-API meter on Azure (batch input and output rows both computed to exactly 0.5x the standard Global rate), not assumed from a blanket policy statement.","Matches OpenAI's own first-party rate for \"gpt-4o\" in openai.json exactly as observed ($2.50/$10.00/$1.25 cached) — no markup detected for this model on Azure's Global deployment tier.","canonicalId \"gpt-4o\" is deliberately identical to the same model's entry in openai.json — Azure genuinely resells the identical first-party OpenAI model, unlike AWS Bedrock's or OpenRouter's differently-branded catalogues. Following the aws-bedrock.json precedent (e.g. its \"mistral-large-3\" and \"gemma-4-31b\" entries) rather than OpenRouter's provider-prefixed-slug convention: this is an intentional cross-provider canonicalId collision, not an error. A bare lookup of this id without a provider qualifier is ambiguous by design and must fail, exactly as already documented for the aws-bedrock.json collisions, since a lookup with a duplicated canonicalId requires a provider qualifier to resolve unambiguously. Per this task's ownership boundary, openai.json itself was not modified to cross-reference this note; a follow-up pass should add a mirroring note there."]},
    ],
    source: {"url":"https://prices.azure.com/api/retail/prices?currencyCode='USD'&$filter=contains(productName,%20%27OpenAI%27)","observedAt":"2026-08-05"},
  },
  {
    canonicalId: "gpt-4o-mini",
    provider: "azure-openai",
    aliases: [],
    family: "gpt-4o",
    pricing: [
      {"effectiveFrom":"2024-07-01","currency":"USD","unit":"per-million-tokens","input":"0.15","output":"0.60","cachedInput":"0.075","batchMultiplier":"0.5","cheapestTier":true,"sourceUrl":"https://prices.azure.com/api/retail/prices?currencyCode='USD'&$filter=contains(productName,%20%27OpenAI%27)","observedAt":"2026-08-05","notes":["Azure's Retail Prices API quotes this meter per 1K tokens; converted to per-million-tokens by shifting the decimal point 3 places as exact string manipulation (never float multiplication).","retailPrice confirmed identical across all 28 Azure regions returned for this Global-deployment SKU (spot-checked programmatically, not just a couple of regions) — no regional price variation observed for the Global tier.","batchMultiplier 0.5 independently confirmed from this model's own Batch-API meter on Azure (batch input and output rows both computed to exactly 0.5x the standard Global rate), not assumed from a blanket policy statement.","Matches OpenAI's own first-party rate for \"gpt-4o-mini\" in openai.json exactly as observed ($0.15/$0.60/$0.075 cached) — no markup detected for this model on Azure's Global deployment tier.","canonicalId \"gpt-4o-mini\" is deliberately identical to the same model's entry in openai.json — Azure genuinely resells the identical first-party OpenAI model, unlike AWS Bedrock's or OpenRouter's differently-branded catalogues. Following the aws-bedrock.json precedent (e.g. its \"mistral-large-3\" and \"gemma-4-31b\" entries) rather than OpenRouter's provider-prefixed-slug convention: this is an intentional cross-provider canonicalId collision, not an error. A bare lookup of this id without a provider qualifier is ambiguous by design and must fail, exactly as already documented for the aws-bedrock.json collisions, since a lookup with a duplicated canonicalId requires a provider qualifier to resolve unambiguously. Per this task's ownership boundary, openai.json itself was not modified to cross-reference this note; a follow-up pass should add a mirroring note there."]},
    ],
    source: {"url":"https://prices.azure.com/api/retail/prices?currencyCode='USD'&$filter=contains(productName,%20%27OpenAI%27)","observedAt":"2026-08-05"},
  },
  {
    canonicalId: "gpt-5",
    provider: "azure-openai",
    aliases: [],
    family: "gpt-5",
    pricing: [
      {"effectiveFrom":"2025-08-01","currency":"USD","unit":"per-million-tokens","input":"1.25","output":"10.00","cachedInput":"0.125","batchMultiplier":"0.5","cheapestTier":true,"sourceUrl":"https://prices.azure.com/api/retail/prices?currencyCode='USD'&$filter=contains(productName,%20%27OpenAI%27)","observedAt":"2026-08-05","notes":["retailPrice confirmed identical across all 24 Azure regions returned for this Global-deployment SKU (spot-checked programmatically, not just a couple of regions) — no regional price variation observed for the Global tier.","batchMultiplier 0.5 independently confirmed from this model's own Batch-API meter on Azure (batch input and output rows both computed to exactly 0.5x the standard Global rate), not assumed from a blanket policy statement.","Matches OpenAI's own first-party rate for \"gpt-5\" in openai.json exactly as observed ($1.25/$10.00/$0.125 cached) — no markup detected for this model on Azure's Global deployment tier.","canonicalId \"gpt-5\" is deliberately identical to the same model's entry in openai.json — Azure genuinely resells the identical first-party OpenAI model, unlike AWS Bedrock's or OpenRouter's differently-branded catalogues. Following the aws-bedrock.json precedent (e.g. its \"mistral-large-3\" and \"gemma-4-31b\" entries) rather than OpenRouter's provider-prefixed-slug convention: this is an intentional cross-provider canonicalId collision, not an error. A bare lookup of this id without a provider qualifier is ambiguous by design and must fail, exactly as already documented for the aws-bedrock.json collisions, since a lookup with a duplicated canonicalId requires a provider qualifier to resolve unambiguously. Per this task's ownership boundary, openai.json itself was not modified to cross-reference this note; a follow-up pass should add a mirroring note there."]},
    ],
    source: {"url":"https://prices.azure.com/api/retail/prices?currencyCode='USD'&$filter=contains(productName,%20%27OpenAI%27)","observedAt":"2026-08-05"},
  },
  {
    canonicalId: "gpt-5-mini",
    provider: "azure-openai",
    aliases: [],
    family: "gpt-5",
    pricing: [
      {"effectiveFrom":"2025-08-01","currency":"USD","unit":"per-million-tokens","input":"0.25","output":"2.00","cachedInput":"0.025","batchMultiplier":"0.5","cheapestTier":true,"sourceUrl":"https://prices.azure.com/api/retail/prices?currencyCode='USD'&$filter=contains(productName,%20%27OpenAI%27)","observedAt":"2026-08-05","notes":["retailPrice confirmed identical across all 27 Azure regions returned for this Global-deployment SKU (spot-checked programmatically, not just a couple of regions) — no regional price variation observed for the Global tier.","batchMultiplier 0.5 independently confirmed from this model's own Batch-API meter on Azure (batch input and output rows both computed to exactly 0.5x the standard Global rate), not assumed from a blanket policy statement.","Matches OpenAI's own first-party rate for \"gpt-5-mini\" in openai.json exactly as observed ($0.25/$2.00/$0.025 cached) — no markup detected for this model on Azure's Global deployment tier.","canonicalId \"gpt-5-mini\" is deliberately identical to the same model's entry in openai.json — Azure genuinely resells the identical first-party OpenAI model, unlike AWS Bedrock's or OpenRouter's differently-branded catalogues. Following the aws-bedrock.json precedent (e.g. its \"mistral-large-3\" and \"gemma-4-31b\" entries) rather than OpenRouter's provider-prefixed-slug convention: this is an intentional cross-provider canonicalId collision, not an error. A bare lookup of this id without a provider qualifier is ambiguous by design and must fail, exactly as already documented for the aws-bedrock.json collisions, since a lookup with a duplicated canonicalId requires a provider qualifier to resolve unambiguously. Per this task's ownership boundary, openai.json itself was not modified to cross-reference this note; a follow-up pass should add a mirroring note there."]},
    ],
    source: {"url":"https://prices.azure.com/api/retail/prices?currencyCode='USD'&$filter=contains(productName,%20%27OpenAI%27)","observedAt":"2026-08-05"},
  },
  {
    canonicalId: "gpt-5-nano",
    provider: "azure-openai",
    aliases: [],
    family: "gpt-5",
    pricing: [
      {"effectiveFrom":"2025-08-01","currency":"USD","unit":"per-million-tokens","input":"0.05","output":"0.40","cachedInput":"0.005","batchMultiplier":"0.5","cheapestTier":true,"sourceUrl":"https://prices.azure.com/api/retail/prices?currencyCode='USD'&$filter=contains(productName,%20%27OpenAI%27)","observedAt":"2026-08-05","notes":["retailPrice confirmed identical across all 27 Azure regions returned for this Global-deployment SKU (spot-checked programmatically, not just a couple of regions) — no regional price variation observed for the Global tier.","batchMultiplier 0.5 independently confirmed from this model's own Batch-API meter on Azure (batch input and output rows both computed to exactly 0.5x the standard Global rate), not assumed from a blanket policy statement.","Matches OpenAI's own first-party rate for \"gpt-5-nano\" in openai.json exactly as observed ($0.05/$0.40/$0.005 cached) — no markup detected for this model on Azure's Global deployment tier.","canonicalId \"gpt-5-nano\" is deliberately identical to the same model's entry in openai.json — Azure genuinely resells the identical first-party OpenAI model, unlike AWS Bedrock's or OpenRouter's differently-branded catalogues. Following the aws-bedrock.json precedent (e.g. its \"mistral-large-3\" and \"gemma-4-31b\" entries) rather than OpenRouter's provider-prefixed-slug convention: this is an intentional cross-provider canonicalId collision, not an error. A bare lookup of this id without a provider qualifier is ambiguous by design and must fail, exactly as already documented for the aws-bedrock.json collisions, since a lookup with a duplicated canonicalId requires a provider qualifier to resolve unambiguously. Per this task's ownership boundary, openai.json itself was not modified to cross-reference this note; a follow-up pass should add a mirroring note there."]},
    ],
    source: {"url":"https://prices.azure.com/api/retail/prices?currencyCode='USD'&$filter=contains(productName,%20%27OpenAI%27)","observedAt":"2026-08-05"},
  },
  {
    canonicalId: "gpt-5-pro",
    provider: "azure-openai",
    aliases: [],
    family: "gpt-5",
    pricing: [
      {"effectiveFrom":"2025-10-01","currency":"USD","unit":"per-million-tokens","input":"15.00","output":"120.00","batchMultiplier":"0.5","cheapestTier":true,"sourceUrl":"https://prices.azure.com/api/retail/prices?currencyCode='USD'&$filter=contains(productName,%20%27OpenAI%27)","observedAt":"2026-08-05","notes":["Azure's Retail Prices API quotes this meter per 1K tokens; converted to per-million-tokens by shifting the decimal point 3 places as exact string manipulation (never float multiplication).","retailPrice confirmed identical across all 24 Azure regions returned for this Global-deployment SKU (spot-checked programmatically, not just a couple of regions) — no regional price variation observed for the Global tier.","batchMultiplier 0.5 independently confirmed from this model's own Batch-API meter on Azure (batch input and output rows both computed to exactly 0.5x the standard Global rate), not assumed from a blanket policy statement.","Matches OpenAI's own first-party rate for \"gpt-5-pro\" in openai.json exactly as observed ($15.00/$120.00) — no markup detected for this model on Azure's Global deployment tier.","canonicalId \"gpt-5-pro\" is deliberately identical to the same model's entry in openai.json — Azure genuinely resells the identical first-party OpenAI model, unlike AWS Bedrock's or OpenRouter's differently-branded catalogues. Following the aws-bedrock.json precedent (e.g. its \"mistral-large-3\" and \"gemma-4-31b\" entries) rather than OpenRouter's provider-prefixed-slug convention: this is an intentional cross-provider canonicalId collision, not an error. A bare lookup of this id without a provider qualifier is ambiguous by design and must fail, exactly as already documented for the aws-bedrock.json collisions, since a lookup with a duplicated canonicalId requires a provider qualifier to resolve unambiguously. Per this task's ownership boundary, openai.json itself was not modified to cross-reference this note; a follow-up pass should add a mirroring note there."]},
    ],
    source: {"url":"https://prices.azure.com/api/retail/prices?currencyCode='USD'&$filter=contains(productName,%20%27OpenAI%27)","observedAt":"2026-08-05"},
  },
  {
    canonicalId: "gpt-5.1",
    provider: "azure-openai",
    aliases: [],
    family: "gpt-5.1",
    pricing: [
      {"effectiveFrom":"2025-11-01","currency":"USD","unit":"per-million-tokens","input":"1.25","output":"10.00","cachedInput":"0.125","batchMultiplier":"0.5","cheapestTier":true,"sourceUrl":"https://prices.azure.com/api/retail/prices?currencyCode='USD'&$filter=contains(productName,%20%27OpenAI%27)","observedAt":"2026-08-05","notes":["retailPrice confirmed identical across all 25 Azure regions returned for this Global-deployment SKU (spot-checked programmatically, not just a couple of regions) — no regional price variation observed for the Global tier.","batchMultiplier 0.5 independently confirmed from this model's own Batch-API meter on Azure (batch input and output rows both computed to exactly 0.5x the standard Global rate), not assumed from a blanket policy statement.","Matches OpenAI's own first-party rate for \"gpt-5.1\" in openai.json exactly as observed ($1.25/$10.00/$0.125 cached) — no markup detected for this model on Azure's Global deployment tier.","canonicalId \"gpt-5.1\" is deliberately identical to the same model's entry in openai.json — Azure genuinely resells the identical first-party OpenAI model, unlike AWS Bedrock's or OpenRouter's differently-branded catalogues. Following the aws-bedrock.json precedent (e.g. its \"mistral-large-3\" and \"gemma-4-31b\" entries) rather than OpenRouter's provider-prefixed-slug convention: this is an intentional cross-provider canonicalId collision, not an error. A bare lookup of this id without a provider qualifier is ambiguous by design and must fail, exactly as already documented for the aws-bedrock.json collisions, since a lookup with a duplicated canonicalId requires a provider qualifier to resolve unambiguously. Per this task's ownership boundary, openai.json itself was not modified to cross-reference this note; a follow-up pass should add a mirroring note there."]},
    ],
    source: {"url":"https://prices.azure.com/api/retail/prices?currencyCode='USD'&$filter=contains(productName,%20%27OpenAI%27)","observedAt":"2026-08-05"},
  },
  {
    canonicalId: "gpt-5.2",
    provider: "azure-openai",
    aliases: [],
    family: "gpt-5.2",
    pricing: [
      {"effectiveFrom":"2025-12-01","currency":"USD","unit":"per-million-tokens","input":"1.75","output":"14.00","cachedInput":"0.175","batchMultiplier":"0.5","cheapestTier":true,"sourceUrl":"https://prices.azure.com/api/retail/prices?currencyCode='USD'&$filter=contains(productName,%20%27OpenAI%27)","observedAt":"2026-08-05","notes":["retailPrice confirmed identical across all 24 Azure regions returned for this Global-deployment SKU (spot-checked programmatically, not just a couple of regions) — no regional price variation observed for the Global tier.","batchMultiplier 0.5 independently confirmed from this model's own Batch-API meter on Azure (batch input and output rows both computed to exactly 0.5x the standard Global rate), not assumed from a blanket policy statement.","Matches OpenAI's own first-party rate for \"gpt-5.2\" in openai.json exactly as observed ($1.75/$14.00/$0.175 cached) — no markup detected for this model on Azure's Global deployment tier.","canonicalId \"gpt-5.2\" is deliberately identical to the same model's entry in openai.json — Azure genuinely resells the identical first-party OpenAI model, unlike AWS Bedrock's or OpenRouter's differently-branded catalogues. Following the aws-bedrock.json precedent (e.g. its \"mistral-large-3\" and \"gemma-4-31b\" entries) rather than OpenRouter's provider-prefixed-slug convention: this is an intentional cross-provider canonicalId collision, not an error. A bare lookup of this id without a provider qualifier is ambiguous by design and must fail, exactly as already documented for the aws-bedrock.json collisions, since a lookup with a duplicated canonicalId requires a provider qualifier to resolve unambiguously. Per this task's ownership boundary, openai.json itself was not modified to cross-reference this note; a follow-up pass should add a mirroring note there."]},
    ],
    source: {"url":"https://prices.azure.com/api/retail/prices?currencyCode='USD'&$filter=contains(productName,%20%27OpenAI%27)","observedAt":"2026-08-05"},
  },
  {
    canonicalId: "gpt-5.2-pro",
    provider: "azure-openai",
    aliases: [],
    family: "gpt-5.2",
    pricing: [
      {"effectiveFrom":"2025-12-01","currency":"USD","unit":"per-million-tokens","input":"21.00","output":"168.00","batchMultiplier":"0.5","cheapestTier":true,"sourceUrl":"https://prices.azure.com/api/retail/prices?currencyCode='USD'&$filter=contains(productName,%20%27OpenAI%27)","observedAt":"2026-08-05","notes":["retailPrice confirmed identical across all 24 Azure regions returned for this Global-deployment SKU (spot-checked programmatically, not just a couple of regions) — no regional price variation observed for the Global tier.","batchMultiplier 0.5 independently confirmed from this model's own Batch-API meter on Azure (batch input and output rows both computed to exactly 0.5x the standard Global rate), not assumed from a blanket policy statement.","Matches OpenAI's own first-party rate for \"gpt-5.2-pro\" in openai.json exactly as observed ($21.00/$168.00) — no markup detected for this model on Azure's Global deployment tier.","canonicalId \"gpt-5.2-pro\" is deliberately identical to the same model's entry in openai.json — Azure genuinely resells the identical first-party OpenAI model, unlike AWS Bedrock's or OpenRouter's differently-branded catalogues. Following the aws-bedrock.json precedent (e.g. its \"mistral-large-3\" and \"gemma-4-31b\" entries) rather than OpenRouter's provider-prefixed-slug convention: this is an intentional cross-provider canonicalId collision, not an error. A bare lookup of this id without a provider qualifier is ambiguous by design and must fail, exactly as already documented for the aws-bedrock.json collisions, since a lookup with a duplicated canonicalId requires a provider qualifier to resolve unambiguously. Per this task's ownership boundary, openai.json itself was not modified to cross-reference this note; a follow-up pass should add a mirroring note there."]},
    ],
    source: {"url":"https://prices.azure.com/api/retail/prices?currencyCode='USD'&$filter=contains(productName,%20%27OpenAI%27)","observedAt":"2026-08-05"},
  },
  {
    canonicalId: "gpt-5.4",
    provider: "azure-openai",
    aliases: [],
    family: "gpt-5.4",
    pricing: [
      {"effectiveFrom":"2026-03-01","currency":"USD","unit":"per-million-tokens","input":"2.50","output":"15.00","cachedInput":"0.25","batchMultiplier":"0.5","cheapestTier":true,"sourceUrl":"https://prices.azure.com/api/retail/prices?currencyCode='USD'&$filter=contains(productName,%20%27OpenAI%27)","observedAt":"2026-08-05","notes":["retailPrice confirmed identical across all 25 Azure regions returned for this Global-deployment SKU (spot-checked programmatically, not just a couple of regions) — no regional price variation observed for the Global tier.","batchMultiplier 0.5 independently confirmed from this model's own Batch-API meter on Azure (batch input and output rows both computed to exactly 0.5x the standard Global rate), not assumed from a blanket policy statement.","Matches OpenAI's own first-party rate for \"gpt-5.4\" in openai.json exactly as observed ($2.50/$15.00/$0.25 cached) — no markup detected for this model on Azure's Global deployment tier.","canonicalId \"gpt-5.4\" is deliberately identical to the same model's entry in openai.json — Azure genuinely resells the identical first-party OpenAI model, unlike AWS Bedrock's or OpenRouter's differently-branded catalogues. Following the aws-bedrock.json precedent (e.g. its \"mistral-large-3\" and \"gemma-4-31b\" entries) rather than OpenRouter's provider-prefixed-slug convention: this is an intentional cross-provider canonicalId collision, not an error. A bare lookup of this id without a provider qualifier is ambiguous by design and must fail, exactly as already documented for the aws-bedrock.json collisions, since a lookup with a duplicated canonicalId requires a provider qualifier to resolve unambiguously. Per this task's ownership boundary, openai.json itself was not modified to cross-reference this note; a follow-up pass should add a mirroring note there."]},
    ],
    source: {"url":"https://prices.azure.com/api/retail/prices?currencyCode='USD'&$filter=contains(productName,%20%27OpenAI%27)","observedAt":"2026-08-05"},
  },
  {
    canonicalId: "gpt-5.4-mini",
    provider: "azure-openai",
    aliases: [],
    family: "gpt-5.4",
    pricing: [
      {"effectiveFrom":"2026-03-01","currency":"USD","unit":"per-million-tokens","input":"0.75","output":"4.50","cachedInput":"0.075","batchMultiplier":"0.5","cheapestTier":true,"sourceUrl":"https://prices.azure.com/api/retail/prices?currencyCode='USD'&$filter=contains(productName,%20%27OpenAI%27)","observedAt":"2026-08-05","notes":["retailPrice confirmed identical across all 25 Azure regions returned for this Global-deployment SKU (spot-checked programmatically, not just a couple of regions) — no regional price variation observed for the Global tier.","batchMultiplier 0.5 independently confirmed from this model's own Batch-API meter on Azure (batch input and output rows both computed to exactly 0.5x the standard Global rate), not assumed from a blanket policy statement.","Matches OpenAI's own first-party rate for \"gpt-5.4-mini\" in openai.json exactly as observed ($0.75/$4.50/$0.075 cached) — no markup detected for this model on Azure's Global deployment tier.","canonicalId \"gpt-5.4-mini\" is deliberately identical to the same model's entry in openai.json — Azure genuinely resells the identical first-party OpenAI model, unlike AWS Bedrock's or OpenRouter's differently-branded catalogues. Following the aws-bedrock.json precedent (e.g. its \"mistral-large-3\" and \"gemma-4-31b\" entries) rather than OpenRouter's provider-prefixed-slug convention: this is an intentional cross-provider canonicalId collision, not an error. A bare lookup of this id without a provider qualifier is ambiguous by design and must fail, exactly as already documented for the aws-bedrock.json collisions, since a lookup with a duplicated canonicalId requires a provider qualifier to resolve unambiguously. Per this task's ownership boundary, openai.json itself was not modified to cross-reference this note; a follow-up pass should add a mirroring note there."]},
    ],
    source: {"url":"https://prices.azure.com/api/retail/prices?currencyCode='USD'&$filter=contains(productName,%20%27OpenAI%27)","observedAt":"2026-08-05"},
  },
  {
    canonicalId: "gpt-5.4-nano",
    provider: "azure-openai",
    aliases: [],
    family: "gpt-5.4",
    pricing: [
      {"effectiveFrom":"2026-03-01","currency":"USD","unit":"per-million-tokens","input":"0.20","output":"1.25","cachedInput":"0.02","batchMultiplier":"0.5","cheapestTier":true,"sourceUrl":"https://prices.azure.com/api/retail/prices?currencyCode='USD'&$filter=contains(productName,%20%27OpenAI%27)","observedAt":"2026-08-05","notes":["retailPrice confirmed identical across all 25 Azure regions returned for this Global-deployment SKU (spot-checked programmatically, not just a couple of regions) — no regional price variation observed for the Global tier.","batchMultiplier 0.5 independently confirmed from this model's own Batch-API meter on Azure (batch input and output rows both computed to exactly 0.5x the standard Global rate), not assumed from a blanket policy statement.","Matches OpenAI's own first-party rate for \"gpt-5.4-nano\" in openai.json exactly as observed ($0.20/$1.25/$0.02 cached) — no markup detected for this model on Azure's Global deployment tier.","canonicalId \"gpt-5.4-nano\" is deliberately identical to the same model's entry in openai.json — Azure genuinely resells the identical first-party OpenAI model, unlike AWS Bedrock's or OpenRouter's differently-branded catalogues. Following the aws-bedrock.json precedent (e.g. its \"mistral-large-3\" and \"gemma-4-31b\" entries) rather than OpenRouter's provider-prefixed-slug convention: this is an intentional cross-provider canonicalId collision, not an error. A bare lookup of this id without a provider qualifier is ambiguous by design and must fail, exactly as already documented for the aws-bedrock.json collisions, since a lookup with a duplicated canonicalId requires a provider qualifier to resolve unambiguously. Per this task's ownership boundary, openai.json itself was not modified to cross-reference this note; a follow-up pass should add a mirroring note there."]},
    ],
    source: {"url":"https://prices.azure.com/api/retail/prices?currencyCode='USD'&$filter=contains(productName,%20%27OpenAI%27)","observedAt":"2026-08-05"},
  },
  {
    canonicalId: "gpt-5.4-pro",
    provider: "azure-openai",
    aliases: [],
    family: "gpt-5.4",
    pricing: [
      {"effectiveFrom":"2026-03-01","currency":"USD","unit":"per-million-tokens","input":"30.00","output":"180.00","batchMultiplier":"0.5","cheapestTier":true,"sourceUrl":"https://prices.azure.com/api/retail/prices?currencyCode='USD'&$filter=contains(productName,%20%27OpenAI%27)","observedAt":"2026-08-05","notes":["retailPrice confirmed identical across all 25 Azure regions returned for this Global-deployment SKU (spot-checked programmatically, not just a couple of regions) — no regional price variation observed for the Global tier.","batchMultiplier 0.5 independently confirmed from this model's own Batch-API meter on Azure (batch input and output rows both computed to exactly 0.5x the standard Global rate), not assumed from a blanket policy statement.","Matches OpenAI's own first-party rate for \"gpt-5.4-pro\" in openai.json exactly as observed ($30.00/$180.00) — no markup detected for this model on Azure's Global deployment tier.","canonicalId \"gpt-5.4-pro\" is deliberately identical to the same model's entry in openai.json — Azure genuinely resells the identical first-party OpenAI model, unlike AWS Bedrock's or OpenRouter's differently-branded catalogues. Following the aws-bedrock.json precedent (e.g. its \"mistral-large-3\" and \"gemma-4-31b\" entries) rather than OpenRouter's provider-prefixed-slug convention: this is an intentional cross-provider canonicalId collision, not an error. A bare lookup of this id without a provider qualifier is ambiguous by design and must fail, exactly as already documented for the aws-bedrock.json collisions, since a lookup with a duplicated canonicalId requires a provider qualifier to resolve unambiguously. Per this task's ownership boundary, openai.json itself was not modified to cross-reference this note; a follow-up pass should add a mirroring note there."]},
    ],
    source: {"url":"https://prices.azure.com/api/retail/prices?currencyCode='USD'&$filter=contains(productName,%20%27OpenAI%27)","observedAt":"2026-08-05"},
  },
  {
    canonicalId: "gpt-5.5",
    provider: "azure-openai",
    aliases: [],
    family: "gpt-5.5",
    pricing: [
      {"effectiveFrom":"2026-05-01","currency":"USD","unit":"per-million-tokens","input":"5.00","output":"30.00","cachedInput":"0.50","batchMultiplier":"0.5","cheapestTier":true,"sourceUrl":"https://prices.azure.com/api/retail/prices?currencyCode='USD'&$filter=contains(productName,%20%27OpenAI%27)","observedAt":"2026-08-05","notes":["retailPrice confirmed identical across all 25 Azure regions returned for this Global-deployment SKU (spot-checked programmatically, not just a couple of regions) — no regional price variation observed for the Global tier.","batchMultiplier 0.5 independently confirmed from this model's own Batch-API meter on Azure (batch input and output rows both computed to exactly 0.5x the standard Global rate), not assumed from a blanket policy statement.","Matches OpenAI's own first-party rate for \"gpt-5.5\" in openai.json exactly as observed ($5.00/$30.00/$0.50 cached) — no markup detected for this model on Azure's Global deployment tier.","canonicalId \"gpt-5.5\" is deliberately identical to the same model's entry in openai.json — Azure genuinely resells the identical first-party OpenAI model, unlike AWS Bedrock's or OpenRouter's differently-branded catalogues. Following the aws-bedrock.json precedent (e.g. its \"mistral-large-3\" and \"gemma-4-31b\" entries) rather than OpenRouter's provider-prefixed-slug convention: this is an intentional cross-provider canonicalId collision, not an error. A bare lookup of this id without a provider qualifier is ambiguous by design and must fail, exactly as already documented for the aws-bedrock.json collisions, since a lookup with a duplicated canonicalId requires a provider qualifier to resolve unambiguously. Per this task's ownership boundary, openai.json itself was not modified to cross-reference this note; a follow-up pass should add a mirroring note there."]},
    ],
    source: {"url":"https://prices.azure.com/api/retail/prices?currencyCode='USD'&$filter=contains(productName,%20%27OpenAI%27)","observedAt":"2026-08-05"},
  },
  {
    canonicalId: "gpt-5.6-luna",
    provider: "azure-openai",
    aliases: [],
    family: "gpt-5.6",
    pricing: [
      {"effectiveFrom":"2026-07-01","currency":"USD","unit":"per-million-tokens","input":"1.00","output":"6.00","cachedInput":"0.10","cacheWrite":"1.25","cheapestTier":true,"sourceUrl":"https://prices.azure.com/api/retail/prices?currencyCode='USD'&$filter=contains(productName,%20%27OpenAI%27)","observedAt":"2026-08-05","notes":["retailPrice confirmed identical across all 24 Azure regions returned for this Global-deployment SKU (spot-checked programmatically, not just a couple of regions) — no regional price variation observed for the Global tier.","No Batch API meter was found for this model/SKU in the Retail Prices API response; batchMultiplier is intentionally omitted rather than assumed.","DIFFERS from OpenAI's own first-party rate recorded in openai.json for the same canonicalId \"gpt-5.6-luna\": OpenAI first-party is $0.20/$1.20 input/output (cached $0.02), Azure Global is $1.00/$6.00 (cached $0.10). Both independently observed on 2026-08-05; this is a genuine, confirmed pricing divergence between the two channels for the same named model, not a transcription error — this is exactly the kind of difference this provider file exists to capture.","canonicalId \"gpt-5.6-luna\" is deliberately identical to the same model's entry in openai.json — Azure genuinely resells the identical first-party OpenAI model, unlike AWS Bedrock's or OpenRouter's differently-branded catalogues. Following the aws-bedrock.json precedent (e.g. its \"mistral-large-3\" and \"gemma-4-31b\" entries) rather than OpenRouter's provider-prefixed-slug convention: this is an intentional cross-provider canonicalId collision, not an error. A bare lookup of this id without a provider qualifier is ambiguous by design and must fail, exactly as already documented for the aws-bedrock.json collisions, since a lookup with a duplicated canonicalId requires a provider qualifier to resolve unambiguously. Per this task's ownership boundary, openai.json itself was not modified to cross-reference this note; a follow-up pass should add a mirroring note there."]},
    ],
    source: {"url":"https://prices.azure.com/api/retail/prices?currencyCode='USD'&$filter=contains(productName,%20%27OpenAI%27)","observedAt":"2026-08-05"},
  },
  {
    canonicalId: "gpt-5.6-sol",
    provider: "azure-openai",
    aliases: [],
    family: "gpt-5.6",
    pricing: [
      {"effectiveFrom":"2026-07-01","currency":"USD","unit":"per-million-tokens","input":"5.00","output":"30.00","cachedInput":"0.50","cacheWrite":"6.25","cheapestTier":true,"sourceUrl":"https://prices.azure.com/api/retail/prices?currencyCode='USD'&$filter=contains(productName,%20%27OpenAI%27)","observedAt":"2026-09-07","notes":["retailPrice confirmed identical across all 24 Azure regions returned for this Global-deployment SKU (spot-checked programmatically, not just a couple of regions) — no regional price variation observed for the Global tier.","No Batch API meter was found for this model/SKU in the Retail Prices API response; batchMultiplier is intentionally omitted rather than assumed.","canonicalId \"gpt-5.6-sol\" is deliberately identical to the same model's entry in openai.json — Azure genuinely resells the identical first-party OpenAI model, unlike AWS Bedrock's or OpenRouter's differently-branded catalogues. Following the aws-bedrock.json precedent (e.g. its \"mistral-large-3\" and \"gemma-4-31b\" entries) rather than OpenRouter's provider-prefixed-slug convention: this is an intentional cross-provider canonicalId collision, not an error. A bare lookup of this id without a provider qualifier is ambiguous by design and must fail, exactly as already documented for the aws-bedrock.json collisions, since a lookup with a duplicated canonicalId requires a provider qualifier to resolve unambiguously. Per this task's ownership boundary, openai.json itself was not modified to cross-reference this note; a follow-up pass should add a mirroring note there.","Re-observed 2026-09-07 via the Retail Prices API filtered to this model's meters (\"5.6 sol ShortCo Inp Std Gl\" $5.00, \"5.6 sol ShortCo Opt Std Gl\" $30.00, \"5.6 sol ShortCo Cd Inp Std Gl\" $0.50): unchanged.","NOW DIFFERS from OpenAI's own first-party rate in openai.json for the same canonicalId \"gpt-5.6-sol\". Both files recorded $5.00/$30.00/$0.50 on 2026-08-05; on 2026-09-07 OpenAI's pricing page published $4.00/$20.00/$0.40 while Azure's meters stayed at $5.00/$30.00/$0.50. Azure did not follow the first-party cut, so this joins gpt-5.6-terra and gpt-5.6-luna as a confirmed same-id price divergence rather than a transcription error.","The API also exposes \"LongCo\" (long-context) meters for this model at $10.00 input / $45.00 output Global Standard, alongside the \"ShortCo\" rates recorded here - the same context tiering OpenAI's page labels \"<272K\". This schema has no context-length dimension, so only the ShortCo tier is recorded."]},
    ],
    source: {"url":"https://prices.azure.com/api/retail/prices?currencyCode='USD'&$filter=contains(productName,%20%27OpenAI%27)","observedAt":"2026-09-07"},
  },
  {
    canonicalId: "gpt-5.6-terra",
    provider: "azure-openai",
    aliases: [],
    family: "gpt-5.6",
    pricing: [
      {"effectiveFrom":"2026-07-01","currency":"USD","unit":"per-million-tokens","input":"2.50","output":"15.00","cachedInput":"0.25","cacheWrite":"3.125","cheapestTier":true,"sourceUrl":"https://prices.azure.com/api/retail/prices?currencyCode='USD'&$filter=contains(productName,%20%27OpenAI%27)","observedAt":"2026-08-05","notes":["retailPrice confirmed identical across all 24 Azure regions returned for this Global-deployment SKU (spot-checked programmatically, not just a couple of regions) — no regional price variation observed for the Global tier.","No Batch API meter was found for this model/SKU in the Retail Prices API response; batchMultiplier is intentionally omitted rather than assumed.","DIFFERS from OpenAI's own first-party rate recorded in openai.json for the same canonicalId \"gpt-5.6-terra\": OpenAI first-party is $2.00/$12.00 input/output (cached $0.20), Azure Global is $2.50/$15.00 (cached $0.25). Both independently observed on 2026-08-05; this is a genuine, confirmed pricing divergence between the two channels for the same named model, not a transcription error — this is exactly the kind of difference this provider file exists to capture.","canonicalId \"gpt-5.6-terra\" is deliberately identical to the same model's entry in openai.json — Azure genuinely resells the identical first-party OpenAI model, unlike AWS Bedrock's or OpenRouter's differently-branded catalogues. Following the aws-bedrock.json precedent (e.g. its \"mistral-large-3\" and \"gemma-4-31b\" entries) rather than OpenRouter's provider-prefixed-slug convention: this is an intentional cross-provider canonicalId collision, not an error. A bare lookup of this id without a provider qualifier is ambiguous by design and must fail, exactly as already documented for the aws-bedrock.json collisions, since a lookup with a duplicated canonicalId requires a provider qualifier to resolve unambiguously. Per this task's ownership boundary, openai.json itself was not modified to cross-reference this note; a follow-up pass should add a mirroring note there."]},
    ],
    source: {"url":"https://prices.azure.com/api/retail/prices?currencyCode='USD'&$filter=contains(productName,%20%27OpenAI%27)","observedAt":"2026-08-05"},
  },
  {
    canonicalId: "o1",
    provider: "azure-openai",
    aliases: [],
    family: "o-series",
    pricing: [
      {"effectiveFrom":"2024-12-01","currency":"USD","unit":"per-million-tokens","input":"15.00","output":"60.00","cachedInput":"7.50","batchMultiplier":"0.5","cheapestTier":true,"sourceUrl":"https://prices.azure.com/api/retail/prices?currencyCode='USD'&$filter=contains(productName,%20%27OpenAI%27)","observedAt":"2026-08-05","notes":["Azure's Retail Prices API quotes this meter per 1K tokens; converted to per-million-tokens by shifting the decimal point 3 places as exact string manipulation (never float multiplication).","retailPrice confirmed identical across all 26 Azure regions returned for this Global-deployment SKU (spot-checked programmatically, not just a couple of regions) — no regional price variation observed for the Global tier.","batchMultiplier 0.5 independently confirmed from this model's own Batch-API meter on Azure (batch input and output rows both computed to exactly 0.5x the standard Global rate), not assumed from a blanket policy statement.","Matches OpenAI's own first-party rate for \"o1\" in openai.json exactly as observed ($15.00/$60.00/$7.50 cached) — no markup detected for this model on Azure's Global deployment tier.","canonicalId \"o1\" is deliberately identical to the same model's entry in openai.json — Azure genuinely resells the identical first-party OpenAI model, unlike AWS Bedrock's or OpenRouter's differently-branded catalogues. Following the aws-bedrock.json precedent (e.g. its \"mistral-large-3\" and \"gemma-4-31b\" entries) rather than OpenRouter's provider-prefixed-slug convention: this is an intentional cross-provider canonicalId collision, not an error. A bare lookup of this id without a provider qualifier is ambiguous by design and must fail, exactly as already documented for the aws-bedrock.json collisions, since a lookup with a duplicated canonicalId requires a provider qualifier to resolve unambiguously. Per this task's ownership boundary, openai.json itself was not modified to cross-reference this note; a follow-up pass should add a mirroring note there."]},
    ],
    source: {"url":"https://prices.azure.com/api/retail/prices?currencyCode='USD'&$filter=contains(productName,%20%27OpenAI%27)","observedAt":"2026-08-05"},
  },
  {
    canonicalId: "o1-mini",
    provider: "azure-openai",
    aliases: [],
    family: "o-series",
    pricing: [
      {"effectiveFrom":"2025-04-01","currency":"USD","unit":"per-million-tokens","input":"1.10","output":"4.40","cachedInput":"0.55","batchMultiplier":"0.5","cheapestTier":true,"sourceUrl":"https://prices.azure.com/api/retail/prices?currencyCode='USD'&$filter=contains(productName,%20%27OpenAI%27)","observedAt":"2026-08-05","notes":["Azure's Retail Prices API quotes this meter per 1K tokens; converted to per-million-tokens by shifting the decimal point 3 places as exact string manipulation (never float multiplication).","retailPrice confirmed identical across all 25 Azure regions returned for this Global-deployment SKU (spot-checked programmatically, not just a couple of regions) — no regional price variation observed for the Global tier.","batchMultiplier 0.5 independently confirmed from this model's own Batch-API meter on Azure (batch input and output rows both computed to exactly 0.5x the standard Global rate), not assumed from a blanket policy statement.","No comparable first-party entry exists in openai.json's 2026-08-05 snapshot for \"o1-mini\" (it is either a legacy/superseded model no longer on OpenAI's current pricing page, or a variant OpenAI does not sell directly) — Azure's own resale rate is recorded as observed with no parity claim possible or intended."]},
    ],
    source: {"url":"https://prices.azure.com/api/retail/prices?currencyCode='USD'&$filter=contains(productName,%20%27OpenAI%27)","observedAt":"2026-08-05"},
  },
  {
    canonicalId: "o1-preview",
    provider: "azure-openai",
    aliases: [],
    family: "o-series",
    pricing: [
      {"effectiveFrom":"2024-10-01","currency":"USD","unit":"per-million-tokens","input":"15.00","output":"60.00","cachedInput":"7.50","cheapestTier":true,"sourceUrl":"https://prices.azure.com/api/retail/prices?currencyCode='USD'&$filter=contains(productName,%20%27OpenAI%27)","observedAt":"2026-08-05","notes":["Azure's Retail Prices API quotes this meter per 1K tokens; converted to per-million-tokens by shifting the decimal point 3 places as exact string manipulation (never float multiplication).","retailPrice confirmed identical across all 3 Azure regions returned for this Global-deployment SKU (spot-checked programmatically, not just a couple of regions) — no regional price variation observed for the Global tier.","No Batch API meter was found for this model/SKU in the Retail Prices API response; batchMultiplier is intentionally omitted rather than assumed.","No comparable first-party entry exists in openai.json's 2026-08-05 snapshot for \"o1-preview\" (it is either a legacy/superseded model no longer on OpenAI's current pricing page, or a variant OpenAI does not sell directly) — Azure's own resale rate is recorded as observed with no parity claim possible or intended."]},
    ],
    source: {"url":"https://prices.azure.com/api/retail/prices?currencyCode='USD'&$filter=contains(productName,%20%27OpenAI%27)","observedAt":"2026-08-05"},
  },
  {
    canonicalId: "o1-pro",
    provider: "azure-openai",
    aliases: [],
    family: "o-series",
    pricing: [
      {"effectiveFrom":"2025-03-01","currency":"USD","unit":"per-million-tokens","input":"150.00","output":"600.00","cachedInput":"75.00","batchMultiplier":"0.5","cheapestTier":true,"sourceUrl":"https://prices.azure.com/api/retail/prices?currencyCode='USD'&$filter=contains(productName,%20%27OpenAI%27)","observedAt":"2026-08-05","notes":["Azure's Retail Prices API quotes this meter per 1K tokens; converted to per-million-tokens by shifting the decimal point 3 places as exact string manipulation (never float multiplication).","retailPrice confirmed identical across all 25 Azure regions returned for this Global-deployment SKU (spot-checked programmatically, not just a couple of regions) — no regional price variation observed for the Global tier.","batchMultiplier 0.5 independently confirmed from this model's own Batch-API meter on Azure (batch input and output rows both computed to exactly 0.5x the standard Global rate), not assumed from a blanket policy statement.","Matches OpenAI's own first-party rate for \"o1-pro\" in openai.json exactly as observed ($150.00/$600.00) — no markup detected for this model on Azure's Global deployment tier.","canonicalId \"o1-pro\" is deliberately identical to the same model's entry in openai.json — Azure genuinely resells the identical first-party OpenAI model, unlike AWS Bedrock's or OpenRouter's differently-branded catalogues. Following the aws-bedrock.json precedent (e.g. its \"mistral-large-3\" and \"gemma-4-31b\" entries) rather than OpenRouter's provider-prefixed-slug convention: this is an intentional cross-provider canonicalId collision, not an error. A bare lookup of this id without a provider qualifier is ambiguous by design and must fail, exactly as already documented for the aws-bedrock.json collisions, since a lookup with a duplicated canonicalId requires a provider qualifier to resolve unambiguously. Per this task's ownership boundary, openai.json itself was not modified to cross-reference this note; a follow-up pass should add a mirroring note there."]},
    ],
    source: {"url":"https://prices.azure.com/api/retail/prices?currencyCode='USD'&$filter=contains(productName,%20%27OpenAI%27)","observedAt":"2026-08-05"},
  },
  {
    canonicalId: "o3",
    provider: "azure-openai",
    aliases: [],
    family: "o-series",
    pricing: [
      {"effectiveFrom":"2025-06-01","currency":"USD","unit":"per-million-tokens","input":"2.00","output":"8.00","cachedInput":"0.50","batchMultiplier":"0.5","cheapestTier":true,"sourceUrl":"https://prices.azure.com/api/retail/prices?currencyCode='USD'&$filter=contains(productName,%20%27OpenAI%27)","observedAt":"2026-08-05","notes":["Azure's Retail Prices API quotes this meter per 1K tokens; converted to per-million-tokens by shifting the decimal point 3 places as exact string manipulation (never float multiplication).","retailPrice confirmed identical across all 24 Azure regions returned for this Global-deployment SKU (spot-checked programmatically, not just a couple of regions) — no regional price variation observed for the Global tier.","batchMultiplier 0.5 independently confirmed from this model's own Batch-API meter on Azure (batch input and output rows both computed to exactly 0.5x the standard Global rate), not assumed from a blanket policy statement.","Matches OpenAI's own first-party rate for \"o3\" in openai.json exactly as observed ($2.00/$8.00/$0.50 cached) — no markup detected for this model on Azure's Global deployment tier.","canonicalId \"o3\" is deliberately identical to the same model's entry in openai.json — Azure genuinely resells the identical first-party OpenAI model, unlike AWS Bedrock's or OpenRouter's differently-branded catalogues. Following the aws-bedrock.json precedent (e.g. its \"mistral-large-3\" and \"gemma-4-31b\" entries) rather than OpenRouter's provider-prefixed-slug convention: this is an intentional cross-provider canonicalId collision, not an error. A bare lookup of this id without a provider qualifier is ambiguous by design and must fail, exactly as already documented for the aws-bedrock.json collisions, since a lookup with a duplicated canonicalId requires a provider qualifier to resolve unambiguously. Per this task's ownership boundary, openai.json itself was not modified to cross-reference this note; a follow-up pass should add a mirroring note there."]},
    ],
    source: {"url":"https://prices.azure.com/api/retail/prices?currencyCode='USD'&$filter=contains(productName,%20%27OpenAI%27)","observedAt":"2026-08-05"},
  },
  {
    canonicalId: "o3-mini",
    provider: "azure-openai",
    aliases: [],
    family: "o-series",
    pricing: [
      {"effectiveFrom":"2025-02-01","currency":"USD","unit":"per-million-tokens","input":"1.10","output":"4.40","cachedInput":"0.55","batchMultiplier":"0.5","cheapestTier":true,"sourceUrl":"https://prices.azure.com/api/retail/prices?currencyCode='USD'&$filter=contains(productName,%20%27OpenAI%27)","observedAt":"2026-08-05","notes":["Azure's Retail Prices API quotes this meter per 1K tokens; converted to per-million-tokens by shifting the decimal point 3 places as exact string manipulation (never float multiplication).","retailPrice confirmed identical across all 27 Azure regions returned for this Global-deployment SKU (spot-checked programmatically, not just a couple of regions) — no regional price variation observed for the Global tier.","batchMultiplier 0.5 independently confirmed from this model's own Batch-API meter on Azure (batch input and output rows both computed to exactly 0.5x the standard Global rate), not assumed from a blanket policy statement.","Matches OpenAI's own first-party rate for \"o3-mini\" in openai.json exactly as observed ($1.10/$4.40/$0.55 cached) — no markup detected for this model on Azure's Global deployment tier.","canonicalId \"o3-mini\" is deliberately identical to the same model's entry in openai.json — Azure genuinely resells the identical first-party OpenAI model, unlike AWS Bedrock's or OpenRouter's differently-branded catalogues. Following the aws-bedrock.json precedent (e.g. its \"mistral-large-3\" and \"gemma-4-31b\" entries) rather than OpenRouter's provider-prefixed-slug convention: this is an intentional cross-provider canonicalId collision, not an error. A bare lookup of this id without a provider qualifier is ambiguous by design and must fail, exactly as already documented for the aws-bedrock.json collisions, since a lookup with a duplicated canonicalId requires a provider qualifier to resolve unambiguously. Per this task's ownership boundary, openai.json itself was not modified to cross-reference this note; a follow-up pass should add a mirroring note there."]},
    ],
    source: {"url":"https://prices.azure.com/api/retail/prices?currencyCode='USD'&$filter=contains(productName,%20%27OpenAI%27)","observedAt":"2026-08-05"},
  },
  {
    canonicalId: "o3-pro",
    provider: "azure-openai",
    aliases: [],
    family: "o-series",
    pricing: [
      {"effectiveFrom":"2025-06-01","currency":"USD","unit":"per-million-tokens","input":"20.00","output":"80.00","batchMultiplier":"0.5","cheapestTier":true,"sourceUrl":"https://prices.azure.com/api/retail/prices?currencyCode='USD'&$filter=contains(productName,%20%27OpenAI%27)","observedAt":"2026-08-05","notes":["Azure's Retail Prices API quotes this meter per 1K tokens; converted to per-million-tokens by shifting the decimal point 3 places as exact string manipulation (never float multiplication).","retailPrice confirmed identical across all 24 Azure regions returned for this Global-deployment SKU (spot-checked programmatically, not just a couple of regions) — no regional price variation observed for the Global tier.","batchMultiplier 0.5 independently confirmed from this model's own Batch-API meter on Azure (batch input and output rows both computed to exactly 0.5x the standard Global rate), not assumed from a blanket policy statement.","Matches OpenAI's own first-party rate for \"o3-pro\" in openai.json exactly as observed ($20.00/$80.00) — no markup detected for this model on Azure's Global deployment tier.","canonicalId \"o3-pro\" is deliberately identical to the same model's entry in openai.json — Azure genuinely resells the identical first-party OpenAI model, unlike AWS Bedrock's or OpenRouter's differently-branded catalogues. Following the aws-bedrock.json precedent (e.g. its \"mistral-large-3\" and \"gemma-4-31b\" entries) rather than OpenRouter's provider-prefixed-slug convention: this is an intentional cross-provider canonicalId collision, not an error. A bare lookup of this id without a provider qualifier is ambiguous by design and must fail, exactly as already documented for the aws-bedrock.json collisions, since a lookup with a duplicated canonicalId requires a provider qualifier to resolve unambiguously. Per this task's ownership boundary, openai.json itself was not modified to cross-reference this note; a follow-up pass should add a mirroring note there."]},
    ],
    source: {"url":"https://prices.azure.com/api/retail/prices?currencyCode='USD'&$filter=contains(productName,%20%27OpenAI%27)","observedAt":"2026-08-05"},
  },
  {
    canonicalId: "o4-mini",
    provider: "azure-openai",
    aliases: [],
    family: "o-series",
    pricing: [
      {"effectiveFrom":"2025-04-01","currency":"USD","unit":"per-million-tokens","input":"1.10","output":"4.40","cachedInput":"0.275","batchMultiplier":"0.5","cheapestTier":true,"sourceUrl":"https://prices.azure.com/api/retail/prices?currencyCode='USD'&$filter=contains(productName,%20%27OpenAI%27)","observedAt":"2026-08-05","notes":["Azure's Retail Prices API quotes this meter per 1K tokens; converted to per-million-tokens by shifting the decimal point 3 places as exact string manipulation (never float multiplication).","retailPrice confirmed identical across all 26 Azure regions returned for this Global-deployment SKU (spot-checked programmatically, not just a couple of regions) — no regional price variation observed for the Global tier.","batchMultiplier 0.5 independently confirmed from this model's own Batch-API meter on Azure (batch input and output rows both computed to exactly 0.5x the standard Global rate), not assumed from a blanket policy statement.","Matches OpenAI's own first-party rate for \"o4-mini\" in openai.json exactly as observed ($1.10/$4.40/$0.275 cached) — no markup detected for this model on Azure's Global deployment tier.","canonicalId \"o4-mini\" is deliberately identical to the same model's entry in openai.json — Azure genuinely resells the identical first-party OpenAI model, unlike AWS Bedrock's or OpenRouter's differently-branded catalogues. Following the aws-bedrock.json precedent (e.g. its \"mistral-large-3\" and \"gemma-4-31b\" entries) rather than OpenRouter's provider-prefixed-slug convention: this is an intentional cross-provider canonicalId collision, not an error. A bare lookup of this id without a provider qualifier is ambiguous by design and must fail, exactly as already documented for the aws-bedrock.json collisions, since a lookup with a duplicated canonicalId requires a provider qualifier to resolve unambiguously. Per this task's ownership boundary, openai.json itself was not modified to cross-reference this note; a follow-up pass should add a mirroring note there."]},
    ],
    source: {"url":"https://prices.azure.com/api/retail/prices?currencyCode='USD'&$filter=contains(productName,%20%27OpenAI%27)","observedAt":"2026-08-05"},
  },
  {
    canonicalId: "aya-expanse-32b",
    provider: "cohere",
    aliases: [],
    family: "aya-expanse",
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"0.50","output":"1.50","sourceUrl":"https://cohere.com/pricing","observedAt":"2026-09-07","notes":["Cohere's pricing page publishes an identical $0.50/$1.50 rate for both the 8B and 32B Aya Expanse sizes (confirmed by two independent re-fetches of the same page); this was double-checked rather than assumed to be an extraction error.","effectiveFrom set conservatively to 2026-01-01; exact rate-effective date not published.","Re-confirmed unchanged on 2026-09-07 against the same page."]},
    ],
    source: {"url":"https://cohere.com/pricing","observedAt":"2026-09-07"},
  },
  {
    canonicalId: "aya-expanse-8b",
    provider: "cohere",
    aliases: [],
    family: "aya-expanse",
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"0.50","output":"1.50","sourceUrl":"https://cohere.com/pricing","observedAt":"2026-09-07","notes":["Cohere's pricing page publishes an identical $0.50/$1.50 rate for both the 8B and 32B Aya Expanse sizes (confirmed by two independent re-fetches of the same page); this was double-checked rather than assumed to be an extraction error.","effectiveFrom set conservatively to 2026-01-01; exact rate-effective date not published.","Re-confirmed unchanged on 2026-09-07 against the same page."]},
    ],
    source: {"url":"https://cohere.com/pricing","observedAt":"2026-09-07"},
  },
  {
    canonicalId: "command",
    provider: "cohere",
    aliases: [],
    family: "command",
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"1.00","output":"2.00","sourceUrl":"https://cohere.com/pricing","observedAt":"2026-09-07","notes":["Cohere's pricing page does not publish an effective date for this rate; effectiveFrom is set conservatively to 2026-01-01.","This rate appears in the pricing page's FAQ/legacy-rates section, not a headline pricing table; it is nonetheless the only per-token price Cohere currently publishes for this model.","Re-confirmed unchanged on 2026-09-07 against the same page."]},
    ],
    source: {"url":"https://cohere.com/pricing","observedAt":"2026-09-07"},
  },
  {
    canonicalId: "command-light",
    provider: "cohere",
    aliases: [],
    family: "command",
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"0.30","output":"0.60","sourceUrl":"https://cohere.com/pricing","observedAt":"2026-09-07","notes":["Cohere's pricing page does not publish an effective date for this rate; effectiveFrom is set conservatively to 2026-01-01.","FAQ/legacy-rates section pricing, per the same caveat as \"command\".","Re-confirmed unchanged on 2026-09-07 against the same page."]},
    ],
    source: {"url":"https://cohere.com/pricing","observedAt":"2026-09-07"},
  },
  {
    canonicalId: "command-r-03-2024",
    provider: "cohere",
    aliases: [],
    family: "command-r",
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"0.50","output":"1.50","sourceUrl":"https://cohere.com/pricing","observedAt":"2026-09-07","notes":["\"03-2024\" is Cohere's own dated-snapshot naming for this model, not a confirmed price-effective date; effectiveFrom is set conservatively to 2026-01-01 per this repository's convention (a too-early effectiveFrom is safe; the price could have applied earlier than 2026 but was not independently confirmed).","FAQ/legacy-rates section pricing.","Re-confirmed unchanged on 2026-09-07 against the same page."]},
    ],
    source: {"url":"https://cohere.com/pricing","observedAt":"2026-09-07"},
  },
  {
    canonicalId: "command-r-plus-04-2024",
    provider: "cohere",
    aliases: [],
    family: "command-r-plus",
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"3.00","output":"15.00","sourceUrl":"https://cohere.com/pricing","observedAt":"2026-09-07","notes":["\"04-2024\" is Cohere's own dated-snapshot naming for this model, not a confirmed price-effective date; effectiveFrom is set conservatively to 2026-01-01.","FAQ/legacy-rates section pricing. Superseded in Cohere's catalogue by \"Command R+ 08-2024\" (below), a distinct dated snapshot with its own price — the two are not the same PricingPeriod for one model, they are two different canonicalIds, matching how Cohere itself lists them.","Re-confirmed unchanged on 2026-09-07 against the same page."]},
    ],
    source: {"url":"https://cohere.com/pricing","observedAt":"2026-09-07"},
  },
  {
    canonicalId: "command-r-plus-08-2024",
    provider: "cohere",
    aliases: [],
    family: "command-r-plus",
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"2.50","output":"10.00","sourceUrl":"https://cohere.com/pricing","observedAt":"2026-09-07","notes":["\"08-2024\" is Cohere's own dated-snapshot naming for this model, not a confirmed price-effective date; effectiveFrom is set conservatively to 2026-01-01.","FAQ/legacy-rates section pricing.","Re-confirmed unchanged on 2026-09-07 against the same page."]},
    ],
    source: {"url":"https://cohere.com/pricing","observedAt":"2026-09-07"},
  },
  {
    canonicalId: "gemini-2.5-flash",
    provider: "google",
    aliases: [],
    family: "gemini-2.5",
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"0.30","output":"2.50","cachedInput":"0.03","batchMultiplier":"0.5","sourceUrl":"https://ai.google.dev/gemini-api/docs/pricing","observedAt":"2026-09-07","notes":["Google's page does not state when this rate took effect; effectiveFrom is set conservatively to 2026-01-01.","Input and context-caching rates are the text/image/video rates. The page prices audio input separately ($1.00 input, $0.10 context caching); this schema has no per-modality dimension, so the audio rate is not recorded.","batchMultiplier of 0.5 was verified from this model's own Batch rows ($0.15 / $1.25), not from a blanket statement.","cachedInput is this model's own published context-caching rate. The page also charges a separate per-hour cache storage fee, which this per-token schema does not model."]},
    ],
    source: {"url":"https://ai.google.dev/gemini-api/docs/pricing","observedAt":"2026-09-07"},
  },
  {
    canonicalId: "gemini-2.5-flash-lite",
    provider: "google",
    aliases: [],
    family: "gemini-2.5",
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"0.10","output":"0.40","cachedInput":"0.01","batchMultiplier":"0.5","sourceUrl":"https://ai.google.dev/gemini-api/docs/pricing","observedAt":"2026-09-07","notes":["Google's page does not state when this rate took effect; effectiveFrom is set conservatively to 2026-01-01.","Input and context-caching rates are the text/image/video rates. The page prices audio input separately ($0.30 input, $0.03 context caching); this schema has no per-modality dimension, so the audio rate is not recorded.","batchMultiplier of 0.5 was verified from this model's own Batch rows ($0.05 / $0.20), not from a blanket statement.","cachedInput is this model's own published context-caching rate. The page also charges a separate per-hour cache storage fee, which this per-token schema does not model."]},
    ],
    source: {"url":"https://ai.google.dev/gemini-api/docs/pricing","observedAt":"2026-09-07"},
  },
  {
    canonicalId: "gemini-2.5-pro",
    provider: "google",
    aliases: [],
    family: "gemini-2.5",
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"1.25","output":"10.00","cachedInput":"0.125","batchMultiplier":"0.5","cheapestTier":true,"sourceUrl":"https://ai.google.dev/gemini-api/docs/pricing","observedAt":"2026-09-07","notes":["Google's page does not state when this rate took effect; effectiveFrom is set conservatively to 2026-01-01.","The page prices prompts >200k tokens higher ($2.50 input / $15.00 output / $0.25 context caching); only the <=200k tier is recorded, since this schema has no context-length dimension.","batchMultiplier of 0.5 was verified from this model's own Batch rows ($0.625 / $5.00), not from a blanket statement.","cachedInput is this model's own published context-caching rate. The page also charges a separate per-hour cache storage fee, which this per-token schema does not model.","batchMultiplier and cachedInput added on 2026-09-07: the page now publishes this model's own Batch and context-caching rows, which were not confirmed per-model on 2026-08-05."]},
    ],
    source: {"url":"https://ai.google.dev/gemini-api/docs/pricing","observedAt":"2026-09-07"},
  },
  {
    canonicalId: "gemini-3.1-flash-lite",
    provider: "google",
    aliases: [],
    family: "gemini-3.1",
    pricing: [
      {"effectiveFrom":"2026-09-07","currency":"USD","unit":"per-million-tokens","input":"0.25","output":"1.50","cachedInput":"0.025","batchMultiplier":"0.5","sourceUrl":"https://ai.google.dev/gemini-api/docs/pricing","observedAt":"2026-09-07","notes":["New model: absent from the pricing page on 2026-08-05, present on 2026-09-07. effectiveFrom is the observation date rather than a backdated guess.","Input and context-caching rates are the text/image/video rates. The page prices audio input separately ($0.50 input, $0.05 context caching); this schema has no per-modality dimension, so the audio rate is not recorded.","batchMultiplier of 0.5 was verified from this model's own Batch rows ($0.125 / $0.75), not from a blanket statement.","cachedInput is this model's own published context-caching rate. The page also charges a separate per-hour cache storage fee, which this per-token schema does not model."]},
    ],
    source: {"url":"https://ai.google.dev/gemini-api/docs/pricing","observedAt":"2026-09-07"},
  },
  {
    canonicalId: "gemini-3.1-pro-preview",
    provider: "google",
    aliases: [],
    family: "gemini-3.1",
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"2.00","output":"12.00","cachedInput":"0.20","batchMultiplier":"0.5","cheapestTier":true,"sourceUrl":"https://ai.google.dev/gemini-api/docs/pricing","observedAt":"2026-09-07","notes":["Google's page does not state when this rate took effect; effectiveFrom is set conservatively to 2026-01-01.","The page prices prompts >200k tokens higher ($4.00 input / $18.00 output / $0.40 context caching); only the <=200k tier is recorded, since this schema has no context-length dimension.","batchMultiplier of 0.5 was verified from this model's own Batch rows ($1.00 / $6.00), not from a blanket statement.","cachedInput is this model's own published context-caching rate. The page also charges a separate per-hour cache storage fee, which this per-token schema does not model.","batchMultiplier and cachedInput added on 2026-09-07: the page now publishes this model's own Batch and context-caching rows, which were not confirmed per-model on 2026-08-05."]},
    ],
    source: {"url":"https://ai.google.dev/gemini-api/docs/pricing","observedAt":"2026-09-07"},
  },
  {
    canonicalId: "gemini-3.5-flash",
    provider: "google",
    aliases: [],
    family: "gemini-3.5",
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"1.50","output":"9.00","cachedInput":"0.15","batchMultiplier":"0.5","sourceUrl":"https://ai.google.dev/gemini-api/docs/pricing","observedAt":"2026-09-07","notes":["Google's page does not state when this rate took effect; effectiveFrom is set conservatively to 2026-01-01.","batchMultiplier of 0.5 was verified from this model's own Batch rows ($0.75 / $4.50), not from a blanket statement.","cachedInput is this model's own published context-caching rate. The page also charges a separate per-hour cache storage fee, which this per-token schema does not model.","cachedInput added on 2026-09-07: the page now publishes a per-model context-caching rate, which it did not on 2026-08-05."]},
    ],
    source: {"url":"https://ai.google.dev/gemini-api/docs/pricing","observedAt":"2026-09-07"},
  },
  {
    canonicalId: "gemini-3.5-flash-lite",
    provider: "google",
    aliases: [],
    family: "gemini-3.5",
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"0.30","output":"2.50","batchMultiplier":"0.5","sourceUrl":"https://ai.google.dev/gemini-api/docs/pricing","observedAt":"2026-09-07","notes":["Google's page does not state when this rate took effect; effectiveFrom is set conservatively to 2026-01-01.","batchMultiplier of 0.5 was verified from this model's own Batch rows ($0.15 / $1.25), not from a blanket statement.","No context-caching rate is published for this model; cachedInput is omitted rather than inferred from a sibling model."]},
    ],
    source: {"url":"https://ai.google.dev/gemini-api/docs/pricing","observedAt":"2026-09-07"},
  },
  {
    canonicalId: "gemini-3.6-flash",
    provider: "google",
    aliases: [],
    family: "gemini-3.6",
    pricing: [
      {"effectiveFrom":"2026-01-01","effectiveTo":"2026-09-07","currency":"USD","unit":"per-million-tokens","input":"1.50","output":"7.50","batchMultiplier":"0.5","sourceUrl":"https://ai.google.dev/gemini-api/docs/pricing","observedAt":"2026-09-07","notes":["Supersedes the single $1.50 / $7.50 period recorded on 2026-08-05. That rate was live then and is scheduled to return on 2027-01-01, so it is kept as a closed historical period rather than deleted.","Recorded 2026-08-05 at $1.50 / $7.50 with no cachedInput; the page did not then publish a per-model context-caching rate. Closed at the 2026-09-07 observation date, the last date the promotional rate is known not to have applied being 2026-08-05.","Google's page does not state when this rate took effect; effectiveFrom is set conservatively to 2026-01-01."]},
      {"effectiveFrom":"2026-09-07","effectiveTo":"2027-01-01","currency":"USD","unit":"per-million-tokens","input":"0.75","output":"3.75","cachedInput":"0.075","batchMultiplier":"0.5","sourceUrl":"https://ai.google.dev/gemini-api/docs/pricing","observedAt":"2026-09-07","notes":["Promotional rate published as running through 2026-12-31, with the standard rate resuming 2027-01-01 - both dates are stated on the page, so this period's effectiveTo and the next period's effectiveFrom are sourced, not conservative placeholders.","batchMultiplier of 0.5 was verified from this model's own Batch rows ($0.375 / $1.875 promo, $0.75 / $3.75 standard), not from a blanket statement.","cachedInput is this model's own published context-caching rate. The page also charges a separate per-hour cache storage fee, which this per-token schema does not model."]},
      {"effectiveFrom":"2027-01-01","currency":"USD","unit":"per-million-tokens","input":"1.50","output":"7.50","cachedInput":"0.15","batchMultiplier":"0.5","sourceUrl":"https://ai.google.dev/gemini-api/docs/pricing","observedAt":"2026-09-07","notes":["Standard rate resuming 2027-01-01, the date the page publishes for the end of the promotional rate.","batchMultiplier of 0.5 was verified from this model's own Batch rows ($0.375 / $1.875 promo, $0.75 / $3.75 standard), not from a blanket statement.","cachedInput is this model's own published context-caching rate. The page also charges a separate per-hour cache storage fee, which this per-token schema does not model."]},
    ],
    source: {"url":"https://ai.google.dev/gemini-api/docs/pricing","observedAt":"2026-09-07","notes":["Three periods: the $1.50/$7.50 rate observed 2026-08-05, the $0.75/$3.75 promotional rate observed 2026-09-07 and published as running through 2026-12-31, then the standard rate resuming 2027-01-01."]},
  },
  {
    canonicalId: "gemini-3.7-flash",
    provider: "google",
    aliases: [],
    family: "gemini-3.7",
    pricing: [
      {"effectiveFrom":"2026-09-07","effectiveTo":"2027-01-01","currency":"USD","unit":"per-million-tokens","input":"0.75","output":"3.75","cachedInput":"0.075","batchMultiplier":"0.5","sourceUrl":"https://ai.google.dev/gemini-api/docs/pricing","observedAt":"2026-09-07","notes":["New model: absent from the pricing page on 2026-08-05, present on 2026-09-07. effectiveFrom is the observation date rather than a backdated guess.","Promotional rate published as running through 2026-12-31, with the standard rate resuming 2027-01-01 - both dates are stated on the page, so this period's effectiveTo and the next period's effectiveFrom are sourced, not conservative placeholders.","batchMultiplier of 0.5 was verified from this model's own Batch rows ($0.375 / $1.875 promo, $0.75 / $3.75 standard), not from a blanket statement.","cachedInput is this model's own published context-caching rate. The page also charges a separate per-hour cache storage fee, which this per-token schema does not model."]},
      {"effectiveFrom":"2027-01-01","currency":"USD","unit":"per-million-tokens","input":"1.50","output":"7.50","cachedInput":"0.15","batchMultiplier":"0.5","sourceUrl":"https://ai.google.dev/gemini-api/docs/pricing","observedAt":"2026-09-07","notes":["Standard rate resuming 2027-01-01, the date the page publishes for the end of the promotional rate.","batchMultiplier of 0.5 was verified from this model's own Batch rows ($0.375 / $1.875 promo, $0.75 / $3.75 standard), not from a blanket statement.","cachedInput is this model's own published context-caching rate. The page also charges a separate per-hour cache storage fee, which this per-token schema does not model."]},
    ],
    source: {"url":"https://ai.google.dev/gemini-api/docs/pricing","observedAt":"2026-09-07"},
  },
  {
    canonicalId: "gemini-3.8-flash",
    provider: "google",
    aliases: [],
    family: "gemini-3.8",
    pricing: [
      {"effectiveFrom":"2026-09-07","effectiveTo":"2027-01-01","currency":"USD","unit":"per-million-tokens","input":"0.75","output":"3.75","cachedInput":"0.075","batchMultiplier":"0.5","sourceUrl":"https://ai.google.dev/gemini-api/docs/pricing","observedAt":"2026-09-07","notes":["New model: absent from the pricing page on 2026-08-05, present on 2026-09-07. effectiveFrom is the observation date rather than a backdated guess.","Promotional rate published as running through 2026-12-31, with the standard rate resuming 2027-01-01 - both dates are stated on the page, so this period's effectiveTo and the next period's effectiveFrom are sourced, not conservative placeholders.","batchMultiplier of 0.5 was verified from this model's own Batch rows ($0.375 / $1.875 promo, $0.75 / $3.75 standard), not from a blanket statement.","cachedInput is this model's own published context-caching rate. The page also charges a separate per-hour cache storage fee, which this per-token schema does not model."]},
      {"effectiveFrom":"2027-01-01","currency":"USD","unit":"per-million-tokens","input":"1.50","output":"7.50","cachedInput":"0.15","batchMultiplier":"0.5","sourceUrl":"https://ai.google.dev/gemini-api/docs/pricing","observedAt":"2026-09-07","notes":["Standard rate resuming 2027-01-01, the date the page publishes for the end of the promotional rate.","batchMultiplier of 0.5 was verified from this model's own Batch rows ($0.375 / $1.875 promo, $0.75 / $3.75 standard), not from a blanket statement.","cachedInput is this model's own published context-caching rate. The page also charges a separate per-hour cache storage fee, which this per-token schema does not model."]},
    ],
    source: {"url":"https://ai.google.dev/gemini-api/docs/pricing","observedAt":"2026-09-07"},
  },
  {
    canonicalId: "gpt-oss-120b",
    provider: "groq",
    aliases: [],
    family: "gpt-oss",
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"0.15","output":"0.60","sourceUrl":"https://console.groq.com/docs/models","observedAt":"2026-09-07","notes":["Groq's docs page does not publish an effective date for this rate; effectiveFrom is set conservatively to 2026-01-01.","No prompt-caching or Batch API discount is documented for Groq in the fetched page.","OpenAI's open-weight gpt-oss-120b model, hosted independently by Groq under Groq's own rate card (also hosted by Together AI, at the same $0.15/$0.60 rate as observed — coincidental agreement, not assumed parity).","Re-confirmed unchanged on 2026-09-07 against the same page."]},
    ],
    source: {"url":"https://console.groq.com/docs/models","observedAt":"2026-09-07"},
  },
  {
    canonicalId: "gpt-oss-20b",
    provider: "groq",
    aliases: [],
    family: "gpt-oss",
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"0.075","output":"0.30","sourceUrl":"https://console.groq.com/docs/models","observedAt":"2026-09-07","notes":["Groq's docs page does not publish an effective date for this rate; effectiveFrom is set conservatively to 2026-01-01.","No prompt-caching or Batch API discount is documented for Groq in the fetched page.","Also hosted by Together AI at a different rate ($0.05/$0.20 as observed) — each host prices it independently; do not assume parity.","Re-confirmed unchanged on 2026-09-07 against the same page."]},
    ],
    source: {"url":"https://console.groq.com/docs/models","observedAt":"2026-09-07"},
  },
  {
    canonicalId: "llama-3.1-8b-instant",
    provider: "groq",
    aliases: ["llama-3.1-8b"],
    family: "llama-3.1",
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"0.05","output":"0.08","sourceUrl":"https://console.groq.com/docs/models","observedAt":"2026-08-05","notes":["Groq's docs page does not publish an effective date for this rate; effectiveFrom is set conservatively to 2026-01-01.","No prompt-caching or Batch API discount is documented for Groq in the fetched page, so cachedInput and batchMultiplier are omitted rather than assumed.","Not surfaced by the 2026-09-07 fetch of the same page, which listed only the gpt-oss and Qwen models with per-token prices. observedAt is deliberately left at 2026-08-05: the rate was not re-observed, and an absence in one page fetch is not evidence of a withdrawal. Re-check before relying on this entry."]},
    ],
    source: {"url":"https://console.groq.com/docs/models","observedAt":"2026-08-05"},
  },
  {
    canonicalId: "llama-3.3-70b-versatile",
    provider: "groq",
    aliases: ["llama-3.3-70b"],
    family: "llama-3.3",
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"0.59","output":"0.79","sourceUrl":"https://console.groq.com/docs/models","observedAt":"2026-08-05","notes":["Groq's docs page does not publish an effective date for this rate; effectiveFrom is set conservatively to 2026-01-01.","No prompt-caching or Batch API discount is documented for Groq in the fetched page, so cachedInput and batchMultiplier are omitted rather than assumed.","This is Groq's own hosted rate for the same open-weight model Together AI also hosts (see together.json's llama-3.3-70b at a different, higher price) and AWS Bedrock resells — each host prices it independently; do not assume parity.","Not surfaced by the 2026-09-07 fetch of the same page, which listed only the gpt-oss and Qwen models with per-token prices. observedAt is deliberately left at 2026-08-05: the rate was not re-observed, and an absence in one page fetch is not evidence of a withdrawal. Re-check before relying on this entry."]},
    ],
    source: {"url":"https://console.groq.com/docs/models","observedAt":"2026-08-05"},
  },
  {
    canonicalId: "qwen3.6-27b",
    provider: "groq",
    aliases: [],
    family: "qwen",
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"0.60","output":"3.00","sourceUrl":"https://console.groq.com/docs/models","observedAt":"2026-09-07","notes":["Listed under Groq's \"Preview\" models section, not \"Production\" — preview models on Groq are explicitly subject to change or removal without notice. Included because a real price was published, but treat this one as less stable than the production-tier entries in this file.","Groq's docs page does not publish an effective date for this rate; effectiveFrom is set conservatively to 2026-01-01.","Re-confirmed unchanged on 2026-09-07 against the same page."]},
    ],
    source: {"url":"https://console.groq.com/docs/models","observedAt":"2026-09-07"},
  },
  {
    canonicalId: "qwen3.8-27b",
    provider: "groq",
    aliases: ["qwen/qwen3.8-27b"],
    family: "qwen3.8",
    pricing: [
      {"effectiveFrom":"2026-09-07","currency":"USD","unit":"per-million-tokens","input":"0.80","output":"4.00","sourceUrl":"https://console.groq.com/docs/models","observedAt":"2026-09-07","notes":["New model: absent from this page on 2026-08-05, present on 2026-09-07. effectiveFrom is the observation date rather than this file's conservative 2026-01-01, since the earlier fetch proves it was not listed then.","Marked Preview on Groq's page - less stable than a Production model, and its price may move accordingly.","No cached-input rate and no batch discount are published for Groq models; both fields are omitted rather than guessed."]},
    ],
    source: {"url":"https://console.groq.com/docs/models","observedAt":"2026-09-07"},
  },
  {
    canonicalId: "codestral",
    provider: "mistral",
    aliases: ["codestral-latest"],
    family: "codestral",
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"0.30","output":"0.90","sourceUrl":"https://mistral.ai/pricing/api","observedAt":"2026-09-07","notes":["Mistral's pricing page does not publish an effective date for this rate; effectiveFrom is set conservatively to 2026-01-01.","Re-confirmed unchanged on 2026-09-07 against the same page, which prints the API id as 'codestral-latest' (recorded as an alias)."]},
    ],
    source: {"url":"https://mistral.ai/pricing/api","observedAt":"2026-09-07"},
  },
  {
    canonicalId: "devstral-2",
    provider: "mistral",
    aliases: [],
    family: "devstral",
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"0.40","output":"2.00","sourceUrl":"https://mistral.ai/pricing/api","observedAt":"2026-08-05","notes":["Mistral's pricing page does not publish an effective date for this rate; effectiveFrom is set conservatively to 2026-01-01.","Not surfaced by the 2026-09-07 fetch of the same page, which listed only the Medium/Small/Large, Ministral, Codestral, embedding and third-party GLM entries. observedAt is deliberately left at 2026-08-05: the rate was not re-observed, and an absence in one page fetch is not evidence of a withdrawal. Re-check before relying on this entry."]},
    ],
    source: {"url":"https://mistral.ai/pricing/api","observedAt":"2026-08-05"},
  },
  {
    canonicalId: "devstral-small-2",
    provider: "mistral",
    aliases: [],
    family: "devstral",
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"0.10","output":"0.30","sourceUrl":"https://mistral.ai/pricing/api","observedAt":"2026-08-05","notes":["Mistral's pricing page does not publish an effective date for this rate; effectiveFrom is set conservatively to 2026-01-01.","Not surfaced by the 2026-09-07 fetch of the same page, which listed only the Medium/Small/Large, Ministral, Codestral, embedding and third-party GLM entries. observedAt is deliberately left at 2026-08-05: the rate was not re-observed, and an absence in one page fetch is not evidence of a withdrawal. Re-check before relying on this entry."]},
    ],
    source: {"url":"https://mistral.ai/pricing/api","observedAt":"2026-08-05"},
  },
  {
    canonicalId: "magistral-medium",
    provider: "mistral",
    aliases: [],
    family: "magistral",
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"2.00","output":"5.00","sourceUrl":"https://mistral.ai/pricing/api","observedAt":"2026-08-05","notes":["Mistral's pricing page does not publish an effective date for this rate; effectiveFrom is set conservatively to 2026-01-01.","Listed as a reasoning model on the pricing page; no separate \"reasoning\" surcharge is published, so the reasoning field is omitted.","Not surfaced by the 2026-09-07 fetch of the same page, which listed only the Medium/Small/Large, Ministral, Codestral, embedding and third-party GLM entries. observedAt is deliberately left at 2026-08-05: the rate was not re-observed, and an absence in one page fetch is not evidence of a withdrawal. Re-check before relying on this entry."]},
    ],
    source: {"url":"https://mistral.ai/pricing/api","observedAt":"2026-08-05"},
  },
  {
    canonicalId: "magistral-small",
    provider: "mistral",
    aliases: [],
    family: "magistral",
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"0.50","output":"1.50","sourceUrl":"https://mistral.ai/pricing/api","observedAt":"2026-08-05","notes":["Mistral's pricing page does not publish an effective date for this rate; effectiveFrom is set conservatively to 2026-01-01.","Not surfaced by the 2026-09-07 fetch of the same page, which listed only the Medium/Small/Large, Ministral, Codestral, embedding and third-party GLM entries. observedAt is deliberately left at 2026-08-05: the rate was not re-observed, and an absence in one page fetch is not evidence of a withdrawal. Re-check before relying on this entry."]},
    ],
    source: {"url":"https://mistral.ai/pricing/api","observedAt":"2026-08-05"},
  },
  {
    canonicalId: "ministral-3-14b",
    provider: "mistral",
    aliases: ["ministral-14b-latest"],
    family: "ministral-3",
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"0.20","output":"0.20","sourceUrl":"https://mistral.ai/pricing/api","observedAt":"2026-09-07","notes":["Mistral's pricing page does not publish an effective date for this rate; effectiveFrom is set conservatively to 2026-01-01.","AWS Bedrock resells a \"Ministral 14B 3.0\" at the same $0.20/$0.20 figure as independently observed on Bedrock's pricing page — likely the same model, coincidental agreement not assumed; Bedrock's variant was not added to aws-bedrock.json in this pass since the version suffix (\"3.0\") was not cross-checked against this \"ministral-3-14b\" naming.","Re-confirmed unchanged on 2026-09-07 against the same page, which prints the API id as 'ministral-14b-latest' (recorded as an alias)."]},
    ],
    source: {"url":"https://mistral.ai/pricing/api","observedAt":"2026-09-07"},
  },
  {
    canonicalId: "ministral-3-3b",
    provider: "mistral",
    aliases: ["ministral-3b-latest"],
    family: "ministral-3",
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"0.10","output":"0.10","sourceUrl":"https://mistral.ai/pricing/api","observedAt":"2026-09-07","notes":["Mistral's pricing page does not publish an effective date for this rate; effectiveFrom is set conservatively to 2026-01-01.","Re-confirmed unchanged on 2026-09-07 against the same page, which prints the API id as 'ministral-3b-latest' (recorded as an alias)."]},
    ],
    source: {"url":"https://mistral.ai/pricing/api","observedAt":"2026-09-07"},
  },
  {
    canonicalId: "ministral-3-8b",
    provider: "mistral",
    aliases: ["ministral-8b-latest"],
    family: "ministral-3",
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"0.15","output":"0.15","sourceUrl":"https://mistral.ai/pricing/api","observedAt":"2026-09-07","notes":["Mistral's pricing page does not publish an effective date for this rate; effectiveFrom is set conservatively to 2026-01-01.","Re-confirmed unchanged on 2026-09-07 against the same page, which prints the API id as 'ministral-8b-latest' (recorded as an alias)."]},
    ],
    source: {"url":"https://mistral.ai/pricing/api","observedAt":"2026-09-07"},
  },
  {
    canonicalId: "mistral-large-3",
    provider: "mistral",
    aliases: ["mistral-large-latest"],
    family: "mistral-large",
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"0.50","output":"1.50","cachedInput":"0.05","batchMultiplier":"0.5","sourceUrl":"https://mistral.ai/pricing/api","observedAt":"2026-09-07","notes":["Mistral's pricing page does not publish an effective date for this rate; effectiveFrom is set conservatively to 2026-01-01.","This is Mistral's own first-party rate. AWS Bedrock also resells \"Mistral Large 3\" under its own rate card at the same $0.50/$1.50 figure as independently observed on Bedrock's pricing page — coincidental agreement between the two sources, not assumed; see aws-bedrock.json.","Re-confirmed unchanged on 2026-09-07 against the same page, which prints the API id as 'mistral-large-latest' (recorded as an alias).","cachedInput and batchMultiplier added on 2026-09-07: the page publishes \"Cached input: 90% discount\" and \"Batch: 50% discount\" for this model, so cachedInput is 0.1x this model's own input rate (0.50 -> 0.05), computed as an exact decimal, and batchMultiplier is 0.5. Both come from this model's own row, not from a sibling's rate."]},
    ],
    source: {"url":"https://mistral.ai/pricing/api","observedAt":"2026-09-07"},
  },
  {
    canonicalId: "mistral-medium-3.5",
    provider: "mistral",
    aliases: ["mistral-medium-latest"],
    family: "mistral-medium",
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"1.50","output":"7.50","cachedInput":"0.15","batchMultiplier":"0.5","sourceUrl":"https://mistral.ai/pricing/api","observedAt":"2026-09-07","notes":["Mistral's pricing page does not publish an effective date for this rate; effectiveFrom is set conservatively to 2026-01-01.","No cachedInput or batchMultiplier is documented on the fetched page for this model; omitted rather than assumed.","Re-confirmed unchanged on 2026-09-07 against the same page, which prints the API id as 'mistral-medium-latest' (recorded as an alias).","cachedInput and batchMultiplier added on 2026-09-07: the page publishes \"Cached input: 90% discount\" and \"Batch: 50% discount\" for this model, so cachedInput is 0.1x this model's own input rate (1.50 -> 0.15), computed as an exact decimal, and batchMultiplier is 0.5. Both come from this model's own row, not from a sibling's rate."]},
    ],
    source: {"url":"https://mistral.ai/pricing/api","observedAt":"2026-09-07"},
  },
  {
    canonicalId: "mistral-nemo",
    provider: "mistral",
    aliases: [],
    family: "mistral-nemo",
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"0.15","output":"0.15","sourceUrl":"https://mistral.ai/pricing/api","observedAt":"2026-08-05","notes":["Mistral's pricing page does not publish an effective date for this rate; effectiveFrom is set conservatively to 2026-01-01.","An older model generation still listed with a live price on the current pricing page as fetched; included because it is confidently sourced, not because it is a current flagship.","Not surfaced by the 2026-09-07 fetch of the same page, which listed only the Medium/Small/Large, Ministral, Codestral, embedding and third-party GLM entries. observedAt is deliberately left at 2026-08-05: the rate was not re-observed, and an absence in one page fetch is not evidence of a withdrawal. Re-check before relying on this entry."]},
    ],
    source: {"url":"https://mistral.ai/pricing/api","observedAt":"2026-08-05"},
  },
  {
    canonicalId: "mistral-small-4",
    provider: "mistral",
    aliases: ["mistral-small-latest"],
    family: "mistral-small",
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"0.15","output":"0.60","cachedInput":"0.015","batchMultiplier":"0.5","sourceUrl":"https://mistral.ai/pricing/api","observedAt":"2026-09-07","notes":["Mistral's pricing page does not publish an effective date for this rate; effectiveFrom is set conservatively to 2026-01-01.","Re-confirmed unchanged on 2026-09-07 against the same page, which prints the API id as 'mistral-small-latest' (recorded as an alias).","cachedInput and batchMultiplier added on 2026-09-07: the page publishes \"Cached input: 90% discount\" and \"Batch: 50% discount\" for this model, so cachedInput is 0.1x this model's own input rate (0.15 -> 0.015), computed as an exact decimal, and batchMultiplier is 0.5. Both come from this model's own row, not from a sibling's rate."]},
    ],
    source: {"url":"https://mistral.ai/pricing/api","observedAt":"2026-09-07"},
  },
  {
    canonicalId: "mixtral-8x22b",
    provider: "mistral",
    aliases: [],
    family: "mixtral",
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"2.00","output":"6.00","sourceUrl":"https://mistral.ai/pricing/api","observedAt":"2026-08-05","notes":["Mistral's pricing page does not publish an effective date for this rate; effectiveFrom is set conservatively to 2026-01-01.","An older model generation still listed with a live price on the current pricing page as fetched.","Not surfaced by the 2026-09-07 fetch of the same page, which listed only the Medium/Small/Large, Ministral, Codestral, embedding and third-party GLM entries. observedAt is deliberately left at 2026-08-05: the rate was not re-observed, and an absence in one page fetch is not evidence of a withdrawal. Re-check before relying on this entry."]},
    ],
    source: {"url":"https://mistral.ai/pricing/api","observedAt":"2026-08-05"},
  },
  {
    canonicalId: "mixtral-8x7b",
    provider: "mistral",
    aliases: [],
    family: "mixtral",
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"0.70","output":"0.70","sourceUrl":"https://mistral.ai/pricing/api","observedAt":"2026-08-05","notes":["Mistral's pricing page does not publish an effective date for this rate; effectiveFrom is set conservatively to 2026-01-01.","An older model generation still listed with a live price on the current pricing page as fetched.","Not surfaced by the 2026-09-07 fetch of the same page, which listed only the Medium/Small/Large, Ministral, Codestral, embedding and third-party GLM entries. observedAt is deliberately left at 2026-08-05: the rate was not re-observed, and an absence in one page fetch is not evidence of a withdrawal. Re-check before relying on this entry."]},
    ],
    source: {"url":"https://mistral.ai/pricing/api","observedAt":"2026-08-05"},
  },
  {
    canonicalId: "zai-glm-5-2",
    provider: "mistral",
    aliases: [],
    family: "glm",
    pricing: [
      {"effectiveFrom":"2026-09-07","currency":"USD","unit":"per-million-tokens","input":"1.40","output":"4.40","cachedInput":"0.14","sourceUrl":"https://mistral.ai/pricing/api","observedAt":"2026-09-07","notes":["New entry: absent from this page on 2026-08-05, present on 2026-09-07. effectiveFrom is the observation date rather than this file's conservative 2026-01-01.","Listed under \"Third-Party Models\" on Mistral's own pricing page - a Z.ai GLM model resold through La Plateforme, so this is Mistral's resale rate, not Z.ai's first-party rate.","All three rates are printed per-model on the page. No batch discount is stated for the third-party section, so batchMultiplier is omitted rather than assumed from the first-party models' 50%."]},
    ],
    source: {"url":"https://mistral.ai/pricing/api","observedAt":"2026-09-07"},
  },
  {
    canonicalId: "gpt-3.5-turbo",
    provider: "openai",
    aliases: [],
    family: "gpt-3.5",
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"0.50","output":"1.50","batchMultiplier":"0.5","sourceUrl":"https://developers.openai.com/api/docs/pricing","observedAt":"2026-09-07","notes":["Found on https://developers.openai.com/api/docs/pricing during a second confirmation pass.","No cached-input rate is published for gpt-3.5-turbo on the current pricing page; cachedInput is intentionally omitted rather than guessed.","OpenAI's pricing page does not publish an effective date for this rate; effectiveFrom is set conservatively to 2026-01-01 pending confirmation of the true rollout date.","batchMultiplier is \"0.5\" per the pricing page's Batch API section, which states the 50% saving \"applies to all text models listed above in the Standard table\" - an explicit all-model statement, so the pro tiers are covered too."]},
    ],
    source: {"url":"https://developers.openai.com/api/docs/pricing","observedAt":"2026-09-07"},
  },
  {
    canonicalId: "gpt-4.1",
    provider: "openai",
    aliases: [],
    family: "gpt-4.1",
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"2.00","output":"8.00","cachedInput":"0.50","batchMultiplier":"0.5","sourceUrl":"https://developers.openai.com/api/docs/pricing","observedAt":"2026-09-07","notes":["OpenAI's pricing page does not publish an effective date for this rate; effectiveFrom is set conservatively to 2026-01-01 pending confirmation of the true rollout date.","batchMultiplier reflects OpenAI's general Batch API policy as stated on the pricing page; not independently confirmed per-model."]},
    ],
    source: {"url":"https://developers.openai.com/api/docs/pricing","observedAt":"2026-09-07"},
  },
  {
    canonicalId: "gpt-4.1-mini",
    provider: "openai",
    aliases: [],
    family: "gpt-4.1",
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"0.40","output":"1.60","cachedInput":"0.10","batchMultiplier":"0.5","sourceUrl":"https://developers.openai.com/api/docs/pricing","observedAt":"2026-09-07","notes":["OpenAI's pricing page does not publish an effective date for this rate; effectiveFrom is set conservatively to 2026-01-01 pending confirmation of the true rollout date.","batchMultiplier reflects OpenAI's general Batch API policy as stated on the pricing page; not independently confirmed per-model."]},
    ],
    source: {"url":"https://developers.openai.com/api/docs/pricing","observedAt":"2026-09-07"},
  },
  {
    canonicalId: "gpt-4.1-nano",
    provider: "openai",
    aliases: [],
    family: "gpt-4.1",
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"0.10","output":"0.40","cachedInput":"0.025","batchMultiplier":"0.5","sourceUrl":"https://developers.openai.com/api/docs/pricing","observedAt":"2026-09-07","notes":["OpenAI's pricing page does not publish an effective date for this rate; effectiveFrom is set conservatively to 2026-01-01 pending confirmation of the true rollout date.","batchMultiplier reflects OpenAI's general Batch API policy as stated on the pricing page; not independently confirmed per-model."]},
    ],
    source: {"url":"https://developers.openai.com/api/docs/pricing","observedAt":"2026-09-07"},
  },
  {
    canonicalId: "gpt-4o",
    provider: "openai",
    aliases: [],
    family: "gpt-4o",
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"2.50","output":"10.00","cachedInput":"1.25","batchMultiplier":"0.5","sourceUrl":"https://developers.openai.com/api/docs/pricing","observedAt":"2026-09-07","notes":["OpenAI's pricing page does not publish an effective date for this rate; effectiveFrom is set conservatively to 2026-01-01 pending confirmation of the true rollout date.","batchMultiplier reflects OpenAI's general Batch API policy as stated on the pricing page; not independently confirmed per-model."]},
    ],
    source: {"url":"https://developers.openai.com/api/docs/pricing","observedAt":"2026-09-07"},
  },
  {
    canonicalId: "gpt-4o-mini",
    provider: "openai",
    aliases: [],
    family: "gpt-4o",
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"0.15","output":"0.60","cachedInput":"0.075","batchMultiplier":"0.5","sourceUrl":"https://developers.openai.com/api/docs/pricing","observedAt":"2026-09-07","notes":["OpenAI's pricing page does not publish an effective date for this rate; effectiveFrom is set conservatively to 2026-01-01 pending confirmation of the true rollout date.","batchMultiplier reflects OpenAI's general Batch API policy as stated on the pricing page; not independently confirmed per-model."]},
    ],
    source: {"url":"https://developers.openai.com/api/docs/pricing","observedAt":"2026-09-07"},
  },
  {
    canonicalId: "gpt-5",
    provider: "openai",
    aliases: [],
    family: "gpt-5",
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"1.25","output":"10.00","cachedInput":"0.125","batchMultiplier":"0.5","sourceUrl":"https://developers.openai.com/api/docs/pricing","observedAt":"2026-09-07","notes":["OpenAI's pricing page does not publish an effective date for this rate; effectiveFrom is set conservatively to 2026-01-01 pending confirmation of the true rollout date.","batchMultiplier reflects OpenAI's general Batch API policy as stated on the pricing page; not independently confirmed per-model.","Lead-supplied verified table (observed 2026-08-05) matches this rate exactly; independently re-confirmed against https://developers.openai.com/api/docs/pricing on the same date."]},
    ],
    source: {"url":"https://developers.openai.com/api/docs/pricing","observedAt":"2026-09-07"},
  },
  {
    canonicalId: "gpt-5-mini",
    provider: "openai",
    aliases: [],
    family: "gpt-5",
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"0.25","output":"2.00","cachedInput":"0.025","batchMultiplier":"0.5","sourceUrl":"https://developers.openai.com/api/docs/pricing","observedAt":"2026-09-07","notes":["OpenAI's pricing page does not publish an effective date for this rate; effectiveFrom is set conservatively to 2026-01-01 pending confirmation of the true rollout date.","batchMultiplier reflects OpenAI's general Batch API policy as stated on the pricing page; not independently confirmed per-model."]},
    ],
    source: {"url":"https://developers.openai.com/api/docs/pricing","observedAt":"2026-09-07"},
  },
  {
    canonicalId: "gpt-5-nano",
    provider: "openai",
    aliases: [],
    family: "gpt-5",
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"0.05","output":"0.40","cachedInput":"0.005","batchMultiplier":"0.5","sourceUrl":"https://developers.openai.com/api/docs/pricing","observedAt":"2026-09-07","notes":["OpenAI's pricing page does not publish an effective date for this rate; effectiveFrom is set conservatively to 2026-01-01 pending confirmation of the true rollout date.","batchMultiplier reflects OpenAI's general Batch API policy as stated on the pricing page; not independently confirmed per-model."]},
    ],
    source: {"url":"https://developers.openai.com/api/docs/pricing","observedAt":"2026-09-07"},
  },
  {
    canonicalId: "gpt-5-pro",
    provider: "openai",
    aliases: [],
    family: "gpt-5",
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"15.00","output":"120.00","batchMultiplier":"0.5","sourceUrl":"https://developers.openai.com/api/docs/pricing","observedAt":"2026-09-07","notes":["No cached-input rate is published for gpt-5-pro (shown as \"—\"); cachedInput is intentionally omitted rather than guessed.","OpenAI's pricing page does not publish an effective date for this rate; effectiveFrom is set conservatively to 2026-01-01 pending confirmation of the true rollout date.","batchMultiplier is \"0.5\" per the pricing page's Batch API section, which states the 50% saving \"applies to all text models listed above in the Standard table\" - an explicit all-model statement, so the pro tiers are covered too."]},
    ],
    source: {"url":"https://developers.openai.com/api/docs/pricing","observedAt":"2026-09-07"},
  },
  {
    canonicalId: "gpt-5.1",
    provider: "openai",
    aliases: [],
    family: "gpt-5.1",
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"1.25","output":"10.00","cachedInput":"0.125","batchMultiplier":"0.5","sourceUrl":"https://developers.openai.com/api/docs/pricing","observedAt":"2026-09-07","notes":["OpenAI's pricing page does not publish an effective date for this rate; effectiveFrom is set conservatively to 2026-01-01 pending confirmation of the true rollout date.","batchMultiplier reflects OpenAI's general Batch API policy as stated on the pricing page; not independently confirmed per-model."]},
    ],
    source: {"url":"https://developers.openai.com/api/docs/pricing","observedAt":"2026-09-07"},
  },
  {
    canonicalId: "gpt-5.2",
    provider: "openai",
    aliases: [],
    family: "gpt-5.2",
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"1.75","output":"14.00","cachedInput":"0.175","batchMultiplier":"0.5","sourceUrl":"https://developers.openai.com/api/docs/pricing","observedAt":"2026-09-07","notes":["OpenAI's pricing page does not publish an effective date for this rate; effectiveFrom is set conservatively to 2026-01-01 pending confirmation of the true rollout date.","batchMultiplier reflects OpenAI's general Batch API policy as stated on the pricing page; not independently confirmed per-model."]},
    ],
    source: {"url":"https://developers.openai.com/api/docs/pricing","observedAt":"2026-09-07"},
  },
  {
    canonicalId: "gpt-5.2-pro",
    provider: "openai",
    aliases: [],
    family: "gpt-5.2",
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"21.00","output":"168.00","batchMultiplier":"0.5","sourceUrl":"https://developers.openai.com/api/docs/pricing","observedAt":"2026-09-07","notes":["No cached-input rate is published for gpt-5.2-pro (shown as \"—\"); cachedInput is intentionally omitted rather than guessed.","OpenAI's pricing page does not publish an effective date for this rate; effectiveFrom is set conservatively to 2026-01-01 pending confirmation of the true rollout date.","batchMultiplier is \"0.5\" per the pricing page's Batch API section, which states the 50% saving \"applies to all text models listed above in the Standard table\" - an explicit all-model statement, so the pro tiers are covered too."]},
    ],
    source: {"url":"https://developers.openai.com/api/docs/pricing","observedAt":"2026-09-07"},
  },
  {
    canonicalId: "gpt-5.4",
    provider: "openai",
    aliases: [],
    family: "gpt-5.4",
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"2.50","output":"15.00","cachedInput":"0.25","batchMultiplier":"0.5","sourceUrl":"https://developers.openai.com/api/docs/pricing","observedAt":"2026-09-07","notes":["OpenAI's pricing page does not publish an effective date for this rate; effectiveFrom is set conservatively to 2026-01-01 pending confirmation of the true rollout date.","batchMultiplier reflects OpenAI's general Batch API policy as stated on the pricing page; not independently confirmed per-model.","The pricing page qualifies this rate as the \"<272K\" context tier. A higher tier above 272K tokens is implied by that label but no rate for it was published in the fetched table, and this schema has no context-length dimension, so only the <272K rate is recorded."]},
    ],
    source: {"url":"https://developers.openai.com/api/docs/pricing","observedAt":"2026-09-07"},
  },
  {
    canonicalId: "gpt-5.4-mini",
    provider: "openai",
    aliases: [],
    family: "gpt-5.4",
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"0.75","output":"4.50","cachedInput":"0.075","batchMultiplier":"0.5","sourceUrl":"https://developers.openai.com/api/docs/pricing","observedAt":"2026-09-07","notes":["OpenAI's pricing page does not publish an effective date for this rate; effectiveFrom is set conservatively to 2026-01-01 pending confirmation of the true rollout date.","batchMultiplier reflects OpenAI's general Batch API policy as stated on the pricing page; not independently confirmed per-model."]},
    ],
    source: {"url":"https://developers.openai.com/api/docs/pricing","observedAt":"2026-09-07"},
  },
  {
    canonicalId: "gpt-5.4-nano",
    provider: "openai",
    aliases: [],
    family: "gpt-5.4",
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"0.20","output":"1.25","cachedInput":"0.02","batchMultiplier":"0.5","sourceUrl":"https://developers.openai.com/api/docs/pricing","observedAt":"2026-09-07","notes":["OpenAI's pricing page does not publish an effective date for this rate; effectiveFrom is set conservatively to 2026-01-01 pending confirmation of the true rollout date.","batchMultiplier reflects OpenAI's general Batch API policy as stated on the pricing page; not independently confirmed per-model."]},
    ],
    source: {"url":"https://developers.openai.com/api/docs/pricing","observedAt":"2026-09-07"},
  },
  {
    canonicalId: "gpt-5.4-pro",
    provider: "openai",
    aliases: [],
    family: "gpt-5.4",
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"30.00","output":"180.00","batchMultiplier":"0.5","sourceUrl":"https://developers.openai.com/api/docs/pricing","observedAt":"2026-09-07","notes":["No cached-input rate is published for gpt-5.4-pro (shown as \"—\"); cachedInput is intentionally omitted rather than guessed.","OpenAI's pricing page does not publish an effective date for this rate; effectiveFrom is set conservatively to 2026-01-01 pending confirmation of the true rollout date.","batchMultiplier is \"0.5\" per the pricing page's Batch API section, which states the 50% saving \"applies to all text models listed above in the Standard table\" - an explicit all-model statement, so the pro tiers are covered too.","The pricing page qualifies this rate as the \"<272K\" context tier. A higher tier above 272K tokens is implied by that label but no rate for it was published in the fetched table, and this schema has no context-length dimension, so only the <272K rate is recorded."]},
    ],
    source: {"url":"https://developers.openai.com/api/docs/pricing","observedAt":"2026-09-07"},
  },
  {
    canonicalId: "gpt-5.5",
    provider: "openai",
    aliases: [],
    family: "gpt-5.5",
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"5.00","output":"30.00","cachedInput":"0.50","batchMultiplier":"0.5","sourceUrl":"https://developers.openai.com/api/docs/pricing","observedAt":"2026-09-07","notes":["OpenAI's pricing page does not publish an effective date for this rate; effectiveFrom is set conservatively to 2026-01-01 pending confirmation of the true rollout date.","batchMultiplier reflects OpenAI's general Batch API policy as stated on the pricing page; not independently confirmed per-model.","The pricing page qualifies this rate as the \"<272K\" context tier. A higher tier above 272K tokens is implied by that label but no rate for it was published in the fetched table, and this schema has no context-length dimension, so only the <272K rate is recorded."]},
    ],
    source: {"url":"https://developers.openai.com/api/docs/pricing","observedAt":"2026-09-07"},
  },
  {
    canonicalId: "gpt-5.5-pro",
    provider: "openai",
    aliases: [],
    family: "gpt-5.5",
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"30.00","output":"180.00","batchMultiplier":"0.5","sourceUrl":"https://developers.openai.com/api/docs/pricing","observedAt":"2026-09-07","notes":["No cached-input rate is published for gpt-5.5-pro (shown as \"—\" on the pricing page); cachedInput is intentionally omitted rather than guessed.","OpenAI's pricing page does not publish an effective date for this rate; effectiveFrom is set conservatively to 2026-01-01 pending confirmation of the true rollout date.","batchMultiplier is \"0.5\" per the pricing page's Batch API section, which states the 50% saving \"applies to all text models listed above in the Standard table\" - an explicit all-model statement, so the pro tiers are covered too.","The pricing page qualifies this rate as the \"<272K\" context tier. A higher tier above 272K tokens is implied by that label but no rate for it was published in the fetched table, and this schema has no context-length dimension, so only the <272K rate is recorded."]},
    ],
    source: {"url":"https://developers.openai.com/api/docs/pricing","observedAt":"2026-09-07"},
  },
  {
    canonicalId: "gpt-5.6-luna",
    provider: "openai",
    aliases: [],
    family: "gpt-5.6",
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"0.20","output":"1.20","cachedInput":"0.02","batchMultiplier":"0.5","sourceUrl":"https://developers.openai.com/api/docs/pricing","observedAt":"2026-09-07","notes":["OpenAI's pricing page does not publish an effective date for this rate; effectiveFrom is set conservatively to 2026-01-01 pending confirmation of the true rollout date.","batchMultiplier reflects OpenAI's general Batch API policy as stated on the pricing page; not independently confirmed per-model."]},
    ],
    source: {"url":"https://developers.openai.com/api/docs/pricing","observedAt":"2026-09-07"},
  },
  {
    canonicalId: "gpt-5.6-sol",
    provider: "openai",
    aliases: [],
    family: "gpt-5.6",
    pricing: [
      {"effectiveFrom":"2026-01-01","effectiveTo":"2026-09-07","currency":"USD","unit":"per-million-tokens","input":"5.00","output":"30.00","cachedInput":"0.50","batchMultiplier":"0.5","sourceUrl":"https://developers.openai.com/api/docs/pricing","observedAt":"2026-08-05","notes":["OpenAI's pricing page does not publish an effective date for this rate; effectiveFrom is set conservatively to 2026-01-01 pending confirmation of the true rollout date (this model's naming implies a later release, but a conservative too-early effectiveFrom only ever makes a historical lookup succeed when it should return \"no period found\", never the reverse).","batchMultiplier reflects OpenAI's general Batch API policy (\"a 50% discount to Standard pricing rates across all models\") as stated on the pricing page; not independently confirmed per-model.","Closed on 2026-09-07: the pricing page published a lower rate (4.00 input / 20.00 output) on that date. The old rate was last confirmed 2026-08-05, so the true change date lies in (2026-08-05, 2026-09-07]; effectiveTo is the observation date, which keeps every confirmed observation correct and approximates only the unobserved gap, toward the last confirmed value."]},
      {"effectiveFrom":"2026-09-07","currency":"USD","unit":"per-million-tokens","input":"4.00","output":"20.00","cachedInput":"0.40","batchMultiplier":"0.5","sourceUrl":"https://developers.openai.com/api/docs/pricing","observedAt":"2026-09-07","notes":["Price cut observed on 2026-09-07: input 5.00 -> 4.00, output 30.00 -> 20.00, cached input 0.50 -> 0.40. OpenAI publishes no effective date, so effectiveFrom is the observation date rather than a guess at when the cut actually landed.","batchMultiplier is \"0.5\" per the pricing page's Batch API section, which states the 50% saving \"applies to all text models listed above in the Standard table\" - an explicit all-model statement, so the pro tiers are covered too."]},
    ],
    source: {"url":"https://developers.openai.com/api/docs/pricing","observedAt":"2026-09-07"},
  },
  {
    canonicalId: "gpt-5.6-terra",
    provider: "openai",
    aliases: [],
    family: "gpt-5.6",
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"2.00","output":"12.00","cachedInput":"0.20","batchMultiplier":"0.5","sourceUrl":"https://developers.openai.com/api/docs/pricing","observedAt":"2026-09-07","notes":["OpenAI's pricing page does not publish an effective date for this rate; effectiveFrom is set conservatively to 2026-01-01 pending confirmation of the true rollout date.","batchMultiplier reflects OpenAI's general Batch API policy as stated on the pricing page; not independently confirmed per-model."]},
    ],
    source: {"url":"https://developers.openai.com/api/docs/pricing","observedAt":"2026-09-07"},
  },
  {
    canonicalId: "gpt-6-astra",
    provider: "openai",
    aliases: [],
    family: "gpt-6",
    pricing: [
      {"effectiveFrom":"2026-09-07","currency":"USD","unit":"per-million-tokens","input":"10.00","output":"50.00","cachedInput":"1.00","batchMultiplier":"0.5","sourceUrl":"https://developers.openai.com/api/docs/pricing","observedAt":"2026-09-07","notes":["New model: absent from the pricing page on 2026-08-05, present on 2026-09-07. effectiveFrom is the observation date rather than this file's usual conservative 2026-01-01 - the model demonstrably did not exist at that rate a month earlier, so backdating it would invent a period.","batchMultiplier is \"0.5\" per the pricing page's Batch API section, which states the 50% saving \"applies to all text models listed above in the Standard table\" - an explicit all-model statement, so the pro tiers are covered too."]},
    ],
    source: {"url":"https://developers.openai.com/api/docs/pricing","observedAt":"2026-09-07"},
  },
  {
    canonicalId: "o1",
    provider: "openai",
    aliases: [],
    family: "o-series",
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"15.00","output":"60.00","cachedInput":"7.50","batchMultiplier":"0.5","sourceUrl":"https://developers.openai.com/api/docs/pricing","observedAt":"2026-09-07","notes":["OpenAI's pricing page does not publish an effective date for this rate; effectiveFrom is set conservatively to 2026-01-01 pending confirmation of the true rollout date.","batchMultiplier reflects OpenAI's general Batch API policy as stated on the pricing page; not independently confirmed per-model."]},
    ],
    source: {"url":"https://developers.openai.com/api/docs/pricing","observedAt":"2026-09-07"},
  },
  {
    canonicalId: "o1-pro",
    provider: "openai",
    aliases: [],
    family: "o-series",
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"150.00","output":"600.00","batchMultiplier":"0.5","sourceUrl":"https://developers.openai.com/api/docs/pricing","observedAt":"2026-09-07","notes":["Found on https://developers.openai.com/api/docs/pricing during a second confirmation pass.","No cached-input rate is published for o1-pro (shown as \"—\"); cachedInput is intentionally omitted rather than guessed.","OpenAI's pricing page does not publish an effective date for this rate; effectiveFrom is set conservatively to 2026-01-01 pending confirmation of the true rollout date.","batchMultiplier is \"0.5\" per the pricing page's Batch API section, which states the 50% saving \"applies to all text models listed above in the Standard table\" - an explicit all-model statement, so the pro tiers are covered too."]},
    ],
    source: {"url":"https://developers.openai.com/api/docs/pricing","observedAt":"2026-09-07"},
  },
  {
    canonicalId: "o3",
    provider: "openai",
    aliases: [],
    family: "o-series",
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"2.00","output":"8.00","cachedInput":"0.50","batchMultiplier":"0.5","sourceUrl":"https://developers.openai.com/api/docs/pricing","observedAt":"2026-09-07","notes":["OpenAI's pricing page does not publish an effective date for this rate; effectiveFrom is set conservatively to 2026-01-01 pending confirmation of the true rollout date.","batchMultiplier reflects OpenAI's general Batch API policy as stated on the pricing page; not independently confirmed per-model."]},
    ],
    source: {"url":"https://developers.openai.com/api/docs/pricing","observedAt":"2026-09-07"},
  },
  {
    canonicalId: "o3-mini",
    provider: "openai",
    aliases: [],
    family: "o-series",
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"1.10","output":"4.40","cachedInput":"0.55","batchMultiplier":"0.5","sourceUrl":"https://developers.openai.com/api/docs/pricing","observedAt":"2026-09-07","notes":["OpenAI's pricing page does not publish an effective date for this rate; effectiveFrom is set conservatively to 2026-01-01 pending confirmation of the true rollout date.","batchMultiplier reflects OpenAI's general Batch API policy as stated on the pricing page; not independently confirmed per-model."]},
    ],
    source: {"url":"https://developers.openai.com/api/docs/pricing","observedAt":"2026-09-07"},
  },
  {
    canonicalId: "o3-pro",
    provider: "openai",
    aliases: [],
    family: "o-series",
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"20.00","output":"80.00","batchMultiplier":"0.5","sourceUrl":"https://developers.openai.com/api/docs/pricing","observedAt":"2026-09-07","notes":["No cached-input rate is published for o3-pro (shown as \"—\"); cachedInput is intentionally omitted rather than guessed.","OpenAI's pricing page does not publish an effective date for this rate; effectiveFrom is set conservatively to 2026-01-01 pending confirmation of the true rollout date.","batchMultiplier is \"0.5\" per the pricing page's Batch API section, which states the 50% saving \"applies to all text models listed above in the Standard table\" - an explicit all-model statement, so the pro tiers are covered too."]},
    ],
    source: {"url":"https://developers.openai.com/api/docs/pricing","observedAt":"2026-09-07"},
  },
  {
    canonicalId: "o4-mini",
    provider: "openai",
    aliases: [],
    family: "o-series",
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"1.10","output":"4.40","cachedInput":"0.275","batchMultiplier":"0.5","sourceUrl":"https://developers.openai.com/api/docs/pricing","observedAt":"2026-09-07","notes":["OpenAI's pricing page does not publish an effective date for this rate; effectiveFrom is set conservatively to 2026-01-01 pending confirmation of the true rollout date.","batchMultiplier reflects OpenAI's general Batch API policy as stated on the pricing page; not independently confirmed per-model."]},
    ],
    source: {"url":"https://developers.openai.com/api/docs/pricing","observedAt":"2026-09-07"},
  },
  {
    canonicalId: "anthropic/claude-sonnet-5",
    provider: "openrouter",
    aliases: [],
    family: "anthropic-proxy",
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"2.00","output":"10.00","cachedInput":"0.20","cacheWrite":"2.50","sourceUrl":"https://openrouter.ai/anthropic/claude-sonnet-5","observedAt":"2026-09-07","notes":["Recorded 2026-08-05 flagged UNCERTAIN: $2.00/$10.00 matched what anthropic.json then held as an introductory rate expiring 2026-08-31, so it was unclear whether OpenRouter had simply not updated its listing. Resolved on 2026-09-07 - Anthropic's pricing page states the scheduled $3.00/$15.00 increase will not occur and $2.00/$10.00 is the standard rate, so this listing was correct all along and the flag is withdrawn.","OpenRouter's per-model page does not publish an effective date; effectiveFrom is set conservatively to 2026-01-01.","canonicalId uses OpenRouter's own slug format, deliberately distinct from Anthropic's first-party canonicalId \"claude-sonnet-5\" (anthropic.json) to avoid a canonicalId collision; this is a legitimate cross-provider situation, not an error.","Re-confirmed unchanged on 2026-09-07 against the same model page.","cachedInput added on 2026-09-07: the model page now prints a Cache Read rate of 0.20 per million tokens for this model.","cacheWrite added on 2026-09-07: the model page prints a 5-minute Cache Write rate of 2.50 per million tokens (and $4.00 for the 1-hour TTL, which this single-field schema does not model).","Resolves the 2026-08-05 caveat on this entry: $2.00/$10.00 was flagged as possibly Anthropic's introductory rate, due to be superseded by $3.00/$15.00 on 2026-09-01. Anthropic's own pricing page now states that increase will not occur and $2.00/$10.00 is the standard rate, so OpenRouter's rate matches the first-party standard rate, not a stale introductory one.","The page notes Google Vertex (US/Europe) and Amazon Bedrock (US) upstreams charge $2.20/$11.00 through OpenRouter; the default cross-provider rate is recorded, since this schema has no upstream dimension."]},
    ],
    source: {"url":"https://openrouter.ai/anthropic/claude-sonnet-5","observedAt":"2026-09-07"},
  },
  {
    canonicalId: "google/gemini-3.1-pro-preview",
    provider: "openrouter",
    aliases: [],
    family: "google-proxy",
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"2.00","output":"12.00","cachedInput":"0.20","cheapestTier":true,"sourceUrl":"https://openrouter.ai/google/gemini-3.1-pro-preview","observedAt":"2026-09-07","notes":["OpenRouter's per-model page does not publish an effective date; effectiveFrom is set conservatively to 2026-01-01.","Matches Google's own first-party <=200k-token-tier rate for gemini-3.1-pro-preview ($2.00/$12.00, see google.json) exactly as observed. Google's >200k-token tier ($4.00/$18.00) is not represented here (or, evidently, distinguished by OpenRouter's listing either) — same context-length-tiering limitation as google.json.","canonicalId uses OpenRouter's own slug format, deliberately distinct from Google's first-party canonicalId \"gemini-3.1-pro-preview\" (google.json).","Re-confirmed unchanged on 2026-09-07 against the same model page.","cachedInput added on 2026-09-07: the model page now prints a Cache Read rate of 0.20 per million tokens for this model."]},
    ],
    source: {"url":"https://openrouter.ai/google/gemini-3.1-pro-preview","observedAt":"2026-09-07"},
  },
  {
    canonicalId: "meta-llama/llama-3.3-70b-instruct",
    provider: "openrouter",
    aliases: [],
    family: "meta-proxy",
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"0.10","output":"0.32","sourceUrl":"https://openrouter.ai/meta-llama/llama-3.3-70b-instruct","observedAt":"2026-09-07","notes":["OpenRouter's per-model page does not publish an effective date; effectiveFrom is set conservatively to 2026-01-01.","Meta does not sell first-party API access to Llama, so there is no first-party \"llama-3.3-70b\" entry in this registry to compare against; Groq (groq.json: llama-3.3-70b-versatile, $0.59/$0.79) and Together AI (together.json: llama-3.3-70b, $1.04/$1.04) each host the same open-weight model at their own, different rates. OpenRouter's rate here is the lowest of the three observed, plausibly because OpenRouter itself proxies to one of several underlying hosts and shows a blended/lowest-cost route; not independently confirmed which underlying host this routes to.","Re-confirmed unchanged on 2026-09-07 against the same model page.","The page labels this \"the average price customers actually pay\" and warns caching and discounts often put the effective price below it; recorded as printed."]},
    ],
    source: {"url":"https://openrouter.ai/meta-llama/llama-3.3-70b-instruct","observedAt":"2026-09-07"},
  },
  {
    canonicalId: "openai/gpt-5",
    provider: "openrouter",
    aliases: [],
    family: "openai-proxy",
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"1.25","output":"10.00","cachedInput":"0.125","sourceUrl":"https://openrouter.ai/openai/gpt-5","observedAt":"2026-09-07","notes":["OpenRouter's per-model page does not publish an effective date; effectiveFrom is set conservatively to 2026-01-01.","Matches OpenAI's own first-party rate for gpt-5 ($1.25/$10.00, see openai.json) exactly as observed — no markup detected for this model.","canonicalId uses OpenRouter's own slug format (\"openai/gpt-5\"), deliberately distinct from OpenAI's first-party canonicalId \"gpt-5\" (openai.json) — this avoids a canonicalId collision while still allowing a cross-provider alias collision if a caller looks up the bare id \"gpt-5\" without a provider qualifier; no bare \"gpt-5\" alias was added to this entry to keep that surface area minimal.","Re-confirmed unchanged on 2026-09-07 against the same model page.","cachedInput added on 2026-09-07: the model page now prints a Cache Read rate of 0.125 per million tokens for this model."]},
    ],
    source: {"url":"https://openrouter.ai/openai/gpt-5","observedAt":"2026-09-07"},
  },
  {
    canonicalId: "deepseek-v4-flash-0731",
    provider: "together",
    aliases: [],
    family: "deepseek",
    pricing: [
      {"effectiveFrom":"2026-09-07","currency":"USD","unit":"per-million-tokens","input":"0.14","output":"0.28","sourceUrl":"https://www.together.ai/pricing","observedAt":"2026-09-07","notes":["Added from the 2026-09-07 fetch. effectiveFrom is the observation date rather than this file's conservative 2026-01-01, since the 2026-08-05 fetch of the same page did not list it.","Together publishes no cached-input rate or batch discount for serverless models; both fields are omitted rather than guessed."]},
    ],
    source: {"url":"https://www.together.ai/pricing","observedAt":"2026-09-07"},
  },
  {
    canonicalId: "deepseek-v4-pro",
    provider: "together",
    aliases: [],
    family: "deepseek",
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"1.74","output":"3.48","cachedInput":"0.20","sourceUrl":"https://www.together.ai/pricing","observedAt":"2026-08-05","notes":["Together's pricing page does not publish an effective date for this rate; effectiveFrom is set conservatively to 2026-01-01.","Not re-confirmed on 2026-09-07: that fetch listed \"DeepSeek V4 Pro 0813\" at $1.32 / $3.96 and no undated \"DeepSeek V4 Pro\" row. Whether the dated build is this same model repriced or a separate snapshot is not stated on the page, so this entry keeps its 2026-08-05 rate and the dated build is recorded separately as deepseek-v4-pro-0813 rather than silently overwriting this one."]},
    ],
    source: {"url":"https://www.together.ai/pricing","observedAt":"2026-08-05"},
  },
  {
    canonicalId: "deepseek-v4-pro-0813",
    provider: "together",
    aliases: [],
    family: "deepseek",
    pricing: [
      {"effectiveFrom":"2026-09-07","currency":"USD","unit":"per-million-tokens","input":"1.32","output":"3.96","sourceUrl":"https://www.together.ai/pricing","observedAt":"2026-09-07","notes":["Dated build listed on the page on 2026-09-07; see deepseek-v4-pro's notes for why it is a separate entry rather than a reprice of that one.","Added from the 2026-09-07 fetch. effectiveFrom is the observation date rather than this file's conservative 2026-01-01, since the 2026-08-05 fetch of the same page did not list it.","Together publishes no cached-input rate or batch discount for serverless models; both fields are omitted rather than guessed."]},
    ],
    source: {"url":"https://www.together.ai/pricing","observedAt":"2026-09-07"},
  },
  {
    canonicalId: "gemma-4-31b",
    provider: "together",
    aliases: [],
    family: "gemma",
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"0.39","output":"0.97","sourceUrl":"https://www.together.ai/pricing","observedAt":"2026-09-07","notes":["Together's pricing page does not publish an effective date for this rate; effectiveFrom is set conservatively to 2026-01-01.","Cross-provider alias/canonicalId collision (allowed, not an error): AWS Bedrock also lists \"Gemma 4 31B\" (aws-bedrock.json: gemma-4-31b) at a different, lower rate ($0.14/$0.40 as observed on Bedrock) — same underlying Google open-weight model, independently priced by each reseller; do not assume parity.","Re-confirmed unchanged on 2026-09-07 against the same page."]},
    ],
    source: {"url":"https://www.together.ai/pricing","observedAt":"2026-09-07"},
  },
  {
    canonicalId: "glm-5.2",
    provider: "together",
    aliases: [],
    family: "glm",
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"1.40","output":"4.40","cachedInput":"0.26","sourceUrl":"https://www.together.ai/pricing","observedAt":"2026-09-07","notes":["Together's pricing page does not publish an effective date for this rate; effectiveFrom is set conservatively to 2026-01-01.","Re-confirmed unchanged on 2026-09-07 against the same page."]},
    ],
    source: {"url":"https://www.together.ai/pricing","observedAt":"2026-09-07"},
  },
  {
    canonicalId: "glm-5.3",
    provider: "together",
    aliases: [],
    family: "glm",
    pricing: [
      {"effectiveFrom":"2026-09-07","currency":"USD","unit":"per-million-tokens","input":"1.40","output":"4.40","sourceUrl":"https://www.together.ai/pricing","observedAt":"2026-09-07","notes":["Added from the 2026-09-07 fetch. effectiveFrom is the observation date rather than this file's conservative 2026-01-01, since the 2026-08-05 fetch of the same page did not list it.","Together publishes no cached-input rate or batch discount for serverless models; both fields are omitted rather than guessed."]},
    ],
    source: {"url":"https://www.together.ai/pricing","observedAt":"2026-09-07"},
  },
  {
    canonicalId: "glm-5.3-flash",
    provider: "together",
    aliases: [],
    family: "glm",
    pricing: [
      {"effectiveFrom":"2026-09-07","currency":"USD","unit":"per-million-tokens","input":"0.15","output":"0.50","sourceUrl":"https://www.together.ai/pricing","observedAt":"2026-09-07","notes":["Added from the 2026-09-07 fetch. effectiveFrom is the observation date rather than this file's conservative 2026-01-01, since the 2026-08-05 fetch of the same page did not list it.","Together publishes no cached-input rate or batch discount for serverless models; both fields are omitted rather than guessed."]},
    ],
    source: {"url":"https://www.together.ai/pricing","observedAt":"2026-09-07"},
  },
  {
    canonicalId: "gpt-oss-120b",
    provider: "together",
    aliases: [],
    family: "gpt-oss",
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"0.15","output":"0.60","sourceUrl":"https://www.together.ai/pricing","observedAt":"2026-09-07","notes":["Together's pricing page does not publish an effective date for this rate; effectiveFrom is set conservatively to 2026-01-01.","Cross-provider alias/canonicalId collision (allowed, not an error): Groq also publishes a model with canonicalId \"gpt-oss-120b\" (groq.json), independently priced at the same $0.15/$0.60 figure as observed. The identical string \"gpt-oss-120b\" is used as the canonicalId on both providers because that is the actual model name each provider publishes; resolving \"gpt-oss-120b\" without a provider qualifier is ambiguous across providers by design and the resolver requires a provider qualifier to disambiguate it.","Re-confirmed unchanged on 2026-09-07 against the same page."]},
    ],
    source: {"url":"https://www.together.ai/pricing","observedAt":"2026-09-07"},
  },
  {
    canonicalId: "gpt-oss-20b",
    provider: "together",
    aliases: [],
    family: "gpt-oss",
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"0.05","output":"0.20","sourceUrl":"https://www.together.ai/pricing","observedAt":"2026-08-05","notes":["Together's pricing page does not publish an effective date for this rate; effectiveFrom is set conservatively to 2026-01-01.","Cross-provider alias/canonicalId collision (allowed, not an error): Groq also publishes \"gpt-oss-20b\" (groq.json) at a different rate ($0.075/$0.30 as observed) — same model name, independently priced by each host; do not assume parity.","Not surfaced by the 2026-09-07 fetch of the same page. observedAt is deliberately left at 2026-08-05: the rate was not re-observed, and an absence in one page fetch is not evidence of a withdrawal."]},
    ],
    source: {"url":"https://www.together.ai/pricing","observedAt":"2026-08-05"},
  },
  {
    canonicalId: "kimi-k3",
    provider: "together",
    aliases: [],
    family: "kimi",
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"3.00","output":"15.00","cachedInput":"0.30","sourceUrl":"https://www.together.ai/pricing","observedAt":"2026-09-07","notes":["Together's pricing page does not publish an effective date for this rate; effectiveFrom is set conservatively to 2026-01-01.","Re-confirmed unchanged on 2026-09-07 against the same page."]},
    ],
    source: {"url":"https://www.together.ai/pricing","observedAt":"2026-09-07"},
  },
  {
    canonicalId: "llama-3-8b-instruct-lite",
    provider: "together",
    aliases: [],
    family: "llama",
    pricing: [
      {"effectiveFrom":"2026-09-07","currency":"USD","unit":"per-million-tokens","input":"0.14","output":"0.14","sourceUrl":"https://www.together.ai/pricing","observedAt":"2026-09-07","notes":["Added from the 2026-09-07 fetch. effectiveFrom is the observation date rather than this file's conservative 2026-01-01, since the 2026-08-05 fetch of the same page did not list it.","Together publishes no cached-input rate or batch discount for serverless models; both fields are omitted rather than guessed."]},
    ],
    source: {"url":"https://www.together.ai/pricing","observedAt":"2026-09-07"},
  },
  {
    canonicalId: "llama-3.3-70b",
    provider: "together",
    aliases: [],
    family: "llama-3.3",
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"1.04","output":"1.04","sourceUrl":"https://www.together.ai/pricing","observedAt":"2026-09-07","notes":["Together's pricing page does not publish an effective date for this rate; effectiveFrom is set conservatively to 2026-01-01.","Also hosted by Groq (groq.json: llama-3.3-70b-versatile, $0.59/$0.79) and resold by AWS Bedrock — each host prices this same open-weight model independently; do not assume parity across providers.","Re-confirmed unchanged on 2026-09-07 against the same page."]},
    ],
    source: {"url":"https://www.together.ai/pricing","observedAt":"2026-09-07"},
  },
  {
    canonicalId: "minimax-m3",
    provider: "together",
    aliases: [],
    family: "minimax",
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"0.30","output":"1.20","cachedInput":"0.06","sourceUrl":"https://www.together.ai/pricing","observedAt":"2026-09-07","notes":["Together's pricing page does not publish an effective date for this rate; effectiveFrom is set conservatively to 2026-01-01.","Re-confirmed unchanged on 2026-09-07 against the same page."]},
    ],
    source: {"url":"https://www.together.ai/pricing","observedAt":"2026-09-07"},
  },
  {
    canonicalId: "qwen2.5-7b-instruct-turbo",
    provider: "together",
    aliases: [],
    family: "qwen",
    pricing: [
      {"effectiveFrom":"2026-09-07","currency":"USD","unit":"per-million-tokens","input":"0.30","output":"0.30","sourceUrl":"https://www.together.ai/pricing","observedAt":"2026-09-07","notes":["Added from the 2026-09-07 fetch. effectiveFrom is the observation date rather than this file's conservative 2026-01-01, since the 2026-08-05 fetch of the same page did not list it.","Together publishes no cached-input rate or batch discount for serverless models; both fields are omitted rather than guessed."]},
    ],
    source: {"url":"https://www.together.ai/pricing","observedAt":"2026-09-07"},
  },
  {
    canonicalId: "qwen3.5-397b-a17b",
    provider: "together",
    aliases: [],
    family: "qwen",
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"0.60","output":"3.60","cachedInput":"0.35","sourceUrl":"https://www.together.ai/pricing","observedAt":"2026-09-07","notes":["Together's pricing page does not publish an effective date for this rate; effectiveFrom is set conservatively to 2026-01-01.","Re-confirmed unchanged on 2026-09-07 against the same page."]},
    ],
    source: {"url":"https://www.together.ai/pricing","observedAt":"2026-09-07"},
  },
  {
    canonicalId: "qwen3.5-9b",
    provider: "together",
    aliases: [],
    family: "qwen",
    pricing: [
      {"effectiveFrom":"2026-09-07","currency":"USD","unit":"per-million-tokens","input":"0.17","output":"0.25","sourceUrl":"https://www.together.ai/pricing","observedAt":"2026-09-07","notes":["Added from the 2026-09-07 fetch. effectiveFrom is the observation date rather than this file's conservative 2026-01-01, since the 2026-08-05 fetch of the same page did not list it.","Together publishes no cached-input rate or batch discount for serverless models; both fields are omitted rather than guessed."]},
    ],
    source: {"url":"https://www.together.ai/pricing","observedAt":"2026-09-07"},
  },
  {
    canonicalId: "qwen3.6-plus",
    provider: "together",
    aliases: [],
    family: "qwen",
    pricing: [
      {"effectiveFrom":"2026-09-07","currency":"USD","unit":"per-million-tokens","input":"0.50","output":"3.00","sourceUrl":"https://www.together.ai/pricing","observedAt":"2026-09-07","notes":["Added from the 2026-09-07 fetch. effectiveFrom is the observation date rather than this file's conservative 2026-01-01, since the 2026-08-05 fetch of the same page did not list it.","Together publishes no cached-input rate or batch discount for serverless models; both fields are omitted rather than guessed."]},
    ],
    source: {"url":"https://www.together.ai/pricing","observedAt":"2026-09-07"},
  },
  {
    canonicalId: "qwen3.7-max",
    provider: "together",
    aliases: [],
    family: "qwen",
    pricing: [
      {"effectiveFrom":"2026-01-01","currency":"USD","unit":"per-million-tokens","input":"1.25","output":"3.75","cachedInput":"0.13","sourceUrl":"https://www.together.ai/pricing","observedAt":"2026-09-07","notes":["Together's pricing page does not publish an effective date for this rate; effectiveFrom is set conservatively to 2026-01-01.","Re-confirmed unchanged on 2026-09-07 against the same page."]},
    ],
    source: {"url":"https://www.together.ai/pricing","observedAt":"2026-09-07"},
  },
  {
    canonicalId: "qwen3.7-plus",
    provider: "together",
    aliases: [],
    family: "qwen",
    pricing: [
      {"effectiveFrom":"2026-09-07","currency":"USD","unit":"per-million-tokens","input":"0.32","output":"1.28","sourceUrl":"https://www.together.ai/pricing","observedAt":"2026-09-07","notes":["Added from the 2026-09-07 fetch. effectiveFrom is the observation date rather than this file's conservative 2026-01-01, since the 2026-08-05 fetch of the same page did not list it.","Together publishes no cached-input rate or batch discount for serverless models; both fields are omitted rather than guessed."]},
    ],
    source: {"url":"https://www.together.ai/pricing","observedAt":"2026-09-07"},
  },
  {
    canonicalId: "qwen3.8-2.4t-a95b",
    provider: "together",
    aliases: [],
    family: "qwen",
    pricing: [
      {"effectiveFrom":"2026-09-07","currency":"USD","unit":"per-million-tokens","input":"2.00","output":"6.00","sourceUrl":"https://www.together.ai/pricing","observedAt":"2026-09-07","notes":["Added from the 2026-09-07 fetch. effectiveFrom is the observation date rather than this file's conservative 2026-01-01, since the 2026-08-05 fetch of the same page did not list it.","Together publishes no cached-input rate or batch discount for serverless models; both fields are omitted rather than guessed."]},
    ],
    source: {"url":"https://www.together.ai/pricing","observedAt":"2026-09-07"},
  },
  {
    canonicalId: "qwen3.8-flash",
    provider: "together",
    aliases: [],
    family: "qwen",
    pricing: [
      {"effectiveFrom":"2026-09-07","currency":"USD","unit":"per-million-tokens","input":"0.15","output":"0.47","sourceUrl":"https://www.together.ai/pricing","observedAt":"2026-09-07","notes":["Added from the 2026-09-07 fetch. effectiveFrom is the observation date rather than this file's conservative 2026-01-01, since the 2026-08-05 fetch of the same page did not list it.","Together publishes no cached-input rate or batch discount for serverless models; both fields are omitted rather than guessed."]},
    ],
    source: {"url":"https://www.together.ai/pricing","observedAt":"2026-09-07"},
  },
];
