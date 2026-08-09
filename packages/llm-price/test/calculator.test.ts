import { describe, expect, it } from 'vitest';
import { createPriceCalculator } from '../src/calculator.js';
import { createPriceOverride } from '../src/overrides.js';

describe('createPriceCalculator', () => {
  it('bundles default overrides so every calculateCost call reuses them', () => {
    const override = createPriceOverride({
      canonicalId: 'gpt-5',
      provider: 'openai',
      input: '0.01',
      output: '0.02',
    });
    const calculator = createPriceCalculator({ overrides: [override] });

    const result = calculator.calculateCost({
      model: 'gpt-5',
      provider: 'openai',
      usage: { inputTokens: 1_000_000, outputTokens: 1_000_000 },
    });
    expect(result.input.costUsdExact).toBe('0.01');
  });

  it('a per-call override list replaces (not merges with) the calculator default', () => {
    const defaultOverride = createPriceOverride({
      canonicalId: 'gpt-5',
      provider: 'openai',
      input: '0.01',
      output: '0.02',
    });
    const perCallOverride = createPriceOverride({
      canonicalId: 'gpt-5',
      provider: 'openai',
      input: '9.00',
      output: '9.00',
    });
    const calculator = createPriceCalculator({ overrides: [defaultOverride] });

    const result = calculator.calculateCost(
      {
        model: 'gpt-5',
        provider: 'openai',
        usage: { inputTokens: 1_000_000, outputTokens: 0 },
      },
      { overrides: [perCallOverride] },
    );
    expect(result.input.costUsdExact).toBe('9.00');
  });

  it('exposes resolveModel with the same bundled defaults', () => {
    const override = createPriceOverride({ canonicalId: 'private-model', input: '1', output: '1' });
    const calculator = createPriceCalculator({ overrides: [override] });
    const resolved = calculator.resolveModel('private-model');
    expect(resolved.matchedBy).toBe('override');
  });

  it('with no options, behaves identically to the bare functions against the bundled registry', () => {
    const calculator = createPriceCalculator();
    const result = calculator.calculateCost({
      model: 'gpt-5',
      provider: 'openai',
      usage: { inputTokens: 1_000_000, outputTokens: 1_000_000 },
      at: '2026-08-05',
    });
    expect(result.input.costUsdExact).toBe('1.25');
  });
});
