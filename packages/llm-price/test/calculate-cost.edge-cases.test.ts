/**
 * Edge cases this package must have tests for.
 */
import { assertErrorShape, assertJsonSerializable } from '@llm-kit/test-utils';
import { describe, expect, it } from 'vitest';
import { calculateCost } from '../src/calculate-cost.js';
import {
  AmbiguousAliasError,
  InvalidTokenCountError,
  InvalidUsageError,
  NoPricingPeriodError,
  UnknownModelError,
} from '../src/index.js';

describe('zero-token requests', () => {
  it('never throws and reports an exact zero total', () => {
    const result = calculateCost({
      model: 'gpt-5',
      provider: 'openai',
      usage: { inputTokens: 0, outputTokens: 0 },
      at: '2026-08-05',
    });
    expect(result.totalUsdExact).toBe('0.00');
    expect(result.totalUsd).toBe(0);
    expect(result.warnings).toEqual([]);
  });
});

describe('cached tokens exceeding total input', () => {
  it('clamps ordinary input to 0 and warns, but still bills the full cached amount', () => {
    const result = calculateCost({
      model: 'gpt-5',
      provider: 'openai',
      usage: { inputTokens: 100, outputTokens: 0, cachedInputTokens: 150 },
      at: '2026-08-05',
    });
    expect(result.input.tokens).toBe(0);
    expect(result.cachedInput?.tokens).toBe(150);
    expect(result.warnings.some((w) => w.code === 'CACHED_EXCEEDS_INPUT')).toBe(true);
    assertJsonSerializable(result, 'CostBreakdown');
  });
});

describe('reasoning tokens exceeding total output', () => {
  it('clamps ordinary output to 0 and warns, but still bills the full reasoning amount', () => {
    const result = calculateCost({
      model: 'gpt-5',
      provider: 'openai',
      usage: { inputTokens: 0, outputTokens: 10, reasoningTokens: 50 },
      at: '2026-08-05',
    });
    expect(result.output.tokens).toBe(0);
    expect(result.reasoning?.tokens).toBe(50);
    expect(result.warnings.some((w) => w.code === 'REASONING_EXCEEDS_OUTPUT')).toBe(true);
  });
});

describe('very large aggregate token counts', () => {
  it('stays exact at Number.MAX_SAFE_INTEGER-scale usage', () => {
    const result = calculateCost({
      model: 'gpt-5',
      provider: 'openai',
      usage: { inputTokens: 900_000_000_000, outputTokens: 900_000_000_000 },
      at: '2026-08-05',
    });
    // 900e9 * 1.25 / 1e6 = 1_125_000; 900e9 * 10.00 / 1e6 = 9_000_000
    expect(result.totalUsdExact).toBe('10125000.00');
  });

  it('rejects an unsafe (beyond Number.MAX_SAFE_INTEGER) token count', () => {
    let error: unknown;
    try {
      calculateCost({
        model: 'gpt-5',
        provider: 'openai',
        usage: { inputTokens: Number.MAX_SAFE_INTEGER + 2048, outputTokens: 0 },
        at: '2026-08-05',
      });
    } catch (e) {
      error = e;
    }
    assertErrorShape(error, { name: 'InvalidTokenCountError', code: 'INVALID_TOKEN_COUNT' });
    expect(error).toBeInstanceOf(InvalidTokenCountError);
  });

  it('rejects a negative token count', () => {
    expect(() =>
      calculateCost({
        model: 'gpt-5',
        provider: 'openai',
        usage: { inputTokens: -1, outputTokens: 0 },
        at: '2026-08-05',
      }),
    ).toThrow(InvalidTokenCountError);
  });

  it('rejects a non-integer token count', () => {
    expect(() =>
      calculateCost({
        model: 'gpt-5',
        provider: 'openai',
        usage: { inputTokens: 1.5, outputTokens: 0 },
        at: '2026-08-05',
      }),
    ).toThrow(InvalidTokenCountError);
  });
});

describe('batch pricing unavailable for a model', () => {
  it('falls back to standard (higher) pricing and warns, rather than guessing a discount', () => {
    // azure-openai:gpt-5.6-luna publishes no batchMultiplier.
    const standard = calculateCost({
      model: 'gpt-5.6-luna',
      provider: 'azure-openai',
      usage: { inputTokens: 1000, outputTokens: 1000 },
      at: '2026-08-05',
    });
    const batch = calculateCost({
      model: 'gpt-5.6-luna',
      provider: 'azure-openai',
      usage: { inputTokens: 1000, outputTokens: 1000 },
      mode: 'batch',
      at: '2026-08-05',
    });
    expect(batch.totalUsdExact).toBe(standard.totalUsdExact);
    expect(batch.warnings.some((w) => w.code === 'BATCH_PRICING_UNAVAILABLE')).toBe(true);
  });
});

