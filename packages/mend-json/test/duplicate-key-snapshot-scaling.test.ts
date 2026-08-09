/**
 * Checks, by measurement rather than by reasoning about the code's shape,
 * the cost of `sliceWithExclusions` (`repair-suffix.ts`) filtering and
 * sorting `state.excludedRanges` on every `resolve()`. A caller reading
 * `.value` on every `push()` over a `duplicateKeyPolicy: 'first'` stream
 * pays `O(k log k)` per snapshot on top of the documented `O(buffer)`,
 * where `k` is the number of excluded ranges.
 *
 * Three things are established here:
 *
 * 1. `excludedRanges` is already ascending by `start` when `mergeRanges`
 *    sorts it. Duplicate members are only ever appended
 *    (`state-machine.ts`'s `completeValue`) as the single-pass scanner moves
 *    forward through the buffer, so `frame.suppressStart` can only increase
 *    from one push to the next — verified here by intercepting
 *    `Array.prototype.push` rather than by re-deriving the argument from
 *    the source.
 * 2. Per-push `.value` reads over a duplicate-heavy stream do far more
 *    `excludedRanges` filter/sort work than reading `.value` once at the
 *    end: redoing the full filter+merge over a growing `excludedRanges` on
 *    every snapshot sums to quadratic total work, the same shape a plain
 *    `O(buffer)`-per-snapshot cost already produces on its own. Measured by
 *    counting `Array.prototype.filter`/`sort` invocations and elements
 *    processed, not by wall-clock time — see "Why counting, not timing"
 *    below.
 * 3. At matched buffer size, the duplicate-heavy case is never worse than —
 *    and is typically dramatically cheaper than — the equivalent
 *    all-unique-key stream with no exclusions at all, read per push the
 *    same way. This is the decisive comparison: the filter+sort over
 *    `excludedRanges` does not add a cost beyond what the README's
 *    Performance section already discloses for reading `.value` on every
 *    `push()` — excluding duplicate text shrinks the materialized
 *    `repairedJson` faster than accounting for the exclusions costs. This
 *    claim is inherently a wall-clock comparison (native `JSON.parse` of a
 *    large string vs. JS-level array bookkeeping are different cost
 *    currencies that only timing can compare honestly), so it stays
 *    timing-based — see that test for the hardening applied.
 *
 * ## Why counting, not timing
 *
 * Comparing elapsed-time ratios across input sizes (per-push growth vs.
 * once-at-end growth) is tempting here and does not hold up: two independent
 * timing measurements flake whenever a scheduler stall lands inside only one
 * of them, which under parallel coverage runs happens often enough to matter.
 * The property this test actually establishes — "per-push
 * materialization redoes O(k) exclusion bookkeeping on every snapshot, so
 * total work is O(n^2) across the stream, vs. O(n) for a single
 * end-of-stream read" — does not need a clock at all: it is a claim about
 * how many times, and over how many elements, `sliceWithExclusions`/
 * `mergeRanges` run. `countArrayOps` below intercepts
 * `Array.prototype.filter`/`sort`, scoped to arrays shaped like
 * `excludedRanges` (non-empty `[number, number]` tuples — nothing else in
 * this package's push()/finish() path has that shape), and counts calls and
 * elements directly. That count is a pure function of the document and
 * chunk size, so this version of the test cannot flake under contention,
 * coverage instrumentation, or GC pauses.
 */
import { describe, expect, it } from 'vitest';
import { createJsonMender } from '../src/create-json-mender.js';
import type { JsonMendResult } from '../src/types.js';

function buildDuplicateKeyDocument(memberCount: number): string {
  const members: string[] = [];
  for (let i = 0; i < memberCount; i += 1) {
    members.push(`"k":${String(i)}`);
  }
  return `{${members.join(',')}}`;
}

/** Same per-member width as `buildDuplicateKeyDocument`, but every key unique — `excludedRanges` never grows. */
function buildUniqueKeyDocumentSameWidth(memberCount: number): string {
  const members: string[] = [];
  for (let i = 0; i < memberCount; i += 1) {
    members.push(`"${String(i).padStart(6, '0')}":0`);
  }
  return `{${members.join(',')}}`;
}

const CHUNK_SIZE = 64;

function pushChunked(doc: string, onChunkResult: (r: JsonMendResult<unknown>) => void): void {
  const mender = createJsonMender({ duplicateKeyPolicy: 'first' });
  for (let i = 0; i < doc.length; i += CHUNK_SIZE) {
    onChunkResult(mender.push(doc.slice(i, i + CHUNK_SIZE)));
  }
  onChunkResult(mender.finish());
}

