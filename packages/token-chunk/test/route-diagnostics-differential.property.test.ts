/**
 * `routeDiagnostics` was rewritten from an
 * O(chunks x diagnostics) `map` + `filter` into a single sorted sweep (see
 * its doc comment in `src/chunk-text.ts`). The rewrite must attach exactly
 * the same diagnostics, in the same order, to every chunk as the original
 * did — including the legitimate case where one diagnostic overlaps more
 * than one chunk (e.g. an unclosed fence running to end of input, or a
 * per-leaf diagnostic that falls inside an overlap region shared by two
 * adjacent chunks).
 *
 * This differentially tests the new implementation (imported directly from
 * `../src/chunk-text.js` — it is exported but deliberately not part of the
 * public `index.ts` barrel, the same white-box pattern `test/normalize.test.ts`
 * uses for `normalizeLineEndings`) against `routeDiagnosticsReference`
 * below, a verbatim copy of the pre-fix implementation kept here only for
 * this comparison.
 *
 * Chunk ranges are generated to respect the real invariant the new
 * algorithm's sweep depends on: `source.charStart` and `source.charEnd` are
 * non-decreasing across the chunk array (true in production — see the
 * routing function's doc comment for why), with a second generator that
 * deliberately overlaps consecutive chunk ranges the way `overlapTokens`
 * does. Diagnostics are generated independently, in arbitrary (not
 * necessarily sorted) order, with spans ranging from a single character to
 * the whole document — covering both "one diagnostic, one chunk" and "one
 * diagnostic, many chunks".
 *
 * Seeded so a CI failure reproduces exactly.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { routeDiagnostics } from '../src/chunk-text.js';
import type { ChunkDiagnostic, TextChunk } from '../src/types.js';

const FAST_CHECK_SEED = 0x64_69_61_67; // 'diag'
const FAST_CHECK_RUNS = 500;

/**
 * Verbatim copy of `routeDiagnostics` as it existed before the O(chunks x diagnostics) fix:
 * maps over every chunk and, per chunk, filters the entire diagnostics
 * collection. O(chunks x diagnostics) — kept only as a differential oracle.
 */
function routeDiagnosticsReference(
  chunks: readonly TextChunk[],
  diagnostics: readonly ChunkDiagnostic[],
  toOriginalOffset: (normalizedIndex: number) => number,
): TextChunk[] {
  if (diagnostics.length === 0 || chunks.length === 0) return [...chunks];

  const converted = diagnostics.map((d) => ({
    ...d,
    charStart: d.charStart === undefined ? undefined : toOriginalOffset(d.charStart),
    charEnd: d.charEnd === undefined ? undefined : toOriginalOffset(d.charEnd),
  }));

  return chunks.map((chunk) => {
    const attached = converted.filter(
      (d) =>
        d.charStart !== undefined &&
        d.charEnd !== undefined &&
        d.charStart < chunk.source.charEnd &&
        d.charEnd > chunk.source.charStart,
    );
    return attached.length === 0
      ? chunk
      : { ...chunk, diagnostics: [...(chunk.diagnostics ?? []), ...attached] };
  });
}

function makeChunk(
  index: number,
  charStart: number,
  charEnd: number,
  preexisting: readonly ChunkDiagnostic[] | undefined,
): TextChunk {
  return {
    id: `chunk-${String(index)}`,
    index,
    text: 'x'.repeat(Math.max(1, charEnd - charStart)),
    tokenCount: 1,
    tokenizerId: 'differential-test',
    source: { charStart, charEnd },
    headings: [],
    kinds: ['paragraph'],
    overlap: { tokensFromPrevious: 0 },
    ...(preexisting !== undefined ? { diagnostics: preexisting } : {}),
  };
}

/** Non-overlapping, contiguous-or-gapped chunk ranges: charStart_i >= charEnd_{i-1}. */
const disjointChunksArb = fc.integer({ min: 1, max: 20 }).chain((chunkCount) =>
  fc
    .array(fc.integer({ min: 0, max: 8 }), { minLength: chunkCount * 2, maxLength: chunkCount * 2 })
    .map((deltas) => {
      const ranges: { charStart: number; charEnd: number }[] = [];
      let cursor = 0;
      for (let i = 0; i < chunkCount; i += 1) {
        const gap = deltas[i * 2] ?? 0;
        const width = (deltas[i * 2 + 1] ?? 0) + 1;
        const start = cursor + gap;
        const end = start + width;
        ranges.push({ charStart: start, charEnd: end });
        cursor = end;
      }
      return ranges;
    }),
);

