import { assertErrorShape, assertJsonSerializable } from '@llm-kit/test-utils';
import { describe, expect, it } from 'vitest';
import { selectPricingPeriod } from '../src/pricing-period.js';
import type { PricingPeriod } from '../src/types.js';

const SOURCE_URL = 'https://platform.claude.com/docs/en/about-claude/models/overview';
const OBSERVED_AT = '2026-08-05';

// The real claude-sonnet-5 shape from docs/provider-data/anthropic.json: an
// introductory rate through 2026-08-31, then the standard rate from
// 2026-09-01. This is the brief's mandated golden fixture for effective-date
// selection — the two most important boundary dates are asserted explicitly.
const SONNET_5_PERIODS: readonly PricingPeriod[] = [
  {
    effectiveFrom: '2026-01-01',
    effectiveTo: '2026-09-01',
    currency: 'USD',
    unit: 'per-million-tokens',
    input: '2.00',
    output: '10.00',
    sourceUrl: SOURCE_URL,
    observedAt: OBSERVED_AT,
  },
  {
    effectiveFrom: '2026-09-01',
    currency: 'USD',
    unit: 'per-million-tokens',
    input: '3.00',
    output: '15.00',
    sourceUrl: SOURCE_URL,
    observedAt: OBSERVED_AT,
  },
];

describe('selectPricingPeriod — claude-sonnet-5 golden fixture', () => {
  it('a lookup dated 2026-08-15 selects the introductory rate ($2.00 / $10.00)', () => {
    const period = selectPricingPeriod(SONNET_5_PERIODS, '2026-08-15');
    expect(period?.input).toBe('2.00');
    expect(period?.output).toBe('10.00');
  });

  it('a lookup dated 2026-09-15 selects the standard rate ($3.00 / $15.00)', () => {
    const period = selectPricingPeriod(SONNET_5_PERIODS, '2026-09-15');
    expect(period?.input).toBe('3.00');
    expect(period?.output).toBe('15.00');
  });

  it('the boundary itself (2026-09-01) already belongs to the standard rate — effectiveTo is exclusive', () => {
    const period = selectPricingPeriod(SONNET_5_PERIODS, '2026-09-01');
    expect(period?.input).toBe('3.00');
  });

  it('the last instant of the introductory window (2026-08-31) still selects the introductory rate', () => {
    const period = selectPricingPeriod(SONNET_5_PERIODS, '2026-08-31');
    expect(period?.input).toBe('2.00');
  });

  it('accepts a Date instance as well as an ISO string', () => {
    const period = selectPricingPeriod(SONNET_5_PERIODS, new Date('2026-08-15T12:00:00Z'));
    expect(period?.input).toBe('2.00');
  });
});

describe('selectPricingPeriod — edge cases', () => {
  it('returns undefined for a lookup before the first known period, without throwing', () => {
    const period = selectPricingPeriod(SONNET_5_PERIODS, '2025-01-01');
    expect(period).toBeUndefined();
  });

  it('returns undefined for an empty period list', () => {
    expect(selectPricingPeriod([], '2026-08-15')).toBeUndefined();
  });

  it('picks the latest effectiveFrom when a correction lands with an earlier effective date than an existing period (out-of-order input)', () => {
    // A provider restates a price: the correction has an earlier effective
    // date than the period it supersedes, appended after it in source order.
    // selectPricingPeriod must not assume chronological input order.
    const withLateCorrection: readonly PricingPeriod[] = [
      { ...SONNET_5_PERIODS[1]!, effectiveFrom: '2026-09-01' },
      {
        ...SONNET_5_PERIODS[0]!,
        effectiveFrom: '2026-01-01',
        effectiveTo: '2026-09-01',
        input: '2.50',
      },
    ];
    const period = selectPricingPeriod(withLateCorrection, '2026-08-15');
    expect(period?.input).toBe('2.50');
  });

  it('raises INVALID_LOOKUP_DATE for an unparseable at value, distinct from "no period matched"', () => {
    let error: unknown;
    try {
      selectPricingPeriod(SONNET_5_PERIODS, 'not-a-date');
    } catch (e) {
      error = e;
    }
    assertErrorShape(error, { name: 'InvalidLookupDateError', code: 'INVALID_LOOKUP_DATE' });
  });
});

