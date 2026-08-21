import { assertErrorShape, assertJsonSerializable } from '@llm-kit/test-utils';
import { describe, expect, it } from 'vitest';
import { createCostAggregator, sumExactUsd } from '../src/aggregate.js';
import { calculateCost } from '../src/calculate-cost.js';
import type { CostBreakdown } from '../src/types.js';

// The whole point of the exact channel: these three values are individually
// representable as doubles but their float sum is not 0.30.
const FLOAT_TRAP = ['0.10', '0.20'] as const;

function breakdown(overrides: Partial<CostBreakdown> = {}): CostBreakdown {
  const base = calculateCost({
    model: 'gpt-4o',
    provider: 'openai',
    usage: { inputTokens: 1000, outputTokens: 1000 },
    at: '2026-01-15',
  });
  return { ...base, ...overrides };
}

describe('sumExactUsd', () => {
  it('sums exactly where float addition drifts', () => {
    expect(sumExactUsd(FLOAT_TRAP)).toBe('0.30');
    expect(0.1 + 0.2).not.toBe(0.3); // the drift this exists to avoid
  });

  it('returns "0.00" for an empty list', () => {
    expect(sumExactUsd([])).toBe('0.00');
  });

  it('sums values of differing scales without rounding', () => {
    expect(sumExactUsd(['0.000001', '0.00', '1.5'])).toBe('1.500001');
  });

  it('stays exact over many values, where a float sum visibly drifts', () => {
    const values = Array.from({ length: 10_000 }, () => '0.000001');
    expect(sumExactUsd(values)).toBe('0.01');

    let float = 0;
    for (const value of values) float += Number(value);
    expect(float).not.toBe(0.01);
  });

  it.each([
    ['not a number', 'abc'],
    ['a negative amount', '-1.00'],
    ['exponent notation', '1e-7'],
    ['NaN', 'NaN'],
    ['Infinity', 'Infinity'],
    ['an empty string', ''],
    ['a trailing dot', '1.'],
    ['a number that slipped past the type', 1.5 as unknown as string],
  ])('rejects %s rather than coercing it', (_label, value) => {
    let error: unknown;
    try {
      sumExactUsd(['1.00', value]);
    } catch (e) {
      error = e;
    }
    assertErrorShape(error, { name: 'InvalidRateError', code: 'INVALID_RATE' });
    // The message names *which* element failed, not just that one did.
    expect((error as Error).message).toContain('values[1]');
  });
});

describe('createCostAggregator', () => {
  it('reports an empty aggregate rather than throwing', () => {
    const aggregator = createCostAggregator();
    expect(aggregator.total()).toEqual({
      count: 0,
      totalUsd: 0,
      totalUsdExact: '0.00',
      registryVersions: [],
    });
    expect(aggregator.byModel().size).toBe(0);
  });

  it('accumulates exactly and matches sumExactUsd over the same values', () => {
    const aggregator = createCostAggregator();
    const breakdowns = [
      breakdown({ totalUsdExact: '0.10' }),
      breakdown({ totalUsdExact: '0.20' }),
      breakdown({ totalUsdExact: '0.000003' }),
    ];
    for (const item of breakdowns) aggregator.add(item);

    const total = aggregator.total();
    expect(total.count).toBe(3);
    expect(total.totalUsdExact).toBe('0.300003');
    expect(total.totalUsdExact).toBe(sumExactUsd(breakdowns.map((b) => b.totalUsdExact)));
    expect(total.totalUsd).toBe(0.300003);
  });

  it('buckets by resolved identity, so a real alias and its canonical id share a bucket', () => {
    // "claude-haiku-4-5" is a registry alias of "claude-haiku-4-5-20251001" —
    // priced through the two ids, the same model must land in one bucket,
    // keyed by the canonical identity rather than by whatever the caller typed.
    const usage = { inputTokens: 1_000_000, outputTokens: 0 };
    const aggregator = createCostAggregator();
    for (const model of ['claude-haiku-4-5', 'claude-haiku-4-5-20251001']) {
      aggregator.add(calculateCost({ model, provider: 'anthropic', usage, at: '2026-08-15' }));
    }
    aggregator.add(breakdown({ totalUsdExact: '4.00' }));

    const byModel = aggregator.byModel();
    const haikuKey = 'anthropic:claude-haiku-4-5-20251001';
    expect([...byModel.keys()].sort()).toEqual([haikuKey, 'openai:gpt-4o'].sort());
    expect(byModel.get(haikuKey)?.count).toBe(2);
    const oneHaiku = calculateCost({
      model: 'claude-haiku-4-5',
      provider: 'anthropic',
      usage,
      at: '2026-08-15',
    }).totalUsdExact;
    expect(byModel.get(haikuKey)?.totalUsdExact).toBe(sumExactUsd([oneHaiku, oneHaiku]));
    expect(byModel.get('openai:gpt-4o')?.totalUsdExact).toBe('4.00');
    expect(aggregator.total().count).toBe(3);
  });

  it('records every registry version seen, so a mixed-snapshot total is visible', () => {
    const aggregator = createCostAggregator();
    aggregator.add(breakdown({ registryVersion: 'v2', totalUsdExact: '1.00' }));
    aggregator.add(breakdown({ registryVersion: 'v1', totalUsdExact: '1.00' }));
    aggregator.add(breakdown({ registryVersion: 'v1', totalUsdExact: '1.00' }));
    expect(aggregator.total().registryVersions).toEqual(['v1', 'v2']);
  });

  it('reports one registry version when nothing was mixed', () => {
    const aggregator = createCostAggregator();
    aggregator.add(breakdown());
    aggregator.add(breakdown());
    expect(aggregator.total().registryVersions).toEqual([breakdown().registryVersion]);
  });

  it('rejects a malformed totalUsdExact instead of letting it land in a total', () => {
    const aggregator = createCostAggregator();
    aggregator.add(breakdown({ totalUsdExact: '1.00' }));
    let error: unknown;
    try {
      aggregator.add(breakdown({ totalUsdExact: 'NaN' }));
    } catch (e) {
      error = e;
    }
    assertErrorShape(error, { name: 'InvalidRateError', code: 'INVALID_RATE' });
    // The rejected breakdown left no trace — count and total are untouched.
    expect(aggregator.total()).toMatchObject({ count: 1, totalUsdExact: '1.00' });
  });

  it('returns a snapshot of byModel, not a live view of the aggregator', () => {
    const aggregator = createCostAggregator();
    aggregator.add(breakdown({ totalUsdExact: '1.00' }));
    const snapshot = aggregator.byModel();
    aggregator.add(breakdown({ totalUsdExact: '1.00' }));
    expect([...snapshot.values()][0]?.totalUsdExact).toBe('1.00');
    expect([...aggregator.byModel().values()][0]?.totalUsdExact).toBe('2.00');
  });

  it('produces JSON-serializable results', () => {
    const aggregator = createCostAggregator();
    aggregator.add(breakdown());
    assertJsonSerializable(aggregator.total());
    assertJsonSerializable(Object.fromEntries(aggregator.byModel()));
  });
});
