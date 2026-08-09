/**
 * Targeted tests for branches that need deliberate setup to reach: a "clean"
 * in-progress number under best-effort policy (no trimming needed), an
 * exponent sign with no following digit, and the manual UTF-8 decoder
 * fallback a runtime without `TextDecoder` would take. (`utf8ByteLength` in
 * `limits.ts` has no runtime-detection branch to exercise here any more —
 * it always counts bytes with a code-point walk; see its property test in
 * `test/limits.test.ts`.)
 */
import { afterEach, describe, expect, it } from 'vitest';
import { createJsonMender } from '../src/create-json-mender.js';
import { mendJson } from '../src/index.js';
import { createUtf8Decoder } from '../src/utf8-decoder.js';

describe('best-effort number with no dangling suffix to trim', () => {
  it('shows the digits as-is, with no "number-truncated" diagnostic', () => {
    const mender = createJsonMender({ incompleteScalarPolicy: 'best-effort' });
    mender.push('[42');
    const snap = mender.snapshot(); // not finishing: "42" might still grow
    expect(snap.value).toEqual([42]);
    expect(snap.diagnostics.some((d) => d.code === 'number-truncated')).toBe(false);
  });
});

describe('exponent sign with no following digit is a genuine syntax error', () => {
  it('freezes rather than treating it as truncation', () => {
    const r = mendJson('[3e+x]');
    expect(r.complete).toBe(false);
    expect(r.value).toEqual([]);
  });
});

describe('runtime fallbacks (no global TextDecoder)', () => {
  const originalTextDecoder = globalThis.TextDecoder;

  afterEach(() => {
    globalThis.TextDecoder = originalTextDecoder;
  });

  it('createUtf8Decoder falls back to the manual decoder without a global TextDecoder', () => {
    // @ts-expect-error -- deliberately simulating a runtime without TextDecoder
    delete globalThis.TextDecoder;
    const decoder = createUtf8Decoder();
    const bytes = new TextEncoder().encode('café 🚀');
    expect(decoder.decode(bytes)).toBe('café 🚀');
  });
});
