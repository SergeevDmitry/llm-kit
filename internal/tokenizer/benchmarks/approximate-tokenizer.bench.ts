/**
 * Throughput baseline for the approximate tokenizer (`vitest bench`).
 *
 * Not a correctness check — `test/error-band.test.ts` and
 * `test/approximate-tokenizer.test.ts` own that. This only tracks how fast
 * `estimateTokenCount` is on realistic-sized inputs of the content classes
 * called out in the package brief: long English prose, CJK, and minified
 * code. `token-chunk` calls this once per candidate chunk boundary while
 * packing, so its cost matters on documents in the tens of thousands of
 * characters, not just on the short calibration samples in `test/`.
 */
import { bench, describe } from 'vitest';
import { unicodeSamples } from '@llm-kit/test-utils';
import { estimateTokenCount } from '../src/approximate-tokenizer.js';
import { createMessageTokenCounter } from '../src/message-accounting.js';
import { approximateTokenizer } from '../src/index.js';

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
    const chunk = `${text} (${counter})\n`;
    parts.push(chunk);
    length += chunk.length;
    counter += 1;
  }
  return parts.join('');
}

const longEnglishProse = expand(sampleText('latin-prose'), 50_000);
const cjkText = expand(sampleText('cjk-han') + sampleText('cjk-japanese'), 50_000);
const minifiedCode = expand(sampleText('minified-code'), 50_000);
const markdownDocument = expand(sampleText('markdown-document'), 50_000);

describe('estimateTokenCount — throughput on ~50k-character inputs', () => {
  bench('long English prose', () => {
    estimateTokenCount(longEnglishProse);
  });

  bench('CJK text', () => {
    estimateTokenCount(cjkText);
  });

  bench('minified code', () => {
    estimateTokenCount(minifiedCode);
  });

  bench('Markdown document', () => {
    estimateTokenCount(markdownDocument);
  });
});

describe('estimateTokenCount — throughput on short calibration-sized inputs', () => {
  for (const sample of unicodeSamples) {
    bench(sample.id, () => {
      estimateTokenCount(sample.text);
    });
  }
});

describe('createMessageTokenCounter — per-message accounting overhead', () => {
  const counter = createMessageTokenCounter(approximateTokenizer);
  const messages = Array.from({ length: 50 }, (_, i) => ({
    role: i % 2 === 0 ? 'user' : 'assistant',
    content: sampleText('latin-prose'),
  }));

  bench('countMessages on a 50-message conversation', () => {
    counter.countMessages(messages);
  });
});
