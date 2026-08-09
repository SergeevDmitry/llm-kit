/**
 * Throughput baseline for `mend-json` (`vitest bench`), covering the
 * scenarios the package brief calls out explicitly: many tiny chunks, one
 * large chunk, deep nesting, and a long string.
 *
 * Not a correctness check — the rest of `test/` owns that. This tracks
 * whether the scanner stays amortized O(n) across a stream: "many tiny
 * chunks" in particular would visibly regress — from roughly linear to
 * roughly quadratic wall time — if a future change reintroduced a
 * full-buffer rescan per chunk or a regex sweep over the whole document.
 */
import { bench, describe } from 'vitest';
import { createJsonMender } from '../src/create-json-mender.js';
import { mendJson } from '../src/index.js';

function buildWideDocument(memberCount: number): string {
  const members: string[] = [];
  for (let i = 0; i < memberCount; i += 1) {
    members.push(`"field_${String(i)}":${String(i)}`);
  }
  return `{${members.join(',')}}`;
}

function buildDeepDocument(depth: number): string {
  return '['.repeat(depth) + '1' + ']'.repeat(depth);
}

function buildToolCallDocument(): string {
  return JSON.stringify({
    tool_calls: Array.from({ length: 20 }, (_, i) => ({
      id: `call_${String(i)}`,
      type: 'function',
      function: {
        name: 'search_documents',
        arguments: JSON.stringify({
          query: `sample query number ${String(i)} with some realistic length text`,
          filters: ['recent', 'verified', 'english'],
          limit: 10,
        }),
      },
    })),
  });
}

const wideDocument = buildWideDocument(5_000); // ~90k characters
const deepDocument = buildDeepDocument(500);
const toolCallDocument = buildToolCallDocument();
const longStringDocument = `{"data":"${'x'.repeat(500_000)}"}`;

describe('mend-json — one large chunk', () => {
  bench('wide object (5,000 members) pushed in one chunk', () => {
    mendJson(wideDocument);
  });

  bench('deep nesting (500 levels) pushed in one chunk', () => {
    mendJson(deepDocument, { maxDepth: 1000 });
  });

  bench('long string (500,000 characters) pushed in one chunk', () => {
    mendJson(longStringDocument);
  });

  bench('realistic multi-tool-call payload pushed in one chunk', () => {
    mendJson(toolCallDocument);
  });
});

describe('mend-json — many tiny chunks (regression guard against a full rescan per chunk)', () => {
  bench('wide object streamed one character at a time', () => {
    const mender = createJsonMender();
    for (let i = 0; i < wideDocument.length; i += 1) {
      mender.push(wideDocument[i] as string);
    }
    mender.finish();
  });

  bench('10,000 single-character pushes with a snapshot() after every one', () => {
    const doc = wideDocument.slice(0, 10_000);
    const mender = createJsonMender();
    for (let i = 0; i < doc.length; i += 1) {
      mender.push(doc[i] as string);
      mender.snapshot();
    }
    mender.finish();
  });

  bench('tool-call payload streamed in 4-character chunks', () => {
    const mender = createJsonMender();
    for (let i = 0; i < toolCallDocument.length; i += 4) {
      mender.push(toolCallDocument.slice(i, i + 4));
    }
    mender.finish();
  });
});

describe('mend-json — snapshot() cost on a large already-buffered document', () => {
  const mender = createJsonMender();
  mender.push(wideDocument.slice(0, -1)); // leave it open

  bench('repeated snapshot() calls on the same open document', () => {
    mender.snapshot();
  });
});

/**
 * Pins the shape settled in `test/duplicate-key-snapshot-scaling.test.ts`:
 * `sliceWithExclusions` (`repair-suffix.ts`) filters and sorts
 * `state.excludedRanges` on every `resolve()`. Measured, not assumed:
 * `excludedRanges` is pushed in already-ascending order (duplicates are
 * only ever appended as the single-pass scanner moves forward), so the sort
 * is close to O(k) in practice, not O(k log k) — and at matched buffer
 * size, a duplicate-heavy stream read per push is *not* slower than an
 * all-unique-key stream of the same shape (excluding duplicate text shrinks
 * the materialized output faster than tracking the exclusions costs). These
 * benchmarks exist so a future change that makes `excludedRanges` handling
 * the dominant cost shows up here, not just in a support ticket.
 */
function buildDuplicateKeyDocument(memberCount: number): string {
  const members: string[] = [];
  for (let i = 0; i < memberCount; i += 1) {
    members.push(`"k":${String(i)}`);
  }
  return `{${members.join(',')}}`;
}

describe('mend-json — snapshot() cost with heavy duplicate-key exclusions', () => {
  const duplicateDocument = buildDuplicateKeyDocument(5_000);
  const menderWithExclusions = createJsonMender({ duplicateKeyPolicy: 'first' });
  menderWithExclusions.push(duplicateDocument); // fully buffered; excludedRanges has ~5,000 entries

  bench('repeated snapshot() calls on a document with ~5,000 excluded duplicate ranges', () => {
    menderWithExclusions.snapshot();
  });

  bench(
    'duplicate-heavy document (5,000 duplicate keys) streamed in 64-byte chunks with .value read every push',
    () => {
      const mender = createJsonMender({ duplicateKeyPolicy: 'first' });
      for (let i = 0; i < duplicateDocument.length; i += 64) {
        const r = mender.push(duplicateDocument.slice(i, i + 64));
        void r.value;
      }
      mender.finish();
    },
  );
});
