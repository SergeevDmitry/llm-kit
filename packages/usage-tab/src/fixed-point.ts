/**
 * Exact fixed-point money arithmetic. Money is never computed in binary
 * floating point on the authoritative path.
 *
 * A rate is a decimal string quoted in USD per 1,000,000 tokens. Both a rate
 * string and "per million" are exact powers of ten, so every cost this
 * package ever computes is an exact terminating decimal — `tokens * rate /
 * 1_000_000` never produces a repeating fraction as long as `tokens` is an
 * integer. The representation below (`ExactAmount`) carries that fraction as
 * a `bigint` numerator over an explicit power-of-ten `scale`
 * (`amount = numerator / 10^scale`) and never converts to a JS `number`
 * until `toDisplayNumber`, which is the one documented display boundary
 * where binary floating point is allowed to enter, and where rounding may
 * happen. Every other function here is exact: no rounding, ever, on the
 * authoritative path.
 */
import { InvalidRateError } from './errors.js';

/** An exact non-negative rational number: `numerator / 10^scale`. `scale >= 0`. */
export interface ExactAmount {
  readonly numerator: bigint;
  readonly scale: number;
}

export const ZERO: ExactAmount = { numerator: 0n, scale: 0 };

const DECIMAL_PATTERN = /^\d+(\.\d+)?$/;

/**
 * Parses a decimal rate string (as stored in `PricingPeriod`) into an exact
 * `ExactAmount`. Never uses `Number()`/`parseFloat` — the string is split on
 * `.` and both halves are concatenated into one `bigint`, so a rate like
 * `"3.125"` becomes exactly `3125n / 10^3`, not the nearest representable
 * double.
 */
export function parseDecimalRate(value: string, field: string): ExactAmount {
  // `typeof` first: `RegExp.test` stringifies its argument, so a `number`
  // that reached here past the type (a hand-built override, a JSON
  // round-trip) would pass the pattern and then throw a raw `TypeError` from
  // `indexOf` — outside this package's error taxonomy.
  if (typeof value !== 'string' || !DECIMAL_PATTERN.test(value)) {
    throw new InvalidRateError(field, value);
  }
  const dot = value.indexOf('.');
  if (dot === -1) {
    return { numerator: BigInt(value), scale: 0 };
  }
  const wholePart = value.slice(0, dot);
  const fractionPart = value.slice(dot + 1);
  return { numerator: BigInt(wholePart + fractionPart), scale: fractionPart.length };
}

const PER_MILLION_SCALE = 6;

/**
 * Exact cost of `tokens` billed at `rate` (USD per 1,000,000 tokens).
 * `tokens` must already be a validated non-negative safe integer — see
 * `validateTokenCount` in `calculate-cost.ts`.
 */
export function costOfTokens(tokens: number, rate: ExactAmount): ExactAmount {
  return {
    numerator: BigInt(tokens) * rate.numerator,
    scale: rate.scale + PER_MILLION_SCALE,
  };
}

/** Exact product of two `ExactAmount`s — used to fold a batch multiplier into a rate before billing. */
export function multiplyExact(a: ExactAmount, b: ExactAmount): ExactAmount {
  return { numerator: a.numerator * b.numerator, scale: a.scale + b.scale };
}

/**
 * Exact sum of any number of `ExactAmount`s, even when they carry different
 * scales (e.g. a `"3.125"` cache-write rate next to a `"1.25"` input rate).
 * Every amount is rescaled to the largest scale present by multiplying its
 * numerator by a power of ten — always exact, never a division — before
 * summing.
 */
export function addExact(amounts: readonly ExactAmount[]): ExactAmount {
  if (amounts.length === 0) return ZERO;
  let maxScale = 0;
  for (const amount of amounts) if (amount.scale > maxScale) maxScale = amount.scale;

  let sum = 0n;
  for (const amount of amounts) {
    sum += amount.numerator * 10n ** BigInt(maxScale - amount.scale);
  }
  return { numerator: sum, scale: maxScale };
}

/**
 * Renders an `ExactAmount` as an exact decimal string — the authoritative
 * `totalUsdExact`/`costUsdExact` value. Trailing zero digits beyond the
 * second decimal place are trimmed for readability (never rounded away —
 * every trimmed digit is a literal `0`), and at least two decimal places are
 * always shown, matching ordinary currency notation.
 */
export function formatExact(amount: ExactAmount): string {
  const negative = amount.numerator < 0n;
  const magnitude = negative ? -amount.numerator : amount.numerator;
  const divisor = 10n ** BigInt(amount.scale);
  const integerPart = amount.scale === 0 ? magnitude : magnitude / divisor;
  const fractionDigits =
    amount.scale === 0 ? '' : (magnitude % divisor).toString().padStart(amount.scale, '0');

  let trimmed = fractionDigits.replace(/0+$/, '');
  if (trimmed.length < 2) trimmed = trimmed.padEnd(2, '0');

  return `${negative ? '-' : ''}${integerPart.toString()}.${trimmed}`;
}

/**
 * Ergonomic numeric form of an `ExactAmount` — the *only* place this package
 * converts money to a binary-floating-point `number`. Safe for display,
 * dashboards, and arithmetic a caller does not need to be exact; never used
 * internally for another calculation. Built from the already-exact decimal
 * string (`Number(formatExact(...))`), not from a fresh float division, so
 * it is the closest double to the true exact value rather than compounding a
 * second, independent rounding step.
 */
export function toDisplayNumber(amount: ExactAmount): number {
  return Number(formatExact(amount));
}