describe('an alias reused by multiple providers', () => {
  it('throws AMBIGUOUS_ALIAS against the real generated registry when unqualified', () => {
    let error: unknown;
    try {
      calculateCost({
        model: 'gpt-oss-120b',
        usage: { inputTokens: 1000, outputTokens: 1000 },
        at: '2026-08-05',
      });
    } catch (e) {
      error = e;
    }
    assertErrorShape(error, { name: 'AmbiguousAliasError', code: 'AMBIGUOUS_ALIAS' });
    expect(error).toBeInstanceOf(AmbiguousAliasError);
  });

  it('resolves cleanly once qualified with a provider', () => {
    const groq = calculateCost({
      model: 'gpt-oss-120b',
      provider: 'groq',
      usage: { inputTokens: 1000, outputTokens: 1000 },
      at: '2026-08-05',
    });
    const together = calculateCost({
      model: 'gpt-oss-120b',
      provider: 'together',
      usage: { inputTokens: 1000, outputTokens: 1000 },
      at: '2026-08-05',
    });
    expect(groq.provider).toBe('groq');
    expect(together.provider).toBe('together');
  });
});

describe('unknown model', () => {
  it('throws UNKNOWN_MODEL rather than silently pricing nothing', () => {
    let error: unknown;
    try {
      calculateCost({
        model: 'not-a-real-model-id',
        usage: { inputTokens: 1000, outputTokens: 1000 },
        at: '2026-08-05',
      });
    } catch (e) {
      error = e;
    }
    assertErrorShape(error, { name: 'UnknownModelError', code: 'UNKNOWN_MODEL' });
    expect(error).toBeInstanceOf(UnknownModelError);
  });
});

describe('historical lookup before the first known period', () => {
  it('throws NO_PRICING_PERIOD rather than returning a zero or guessed cost', () => {
    let error: unknown;
    try {
      calculateCost({
        model: 'claude-sonnet-5',
        provider: 'anthropic',
        usage: { inputTokens: 1000, outputTokens: 1000 },
        at: '2020-01-01',
      });
    } catch (e) {
      error = e;
    }
    assertErrorShape(error, { name: 'NoPricingPeriodError', code: 'NO_PRICING_PERIOD' });
    expect(error).toBeInstanceOf(NoPricingPeriodError);
  });
});

describe('unknown future usage properties', () => {
  it('surfaces an unrecognized usage field as a warning, never silently dropping it', () => {
    const result = calculateCost({
      model: 'gpt-5',
      provider: 'openai',
      usage: { inputTokens: 100, outputTokens: 100, audioTokens: 50 },
      at: '2026-08-05',
    });
    const warning = result.warnings.find((w) => w.code === 'UNSUPPORTED_USAGE_FIELD');
    expect(warning?.field).toBe('audioTokens');
  });
});

describe('invalid usage', () => {
  it('rejects a non-object usage value', () => {
    expect(() =>
      calculateCost({
        model: 'gpt-5',
        provider: 'openai',
        usage: 'not an object',
        at: '2026-08-05',
      }),
    ).toThrow(InvalidUsageError);
  });

  it('rejects an object missing inputTokens/outputTokens', () => {
    expect(() =>
      calculateCost({ model: 'gpt-5', provider: 'openai', usage: { foo: 1 }, at: '2026-08-05' }),
    ).toThrow(InvalidUsageError);
  });
});

describe('reasoning tokens with no dedicated reasoning rate', () => {
  it('bills reasoning at the output rate and warns, rather than dropping the tokens', () => {
    const result = calculateCost({
      model: 'gpt-5',
      provider: 'openai',
      usage: { inputTokens: 0, outputTokens: 1_000_000, reasoningTokens: 200_000 },
      at: '2026-08-05',
    });
    // ordinary output = 800,000 @ $10.00/M = $8.00; reasoning = 200,000 @ $10.00/M (fallback) = $2.00
    expect(result.output.costUsdExact).toBe('8.00');
    expect(result.reasoning?.costUsdExact).toBe('2.00');
    expect(result.warnings.some((w) => w.code === 'REASONING_PRICED_AS_OUTPUT')).toBe(true);
  });
});

describe('cached/cache-write tokens with no dedicated rate (groq has neither)', () => {
  it('bills both at the input rate and warns for each', () => {
    const result = calculateCost({
      model: 'llama-3.3-70b-versatile',
      provider: 'groq',
      usage: {
        inputTokens: 1000,
        outputTokens: 0,
        cachedInputTokens: 100,
        cacheWriteTokens: 100,
      },
      at: '2026-08-05',
    });
    expect(result.cachedInput?.rate).toBe(result.input.rate);
    expect(result.cacheWrite?.rate).toBe(result.input.rate);
    expect(result.warnings.some((w) => w.code === 'CACHED_INPUT_PRICED_AS_INPUT')).toBe(true);
    expect(result.warnings.some((w) => w.code === 'CACHE_WRITE_PRICED_AS_INPUT')).toBe(true);
  });
});

