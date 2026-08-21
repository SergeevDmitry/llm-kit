/**
 * Historical lookup by effective date — the mandated golden fixture: the
 * real claude-sonnet-5 introductory rate expiring 2026-08-31, exercised
 * through `calculateCost` end to end against the real generated registry.
 */
import { assertErrorShape } from '@llm-kit/test-utils';
import { describe, expect, it } from 'vitest';
import { calculateCost } from '../src/calculate-cost.js';

describe('claude-sonnet-5 introductory/standard rate boundary', () => {
  it('a lookup dated 2026-08-15 gets the introductory rate: $2.00 / $10.00 per million tokens', () => {
    const result = calculateCost({
      model: 'claude-sonnet-5',
      provider: 'anthropic',
      usage: { inputTokens: 1_000_000, outputTokens: 1_000_000 },
      at: '2026-08-15',
    });
    expect(result.input.costUsdExact).toBe('2.00');
    expect(result.output.costUsdExact).toBe('10.00');
    expect(result.pricingEffectiveFrom).toBe('2026-01-01');
  });

  it('a lookup dated 2026-09-15 gets the standard rate: $3.00 / $15.00 per million tokens', () => {
    const result = calculateCost({
      model: 'claude-sonnet-5',
      provider: 'anthropic',
      usage: { inputTokens: 1_000_000, outputTokens: 1_000_000 },
      at: '2026-09-15',
    });
    expect(result.input.costUsdExact).toBe('3.00');
    expect(result.output.costUsdExact).toBe('15.00');
    expect(result.pricingEffectiveFrom).toBe('2026-09-01');
  });

  it('the boundary instant itself (2026-09-01) already belongs to the standard rate', () => {
    const result = calculateCost({
      model: 'claude-sonnet-5',
      provider: 'anthropic',
      usage: { inputTokens: 1_000_000, outputTokens: 0 },
      at: '2026-09-01',
    });
    expect(result.input.costUsdExact).toBe('3.00');
  });

  it('accepts a Date instance identically to an ISO string', () => {
    const result = calculateCost({
      model: 'claude-sonnet-5',
      provider: 'anthropic',
      usage: { inputTokens: 1_000_000, outputTokens: 0 },
      at: new Date('2026-08-15T12:00:00Z'),
    });
    expect(result.input.costUsdExact).toBe('2.00');
  });

  it('defaults `at` to the current date when omitted', () => {
    // At the time this registry snapshot was taken (2026-08-05), "now" falls
    // inside the introductory window.
    const result = calculateCost({
      model: 'claude-sonnet-5',
      provider: 'anthropic',
      usage: { inputTokens: 1_000_000, outputTokens: 0 },
    });
    expect(['2.00', '3.00']).toContain(result.input.costUsdExact);
  });
});

describe("OpenRouter's UNCERTAIN-flagged claude-sonnet-5 entry", () => {
  it('is left as recorded — matches the introductory rate, not the standard rate', () => {
    const result = calculateCost({
      model: 'anthropic/claude-sonnet-5',
      provider: 'openrouter',
      usage: { inputTokens: 1_000_000, outputTokens: 1_000_000 },
      at: '2026-08-05',
    });
    expect(result.input.costUsdExact).toBe('2.00');
    expect(result.output.costUsdExact).toBe('10.00');
  });
});

// The same boundary, reached through the public money path with an ISO
// lookup date. $12.00 versus $18.00 for one identical request is the whole
// cost of reading a timestamp in whatever timezone the host happens to run.
describe('an ISO lookup date prices the same on every host', () => {
  const USAGE = { inputTokens: 1_000_000, outputTokens: 1_000_000 };

  function priceAt(at: Date | string): string {
    return calculateCost({ model: 'claude-sonnet-5', provider: 'anthropic', usage: USAGE, at })
      .totalUsdExact;
  }

  it.each([
    ['an ISO date, UTC by spec', '2026-08-31', '12.00'],
    ['a Z-suffixed datetime just inside the introductory period', '2026-08-31T23:59:59Z', '12.00'],
    ['a Z-suffixed datetime just past it', '2026-09-01T00:00:00Z', '18.00'],
    ['an offset that moves the instant across the boundary', '2026-09-01T05:00:00+14:00', '12.00'],
    // Offset-less: read as UTC, so this is the standard rate everywhere. Read
    // in local time it would be the introductory rate anywhere east of UTC.
    ['an offset-less datetime, the log-timestamp shape', '2026-09-01T05:00:00', '18.00'],
    ['an offset-less datetime just short of the boundary', '2026-08-31T23:59:59', '12.00'],
  ])('prices %s reproducibly', (_label, at, expected) => {
    expect(priceAt(at)).toBe(expected);
  });

  it('prices an offset-less datetime identically to its explicit-UTC form', () => {
    expect(priceAt('2026-09-01T05:00:00')).toBe(priceAt('2026-09-01T05:00:00Z'));
    expect(priceAt('2026-09-01T05:00:00')).toBe(priceAt(new Date('2026-09-01T05:00:00Z')));
  });

  it('reports an invalid Date as INVALID_LOOKUP_DATE, not an uncoded RangeError', () => {
    let error: unknown;
    try {
      priceAt(new Date('not-a-date'));
    } catch (e) {
      error = e;
    }
    assertErrorShape(error, { name: 'InvalidLookupDateError', code: 'INVALID_LOOKUP_DATE' });
  });
});