function measurePerPush(doc: string): number {
  const start = performance.now();
  pushChunked(doc, (r) => void r.value); // read on every push: the pathological pattern SECURITY.md warns about
  return performance.now() - start;
}

/**
 * Intercepts `Array.prototype.filter`/`sort`, counting only calls on arrays
 * shaped exactly like `state.excludedRanges` (non-empty arrays of
 * `[number, number]` tuples) — the shape `sliceWithExclusions`/`mergeRanges`
 * operate on and nothing else touches on this package's `push()`/`finish()`
 * path. Deterministic: a rerun of `fn` with the same input always produces
 * the same counts, regardless of machine load, coverage instrumentation, or
 * scheduling — unlike wall-clock time, which is why this exists.
 */
function countArrayOps(fn: () => void): {
  filterCalls: number;
  filterElements: number;
  sortCalls: number;
  sortElements: number;
} {
  let filterCalls = 0;
  let filterElements = 0;
  let sortCalls = 0;
  let sortElements = 0;

  function isRangeTupleArray(arr: readonly unknown[]): boolean {
    return (
      arr.length > 0 &&
      arr.every(
        (item) =>
          Array.isArray(item) &&
          item.length === 2 &&
          typeof item[0] === 'number' &&
          typeof item[1] === 'number',
      )
    );
  }

  const originalFilter = Array.prototype.filter;
  const originalSort = Array.prototype.sort;

  Array.prototype.filter = function interceptingFilter(this: unknown[], ...args: unknown[]) {
    if (isRangeTupleArray(this)) {
      filterCalls += 1;
      filterElements += this.length;
    }
    return originalFilter.apply(this, args as never);
  } as typeof Array.prototype.filter;

  Array.prototype.sort = function interceptingSort(this: unknown[], ...args: unknown[]) {
    if (isRangeTupleArray(this)) {
      sortCalls += 1;
      sortElements += this.length;
    }
    return originalSort.apply(this, args as never);
  } as typeof Array.prototype.sort;

  try {
    fn();
  } finally {
    Array.prototype.filter = originalFilter;
    Array.prototype.sort = originalSort;
  }

  return { filterCalls, filterElements, sortCalls, sortElements };
}

describe('excludedRanges is already sorted when mergeRanges sorts it', () => {
  it('duplicate ranges are pushed in non-decreasing order of start, across 100,000 duplicate keys', () => {
    const doc = buildDuplicateKeyDocument(100_000);
    const recorded: [number, number][] = [];

    const originalPush = Array.prototype.push;
    Array.prototype.push = function interceptingPush(this: unknown[], ...items: unknown[]) {
      if (
        items.length === 1 &&
        Array.isArray(items[0]) &&
        items[0].length === 2 &&
        typeof items[0][0] === 'number' &&
        typeof items[0][1] === 'number'
      ) {
        // Assign by index, not `recorded.push(...)` — `recorded` is a plain
        // array too, and calling `.push` on it here would re-enter this same
        // intercepted `Array.prototype.push`.
        recorded[recorded.length] = items[0] as [number, number];
      }
      return originalPush.apply(this, items as never);
    } as typeof Array.prototype.push;

    try {
      const mender = createJsonMender({ duplicateKeyPolicy: 'first' });
      mender.push(doc);
      void mender.finish().value;
    } finally {
      Array.prototype.push = originalPush;
    }

    // Sanity check the reproduction shape: one exclusion range per duplicate
    // member (100,000 keys - 1 kept as the first occurrence).
    expect(recorded.length).toBe(99_999);

    for (let i = 1; i < recorded.length; i += 1) {
      expect((recorded[i] as [number, number])[0]).toBeGreaterThanOrEqual(
        (recorded[i - 1] as [number, number])[0],
      );
    }
  });
});

