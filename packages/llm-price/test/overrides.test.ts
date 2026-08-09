/**
 * Custom/negotiated pricing overrides and resolution precedence — an exact
 * custom override is the highest-precedence resolution step.
 */
import { describe, expect, it } from 'vitest';
import { calculateCost } from '../src/calculate-cost.js';
import { createPriceOverride } from '../src/overrides.js';
import { resolveModel } from '../src/resolve-model.js';

describe('createPriceOverride + override precedence', () => {
  it('a custom override takes precedence over a registry model of the same canonical id', () => {
    const override = createPriceOverride({
      canonicalId: 'gpt-5',
      provider: 'openai',
      input: '0.01',
      output: '0.02',
    });

    const result = calculateCost(
      {
        model: 'gpt-5',
        provider: 'openai',
        usage: { inputTokens: 1_000_000, outputTokens: 1_000_000 },
      },
      { overrides: [override] },
    );

    expect(result.input.costUsdExact).toBe('0.01');
    expect(result.output.costUsdExact).toBe('0.02');
  });

  it('is pure: identical input always builds an identical descriptor (no system clock read)', () => {
    const a = createPriceOverride({ canonicalId: 'x', input: '1', output: '2' });
    const b = createPriceOverride({ canonicalId: 'x', input: '1', output: '2' });
    expect(a).toEqual(b);
    expect(a.pricing?.[0]?.effectiveFrom).toBe('1970-01-01');
    expect(a.pricing?.[0]?.observedAt).toBe('1970-01-01');
  });

  it('a negotiated deal can use a provider label outside the baseline registry', () => {
    const override = createPriceOverride({
      canonicalId: 'my-negotiated-model',
      provider: 'my-private-vendor',
      input: '5.00',
      output: '5.00',
    });
    const resolved = resolveModel('my-negotiated-model', { overrides: [override] });
    expect(resolved.descriptor.provider).toBe('my-private-vendor');
    expect(resolved.matchedBy).toBe('override');
  });

  it('respects a custom effectiveFrom/effectiveTo window', () => {
    const override = createPriceOverride({
      canonicalId: 'seasonal-model',
      input: '1.00',
      output: '1.00',
      effectiveFrom: '2026-01-01',
      effectiveTo: '2026-06-01',
    });
    expect(() =>
      calculateCost(
        { model: 'seasonal-model', usage: { inputTokens: 1, outputTokens: 1 }, at: '2027-01-01' },
        { overrides: [override] },
      ),
    ).toThrow(/No pricing period/);
  });

  it('supports cachedInput/cacheWrite/reasoning/batchMultiplier overrides', () => {
    const override = createPriceOverride({
      canonicalId: 'full-shape-model',
      input: '1.00',
      output: '2.00',
      cachedInput: '0.10',
      cacheWrite: '1.50',
      reasoning: '3.00',
      batchMultiplier: '0.5',
    });
    const result = calculateCost(
      {
        model: 'full-shape-model',
        usage: {
          inputTokens: 1_000_000,
          outputTokens: 1_000_000,
          cachedInputTokens: 100_000,
          cacheWriteTokens: 100_000,
          reasoningTokens: 100_000,
        },
        mode: 'batch',
      },
      { overrides: [override] },
    );
    expect(result.cachedInput?.rate).toBe('0.05');
    expect(result.cacheWrite?.rate).toBe('0.75');
    expect(result.reasoning?.rate).toBe('1.50');
    expect(result.warnings.some((w) => w.code === 'BATCH_PRICING_UNAVAILABLE')).toBe(false);
  });
});

describe('resolveModel fallback (resolution step 5)', () => {
  it('falls back to a configured canonical id when nothing else matches', () => {
    const resolved = resolveModel('totally-unknown-id', { fallback: 'gpt-5' });
    expect(resolved.matchedBy).toBe('fallback');
    expect(resolved.descriptor.canonicalId).toBe('gpt-5');
  });
});
