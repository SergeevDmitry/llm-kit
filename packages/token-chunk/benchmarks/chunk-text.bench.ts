/**
 * Throughput baseline for `chunkText` / `chunkMarkdown` (`vitest bench`).
 *
 * Not a correctness check — the property tests and `test/*.test.ts` own
 * that. This tracks how fast chunking is on realistic-sized documents in
 * the content shapes the package brief calls out for benchmarking: long
 * Markdown, plain prose, minified code, and CJK.
 */
import { bench, describe } from 'vitest';
import { unicodeSamples } from '@llm-kit/test-utils';
import { chunkMarkdown, chunkText } from '../src/index.js';
import type { Tokenizer } from '../src/types.js';

function sampleText(id: string): string {
  const sample = unicodeSamples.find((entry) => entry.id === id);
  if (sample === undefined) {
    throw new Error(`benchmark fixture: unknown unicodeSamples id "${id}"`);
  }
  return sample.text;
}

/** Repeats a short sample up to roughly `targetLength` characters, varying the join so the text isn't perfectly periodic. */
function expand(text: string, targetLength: number): string {
  const parts: string[] = [];
  let length = 0;
  let counter = 0;
  while (length < targetLength) {
    const chunk = `${text} (${String(counter)})\n`;
    parts.push(chunk);
    length += chunk.length;
    counter += 1;
  }
  return parts.join('');
}

function markdownDocument(sectionCount: number): string {
  const parts: string[] = ['# Reference Document\n'];
  for (let i = 0; i < sectionCount; i += 1) {
    parts.push(
      `\n## Section ${String(i)}\n\n${sampleText('latin-prose')}\n\n` +
        '```ts\n' +
        sampleText('source-code') +
        '\n```\n\n' +
        '| column | value |\n| --- | --- |\n| a | 1 |\n| b | 2 |\n',
    );
  }
  return parts.join('');
}

const longProse = expand(sampleText('latin-prose'), 100_000);
const minifiedCode = expand(sampleText('minified-code'), 100_000);
const cjkText = expand(sampleText('cjk-han') + sampleText('cjk-japanese'), 100_000);
const longMarkdown = markdownDocument(200); // roughly a few hundred KB

describe('chunkText — throughput on ~100k-character inputs', () => {
  bench('long English prose, maxTokens=200, overlap=20', () => {
    chunkText(longProse, { maxTokens: 200, overlapTokens: 20, format: 'text' });
  });

  bench('minified code, maxTokens=100', () => {
    chunkText(minifiedCode, { maxTokens: 100, format: 'text' });
  });

  bench('CJK text, maxTokens=100, overlap=10', () => {
    chunkText(cjkText, { maxTokens: 100, overlapTokens: 10, format: 'text' });
  });
});

describe('chunkMarkdown — throughput on a large multi-section document', () => {
  bench('long Markdown (~200 sections), maxTokens=200, overlap=20', () => {
    chunkMarkdown(longMarkdown, { maxTokens: 200, overlapTokens: 20 });
  });
});

describe('chunkText — throughput on short calibration-sized inputs', () => {
  for (const sample of unicodeSamples) {
    bench(sample.id, () => {
      chunkText(sample.text, { maxTokens: 30, overlapTokens: 5 });
    });
  }
});

describe('chunkText — pathological unbroken run (worst case for token-window fallback)', () => {
  const longUrl = `https://example.com/${'segment-'.repeat(3000)}end`;

  bench('24k-character unbroken run, maxTokens=20', () => {
    chunkText(longUrl, { maxTokens: 20 });
  });
});

/**
 * `maxTokens: 1` against a run of indivisible units (one grapheme cluster
 * per unit under the approximate tokenizer) produces one `BUDGET_EXCEEDED`
 * diagnostic per output chunk — both dimensions can grow with input size,
 * so this is the shape that would make diagnostic routing quadratic if it
 * regressed. Kept as a permanent throughput baseline (not just the one-off
 * regression test in `test/diagnostic-routing-scaling.test.ts`) so a future
 * regression shows up in `pnpm run bench` output too, not only as a
 * pass/fail.
 */
describe('chunkText — indivisible-unit run with maxTokens=1 (one diagnostic per chunk)', () => {
  const emojiRun16k = '😀'.repeat(16_000);
  const emojiRun64k = '😀'.repeat(64_000);

  bench('16,000 indivisible units, maxTokens=1', () => {
    chunkText(emojiRun16k, { maxTokens: 1, format: 'text' });
  });

  bench('64,000 indivisible units, maxTokens=1', () => {
    chunkText(emojiRun64k, { maxTokens: 1, format: 'text' });
  });
});

/**
 * `computeOverlap`'s `shrinkToFit` (`src/packing/overlap.ts`) re-joins and
 * re-counts its whole candidate window per shrink step — O(k²) in candidate
 * pieces if it ever needs more than one step. Measured
 * (`test/overlap-shrink-scaling.test.ts`) to exit in
 * exactly one step for any tokenizer whose cost is a pure function of
 * literal text content (the bundled approximate tokenizer, and any real
 * exact/BPE-shaped adapter), even at a very large `overlapTokens` — this is
 * the permanent throughput baseline for that shape, so a future tokenizer
 * change that breaks the single-step assumption shows up here as a
 * regression, not a support ticket. A large `overlapTokens` should cost
 * about the same as a small one under a content-only tokenizer.
 */
describe('chunkText — overlap cost at a large overlapTokens (content-only exact tokenizer)', () => {
  const overlapProse = expand(sampleText('latin-prose'), 200_000);

  // A pure function of literal text, shaped like a real subword tokenizer —
  // no per-segment bookkeeping, so it stays subadditive under concatenation
  // (see `overlap.ts`'s module doc comment for why that matters here).
  const bpeLikeTokenizer: Tokenizer = {
    id: 'bench-bpe-like-v1',
    count: (text: string) => (text.match(/[A-Za-z0-9]{1,4}|[^\sA-Za-z0-9]+|\s+/g) ?? []).length,
  };

  bench('overlapTokens=20 (typical)', () => {
    chunkText(overlapProse, { maxTokens: 200, overlapTokens: 20, tokenizer: bpeLikeTokenizer });
  });

  bench('overlapTokens=2,000 (large)', () => {
    chunkText(overlapProse, { maxTokens: 200, overlapTokens: 2_000, tokenizer: bpeLikeTokenizer });
  });
});
