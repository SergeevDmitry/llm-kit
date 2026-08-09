/**
 * One golden calculation per pricing shape, plus the package's headline
 * example: Azure reselling an OpenAI model at a genuinely different price.
 */
import { describe, expect, it } from 'vitest';
import { calculateCost } from '../src/calculate-cost.js';

describe('golden calculation — input/output/cached, standard mode (openai:gpt-5)', () => {
  it('bills ordinary input, cached input, and output on three separate lines that sum exactly', () => {
    const result = calculateCost({
      model: 'gpt-5',
      provider: 'openai',
      usage: { inputTokens: 1000, outputTokens: 500, cachedInputTokens: 200 },
      at: '2026-08-05',
    });

    expect(result.canonicalModel).toBe('gpt-5');
    expect(result.provider).toBe('openai');
    expect(result.input).toEqual({
      tokens: 800,
      rate: '1.25',
      costUsd: 0.001,
      costUsdExact: '0.001',
    });
    expect(result.output).toEqual({
      tokens: 500,
      rate: '10.00',
      costUsd: 0.005,
      costUsdExact: '0.005',
    });
    expect(result.cachedInput).toEqual({
      tokens: 200,
      rate: '0.125',
      costUsd: 0.000025,
      costUsdExact: '0.000025',
    });
    expect(result.cacheWrite).toBeUndefined();
    expect(result.reasoning).toBeUndefined();
    expect(result.totalUsdExact).toBe('0.006025');
    expect(result.totalUsd).toBe(0.006025);
    expect(result.warnings).toEqual([]);
  });
});

describe('golden calculation — batch mode halves every line via batchMultiplier', () => {
  it('applies the 0.5 batchMultiplier to input, cached input, and output alike', () => {
    const result = calculateCost({
      model: 'gpt-5',
      provider: 'openai',
      usage: { inputTokens: 1000, outputTokens: 500, cachedInputTokens: 200 },
      mode: 'batch',
      at: '2026-08-05',
    });

    expect(result.totalUsdExact).toBe('0.0030125');
    expect(result.warnings).toEqual([]);
  });
});

describe('golden calculation — cache-write tokens (anthropic:claude-sonnet-5, standard rate)', () => {
  it('bills ordinary input, cached input, cache-write, and output on four lines', () => {
    const result = calculateCost({
      model: 'claude-sonnet-5',
      provider: 'anthropic',
      usage: {
        inputTokens: 10_000, // 7,000 ordinary + 2,000 cached + 1,000 cache-write
        outputTokens: 2_000,
        cachedInputTokens: 2_000,
        cacheWriteTokens: 1_000,
      },
      at: '2026-09-15', // standard rate: $3.00/$15.00, cachedInput $0.30, cacheWrite $3.75
    });

    expect(result.pricingEffectiveFrom).toBe('2026-09-01');
    expect(result.input.tokens).toBe(7_000);
    expect(result.cachedInput?.tokens).toBe(2_000);
    expect(result.cacheWrite?.tokens).toBe(1_000);
    // input: 7000*3.00/1e6 = 0.021; cachedInput: 2000*0.30/1e6 = 0.0006;
    // cacheWrite: 1000*3.75/1e6 = 0.00375; output: 2000*15.00/1e6 = 0.03.
    expect(result.input.costUsdExact).toBe('0.021');
    expect(result.cachedInput?.costUsdExact).toBe('0.0006');
    expect(result.cacheWrite?.costUsdExact).toBe('0.00375');
    expect(result.output.costUsdExact).toBe('0.03');
    expect(result.totalUsdExact).toBe('0.05535');
  });
});

describe("the package's headline example — Azure resells OpenAI models at genuinely different prices", () => {
  it('gpt-5.6-luna is $1.00/$6.00 on Azure but $0.20/$1.20 on OpenAI — 5x apart for the identical model name', () => {
    const azure = calculateCost({
      model: 'gpt-5.6-luna',
      provider: 'azure-openai',
      usage: { inputTokens: 1_000_000, outputTokens: 1_000_000 },
      at: '2026-08-05',
    });
    const openai = calculateCost({
      model: 'gpt-5.6-luna',
      provider: 'openai',
      usage: { inputTokens: 1_000_000, outputTokens: 1_000_000 },
      at: '2026-08-05',
    });

    expect(azure.totalUsdExact).toBe('7.00'); // $1.00 + $6.00 per million tokens
    expect(openai.totalUsdExact).toBe('1.40'); // $0.20 + $1.20 per million tokens
    expect(azure.totalUsd / openai.totalUsd).toBeCloseTo(5, 5);

    // Azure's rate is flagged as the cheapest of several published tiers
    // (Global + ShortCo + Standard); OpenAI's first-party rate carries no
    // such flag.
    expect(azure.warnings.some((w) => w.code === 'PARTIAL_TIER_PRICING')).toBe(true);
    expect(openai.warnings.some((w) => w.code === 'PARTIAL_TIER_PRICING')).toBe(false);
  });

  it('an unqualified lookup of "gpt-5.6-luna" without a provider throws — it must never silently pick one', () => {
    expect(() =>
      calculateCost({
        model: 'gpt-5.6-luna',
        usage: { inputTokens: 1000, outputTokens: 1000 },
        at: '2026-08-05',
      }),
    ).toThrowError(/matches more than one model/);
  });
});
