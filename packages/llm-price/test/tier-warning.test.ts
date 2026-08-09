/**
 * The tier-warning design: `PricingPeriod.cheapestTier` and the
 * `PARTIAL_TIER_PRICING` warning it produces. Covers both real multi-tier
 * shapes documented in `docs/provider-data/README.md` — Google's
 * prompt-size tiering and Azure's deployment/context-length/service-tier
 * dimensions — against the real generated registry, not a fixture.
 */
import { describe, expect, it } from 'vitest';
import { calculateCost } from '../src/calculate-cost.js';
import { resolveModel } from '../src/resolve-model.js';

describe('PARTIAL_TIER_PRICING — Google prompt-size tiering', () => {
  it('gemini-3.1-pro-preview carries cheapestTier and calculateCost warns every time it is used', () => {
    const resolved = resolveModel('gemini-3.1-pro-preview', { provider: 'google' });
    const period = resolved.descriptor.pricing?.[0];
    expect(period?.cheapestTier).toBe(true);

    const result = calculateCost({
      model: 'gemini-3.1-pro-preview',
      provider: 'google',
      usage: { inputTokens: 10, outputTokens: 10 },
      at: '2026-08-05',
    });
    const warning = result.warnings.find((w) => w.code === 'PARTIAL_TIER_PRICING');
    expect(warning).toBeDefined();
    expect(warning?.message).toMatch(/google:gemini-3.1-pro-preview/);
  });

  it('gemini-2.5-pro is also flagged (its own <=200k-token tier note)', () => {
    const result = calculateCost({
      model: 'gemini-2.5-pro',
      provider: 'google',
      usage: { inputTokens: 10, outputTokens: 10 },
      at: '2026-08-05',
    });
    expect(result.warnings.some((w) => w.code === 'PARTIAL_TIER_PRICING')).toBe(true);
  });

  it('a Flash-tier Google model with no context-length tiering is not flagged', () => {
    const result = calculateCost({
      model: 'gemini-2.5-flash',
      provider: 'google',
      usage: { inputTokens: 10, outputTokens: 10 },
      at: '2026-08-05',
    });
    expect(result.warnings.some((w) => w.code === 'PARTIAL_TIER_PRICING')).toBe(false);
  });
});

describe('PARTIAL_TIER_PRICING — Azure OpenAI deployment/context/service tiering', () => {
  it('every Azure OpenAI model in the registry is flagged (Global + ShortCo + Standard only recorded)', () => {
    const models = ['gpt-5', 'gpt-4o', 'o1', 'gpt-5.6-sol', 'gpt-3.5-turbo'];
    for (const model of models) {
      const result = calculateCost({
        model,
        provider: 'azure-openai',
        usage: { inputTokens: 10, outputTokens: 10 },
        at: '2026-08-05',
      });
      expect(
        result.warnings.some((w) => w.code === 'PARTIAL_TIER_PRICING'),
        `expected azure-openai:${model} to carry PARTIAL_TIER_PRICING`,
      ).toBe(true);
    }
  });

  it("the identical model on OpenAI's own first-party pricing is not flagged", () => {
    const result = calculateCost({
      model: 'gpt-5',
      provider: 'openai',
      usage: { inputTokens: 10, outputTokens: 10 },
      at: '2026-08-05',
    });
    expect(result.warnings.some((w) => w.code === 'PARTIAL_TIER_PRICING')).toBe(false);
  });
});
