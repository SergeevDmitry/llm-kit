import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { createJsonMender } from '../src/create-json-mender.js';
import { mendJson } from '../src/index.js';
import { JsonMendLimitError, JsonMendOptionsError } from '../src/errors.js';
import { utf8ByteLength } from '../src/limits.js';

const FAST_CHECK_SEED = 0x6c656e; // 'len'
const FAST_CHECK_RUNS = 500;

describe('maxDepth', () => {
  it('defaults to a generous limit that ordinary payloads never hit', () => {
    const deep = '['.repeat(50) + '1' + ']'.repeat(50);
    expect(() => mendJson(deep)).not.toThrow();
  });

  it('throws MAX_DEPTH_EXCEEDED the instant the limit would be exceeded, not before', () => {
    const mender = createJsonMender({ maxDepth: 2 });
    expect(() => mender.push('[[[1')).toThrow(JsonMendLimitError);
  });

  it('a depth-limit throw happens synchronously out of push(), mid-chunk', () => {
    const mender = createJsonMender({ maxDepth: 1 });
    let threw = false;
    try {
      mender.push('{"a":{"b":1}}');
    } catch (error) {
      threw = true;
      expect(error).toBeInstanceOf(JsonMendLimitError);
      expect((error as JsonMendLimitError).code).toBe('MAX_DEPTH_EXCEEDED');
    }
    expect(threw).toBe(true);
  });

  it('is enforced across chunk boundaries, not just within a single chunk', () => {
    const mender = createJsonMender({ maxDepth: 2 });
    mender.push('[[');
    expect(() => mender.push('[')).toThrow(JsonMendLimitError);
  });
});

describe('maxBufferBytes', () => {
  it('defaults to a generous limit that ordinary payloads never hit', () => {
    expect(() => mendJson('{"a":"small payload"}')).not.toThrow();
  });

  it('throws MAX_BUFFER_BYTES_EXCEEDED once the cumulative input exceeds the limit', () => {
    const mender = createJsonMender({ maxBufferBytes: 20 });
    expect(() => mender.push('{"a":"this is definitely more than twenty bytes"}')).toThrow(
      JsonMendLimitError,
    );
  });

  it('accumulates across pushes rather than resetting per chunk', () => {
    const mender = createJsonMender({ maxBufferBytes: 10 });
    mender.push('12345');
    expect(() => mender.push('67890abc')).toThrow(JsonMendLimitError);
  });

  it('charges multi-byte characters by their UTF-8 byte length, not character count', () => {
    // 5 emoji, 4 bytes each = 20 bytes, well over an 8-byte budget.
    const mender = createJsonMender({ maxBufferBytes: 8 });
    expect(() => mender.push('"🚀🚀🚀🚀🚀"')).toThrow(JsonMendLimitError);
  });

  it('charges Uint8Array chunks by their exact byte length', () => {
    const mender = createJsonMender({ maxBufferBytes: 4 });
    expect(() => mender.push(new Uint8Array([1, 2, 3, 4, 5]))).toThrow(JsonMendLimitError);
  });

  it('reset() clears the accumulated byte count', () => {
    const mender = createJsonMender({ maxBufferBytes: 10 });
    mender.push('12345');
    mender.reset();
    expect(() => mender.push('123456789')).not.toThrow();
  });
});

