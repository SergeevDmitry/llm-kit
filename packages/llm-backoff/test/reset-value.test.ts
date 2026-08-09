/**
 * Direct unit tests for the format-specific value parsers, including
 * `parseEpochSeconds`/`parseEpochMilliseconds` — implemented and tested as
 * part of the supported header-format list even though no shipped provider
 * profile currently binds a header to them (see `providers/types.ts`).
 */
import { createFakeClock } from '@llm-kit/test-utils';
import { describe, expect, it } from 'vitest';
import {
  parseDeltaSeconds,
  parseDuration,
  parseEpochMilliseconds,
  parseEpochSeconds,
  parseIsoTimestamp,
} from '../src/delay/reset-value.js';

describe('parseEpochSeconds', () => {
  it('computes a relative delay from an absolute epoch-seconds timestamp', () => {
    const clock = createFakeClock();
    const futureSeconds = Math.floor((clock.now() + 30_000) / 1000);
    expect(parseEpochSeconds(String(futureSeconds), clock.now())).toBeCloseTo(30_000, -2);
  });

  it('returns a negative value for a past timestamp (caller clamps)', () => {
    const clock = createFakeClock();
    const pastSeconds = Math.floor((clock.now() - 10_000) / 1000);
    expect(parseEpochSeconds(String(pastSeconds), clock.now())).toBeLessThan(0);
  });

  it('returns undefined for a non-numeric value', () => {
    expect(parseEpochSeconds('not-a-number', 0)).toBeUndefined();
  });

  // An unbounded digit string maps to Infinity via `Number()`. That counts as
  // malformed (`undefined`), the same as any other value this parser cannot
  // make sense of, rather than a usable but non-finite delay.
  it('returns undefined rather than a non-finite delay for an overflowing digit string', () => {
    expect(parseEpochSeconds('9'.repeat(400), 0)).toBeUndefined();
  });
});

describe('parseEpochMilliseconds', () => {
  it('computes a relative delay from an absolute epoch-milliseconds timestamp', () => {
    const clock = createFakeClock();
    expect(parseEpochMilliseconds(String(clock.now() + 5000), clock.now())).toBe(5000);
  });

  it('returns a negative value for a past timestamp (caller clamps)', () => {
    const clock = createFakeClock();
    expect(parseEpochMilliseconds(String(clock.now() - 5000), clock.now())).toBe(-5000);
  });

  it('returns undefined for a non-numeric value', () => {
    expect(parseEpochMilliseconds('soon', 0)).toBeUndefined();
  });

  it('returns undefined rather than a non-finite delay for an overflowing digit string', () => {
    expect(parseEpochMilliseconds('9'.repeat(400), 0)).toBeUndefined();
  });
});

describe('parseDuration — additional coverage', () => {
  it('parses a negative duration (caller clamps to 0)', () => {
    expect(parseDuration('-5s')).toBe(-5000);
  });

  it('rejects a value with a trailing unrecognized character', () => {
    expect(parseDuration('5sx')).toBeUndefined();
  });

  it('rejects a value that starts with an unrecognized character', () => {
    expect(parseDuration('x5s')).toBeUndefined();
  });

  it('rejects an empty string', () => {
    expect(parseDuration('')).toBeUndefined();
  });

  it('returns undefined rather than a non-finite delay when segments sum past Infinity', () => {
    // A single absurdly large hour segment is enough to overflow the sum.
    expect(parseDuration(`${'9'.repeat(400)}h`)).toBeUndefined();
  });
});

describe('parseIsoTimestamp — additional coverage', () => {
  it('rejects a value that is not shaped like an ISO timestamp at all', () => {
    expect(parseIsoTimestamp('42', 0)).toBeUndefined();
  });

  it('rejects a value shaped like a date but not actually parseable', () => {
    expect(parseIsoTimestamp('9999-99-99T99:99:99Z', 0)).toBeUndefined();
  });
});

describe('parseDeltaSeconds', () => {
  it('parses non-negative integer seconds', () => {
    expect(parseDeltaSeconds('42')).toBe(42_000);
  });

  it('rejects a negative or non-numeric value', () => {
    expect(parseDeltaSeconds('-1')).toBeUndefined();
    expect(parseDeltaSeconds('soon')).toBeUndefined();
  });

  it('returns undefined rather than a non-finite delay for an overflowing digit string', () => {
    expect(parseDeltaSeconds('9'.repeat(400))).toBeUndefined();
  });
});
