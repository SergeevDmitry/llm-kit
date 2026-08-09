/**
 * `describeInvalidNumber` (`src/normalize/support.ts`) and `readNumericField`
 * (`src/normalize/generic.ts`) render a rejected usage value with
 * `JSON.stringify`, which throws on a `bigint` — a value type node-postgres
 * and mysql2 both routinely return for a `BIGINT` column. Left unguarded,
 * that throw would escape from inside the `InvalidUsageError` being
 * constructed, so the error the contract promises (a stable `code`, per
 * `errors.ts` and the README) would never get built and the caller would see
 * a bare `TypeError` instead.
 *
 * `describeValue` (`src/normalize/support.ts`) is the total describer shared
 * by both call sites. This suite checks it directly against every value
 * shape that can make `JSON.stringify` throw or render uselessly, then
 * checks the two regression paths end to end, then adds a fast-check
 * property over arbitrary non-number inputs.
 */
import fc from 'fast-check';
import { fuzzConfig } from '@llm-kit/test-utils';
import { describe, expect, it } from 'vitest';
import { InvalidUsageError } from '../src/errors.js';
import { describeValue } from '../src/normalize/support.js';
import { normalizeOpenAIUsage } from '../src/normalize/openai.js';
import { normalizeRequestUsage } from '../src/normalize/generic.js';

describe('describeValue — total over every value shape that breaks or misrenders under JSON.stringify', () => {
  it('bigint: renders instead of throwing', () => {
    expect(() => describeValue(100n)).not.toThrow();
    expect(describeValue(100n)).toBe('100n');
  });

  it('symbol: JSON.stringify(Symbol()) silently returns undefined — this renders it instead', () => {
    expect(describeValue(Symbol('x'))).toBe('Symbol(x)');
  });

  it('function: named and anonymous', () => {
    function namedFn(): void {
      /* noop */
    }
    expect(describeValue(namedFn)).toBe('[Function: namedFn]');
    expect(describeValue(() => {})).toContain('[Function');
  });

  it('undefined', () => {
    expect(describeValue(undefined)).toBe('undefined');
  });

  it('a circular object: JSON.stringify throws "Converting circular structure to JSON"', () => {
    const circular: Record<string, unknown> = {};
    circular['self'] = circular;
    expect(() => describeValue(circular)).not.toThrow();
    expect(typeof describeValue(circular)).toBe('string');
  });

  it('an object whose toJSON throws', () => {
    const value = {
      toJSON(): never {
        throw new Error('boom');
      },
    };
    expect(() => describeValue(value)).not.toThrow();
    expect(typeof describeValue(value)).toBe('string');
  });

  it('an object whose toJSON throws a non-Error value', () => {
    const value = {
      toJSON(): never {
        throw 'not an Error instance';
      },
    };
    expect(() => describeValue(value)).not.toThrow();
  });

  it('-0: JSON.stringify(-0) renders "0", losing the sign', () => {
    expect(describeValue(-0)).toBe('-0');
  });

  it('NaN and Infinity: JSON.stringify renders both as "null", indistinguishable from an actual null', () => {
    expect(describeValue(Number.NaN)).toBe('NaN');
    expect(describeValue(Number.POSITIVE_INFINITY)).toBe('Infinity');
    expect(describeValue(Number.NEGATIVE_INFINITY)).toBe('-Infinity');
  });

  it('ordinary values still render as before (no regression for the common case)', () => {
    expect(describeValue('hello')).toBe('"hello"');
    expect(describeValue(true)).toBe('true');
    expect(describeValue(null)).toBe('null');
    expect(describeValue([1, 2, 3])).toBe('[1,2,3]');
    expect(describeValue({ a: 1 })).toBe('{"a":1}');
    expect(describeValue(42)).toBe('42');
  });
});

describe('end to end: a bigint usage value throws InvalidUsageError, not a raw TypeError', () => {
  it('normalizeOpenAIUsage({ prompt_tokens: 100n }) throws InvalidUsageError, not a raw TypeError', () => {
    let error: unknown;
    try {
      normalizeOpenAIUsage({ prompt_tokens: 100n, completion_tokens: 10 });
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(InvalidUsageError);
    expect((error as InvalidUsageError).code).toBe('INVALID_USAGE');
  });

  it('normalizeRequestUsage({ inputTokens: 100n }) throws InvalidUsageError, not a raw TypeError', () => {
    let error: unknown;
    try {
      normalizeRequestUsage({ inputTokens: 100n, outputTokens: 10 });
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(InvalidUsageError);
    expect((error as InvalidUsageError).code).toBe('INVALID_USAGE');
  });

  it("the string '100' control case still throws the same error shape", () => {
    let error: unknown;
    try {
      normalizeRequestUsage({ inputTokens: '100', outputTokens: 10 });
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(InvalidUsageError);
    expect((error as InvalidUsageError).code).toBe('INVALID_USAGE');
  });
});

describe('property: normalizeRequestUsage throws only InvalidUsageError for arbitrary non-number inputTokens', () => {
  // `fc.anything()`'s default value pool already covers strings, booleans,
  // arrays, plain objects, null and undefined; the `with*` flags below add
  // the shapes most likely to defeat a naive error-message renderer
  // (bigint plus Map/Set/Date/boxed values/null-prototype objects). Genuine
  // `Symbol`/`Function` values aren't generated by `fc.anything()` in this
  // fast-check version, so they're covered directly in the `describeValue`
  // suite above instead.
  const nonNumberValue = fc
    .anything({
      withBigInt: true,
      withMap: true,
      withSet: true,
      withObjectString: true,
      withDate: true,
      withNullPrototype: true,
      withBoxedValues: true,
    })
    .filter((value) => typeof value !== 'number');

  it('holds for arbitrary non-number values (seeded — see FUZZ_SEED/FUZZ_RUNS in fuzz.yml)', () => {
    fc.assert(
      fc.property(nonNumberValue, (inputTokens) => {
        let error: unknown;
        try {
          normalizeRequestUsage({ inputTokens, outputTokens: 1 });
        } catch (e) {
          error = e;
        }
        expect(error).toBeInstanceOf(InvalidUsageError);
      }),
      fuzzConfig(0x6c6c7072, 300), // 0x6c6c7072 = 'llpr' — llm-price
    );
  });
});