// An exact `effectiveFrom` tie among qualifying periods must not be resolved
// by array order with no diagnostic (`fromMs > bestFromMs` never re-triggers
// on an equal value, so whichever period was listed first would silently
// keep winning). `validateModelDescriptor` rejects overlapping periods for
// the generated registry — and two periods sharing `effectiveFrom`
// necessarily overlap — so this is unreachable there; it is reachable only
// through a caller-supplied `ModelDescriptor` (e.g. `usage-tab`'s
// `options.overrides`) that never passed that validator.
describe('selectPricingPeriod — ambiguous tie on effectiveFrom', () => {
  it('throws AmbiguousPricingPeriodError when two qualifying periods share the same effectiveFrom', () => {
    const tiedPeriods: readonly PricingPeriod[] = [
      { ...SONNET_5_PERIODS[0]!, input: '2.00' },
      { ...SONNET_5_PERIODS[0]!, input: '2.50' },
    ];
    let error: unknown;
    try {
      selectPricingPeriod(tiedPeriods, '2026-08-15');
    } catch (e) {
      error = e;
    }
    assertErrorShape(error, {
      name: 'AmbiguousPricingPeriodError',
      code: 'AMBIGUOUS_PRICING_PERIOD',
    });
    expect((error as { effectiveFrom: string }).effectiveFrom).toBe('2026-01-01');
    expect((error as { count: number }).count).toBe(2);
    expect((error as Error).message).toContain('2026-01-01');
    expect((error as Error).message).toContain('2026-08-15');
    // No identity was supplied — the pre-existing (identity-free) shape and
    // message must be unaffected: no model/provider fields set, no "for
    // model"/"for provider" clause in the message.
    expect((error as { canonicalId?: string }).canonicalId).toBeUndefined();
    expect((error as { provider?: string }).provider).toBeUndefined();
    expect((error as Error).message).not.toMatch(/for model|for provider/);
  });

  it('names the model and provider in the message and as structured properties when an identity is supplied', () => {
    const tiedPeriods: readonly PricingPeriod[] = [
      { ...SONNET_5_PERIODS[0]!, input: '2.00' },
      { ...SONNET_5_PERIODS[0]!, input: '2.50' },
    ];
    let error: unknown;
    try {
      selectPricingPeriod(tiedPeriods, '2026-08-15', {
        canonicalId: 'claude-sonnet-5',
        provider: 'anthropic',
      });
    } catch (e) {
      error = e;
    }
    assertErrorShape(error, {
      name: 'AmbiguousPricingPeriodError',
      code: 'AMBIGUOUS_PRICING_PERIOD',
    });
    // Structured properties, not just message text — the model id must be
    // programmatically recoverable, matching `UnknownModelError`'s
    // `requestedId`/`provider` and `AmbiguousAliasError`'s `candidates`.
    expect((error as { canonicalId?: string }).canonicalId).toBe('claude-sonnet-5');
    expect((error as { provider?: string }).provider).toBe('anthropic');
    expect((error as { effectiveFrom: string }).effectiveFrom).toBe('2026-01-01');
    expect((error as { count: number }).count).toBe(2);
    // And the model id must actually appear in the human-readable message —
    // a caller working through many overrides needs this without inspecting
    // structured fields.
    expect((error as Error).message).toContain('claude-sonnet-5');
    expect((error as Error).message).toContain('anthropic');
    expect((error as Error).message).toContain('2026-01-01');
    expect((error as Error).message).toContain('2026-08-15');
    // The three remedies are still present.
    expect((error as Error).message).toContain('validateModelDescriptor');
    expect((error as Error).message).toMatch(/distinct effectiveFrom/);
    expect((error as Error).message).toMatch(/remove the duplicate/);
    assertJsonSerializable(
      {
        canonicalId: (error as { canonicalId?: string }).canonicalId,
        provider: (error as { provider?: string }).provider,
      },
      'AmbiguousPricingPeriodError identity',
    );
  });

  it('handles a partial identity (canonicalId only, or provider only) without throwing while building the message', () => {
    const tiedPeriods: readonly PricingPeriod[] = [
      { ...SONNET_5_PERIODS[0]!, input: '2.00' },
      { ...SONNET_5_PERIODS[0]!, input: '2.50' },
    ];
    expect(() =>
      selectPricingPeriod(tiedPeriods, '2026-08-15', { canonicalId: 'claude-sonnet-5' }),
    ).toThrow(/claude-sonnet-5/);
    expect(() => selectPricingPeriod(tiedPeriods, '2026-08-15', { provider: 'anthropic' })).toThrow(
      /anthropic/,
    );
  });

  it('throws for three-way ties too, reporting the full tied count', () => {
    const tiedPeriods: readonly PricingPeriod[] = [
      { ...SONNET_5_PERIODS[0]!, input: '2.00' },
      { ...SONNET_5_PERIODS[0]!, input: '2.25' },
      { ...SONNET_5_PERIODS[0]!, input: '2.50' },
    ];
    let error: unknown;
    try {
      selectPricingPeriod(tiedPeriods, '2026-08-15');
    } catch (e) {
      error = e;
    }
    assertErrorShape(error, {
      name: 'AmbiguousPricingPeriodError',
      code: 'AMBIGUOUS_PRICING_PERIOD',
    });
    expect((error as { count: number }).count).toBe(3);
  });

  it('does not throw when only the non-winning (earlier) effectiveFrom repeats — the tie must be among the latest-qualifying periods', () => {
    const periods: readonly PricingPeriod[] = [
      {
        ...SONNET_5_PERIODS[0]!,
        effectiveFrom: '2026-01-01',
        effectiveTo: '2026-02-01',
        input: '1.00',
      },
      {
        ...SONNET_5_PERIODS[0]!,
        effectiveFrom: '2026-01-01',
        effectiveTo: '2026-02-01',
        input: '1.50',
      },
      {
        ...SONNET_5_PERIODS[0]!,
        effectiveFrom: '2026-06-01',
        effectiveTo: undefined,
        input: '2.00',
      },
    ];
    const period = selectPricingPeriod(periods, '2026-08-15');
    expect(period?.input).toBe('2.00');
  });

  it('accepts a Date instance for `at` in the thrown error message', () => {
    const tiedPeriods: readonly PricingPeriod[] = [
      { ...SONNET_5_PERIODS[0]!, input: '2.00' },
      { ...SONNET_5_PERIODS[0]!, input: '2.50' },
    ];
    expect(() => selectPricingPeriod(tiedPeriods, new Date('2026-08-15T12:00:00Z'))).toThrow(
      /2026-08-15T12:00:00\.000Z/,
    );
  });

  it('does not throw for the ordinary, non-tied golden-fixture lookups (no regression)', () => {
    expect(() => selectPricingPeriod(SONNET_5_PERIODS, '2026-08-15')).not.toThrow();
    expect(() => selectPricingPeriod(SONNET_5_PERIODS, '2026-09-15')).not.toThrow();
  });
});

