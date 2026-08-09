import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { normalizeLineEndings } from '../src/document/normalize.js';

describe('normalizeLineEndings', () => {
  it('leaves LF-only text untouched, with an identity offset map', () => {
    const input = 'line one\nline two\nline three';
    const normalized = normalizeLineEndings(input);
    expect(normalized.text).toBe(input);
    expect(normalized.toOriginalOffset(0)).toBe(0);
    expect(normalized.toOriginalOffset(5)).toBe(5);
    expect(normalized.toOriginalOffset(input.length)).toBe(input.length);
  });

  it('collapses CRLF to LF and shortens the text', () => {
    const input = 'line one\r\nline two\r\n';
    const normalized = normalizeLineEndings(input);
    expect(normalized.text).toBe('line one\nline two\n');
  });

  it('converts a lone CR to LF without changing length', () => {
    const input = 'line one\rline two';
    const normalized = normalizeLineEndings(input);
    expect(normalized.text).toBe('line one\nline two');
    expect(normalized.text.length).toBe(input.length);
  });

  it('maps every normalized offset back to the exact original offset (CRLF)', () => {
    const input = 'aa\r\nbb\r\ncc';
    // original: a a \r \n b  b  \r  \n c  c
    // idx:      0 1 2  3  4  5  6   7  8  9
    // normalized: a a \n b b \n c c
    // idx:        0 1 2  3 4 5  6 7
    const normalized = normalizeLineEndings(input);
    expect(normalized.text).toBe('aa\nbb\ncc');
    // Before the first CRLF, offsets are identical.
    expect(normalized.toOriginalOffset(0)).toBe(0);
    expect(normalized.toOriginalOffset(2)).toBe(2); // the '\n' itself, collapsed from '\r\n' at original 2-3
    // After the first collapse, every offset is shifted by 1 — normalized
    // index 5 (the second '\n') maps to the *start* of the original '\r\n'
    // pair that produced it (the shift to +2 only takes effect from
    // normalized index 6 on), which is what keeps range slicing consistent:
    // `input.slice(toOriginalOffset(5), toOriginalOffset(6))` is `'\r\n'`,
    // which normalizes back to the single `'\n'` at `normalized.text[5]`.
    expect(normalized.toOriginalOffset(3)).toBe(4); // 'b'
    expect(normalized.toOriginalOffset(5)).toBe(6);
    expect(normalizeLineEndings(input.slice(6, 8)).text).toBe('\n');
    // After the second collapse, shifted by 2.
    expect(normalized.toOriginalOffset(6)).toBe(8); // 'c'
    expect(normalized.toOriginalOffset(8)).toBe(10); // end of string
  });

  it('round-trips: slicing the original at the mapped offsets, then normalizing, matches the normalized slice', () => {
    fc.assert(
      fc.property(
        fc
          .array(fc.constantFrom('a', 'b', 'c', '\n', '\r\n', '\r', ' '), {
            minLength: 0,
            maxLength: 50,
          })
          .map((parts) => parts.join('')),
        fc.nat(),
        fc.nat(),
        (input, a, b) => {
          const normalized = normalizeLineEndings(input);
          const len = normalized.text.length;
          const start = Math.min(a, len);
          const end = Math.min(Math.max(start, b), len);
          const origStart = normalized.toOriginalOffset(start);
          const origEnd = normalized.toOriginalOffset(end);
          const reNormalized = normalizeLineEndings(input.slice(origStart, origEnd)).text;
          expect(reNormalized).toBe(normalized.text.slice(start, end));
        },
      ),
      { seed: 0x6e6f_726d, numRuns: 500 },
    );
  });
});
