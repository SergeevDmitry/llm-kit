/**
 * Edge cases that aren't already covered by the split-point, byte-split, or
 * lexical-state suites.
 */
import { describe, expect, it } from 'vitest';
import { createJsonMender } from '../src/create-json-mender.js';
import { mendJson } from '../src/index.js';

describe('root scalar values', () => {
  it.each([
    ['string', '"hello"', 'hello'],
    ['number', '42', 42],
    ['negative number', '-3.5', -3.5],
    ['true', 'true', true],
    ['false', 'false', false],
    ['null', 'null', null],
  ])('a bare %s at the root streams and completes', (_label, input, expected) => {
    const r = mendJson(input);
    expect(r.complete).toBe(true);
    expect(r.value).toBe(expected);
  });
});

describe('whitespace-only and empty input', () => {
  it('whitespace-only input never produces a value', () => {
    const r = mendJson('   \n\t\r  ');
    expect(r.value).toBeUndefined();
    expect(r.repairedJson).toBeUndefined();
  });

  it('empty input never produces a value', () => {
    const r = mendJson('');
    expect(r.value).toBeUndefined();
    expect(r.repairedJson).toBeUndefined();
  });

  it('leading whitespace before a value is tolerated', () => {
    const r = mendJson('   {"a":1}');
    expect(r.complete).toBe(true);
    expect(r.value).toEqual({ a: 1 });
  });
});

describe('duplicate keys (default policy)', () => {
  it('the raw text is preserved verbatim and JSON.parse semantics apply', () => {
    const r = mendJson('{"a":1,"a":2}');
    expect(r.repairedJson).toBe('{"a":1,"a":2}');
    expect(r.value).toEqual({ a: 2 });
  });
});

describe('escaped quotes and backslashes', () => {
  it('a string containing an escaped quote does not confuse the scanner about where it ends', () => {
    const r = mendJson(String.raw`{"a":"she said \"hi\""}`);
    expect(r.value).toEqual({ a: 'she said "hi"' });
  });

  it('a string containing an escaped backslash followed by a real quote closes correctly', () => {
    const r = mendJson(String.raw`{"a":"path\\"}`);
    expect(r.value).toEqual({ a: 'path\\' });
    expect(r.complete).toBe(true);
  });

  it('an odd number of trailing backslashes leaves the string open, not closed', () => {
    // "a\" -> the quote is escaped, string is NOT closed yet.
    const mender = createJsonMender();
    const r = mender.push(String.raw`{"a":"x\"`);
    expect(r.complete).toBe(false);
    expect((r.value as { a: string }).a).toBe('x"');
  });
});

describe('braces and brackets inside strings', () => {
  it('do not affect structural nesting tracking', () => {
    const r = mendJson('{"a":"{[](){}}","b":1}');
    expect(r.value).toEqual({ a: '{[](){}}', b: 1 });
    expect(r.complete).toBe(true);
  });
});

describe('invalid completed JSON that followed valid partial snapshots', () => {
  it('a trailing comma immediately followed by the closer is never reported complete', () => {
    const mender = createJsonMender();
    // The trailing comma after "b":2 confirms the number is finished (a
    // delimiter arrived), so it is safely included even under the default
    // "omit" policy — this snapshot is a legitimately valid partial state.
    const partial = mender.push('{"a":1,"b":2,');
    expect(partial.complete).toBe(false); // still open, legitimately incomplete
    expect(partial.value).toEqual({ a: 1, b: 2 });

    const closed = mender.push('}'); // dangling comma then close: genuinely invalid
    expect(closed.complete).toBe(false);
    expect(closed.value).toEqual({ a: 1, b: 2 }); // frozen at the last valid state
  });

  it('mismatched brackets freeze scanning without throwing', () => {
    const r = mendJson('{"a":[1,2}');
    expect(r.complete).toBe(false);
  });

  it('an invalid literal freezes scanning at the last safe boundary', () => {
    const r = mendJson('{"a":tRue,"b":2}');
    expect(r.complete).toBe(false);
    expect(r.value).toEqual({});
  });

  it.each([
    ['a wrong-case letter', 'tRue'],
    ['a wrong trailing character', 'tru5'],
    ['a wrong trailing character on "false"', 'fals3'],
    ['a wrong trailing character on "null"', 'nulx'],
  ])(
    '%s does not get completed to its nearest literal under "best-effort" (nothing is invented)',
    (_label, badLiteral) => {
      const withBest = mendJson(`{"a":${badLiteral}}`, { incompleteScalarPolicy: 'best-effort' });
      const withOmit = mendJson(`{"a":${badLiteral}}`, { incompleteScalarPolicy: 'omit' });
      // A contradicted literal must be omitted exactly like under "omit" —
      // "best-effort" only completes a literal truncation never disproved.
      expect(withBest.value).toEqual(withOmit.value);
      expect(withBest.value).toEqual({});
      expect(withBest.diagnostics.map((d) => d.code)).not.toContain('scalar-completed');
    },
  );

  it('a genuinely truncated (not contradicted) literal still completes under "best-effort"', () => {
    const r = mendJson('{"a":tru', { incompleteScalarPolicy: 'best-effort' });
    expect(r.value).toEqual({ a: true });
    expect(r.diagnostics.map((d) => d.code)).toContain('scalar-completed');
  });

  it('a leading zero followed by another digit ("01") is invalid, not truncated', () => {
    const r = mendJson('{"a":01}');
    expect(r.complete).toBe(false);
    expect(r.value).toEqual({});
  });
});

describe('nesting near maxDepth boundary', () => {
  it('exactly at the limit succeeds; one level past throws', () => {
    const okDoc = '{"a":' + '['.repeat(9) + '1' + ']'.repeat(9) + '}';
    expect(() => mendJson(okDoc, { maxDepth: 10 })).not.toThrow();

    const tooDeep = '{"a":' + '['.repeat(10) + '1' + ']'.repeat(10) + '}';
    expect(() => mendJson(tooDeep, { maxDepth: 10 })).toThrow();
  });
});

describe('incomplete negative numbers and exponents', () => {
  it.each([
    ['bare minus', '-'],
    ['decimal point with no fraction digit', '3.'],
    ['exponent marker with no sign or digit', '3e'],
    ['exponent sign with no digit', '3e+'],
    ['exponent minus sign with no digit', '3e-'],
  ])('%s as a pending array element does not produce a bogus number', (_label, input) => {
    const r = mendJson(`[${input}`, { incompleteScalarPolicy: 'omit' });
    // omit policy: the incomplete element is dropped entirely.
    expect(r.value).toEqual([]);
  });

  it.each([
    ['bare minus', '-', []],
    ['decimal point with no fraction digit', '3.', [3]],
    ['exponent marker with no sign or digit', '3e', [3]],
    ['exponent sign with no digit', '3e+', [3]],
    ['exponent minus sign with no digit', '3e-', [3]],
  ])(
    '%s as a pending array element trims to its last safe digits under best-effort',
    (_label, input, expected) => {
      const r = mendJson(`[${input}`, { incompleteScalarPolicy: 'best-effort' });
      expect(r.value).toEqual(expected);
    },
  );
});

describe('multiple mender instances do not share state', () => {
  it('two independent menders track independent buffers', () => {
    const a = createJsonMender();
    const b = createJsonMender();
    a.push('{"from":"a"');
    b.push('{"from":"b"}');
    expect(a.snapshot().value).toEqual({ from: 'a' });
    expect(b.snapshot().value).toEqual({ from: 'b' });
  });
});
