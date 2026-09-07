/**
 * Historical lookup by effective date - the mandated golden fixture,
 * exercised through `calculateCost` end to end against the real generated
 * registry.
 *
 * The fixture is google:gemini-3.6-flash, whose promotional rate Google
 * publishes as running through 2026-12-31 with the standard rate resuming
 * 2027-01-01 - both boundary dates sourced from the provider rather than
 * inferred. It replaced anthropic:claude-sonnet-5, which carried this role
 * until Anthropic cancelled the increase that gave it two periods; the
 * cancellation itself is pinned at the end of the first block.
 */
import { assertErrorShape } from '@llm-kit/test-utils';
import { describe, expect, it } from 'vitest';
import { calculateCost } from '../src/calculate-cost.js';

describe('gemini-3.6-flash promotional/standard rate boundary', () => {
  const MODEL = { model: 'gemini-3.6-flash', provider: 'google' } as const;

  it('a lookup dated 2026-08-15 gets the pre-promotional rate: $1.50 / $7.50 per million tokens', () => {
    const result = calculateCost({
      ...MODEL,
      usage: { inputTokens: 1_000_000, outputTokens: 1_000_000 },
      at: '2026-08-15',
    });
    expect(result.input.costUsdExact).toBe('1.50');
    expect(result.output.costUsdExact).toBe('7.50');
    expect(result.pricingEffectiveFrom).toBe('2026-01-01');
  });

  it('a lookup dated 2026-11-01 gets the promotional rate: $0.75 / $3.75 per million tokens', () => {
    const result = calculateCost({
      ...MODEL,
      usage: { inputTokens: 1_000_000, outputTokens: 1_000_000 },
      at: '2026-11-01',
    });
    expect(result.input.costUsdExact).toBe('0.75');
    expect(result.output.costUsdExact).toBe('3.75');
    expect(result.pricingEffectiveFrom).toBe('2026-09-07');
  });

  it('the boundary instant itself (2027-01-01) already belongs to the resumed standard rate', () => {
    const result = calculateCost({
      ...MODEL,
      usage: { inputTokens: 1_000_000, outputTokens: 0 },
      at: '2027-01-01',
    });
    expect(result.input.costUsdExact).toBe('1.50');
    expect(result.pricingEffectiveFrom).toBe('2027-01-01');
  });

  it('accepts a Date instance identically to an ISO string', () => {
    const result = calculateCost({
      ...MODEL,
      usage: { inputTokens: 1_000_000, outputTokens: 0 },
      at: new Date('2026-11-01T12:00:00Z'),
    });
    expect(result.input.costUsdExact).toBe('0.75');
  });

  it('defaults `at` to the current date when omitted', () => {
    // Which period "now" falls in depends on when this runs, so assert only
    // that it is one of this model's real rates.
    const result = calculateCost({
      ...MODEL,
      usage: { inputTokens: 1_000_000, outputTokens: 0 },
    });
    expect(['1.50', '0.75']).toContain(result.input.costUsdExact);
  });
});

describe('claude-sonnet-5 no longer has a rate boundary', () => {
  // Anthropic's pricing page states the $3.00/$15.00 increase scheduled for
  // 2026-09-01 will not occur and $2.00/$10.00 is now the standard rate. The
  // dates either side of that cancelled boundary must price identically -
  // this is the end-to-end guard against the removed period coming back.
  it.each(['2026-08-15', '2026-09-01', '2026-09-15', '2027-06-01'])(
    'prices $2.00 / $10.00 per million tokens at %s',
    (at) => {
      const result = calculateCost({
        model: 'claude-sonnet-5',
        provider: 'anthropic',
        usage: { inputTokens: 1_000_000, outputTokens: 1_000_000 },
        at,
      });
      expect(result.input.costUsdExact).toBe('2.00');
      expect(result.output.costUsdExact).toBe('10.00');
      expect(result.pricingEffectiveFrom).toBe('2026-01-01');
    },
  );
});

describe("OpenRouter's claude-sonnet-5 entry", () => {
  // Recorded 2026-08-05 flagged UNCERTAIN, because $2.00/$10.00 matched what
  // was then Anthropic's introductory rate. That rate is now the standard
  // rate, so OpenRouter's number is simply the first-party rate.
  it('matches the first-party standard rate', () => {
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
// lookup date. $4.50 versus $9.00 for one identical request is the whole
// cost of reading a timestamp in whatever timezone the host happens to run.
describe('an ISO lookup date prices the same on every host', () => {
  const USAGE = { inputTokens: 1_000_000, outputTokens: 1_000_000 };

  function priceAt(at: Date | string): string {
    return calculateCost({ model: 'gemini-3.6-flash', provider: 'google', usage: USAGE, at })
      .totalUsdExact;
  }

  it.each([
    ['an ISO date, UTC by spec', '2026-12-31', '4.50'],
    ['a Z-suffixed datetime just inside the promotional period', '2026-12-31T23:59:59Z', '4.50'],
    ['a Z-suffixed datetime just past it', '2027-01-01T00:00:00Z', '9.00'],
    ['an offset that moves the instant across the boundary', '2027-01-01T05:00:00+14:00', '4.50'],
    // Offset-less: read as UTC, so this is the standard rate everywhere. Read
    // in local time it would be the promotional rate anywhere east of UTC.
    ['an offset-less datetime, the log-timestamp shape', '2027-01-01T05:00:00', '9.00'],
    ['an offset-less datetime just short of the boundary', '2026-12-31T23:59:59', '4.50'],
  ])('prices %s reproducibly', (_label, at, expected) => {
    expect(priceAt(at)).toBe(expected);
  });

  it('prices an offset-less datetime identically to its explicit-UTC form', () => {
    expect(priceAt('2027-01-01T05:00:00')).toBe(priceAt('2027-01-01T05:00:00Z'));
    expect(priceAt('2027-01-01T05:00:00')).toBe(priceAt(new Date('2027-01-01T05:00:00Z')));
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
