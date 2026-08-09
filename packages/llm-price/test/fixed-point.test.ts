import { assertErrorShape } from '@llm-kit/test-utils';
import { describe, expect, it } from 'vitest';
import {
  addExact,
  costOfTokens,
  formatExact,
  multiplyExact,
  parseDecimalRate,
  toDisplayNumber,
  ZERO,
} from '../src/fixed-point.js';
import { InvalidRateError } from '../src/errors.js';

describe('parseDecimalRate', () => {
  it('parses an integer rate exactly', () => {
    expect(parseDecimalRate('3', 'input')).toEqual({ numerator: 3n, scale: 0 });
  });

  it('parses a two-decimal rate exactly', () => {
    expect(parseDecimalRate('3.00', 'input')).toEqual({ numerator: 300n, scale: 2 });
  });

  it('parses a three-decimal rate exactly, preserving trailing zeros in the numerator', () => {
    expect(parseDecimalRate('3.125', 'cacheWrite')).toEqual({ numerator: 3125n, scale: 3 });
  });

  it('parses a sub-cent rate exactly (0.005)', () => {
    expect(parseDecimalRate('0.005', 'cachedInput')).toEqual({ numerator: 5n, scale: 3 });
  });

  it('rejects a negative rate', () => {
    let error: unknown;
    try {
      parseDecimalRate('-1.00', 'input');
    } catch (e) {
      error = e;
    }
    assertErrorShape(error, { name: 'InvalidRateError', code: 'INVALID_RATE' });
    expect(error).toBeInstanceOf(InvalidRateError);
  });

  it('rejects a non-numeric rate', () => {
    expect(() => parseDecimalRate('abc', 'input')).toThrow(InvalidRateError);
  });

  it('rejects an empty string', () => {
    expect(() => parseDecimalRate('', 'input')).toThrow(InvalidRateError);
  });
});

describe('costOfTokens — exact tokens*rate/1,000,000', () => {
  it('1,000,000 tokens at $3.00/M costs exactly $3.00', () => {
    const rate = parseDecimalRate('3.00', 'input');
    const cost = costOfTokens(1_000_000, rate);
    expect(formatExact(cost)).toBe('3.00');
  });

  it('333,333 tokens at $1.10/M costs an exact, non-round amount', () => {
    const rate = parseDecimalRate('1.10', 'input');
    const cost = costOfTokens(333_333, rate);
    // 333333 * 1.10 / 1e6 = 366666.3 / 1e6 = 0.3666663
    expect(formatExact(cost)).toBe('0.3666663');
  });

  it('0 tokens costs exactly 0, regardless of rate', () => {
    const rate = parseDecimalRate('999.99', 'input');
    expect(formatExact(costOfTokens(0, rate))).toBe('0.00');
  });

  it('a very large aggregate token count stays exact', () => {
    const rate = parseDecimalRate('2.50', 'input');
    const cost = costOfTokens(Number.MAX_SAFE_INTEGER, rate);
    // Independently computed: 9_007_199_254_740_991 * 2.50 / 1_000_000.
    expect(formatExact(cost)).toBe('22517998136.8524775');
  });
});

describe('multiplyExact — folding a batch multiplier into a rate', () => {
  it('halves a rate for a 0.5 batch multiplier, exactly', () => {
    const rate = parseDecimalRate('4.00', 'input');
    const multiplier = parseDecimalRate('0.5', 'batchMultiplier');
    const effective = multiplyExact(rate, multiplier);
    const cost = costOfTokens(1_000_000, effective);
    expect(formatExact(cost)).toBe('2.00');
  });
});

describe('addExact — exact summation across different scales', () => {
  it('sums amounts with different decimal precision without rounding', () => {
    const a = { numerator: 300n, scale: 2 }; // 3.00
    const b = { numerator: 3125n, scale: 3 }; // 3.125
    expect(formatExact(addExact([a, b]))).toBe('6.125');
  });

  it('returns exactly zero for an empty list', () => {
    expect(addExact([])).toEqual(ZERO);
  });
});

describe('formatExact', () => {
  it('always shows at least two decimal places', () => {
    expect(formatExact({ numerator: 3n, scale: 0 })).toBe('3.00');
  });

  it('trims trailing zeros beyond two decimal places without changing the value', () => {
    expect(formatExact({ numerator: 300000n, scale: 5 })).toBe('3.00');
  });

  it('preserves genuine non-zero low-order digits', () => {
    expect(formatExact({ numerator: 3125n, scale: 3 })).toBe('3.125');
  });

  it('formats a negative amount with a leading minus sign', () => {
    expect(formatExact({ numerator: -150n, scale: 2 })).toBe('-1.50');
  });
});

describe('fixed-point vs. naive floating point — the authoritative-path proof', () => {
  it('naive float summation visibly diverges from exact BigInt summation over many repeated line items', () => {
    // A realistic scenario: 100,000 separate requests, each 333,333 tokens
    // billed at $1.10 per million tokens. Naive per-call float division
    // followed by float accumulation drifts measurably from the true total;
    // this package's exact fixed-point path does not.
    const tokensPerCall = 333_333;
    const rateUsdPerMillion = 1.1; // the same rate, deliberately read as a JS number here
    const callCount = 100_000;

    let naiveTotal = 0;
    for (let i = 0; i < callCount; i += 1) {
      naiveTotal += (tokensPerCall * rateUsdPerMillion) / 1_000_000;
    }

    const rate = parseDecimalRate('1.10', 'input');
    const perCall = costOfTokens(tokensPerCall, rate);
    const exactTotal = addExact(Array.from({ length: callCount }, () => perCall));
    const exactTotalUsd = toDisplayNumber(exactTotal);

    expect(formatExact(exactTotal)).toBe('36666.63');
    expect(exactTotalUsd).toBe(36666.63);
    // The naive float path does not land on the exact value: this is the
    // divergence exact fixed-point arithmetic exists to rule out on the
    // authoritative path. Assert both the raw inequality and a visible
    // magnitude of drift.
    expect(naiveTotal).not.toBe(exactTotalUsd);
    expect(Math.abs(naiveTotal - exactTotalUsd)).toBeGreaterThan(1e-9);
  });
});
