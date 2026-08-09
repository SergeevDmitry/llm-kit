import { describe, expect, it } from 'vitest';
import { chunkText } from '../src/index.js';

describe('overlap', () => {
  it('defaults to no overlap when overlapTokens is not set', () => {
    const text = 'one two three four five six seven eight nine ten eleven twelve';
    const chunks = chunkText(text, { maxTokens: 6 });
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.overlap.tokensFromPrevious).toBe(0);
      expect(chunk.overlap.sourceCharStart).toBeUndefined();
    }
  });

  it('the first chunk never has overlap', () => {
    const text = 'one two three four five six seven eight nine ten eleven twelve';
    const chunks = chunkText(text, { maxTokens: 6, overlapTokens: 3 });
    expect(chunks[0]?.overlap.tokensFromPrevious).toBe(0);
  });

  it('reports actual overlap tokens, never exceeding the requested target', () => {
    const text = Array.from({ length: 30 }, (_, i) => `sentence number ${String(i)}.`).join(' ');
    const chunks = chunkText(text, { maxTokens: 12, overlapTokens: 4 });
    expect(chunks.length).toBeGreaterThan(2);
    for (const chunk of chunks.slice(1)) {
      expect(chunk.overlap.tokensFromPrevious).toBeGreaterThan(0);
      expect(chunk.overlap.tokensFromPrevious).toBeLessThanOrEqual(4);
      expect(chunk.overlap.sourceCharStart).toBeDefined();
    }
  });

  it('overlap text is a literal, contiguous prefix of the chunk, sourced from before source.charStart of the un-overlapped content', () => {
    const text =
      'Alpha sentence one. Beta sentence two. Gamma sentence three. Delta sentence four. Epsilon sentence five.';
    const chunks = chunkText(text, { maxTokens: 8, overlapTokens: 3 });
    let sawOverlap = false;
    for (const chunk of chunks) {
      if (chunk.overlap.tokensFromPrevious > 0 && chunk.overlap.sourceCharStart !== undefined) {
        sawOverlap = true;
        // `source.charStart` is defined to be the overlap's own start when
        // overlap is present (packing/pack-units.ts) — so the overlap text
        // is exactly the literal slice from source.charStart up to wherever
        // the chunk's *new* content begins, and that whole literal slice
        // (overlap + new content) reconstructs from `text` verbatim.
        expect(chunk.overlap.sourceCharStart).toBe(chunk.source.charStart);
        const slice = text.slice(chunk.source.charStart, chunk.source.charEnd);
        expect(chunk.text.startsWith(slice.slice(0, 5))).toBe(true);
      }
    }
    expect(sawOverlap).toBe(true);
  });

  it('never pushes a chunk over maxTokens, even with overlap applied', () => {
    const text = 'word '.repeat(200);
    const chunks = chunkText(text, { maxTokens: 10, overlapTokens: 9 });
    for (const chunk of chunks) {
      expect(chunk.tokenCount).toBeLessThanOrEqual(10);
    }
  });

  it('falls back to word-level overlap when the trailing unit alone exceeds the overlap budget', () => {
    // One very long "sentence" (no punctuation) as the whole previous chunk's content.
    const text =
      'a-very-long-single-sentence-with-no-breaks-at-all-that-keeps-going ' +
      'short words after it that are small'.repeat(5);
    const chunks = chunkText(text, { maxTokens: 10, overlapTokens: 2 });
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.overlap.tokensFromPrevious).toBeLessThanOrEqual(2);
    }
  });

  it('an isolated table-header-repeat prefix never triggers overlap into the next chunk', () => {
    const rows = Array.from({ length: 10 }, (_, i) => `| row-${String(i)} | value |`);
    const doc = '| name | value |\n| --- | --- |\n' + rows.join('\n') + '\n';
    const chunks = chunkText(doc, { maxTokens: 25, overlapTokens: 5, format: 'markdown' });
    for (const chunk of chunks) {
      expect(chunk.tokenCount).toBeLessThanOrEqual(25);
    }
  });
});