describe('option validation: non-finite limits must not silently disable the caps', () => {
  // Table-driven: zero, negative, fractional, NaN, Infinity, and wrong
  // types, for both maxDepth and maxBufferBytes. Without this validation,
  // every one of these would construct successfully and silently disable
  // (or never enable) the corresponding resource bound.
  describe.each([
    { name: 'maxDepth', min: 0 },
    { name: 'maxBufferBytes', min: 1 },
  ] as const)('$name', ({ name, min }) => {
    const invalidValues: Array<[label: string, value: unknown]> = [
      ['NaN', NaN],
      ['Infinity', Infinity],
      ['-Infinity', -Infinity],
      ['a negative integer', -5],
      ['a fraction', 1.5],
      ['a string', '10'],
      ['a boolean', true],
      ['an array', [10]],
    ];
    if (min > 0) {
      invalidValues.push([`${String(min - 1)} (below the minimum)`, min - 1]);
    }

    for (const [label, value] of invalidValues) {
      it(`rejects ${label} with a stable INVALID_OPTIONS error, before any input is accepted`, () => {
        expect(() => createJsonMender({ [name]: value })).toThrow(JsonMendOptionsError);
        try {
          createJsonMender({ [name]: value });
          expect.unreachable('createJsonMender should have thrown');
        } catch (error) {
          expect(error).toBeInstanceOf(JsonMendOptionsError);
          expect((error as JsonMendOptionsError).code).toBe('INVALID_OPTIONS');
          expect((error as JsonMendOptionsError).name).toBe('JsonMendOptionsError');
        }
      });
    }

    it(`accepts the minimum legal value (${String(min)}) and every larger integer`, () => {
      expect(() => createJsonMender({ [name]: min })).not.toThrow();
      expect(() => createJsonMender({ [name]: min + 1 })).not.toThrow();
      expect(() => createJsonMender({ [name]: min + 1000 })).not.toThrow();
    });

    it('rejects the same value through mendJson(), not just createJsonMender()', () => {
      expect(() => mendJson('1', { [name]: NaN })).toThrow(JsonMendOptionsError);
    });

    // `null` is deliberately *not* in `invalidValues`: every optional
    // numeric option in this codebase is resolved with `options?.x ?? default`
    // (see `chat-fit/src/normalize-options.ts`'s identical pattern for
    // `reserveTokens`/`safetyMarginTokens`), and `??` treats `null` the same
    // as `undefined` — "not provided, use the default" — not as a value to
    // validate. That default is always a safe, finite, positive cap, so this
    // is consistent with, not an exception to, the validation above.
    it('treats null the same as undefined (falls back to the default) rather than rejecting it', () => {
      expect(() => createJsonMender({ [name]: null })).not.toThrow();
    });
  });

  it('maxDepth: 0 is legal and means "no object/array is ever allowed, root scalars only" — a stricter, not weaker, cap', () => {
    expect(() => mendJson('42', { maxDepth: 0 })).not.toThrow();
    expect(mendJson('42', { maxDepth: 0 }).value).toBe(42);
    // The instant a '{' or '[' is scanned it exceeds the depth-0 cap — this
    // is `MAX_DEPTH_EXCEEDED` (a runtime limit hit while processing input),
    // a different, pre-existing error from `INVALID_OPTIONS` (a
    // construction-time option-validation failure).
    expect(() => mendJson('[1]', { maxDepth: 0 })).toThrow(JsonMendLimitError);
  });

  it('maxBufferBytes: 0 is rejected — it could never accept a single byte of real content', () => {
    expect(() => createJsonMender({ maxBufferBytes: 0 })).toThrow(JsonMendOptionsError);
  });

  describe('duplicateKeyPolicy and incompleteScalarPolicy enums', () => {
    // `null` and `undefined` are excluded here too, for the same
    // `?? default` reason as the numeric options above.
    const invalidEnumValues: readonly unknown[] = ['nope', '', 'LAST', 1];

    for (const value of invalidEnumValues) {
      it(`rejects duplicateKeyPolicy: ${JSON.stringify(value)}`, () => {
        expect(() => createJsonMender({ duplicateKeyPolicy: value as never })).toThrow(
          JsonMendOptionsError,
        );
      });

      it(`rejects incompleteScalarPolicy: ${JSON.stringify(value)}`, () => {
        expect(() => createJsonMender({ incompleteScalarPolicy: value as never })).toThrow(
          JsonMendOptionsError,
        );
      });
    }

    it('treats null the same as undefined for both enum options (falls back to the default)', () => {
      expect(() => createJsonMender({ duplicateKeyPolicy: null as never })).not.toThrow();
      expect(() => createJsonMender({ incompleteScalarPolicy: null as never })).not.toThrow();
    });

    it('accepts every documented duplicateKeyPolicy value', () => {
      for (const value of ['last', 'first', 'error'] as const) {
        expect(() => createJsonMender({ duplicateKeyPolicy: value })).not.toThrow();
      }
    });

    it('accepts every documented incompleteScalarPolicy value', () => {
      for (const value of ['omit', 'best-effort'] as const) {
        expect(() => createJsonMender({ incompleteScalarPolicy: value })).not.toThrow();
      }
    });
  });

  it('omitting options entirely still constructs successfully with the documented defaults', () => {
    expect(() => createJsonMender()).not.toThrow();
    expect(() => createJsonMender({})).not.toThrow();
  });

  it('property: any non-finite or out-of-range number for maxDepth/maxBufferBytes always throws INVALID_OPTIONS, never constructs', () => {
    const badNumber = fc.oneof(
      fc.constant(NaN),
      fc.constant(Infinity),
      fc.constant(-Infinity),
      fc.double({ noNaN: true, noDefaultInfinity: true }).filter((n) => !Number.isInteger(n)),
      fc.integer({ max: -1 }),
    );
    fc.assert(
      fc.property(badNumber, fc.constantFrom('maxDepth', 'maxBufferBytes'), (value, option) => {
        expect(() => createJsonMender({ [option]: value })).toThrow(JsonMendOptionsError);
      }),
      { seed: FAST_CHECK_SEED, numRuns: FAST_CHECK_RUNS },
    );
  });
});

