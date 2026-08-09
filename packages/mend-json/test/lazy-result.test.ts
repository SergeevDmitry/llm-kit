/**
 * `value` and `repairedJson` are computed lazily (memoized getters) so a
 * caller who pushes many small chunks without reading every intermediate
 * result doesn't pay O(buffer size) per push — see the comment in
 * `repair-suffix.ts` above `resolve()`. These tests pin the two things that
 * matter about that: it is completely transparent to a normal consumer
 * (enumerable, JSON-serializable, stable across repeat reads), and it
 * actually delivers the performance property it exists for.
 */
import { describe, expect, it } from 'vitest';
import { createJsonMender } from '../src/create-json-mender.js';
import { mendJson } from '../src/index.js';

describe('lazy value/repairedJson: transparent to a normal consumer', () => {
  it('Object.keys includes value and repairedJson', () => {
    const r = mendJson('{"a":1}');
    expect(Object.keys(r).sort()).toEqual(
      [
        'appendedSuffix',
        'complete',
        'diagnostics',
        'repairedJson',
        'validPrefixLength',
        'value',
      ].sort(),
    );
  });

  it('JSON.stringify includes both fields', () => {
    const r = mendJson('{"a":1}');
    const parsed = JSON.parse(JSON.stringify(r)) as Record<string, unknown>;
    expect(parsed.value).toEqual({ a: 1 });
    expect(parsed.repairedJson).toBe('{"a":1}');
  });

  it('repeated access returns an equal value without re-parsing observable state', () => {
    const r = mendJson('{"a":[1,2,3]}');
    const first = r.value;
    const second = r.value;
    expect(first).toEqual(second);
    // JSON.parse builds a fresh object graph each time it runs; a stable
    // reference across two reads is direct evidence the result is memoized
    // rather than recomputed on every access.
    expect(first).toBe(second);
  });

  it('a mid-stream snapshot omitted with no value never touches the getters at all', () => {
    const r = mendJson('   '); // whitespace-only: no value branch
    expect(r.value).toBeUndefined();
    expect(r.repairedJson).toBeUndefined();
  });
});

describe('lazy value/repairedJson: performance property', () => {
  // An absolute wall-clock bound (`elapsedMs < 2000`) is never safe to
  // assert — it's sensitive to machine speed and scheduling noise. The
  // property this test actually needs — "resolve() never runs while
  // `.value`/`.repairedJson` are never read, so pushing without reading
  // never re-parses anything" — is a claim about *whether a function was
  // called*, not about how long anything took, so it is asserted directly
  // by counting `JSON.parse` invocations rather than by timing. This is
  // strictly stronger than the timing version (it proves laziness exactly,
  // rather than inferring it from an elapsed-time proxy) and cannot flake
  // under scheduler or GC noise, since the count does not depend on either.
  it('pushing many single-character chunks without reading every result never calls JSON.parse', () => {
    const members = Array.from({ length: 3000 }, (_, i) => `"f${String(i)}":${String(i)}`);
    const doc = `{${members.join(',')}}`;

    let parseCalls = 0;
    const originalParse = JSON.parse;
    JSON.parse = ((...args: Parameters<typeof JSON.parse>) => {
      parseCalls += 1;
      return originalParse(...args);
    }) as typeof JSON.parse;

    const mender = createJsonMender();
    try {
      for (let i = 0; i < doc.length; i += 1) {
        mender.push(doc[i] as string); // never reads .value/.repairedJson
      }
      expect(parseCalls).toBe(0); // resolve() must not have run at all yet

      const final = mender.finish();
      expect(parseCalls).toBe(0); // finish() alone still doesn't read .value

      expect(final.complete).toBe(true);
      expect(final.value).toEqual(Object.fromEntries(members.map((_, i) => [`f${String(i)}`, i])));
      expect(parseCalls).toBe(1); // exactly one materialization, on first read
      void final.value; // repeat read
      expect(parseCalls).toBe(1); // memoized — no second parse
    } finally {
      JSON.parse = originalParse;
    }
  });
});
