/**
 * `toLeafUnits` in `src/chunk-text.ts` must not collect split leaves with
 * `leaves.push(...pieces)` on either the table (`splitTable`) or plain
 * (`splitOversizedUnit`) path. Spread syntax turns `pieces` into call
 * *arguments*, which every JS engine caps far below what this package's leaf
 * counts can reach: a run of indivisible units (at `maxTokens: 1` the
 * approximate tokenizer treats each one as its own over-budget unit)
 * produces one leaf per character.
 *
 * Measured on Node 24.8.0, a bare `[].push(...new Array(n))` starts throwing
 * `RangeError: Maximum call stack size exceeded` at n = 125,149, and a little
 * below that once nested inside a real call stack (at depth 40 it throws at
 * 125,000 and survives 120,000). `LEAF_COUNT` sits ~20% above that, and two
 * orders of magnitude under the default `maxInputChars` (5,000,000), so this
 * reproduces well within default limits rather than below some raised cap.
 *
 * The unit is a CJK ideograph rather than an emoji. Both are indivisible at
 * `maxTokens: 1` and both yield exactly one leaf per character, but an emoji
 * costs about twice as much to segment, and this test is about argument
 * *count* — nothing here depends on the character being astral or on
 * grapheme-cluster handling, which `test/unicode-samples.test.ts` and
 * `test/reconstruction.property.test.ts` cover directly. Halving the per-leaf
 * cost matters because this file was the slowest in the package by a wide
 * margin.
 *
 * The fix replaced both spreads with bounded `for (const piece of ...)
 * leaves.push(piece)` loops (see `toLeafUnits`'s comment in
 * `src/chunk-text.ts`). This is a pure regression test: it doesn't assert
 * anything about timing (see `test/diagnostic-routing-scaling.test.ts` for
 * that), only that the call completes without `RangeError` and that every
 * character of the source is accounted for in the output.
 */
import { describe, expect, it } from 'vitest';
import { chunkMarkdown, chunkText } from '../src/index.js';

interface SourceRange {
  readonly text: string;
  readonly source: { readonly charStart: number; readonly charEnd: number };
}

/** Index of the first chunk that does not start where the previous one ended, or -1. */
function firstNonContiguousIndex(chunks: readonly SourceRange[]): number {
  for (let i = 1; i < chunks.length; i += 1) {
    if (chunks[i]?.source.charStart !== chunks[i - 1]?.source.charEnd) return i;
  }
  return -1;
}

/** Index of the first chunk whose reported source range does not slice back to its own text, or -1. */
function firstSourceMismatchIndex(chunks: readonly SourceRange[], doc: string): number {
  for (let i = 0; i < chunks.length; i += 1) {
    const chunk = chunks[i];
    if (chunk === undefined) return i;
    if (doc.slice(chunk.source.charStart, chunk.source.charEnd) !== chunk.text) return i;
  }
  return -1;
}

/** Index of the first chunk that starts before the previous one, or -1. */
function firstOutOfOrderIndex(chunks: readonly SourceRange[]): number {
  for (let i = 1; i < chunks.length; i += 1) {
    if ((chunks[i]?.source.charStart ?? 0) < (chunks[i - 1]?.source.charStart ?? 0)) return i;
  }
  return -1;
}

/**
 * Opt-in: RUN_SCALING_ASSERTIONS=1.
 *
 * Reproducing the engine argument limit requires more than ~125,000 live
 * leaves by definition, and materializing that many chunk objects costs a few
 * seconds locally but over 100s on a two-core CI runner already hosting eight
 * packages' vitest workers — memory pressure, not CPU, and it took the whole
 * job down with worker RPC timeouts.
 *
 * What actually prevents the regression is the no-restricted-syntax rule
 * covering every shipped source directory, which rejects any spread into a
 * call and runs on every lint (the first step of the gate). Reintroducing
 * leaves.push(...pieces) fails lint before any test executes. These two tests
 * demonstrate the consequence end to end; they are not the enforcement.
 */
const RUN_SCALING_ASSERTIONS = process.env.RUN_SCALING_ASSERTIONS === '1';

/** ~20% above the measured engine argument limit; see the module doc comment. */
const LEAF_COUNT = 150_000;

/** Indivisible at maxTokens: 1, one leaf per character, and cheaper to segment than an emoji. */
const UNIT = '語';

describe('no argument-spread stack overflow splitting oversized units', () => {
  it.skipIf(!RUN_SCALING_ASSERTIONS)(
    'plain-text path: an indivisible-unit run far above the engine argument limit does not throw RangeError, and every source range is preserved',
    () => {
      const text = UNIT.repeat(LEAF_COUNT);

      let chunks: ReturnType<typeof chunkText>;
      expect(() => {
        chunks = chunkText(text, { maxTokens: 1, format: 'text' });
      }).not.toThrow();

      // Each unit becomes its own leaf/chunk at maxTokens: 1.
      expect(chunks!.length).toBe(LEAF_COUNT);

      // No content lost, duplicated, or reordered: joined chunk text
      // reconstructs the input exactly.
      expect(chunks!.map((c) => c.text).join('')).toBe(text);

      // Source ranges are contiguous, ordered, and cover the whole input.
      expect(chunks![0]?.source.charStart).toBe(0);
      expect(chunks![chunks!.length - 1]?.source.charEnd).toBe(text.length);

      // Scan in a plain loop and assert once. An `expect` per element would be
      // one matcher invocation per leaf, each building its own context and lazy
      // failure message — that overhead dwarfed the chunking this test is
      // actually about and pushed the file into minutes.
      expect(firstNonContiguousIndex(chunks!)).toBe(-1);
    },
    30_000,
  );

  it.skipIf(!RUN_SCALING_ASSERTIONS)(
    'table split path: an oversized table row far above the engine argument limit does not throw RangeError, and every source range is preserved',
    () => {
      const row = UNIT.repeat(LEAF_COUNT);
      const doc = `| A |\n| --- |\n| ${row} |\n`;

      let chunks: ReturnType<typeof chunkMarkdown>;
      expect(() => {
        chunks = chunkMarkdown(doc, { maxTokens: 1 });
      }).not.toThrow();

      expect(chunks!.length).toBeGreaterThan(LEAF_COUNT);

      // Every chunk's reported source range really is that slice of `doc`
      // (post CRLF-normalization, which doesn't apply here — no \r). Scanned in
      // a plain loop for the same reason as the plain-text case above: one
      // assertion, not one per chunk.
      expect(firstSourceMismatchIndex(chunks!, doc)).toBe(-1);

      // Ranges are ordered and, taken together, reconstruct the full document.
      const reconstructed = chunks!
        .map((c) => doc.slice(c.source.charStart, c.source.charEnd))
        .join('');
      expect(reconstructed).toBe(doc);
      expect(firstOutOfOrderIndex(chunks!)).toBe(-1);
    },
    30_000,
  );
});