describe('a pricing correction landing with an earlier effective date', () => {
  it('selectPeriodOrThrow still resolves the latest-effectiveFrom period covering the lookup date', () => {
    // claude-sonnet-5's introductory period (2026-01-01..2026-09-01) already
    // demonstrates this at the registry level; here we assert the same
    // behavior end-to-end through calculateCost.
    const early = calculateCost({
      model: 'claude-sonnet-5',
      provider: 'anthropic',
      usage: { inputTokens: 1_000_000, outputTokens: 0 },
      at: '2026-02-01',
    });
    expect(early.input.costUsdExact).toBe('2.00');
  });
});

// A provider qualifier is a constraint, not a hint: a provider-qualified
// lookup that misses under the requested provider must throw rather than
// falling through to a globally-unambiguous match under a *different*
// provider, which would price the request at that other provider's rate
// with zero warnings and `breakdown.provider` quietly disagreeing with the
// `provider` that was passed in. Verified against the real generated
// registry, not a fixture.
describe('a provider-qualified lookup does not silently fall through to a different provider', () => {
  it('gpt-5.5-pro is OpenAI-only: qualifying it to azure-openai throws UNKNOWN_MODEL rather than returning OpenAI pricing', () => {
    let error: unknown;
    try {
      calculateCost({
        model: 'gpt-5.5-pro',
        provider: 'azure-openai',
        usage: { inputTokens: 1_000_000, outputTokens: 0 },
        at: '2026-08-05',
      });
    } catch (e) {
      error = e;
    }
    assertErrorShape(error, { name: 'UnknownModelError', code: 'UNKNOWN_MODEL' });
    expect((error as { otherProviders?: readonly string[] }).otherProviders).toEqual(['openai']);
  });

  it('claude-opus-4-6 is anthropic-only: qualifying it to groq throws UNKNOWN_MODEL rather than returning Anthropic pricing', () => {
    let error: unknown;
    try {
      calculateCost({
        model: 'claude-opus-4-6',
        provider: 'groq',
        usage: { inputTokens: 1_000_000, outputTokens: 1_000_000 },
        at: '2026-08-05',
      });
    } catch (e) {
      error = e;
    }
    assertErrorShape(error, { name: 'UnknownModelError', code: 'UNKNOWN_MODEL' });
    expect((error as { otherProviders?: readonly string[] }).otherProviders).toEqual(['anthropic']);
  });

  it('the same two lookups resolve exactly as before this fix once the provider qualifier is dropped', () => {
    // Unqualified resolution must be completely unaffected by this fix:
    // both ids are globally unique (no other provider carries them), so
    // step 4 still resolves them via 'alias-global', at their own rates.
    const gptResult = calculateCost({
      model: 'gpt-5.5-pro',
      usage: { inputTokens: 1_000_000, outputTokens: 0 },
      at: '2026-08-05',
    });
    expect(gptResult.provider).toBe('openai');
    expect(gptResult.matchedBy).toBe('alias-global');
    expect(gptResult.totalUsdExact).toBe('30.00');

    const claudeResult = calculateCost({
      model: 'claude-opus-4-6',
      usage: { inputTokens: 1_000_000, outputTokens: 1_000_000 },
      at: '2026-08-05',
    });
    expect(claudeResult.provider).toBe('anthropic');
    expect(claudeResult.matchedBy).toBe('alias-global');
    expect(claudeResult.totalUsdExact).toBe('30.00');
  });

  it('a provider-qualified lookup with an explicit fallback uses the fallback rather than throwing', () => {
    const result = calculateCost(
      {
        model: 'claude-opus-4-6',
        provider: 'groq',
        usage: { inputTokens: 1000, outputTokens: 1000 },
        at: '2026-08-05',
      },
      { fallback: 'gpt-oss-120b' },
    );
    expect(result.matchedBy).toBe('fallback');
    expect(result.canonicalModel).toBe('gpt-oss-120b');
    // `requestedProvider` still reflects what was asked for, even though the
    // fallback landed on a different provider — this is the one path where
    // that divergence is expected, and it is now visible on the breakdown.
    expect(result.requestedProvider).toBe('groq');
  });

  it('a genuine cross-provider Azure/OpenAI price divergence stays qualifier-sensitive (gpt-5.6-luna, 5x)', () => {
    const onOpenAI = calculateCost({
      model: 'gpt-5.6-luna',
      provider: 'openai',
      usage: { inputTokens: 1_000_000, outputTokens: 0 },
      at: '2026-08-05',
    });
    const onAzure = calculateCost({
      model: 'gpt-5.6-luna',
      provider: 'azure-openai',
      usage: { inputTokens: 1_000_000, outputTokens: 0 },
      at: '2026-08-05',
    });
    expect(onOpenAI.provider).toBe('openai');
    expect(onAzure.provider).toBe('azure-openai');
    expect(onOpenAI.totalUsdExact).toBe('0.20');
    expect(onAzure.totalUsdExact).toBe('1.00');
  });
});
