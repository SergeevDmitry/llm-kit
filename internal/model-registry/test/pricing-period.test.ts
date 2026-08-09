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