/** Chunk ranges that overlap their predecessor, like `overlapTokens` produces: start/end both non-decreasing, but start may dip back into the previous chunk's own range. */
const overlappingChunksArb = fc.integer({ min: 1, max: 20 }).chain((chunkCount) =>
  fc
    .array(fc.integer({ min: 0, max: 8 }), { minLength: chunkCount * 3, maxLength: chunkCount * 3 })
    .map((deltas) => {
      const ranges: { charStart: number; charEnd: number }[] = [];
      let prevStart = 0;
      let prevEnd = 0;
      for (let i = 0; i < chunkCount; i += 1) {
        const advance = deltas[i * 3] ?? 0;
        const overlapBack = deltas[i * 3 + 1] ?? 0;
        const width = (deltas[i * 3 + 2] ?? 0) + 1;
        const candidateStart = prevStart + advance;
        // Never below prevStart (monotonic), but may reach back before prevEnd.
        const start = Math.max(prevStart, candidateStart - overlapBack);
        const end = Math.max(start + width, prevEnd);
        ranges.push({ charStart: start, charEnd: end });
        prevStart = start;
        prevEnd = end;
      }
      return ranges;
    }),
);

const chunkRangesArb = fc.oneof(disjointChunksArb, overlappingChunksArb);

/** Diagnostics with arbitrary (not necessarily sorted) spans, some wide enough to cover many chunks, some undefined (never attach). */
function diagnosticsArb(maxOffset: number) {
  return fc.array(
    fc.oneof(
      // A defined span, in arbitrary order relative to other diagnostics.
      fc
        .tuple(
          fc.integer({ min: 0, max: Math.max(0, maxOffset) }),
          fc.integer({ min: 0, max: Math.max(0, maxOffset) }),
        )
        .map(([a, b]): ChunkDiagnostic => {
          const charStart = Math.min(a, b);
          const charEnd = Math.max(a, b) + 1; // ensure charEnd > charStart
          return { code: 'BUDGET_EXCEEDED', message: 'synthetic', charStart, charEnd };
        }),
      // No range at all: must never attach to any chunk.
      fc.constant<ChunkDiagnostic>({ code: 'HEADING_PREFIX_OMITTED', message: 'no range' }),
    ),
    { maxLength: 40 },
  );
}

const caseArb = chunkRangesArb.chain((ranges) => {
  const maxOffset = ranges.length === 0 ? 10 : (ranges[ranges.length - 1]?.charEnd ?? 10) + 10;
  return fc.tuple(
    fc.constant(ranges),
    diagnosticsArb(maxOffset),
    fc.array(fc.boolean(), { minLength: ranges.length, maxLength: ranges.length }),
  );
});

describe('routeDiagnostics rewrite (differential property test)', () => {
  it('attaches identical diagnostics, in identical order, to every chunk as the pre-fix implementation', () => {
    fc.assert(
      fc.property(caseArb, ([ranges, diagnostics, hasPreexisting]) => {
        const chunks = ranges.map((r, i) =>
          makeChunk(
            i,
            r.charStart,
            r.charEnd,
            hasPreexisting[i] === true
              ? [{ code: 'HARD_BOUNDARY_REACHED', message: 'preexisting' }]
              : undefined,
          ),
        );
        const identity = (n: number): number => n;

        const before = routeDiagnosticsReference(chunks, diagnostics, identity);
        const after = routeDiagnostics(chunks, diagnostics, identity);

        expect(after).toEqual(before);
      }),
      { seed: FAST_CHECK_SEED, numRuns: FAST_CHECK_RUNS },
    );
  });

  it('handles the empty-diagnostics and empty-chunks shortcuts identically', () => {
    const chunk = makeChunk(0, 0, 5, undefined);
    const diag: ChunkDiagnostic = {
      code: 'BUDGET_EXCEEDED',
      message: 'x',
      charStart: 0,
      charEnd: 5,
    };
    const identity = (n: number): number => n;

    expect(routeDiagnostics([], [diag], identity)).toEqual(
      routeDiagnosticsReference([], [diag], identity),
    );
    expect(routeDiagnostics([chunk], [], identity)).toEqual(
      routeDiagnosticsReference([chunk], [], identity),
    );
  });
});
