/**
 * Table-driven tests for every lexical state the scanner passes through.
 * Each case pushes the whole input in one shot and checks the resulting
 * snapshot — the split-point tests in
 * `split-point.test.ts` re-check the same lexical territory chunked at every
 * character/byte boundary instead of in one piece.
 */
import { describe, expect, it } from 'vitest';
import { createJsonMender } from '../src/create-json-mender.js';
import { mendJson } from '../src/index.js';

interface Case {
  readonly name: string;
  readonly input: string;
  readonly value: unknown;
  readonly complete: boolean;
}

const NUMBER_CASES: Case[] = [
  { name: 'zero', input: '0', value: 0, complete: true },
  { name: 'negative zero', input: '-0', value: -0, complete: true },
  { name: 'positive integer', input: '42', value: 42, complete: true },
  { name: 'negative integer', input: '-17', value: -17, complete: true },
  { name: 'decimal', input: '3.14', value: 3.14, complete: true },
  { name: 'negative decimal', input: '-0.001', value: -0.001, complete: true },
  { name: 'exponent lowercase', input: '1e10', value: 1e10, complete: true },
  { name: 'exponent uppercase', input: '1E10', value: 1e10, complete: true },
  { name: 'exponent plus', input: '1e+5', value: 1e5, complete: true },
  { name: 'exponent minus', input: '1e-5', value: 1e-5, complete: true },
  { name: 'decimal with exponent', input: '-3.14e+2', value: -3.14e2, complete: true },
];

const LITERAL_CASES: Case[] = [
  { name: 'true', input: 'true', value: true, complete: true },
  { name: 'false', input: 'false', value: false, complete: true },
  { name: 'null', input: 'null', value: null, complete: true },
];

const STRING_CASES: Case[] = [
  { name: 'empty string', input: '""', value: '', complete: true },
  { name: 'simple string', input: '"hello"', value: 'hello', complete: true },
  { name: 'escaped quote', input: '"a\\"b"', value: 'a"b', complete: true },
  { name: 'escaped backslash', input: '"a\\\\b"', value: 'a\\b', complete: true },
  { name: 'escaped slash', input: '"a\\/b"', value: 'a/b', complete: true },
  { name: 'all simple escapes', input: '"\\b\\f\\n\\r\\t"', value: '\b\f\n\r\t', complete: true },
  { name: 'unicode escape', input: '"\\u00e9"', value: 'é', complete: true },
  { name: 'unicode escape surrogate pair', input: '"\\ud83d\\ude00"', value: '😀', complete: true },
  {
    name: 'braces inside a string are just characters',
    input: '"{not json}"',
    value: '{not json}',
    complete: true,
  },
  { name: 'commas and colons inside a string', input: '"a,b:c"', value: 'a,b:c', complete: true },
];

const STRUCTURAL_CASES: Case[] = [
  { name: 'empty object', input: '{}', value: {}, complete: true },
  { name: 'empty array', input: '[]', value: [], complete: true },
  { name: 'object with one member', input: '{"a":1}', value: { a: 1 }, complete: true },
  { name: 'array with elements', input: '[1,2,3]', value: [1, 2, 3], complete: true },
  {
    name: 'nested mixed structure',
    input: '{"a":[1,{"b":2},[3,4]],"c":null}',
    value: { a: [1, { b: 2 }, [3, 4]], c: null },
    complete: true,
  },
  {
    name: 'whitespace between tokens',
    input: '{ "a" : 1 , "b" : [ 1 , 2 ] }',
    value: { a: 1, b: [1, 2] },
    complete: true,
  },
];

for (const [group, cases] of Object.entries({
  numbers: NUMBER_CASES,
  literals: LITERAL_CASES,
  strings: STRING_CASES,
  structural: STRUCTURAL_CASES,
})) {
  describe(`lexical state: ${group}`, () => {
    for (const testCase of cases) {
      it(testCase.name, () => {
        // `mendJson` (push + finish) is the right lens for "this whole
        // document arrived": a bare number like `-17` only reports
        // `complete: true` once the caller declares no more digits are
        // coming, which is exactly what `finish()` does.
        const result = mendJson(testCase.input);
        expect(result.value).toEqual(testCase.value);
        expect(result.complete).toBe(testCase.complete);
        expect(result.repairedJson).toBeDefined();
        expect(() => JSON.parse(result.repairedJson as string)).not.toThrow();
      });
    }
  });
}

describe('lexical state: incomplete numbers mid-stream (default omit policy)', () => {
  const incomplete = ['-', '3.', '1e', '1e+', '1e-', '0.'];
  for (const input of incomplete) {
    it(`"${input}" alone has no safe value yet`, () => {
      const mender = createJsonMender();
      const result = mender.push(input);
      expect(result.value).toBeUndefined();
      expect(result.complete).toBe(false);
    });
  }
});

describe('lexical state: partial literals mid-stream (default omit policy)', () => {
  const partials = ['t', 'tr', 'tru', 'f', 'fa', 'fal', 'fals', 'n', 'nu', 'nul'];
  for (const input of partials) {
    it(`"${input}" alone, wrapped in an array, omits the pending element`, () => {
      const mender = createJsonMender();
      const result = mender.push(`[${input}`);
      expect(result.value).toEqual([]);
      expect(result.complete).toBe(false);
      expect(() => JSON.parse(result.repairedJson as string)).not.toThrow();
    });
  }
});

describe('lexical state: nesting near maxDepth', () => {
  it('accepts nesting exactly at the configured limit', () => {
    const mender = createJsonMender({ maxDepth: 5 });
    const input = '[[[[[1]]]]]'; // 5 levels of array nesting
    const result = mender.push(input);
    expect(result.complete).toBe(true);
    expect(result.value).toEqual([[[[[1]]]]]);
  });

  it('throws exactly one level past the configured limit', () => {
    const mender = createJsonMender({ maxDepth: 5 });
    expect(() => mender.push('[[[[[[1]]]]]]')).toThrow(/maxDepth/);
  });
});

describe('lexical state: very long strings', () => {
  it('handles a string well beyond typical small-buffer sizes', () => {
    const longContent = 'x'.repeat(200_000);
    const mender = createJsonMender();
    const result = mender.push(`{"data":"${longContent}"}`);
    expect(result.complete).toBe(true);
    expect((result.value as { data: string }).data).toHaveLength(200_000);
  });

  it('closes a still-open very long string safely mid-stream', () => {
    const longContent = 'y'.repeat(100_000);
    const mender = createJsonMender();
    const result = mender.push(`{"data":"${longContent}`); // no closing quote yet
    expect(result.complete).toBe(false);
    expect((result.value as { data: string }).data).toBe(longContent);
    expect(() => JSON.parse(result.repairedJson as string)).not.toThrow();
  });
});