describe('utf8ByteLength', () => {
  // `limits.ts` counts bytes with a code-point walk instead of
  // `new TextEncoder().encode(text).length` — measured faster on the small
  // chunks a real stream sends, see `benchmarks/mend-json.bench.ts`. This
  // property test is what makes that swap safe: the counting loop must
  // agree with `TextEncoder` byte-for-byte, including for a lone (unpaired)
  // surrogate, which `TextEncoder` substitutes with U+FFFD (3 bytes) in its
  // UTF-8 output.
  it('agrees with TextEncoder byte-for-byte over random strings, including lone surrogates', () => {
    const surrogateHalf = fc
      .integer({ min: 0xd800, max: 0xdfff })
      .map((cp) => String.fromCharCode(cp));
    const ordinaryChar = fc.string({ minLength: 1, maxLength: 1 });
    const astralChar = fc
      .integer({ min: 0x10000, max: 0x10ffff })
      .map((cp) => String.fromCodePoint(cp));
    const anyChar = fc.oneof(surrogateHalf, ordinaryChar, astralChar);

    fc.assert(
      fc.property(fc.array(anyChar, { minLength: 0, maxLength: 30 }), (chars) => {
        const text = chars.join('');
        expect(utf8ByteLength(text)).toBe(new TextEncoder().encode(text).length);
      }),
      { seed: FAST_CHECK_SEED, numRuns: FAST_CHECK_RUNS },
    );
  });

  it('matches TextEncoder for known single-character byte counts', () => {
    expect(utf8ByteLength('a')).toBe(1); // 1-byte
    expect(utf8ByteLength('é')).toBe(2); // 2-byte
    expect(utf8ByteLength('€')).toBe(3); // 3-byte
    expect(utf8ByteLength('🚀')).toBe(4); // 4-byte (surrogate pair, one code point)
    expect(utf8ByteLength('a€🚀')).toBe(1 + 3 + 4);
    expect(utf8ByteLength('\ud800')).toBe(new TextEncoder().encode('\ud800').length); // lone high surrogate
    expect(utf8ByteLength('\udc00')).toBe(new TextEncoder().encode('\udc00').length); // lone low surrogate
  });
});