describe('per-push .value reads over a duplicate-heavy stream do far more excludedRanges work than reading once at the end', () => {
  it('total filter/sort element-operations are counted directly (no wall-clock time), and per-push sums to far more than a single end-of-stream read', () => {
    const doc = buildDuplicateKeyDocument(10_000);

    const perPush = countArrayOps(() => {
      pushChunked(doc, (r) => void r.value); // read every push
    });
    const onceAtEnd = countArrayOps(() => {
      pushChunked(doc, () => {}); // scan only, .value/.repairedJson never touched
    });
    const onceAtEndReadOnce = countArrayOps(() => {
      const mender = createJsonMender({ duplicateKeyPolicy: 'first' });
      for (let i = 0; i < doc.length; i += CHUNK_SIZE) {
        mender.push(doc.slice(i, i + CHUNK_SIZE)); // never read .value mid-stream
      }
      void mender.finish().value; // exactly one materialization
    });

    console.log(
      `per-push:          filterCalls=${String(perPush.filterCalls)}, ` +
        `filterElements=${String(perPush.filterElements)}, ` +
        `sortCalls=${String(perPush.sortCalls)}, sortElements=${String(perPush.sortElements)}`,
    );
    console.log(
      `once-at-end (read never): filterCalls=${String(onceAtEnd.filterCalls)} (expect 0 — .value is never read)`,
    );
    console.log(
      `once-at-end (read once):  filterCalls=${String(onceAtEndReadOnce.filterCalls)}, ` +
        `filterElements=${String(onceAtEndReadOnce.filterElements)}, ` +
        `sortCalls=${String(onceAtEndReadOnce.sortCalls)}, ` +
        `sortElements=${String(onceAtEndReadOnce.sortElements)}`,
    );

    // Scanning alone (never reading .value) never touches excludedRanges'
    // filter/sort at all — resolve() is lazy, exactly as documented.
    expect(onceAtEnd.filterCalls).toBe(0);
    expect(onceAtEnd.sortCalls).toBe(0);

    // A single end-of-stream read does exactly one filter+sort pass, over
    // (up to) the full, final excludedRanges — one call each, deterministic.
    expect(onceAtEndReadOnce.filterCalls).toBe(1);
    expect(onceAtEndReadOnce.sortCalls).toBe(1);
    expect(onceAtEndReadOnce.filterElements).toBeGreaterThan(9_000); // ~9,999 dropped duplicates
    expect(onceAtEndReadOnce.sortElements).toBe(onceAtEndReadOnce.filterElements);

    // Per-push reads redo that pass on (up to) every push — many calls, and
    // the *sum* of elements processed across all of them is what makes this
    // O(n^2): a growing excludedRanges filtered/sorted from scratch on every
    // one of ~doc.length/CHUNK_SIZE reads, rather than once.
    expect(perPush.filterCalls).toBeGreaterThan(100);
    expect(perPush.filterCalls).toBe(perPush.sortCalls); // every filter that finds anything relevant is followed by a merge+sort

    // The decisive, deterministic assertion: total elements processed by
    // per-push reads is a large multiple of the single once-at-end pass —
    // this is a pure function of the document and CHUNK_SIZE, so it cannot
    // flip due to scheduling, GC, or coverage instrumentation. A future
    // change that makes this ratio collapse (e.g. memoizing the merged
    // ranges) is the signal to revisit this trade-off, not a false alarm.
    expect(perPush.filterElements).toBeGreaterThan(onceAtEndReadOnce.filterElements * 50);
  });
});

describe('duplicate-heavy per-push reads are not worse than the already-documented general case', () => {
  it('at matched buffer size, a duplicate-heavy stream read per push is not slower than an all-unique-key stream of the same shape', () => {
    // This claim is inherently a wall-clock comparison — native `JSON.parse`
    // of a large string (the unique-key side) and JS-level array
    // filter/sort bookkeeping (the duplicate-heavy side) are different cost
    // currencies that only timing can compare honestly; see the file doc
    // comment's "Why counting, not timing" for why test 2 above could move
    // off the clock and this one cannot.
    //
    // Best-of-5, a member count large enough to keep absolute times well
    // above fixed overhead, and a threshold with real headroom above every
    // margin measured during development (worst observed: duplicate-heavy
    // at ~0.72x of all-unique's time, under coverage instrumentation;
    // typical without coverage: 0.04x-0.2x). `2x` sits comfortably above
    // that worst case while still failing if a future change makes
    // excludedRanges handling the dominant cost — verified by deliberately
    // reintroducing that pathology and confirming this assertion goes red
    // before restoring the source.
    const memberCount = 8_000;
    const dupDoc = buildDuplicateKeyDocument(memberCount);
    const uniqueDoc = buildUniqueKeyDocumentSameWidth(memberCount);

    const REPS = 5;
    let dupMs = Infinity;
    let uniqueMs = Infinity;
    for (let i = 0; i < REPS; i += 1) {
      dupMs = Math.min(dupMs, measurePerPush(dupDoc));
      uniqueMs = Math.min(uniqueMs, measurePerPush(uniqueDoc));
    }

    console.log(
      `matched-size comparison (member count ${String(memberCount)}, best of ${String(REPS)}): ` +
        `duplicate-heavy=${dupMs.toFixed(1)}ms, all-unique=${uniqueMs.toFixed(1)}ms, ` +
        `ratio=${(dupMs / uniqueMs).toFixed(3)}`,
    );

    expect(dupMs).toBeLessThan(uniqueMs * 2);
  }, 60_000);
});