// An ISO `at` must denote the same instant no matter where the process runs —
// otherwise a historical lookup is not reproducible, which is the one thing a
// dated price registry exists to be. `Date.parse` does not give that for
// free: a datetime without an offset is local time *by specification*, so it
// is normalized to UTC here. The 2026-09-01 boundary below is the golden
// fixture's real restatement — $2.00 to $3.00 — so an off-by-one-timezone
// lookup shows up as a different price, not a different object.
describe('ISO lookup dates select the same period regardless of host timezone', () => {
  const TIMEZONES = ['UTC', 'Pacific/Kiritimati', 'Pacific/Midway'] as const; // UTC, +14, -11

  function inTimezone<T>(timezone: string, run: () => T): T {
    const original = process.env.TZ;
    process.env.TZ = timezone;
    try {
      return run();
    } finally {
      process.env.TZ = original;
    }
  }

  it('the TZ harness itself works — otherwise every case below passes vacuously', () => {
    const offsets = TIMEZONES.map((tz) =>
      inTimezone(tz, () => new Date('2026-09-01T00:00:00Z').getTimezoneOffset()),
    );
    expect(new Set(offsets).size).toBe(TIMEZONES.length);
  });

  it.each([
    ['a date-only string, UTC by spec', '2026-09-01', '3.00'],
    ['a Z-suffixed datetime', '2026-08-31T23:59:59Z', '2.00'],
    ['a datetime with a positive offset', '2026-09-01T13:00:00+14:00', '2.00'],
    ['a datetime with a negative offset', '2026-08-31T13:00:00-11:00', '3.00'],
    // The fix: local time by spec, read as UTC here. In UTC+14 the local
    // reading of this value is 2026-08-31T15:00Z — the introductory rate —
    // and in UTC-11 it is 2026-09-01T16:00Z, the standard one.
    ['an offset-less datetime, the log-timestamp shape', '2026-09-01T05:00:00', '3.00'],
    ['an offset-less datetime just short of the boundary', '2026-08-31T23:59:59', '2.00'],
    ['an offset-less datetime with millis', '2026-09-01T00:00:00.001', '3.00'],
    ['an offset-less datetime with no seconds', '2026-09-01T00:00', '3.00'],
  ])('%s selects the same period in every timezone', (_label, at, expectedInput) => {
    for (const timezone of TIMEZONES) {
      const period = inTimezone(timezone, () => selectPricingPeriod(SONNET_5_PERIODS, at));
      expect(period?.input, `${at} in ${timezone}`).toBe(expectedInput);
    }
  });

  it('a Date instance is unambiguous and unaffected', () => {
    for (const timezone of TIMEZONES) {
      const period = inTimezone(timezone, () =>
        selectPricingPeriod(SONNET_5_PERIODS, new Date('2026-09-01T00:00:00Z')),
      );
      expect(period?.input).toBe('3.00');
    }
  });

  it('normalizes a period boundary too, not just `at`', () => {
    // A caller-supplied override (usage-tab's `options.overrides`) never went
    // through `validateModelDescriptor`, so its `effectiveFrom` reaches here
    // unchecked — the same local-time reading, one level down. In UTC+14 the
    // local reading of this boundary is 2026-08-31T10:00Z, so a lookup at
    // 2026-08-31T12:00Z would qualify there and nowhere else.
    const periods: readonly PricingPeriod[] = [
      { ...SONNET_5_PERIODS[0]!, effectiveFrom: '2026-09-01T00:00:00', effectiveTo: undefined },
    ];
    for (const timezone of TIMEZONES) {
      expect(
        inTimezone(timezone, () => selectPricingPeriod(periods, '2026-08-31T12:00:00Z')),
      ).toBeUndefined();
      expect(
        inTimezone(timezone, () => selectPricingPeriod(periods, '2026-09-01T12:00:00Z')),
      ).toBeDefined();
    }
  });

  // Not covered by the normalization above, and deliberately so: these are
  // implementation-defined, not specified, so there is no single reading to
  // normalize them to. They keep whatever `Date.parse` does with them —
  // which on V8 is local time — and the caller's documentation says to pass
  // an ISO form or a `Date`.
  it('leaves a non-ISO form to Date.parse rather than inventing a reading for it', () => {
    expect(() => selectPricingPeriod(SONNET_5_PERIODS, 'September 1, 2026')).not.toThrow();
  });

  it('still reports a value Date.parse cannot read at all', () => {
    let error: unknown;
    try {
      selectPricingPeriod(SONNET_5_PERIODS, '2026-13-45');
    } catch (e) {
      error = e;
    }
    assertErrorShape(error, { name: 'InvalidLookupDateError', code: 'INVALID_LOOKUP_DATE' });
    expect(error).toMatchObject({ value: '2026-13-45' });
  });

  it('reports an invalid Date instance as INVALID_LOOKUP_DATE, not an uncoded RangeError', () => {
    // `toISOString()` throws on an invalid Date, which used to discard the
    // InvalidLookupDateError under construction and surface a RangeError
    // instead — defeating the "branch on .code" contract.
    let error: unknown;
    try {
      selectPricingPeriod(SONNET_5_PERIODS, new Date('not-a-date'));
    } catch (e) {
      error = e;
    }
    assertErrorShape(error, { name: 'InvalidLookupDateError', code: 'INVALID_LOOKUP_DATE' });
  });
});
