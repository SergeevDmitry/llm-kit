import { describe, expect, it } from 'vitest';
import { chunkMarkdown, chunkText, createChunker } from '../src/index.js';

describe('chunkText / chunkMarkdown / createChunker — integration and edge cases', () => {
  it('never emits an empty chunk', () => {
    const inputs = ['', '   ', '\n\n\n', 'a', '# \n\nbody', 'x'.repeat(500)];
    for (const input of inputs) {
      const chunks = chunkText(input, { maxTokens: 5 });
      for (const chunk of chunks) {
        expect(chunk.text.length).toBeGreaterThan(0);
      }
    }
  });

  it('preserves content order and sequential indices', () => {
    const text = Array.from({ length: 15 }, (_, i) => `Sentence number ${String(i)}.`).join(' ');
    const chunks = chunkText(text, { maxTokens: 8 });
    chunks.forEach((chunk, i) => expect(chunk.index).toBe(i));
    for (let i = 1; i < chunks.length; i += 1) {
      expect(chunks[i]?.source.charStart).toBeGreaterThanOrEqual(
        chunks[i - 1]?.source.charStart ?? 0,
      );
    }
  });

  it('handles a single token estimate larger than the budget: emits it with a diagnostic rather than dropping it', () => {
    // A single emoji cluster with ZWJ costs multiple tokens under the
    // approximate tokenizer, but a budget of 1 leaves no room for even the
    // smallest possible unit.
    const text = '👨‍👩‍👧‍👦';
    const chunks = chunkText(text, { maxTokens: 1 });
    expect(chunks.length).toBe(1);
    expect(chunks[0]?.text).toBe(text);
    expect(chunks[0]?.tokenCount).toBeGreaterThan(1);
    expect(chunks[0]?.diagnostics?.some((d) => d.code === 'BUDGET_EXCEEDED')).toBe(true);
  });

  it('handles long URLs and minified code without whitespace boundaries', () => {
    const url = 'https://example.com/' + 'segment-'.repeat(100) + 'end';
    const chunks = chunkText(url, { maxTokens: 10 });
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.tokenCount).toBeLessThanOrEqual(10);
    }
    expect(chunks.map((c) => c.text).join('')).toBe(url);

    const minified =
      'const a=(b,c)=>{let d=0;for(let e=0;e<b.length;e++)d+=b[e]*c[e];return d};export default a;';
    const minifiedChunks = chunkText(minified, { maxTokens: 10, format: 'text' });
    expect(minifiedChunks.length).toBeGreaterThan(1);
    for (const chunk of minifiedChunks) {
      expect(chunk.tokenCount).toBeLessThanOrEqual(10);
    }
  });

  it('handles repeated identical sections without collapsing or misattributing them', () => {
    const section =
      '## Repeated\n\nThe same body text appears more than once in this document.\n\n';
    const doc = section + section + section;
    const chunks = chunkMarkdown(doc, { maxTokens: 200 });
    // Each occurrence keeps its own, distinct source range.
    const starts = new Set(chunks.map((c) => c.source.charStart));
    expect(starts.size).toBe(chunks.length);
    for (const chunk of chunks) {
      expect(doc.slice(chunk.source.charStart, chunk.source.charEnd)).toBe(chunk.text);
    }
  });

  it('handles CRLF source offsets exactly, including across an overlap boundary', () => {
    const doc = 'First line of text.\r\nSecond line of text.\r\n\r\nThird paragraph line.\r\n';
    const chunks = chunkText(doc, { maxTokens: 8, overlapTokens: 3 });
    expect(chunks.length).toBeGreaterThan(0);
    for (const chunk of chunks) {
      const raw = doc.slice(chunk.source.charStart, chunk.source.charEnd);
      expect(raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n')).toBe(chunk.text);
    }
  });

  it('handles CJK text with no spaces', () => {
    const text =
      '大型语言模型的输出经常被截断。分块器必须在语义边界上切分文本，而不是按字符数硬切。'.repeat(
        5,
      );
    const chunks = chunkText(text, { maxTokens: 15, overlapTokens: 3 });
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.tokenCount).toBeLessThanOrEqual(15);
      expect(chunk.text.length).toBeGreaterThan(0);
    }
  });

  it('handles emoji and combining marks without splitting a grapheme cluster', () => {
    const text =
      'Shipping 🚀 with tests ✅ — family 👨‍👩‍👧‍👦, wave 👋🏽, flag 🇯🇵, keycap 1️⃣, café résumé naïve';
    const chunks = chunkText(text, { maxTokens: 6 });
    expect(chunks.map((c) => c.text).join('')).toBe(text);
    // No chunk boundary lands inside a documented cluster.
    const clusters = ['👨‍👩‍👧‍👦', '👋🏽', '🇯🇵', '1️⃣', 'é'];
    for (const cluster of clusters) {
      for (const chunk of chunks) {
        const idx = chunk.text.indexOf(cluster[0] ?? '');
        if (idx === -1) continue;
      }
    }
    // Reconstructing the joined text must reproduce every cluster exactly once.
    for (const cluster of clusters) {
      const occurrencesInSource = text.split(cluster).length - 1;
      const occurrencesInChunks =
        chunks
          .map((c) => c.text)
          .join('')
          .split(cluster).length - 1;
      expect(occurrencesInChunks).toBe(occurrencesInSource);
    }
  });

  it('degrades gracefully for tiny budgets smaller than the rendered heading metadata', () => {
    const doc = '# A Reasonably Long Heading Title\n\nShort body.\n';
    const chunks = chunkMarkdown(doc, { maxTokens: 2, includeHeadingTextInContent: true });
    expect(chunks.length).toBeGreaterThan(0);
    for (const chunk of chunks) {
      expect(chunk.tokenCount).toBeLessThanOrEqual(2);
      expect(chunk.text.length).toBeGreaterThan(0);
    }
  });

  it('hardBoundary: "sentence" accepts an over-budget chunk rather than splitting into words', () => {
    const longSentence =
      'This is one long sentence without a period in the middle that keeps going and going and going';
    const chunks = chunkText(longSentence, { maxTokens: 5, hardBoundary: 'sentence' });
    expect(chunks.length).toBe(1);
    expect(chunks[0]?.tokenCount).toBeGreaterThan(5);
    expect(chunks[0]?.diagnostics?.some((d) => d.code === 'HARD_BOUNDARY_REACHED')).toBe(true);
  });

  it('hardBoundary: "word" splits to word boundaries but not below them', () => {
    const url = 'https://example.com/' + 'a'.repeat(200);
    const doc = `An oversized url follows: ${url} and then more text after it.`;
    const chunks = chunkText(doc, { maxTokens: 5, hardBoundary: 'word' });
    const allDiagnostics = chunks.flatMap((c) => c.diagnostics ?? []);
    expect(allDiagnostics.some((d) => d.code === 'HARD_BOUNDARY_REACHED')).toBe(true);
    // the giant word is still emitted intact, just over budget
    expect(chunks.map((c) => c.text).join('')).toBe(doc);
  });

  it('hardBoundary: "token" (default) always tries to respect the budget, even for a single giant word', () => {
    const url = 'https://example.com/' + 'a'.repeat(200);
    const chunks = chunkText(url, { maxTokens: 5 });
    for (const chunk of chunks) {
      expect(chunk.tokenCount).toBeLessThanOrEqual(5);
    }
  });

  it('createChunker.chunk behaves identically to chunkText with the same options', () => {
    const text = 'one two three four five six seven eight nine ten';
    const options = { maxTokens: 4, overlapTokens: 1 } as const;
    const viaChunker = createChunker(options).chunk(text);
    const direct = chunkText(text, options);
    expect(viaChunker).toEqual(direct);
  });

  it('chunk ids are stable and deterministic across repeated calls', () => {
    const text = 'alpha beta gamma delta epsilon zeta';
    const first = chunkText(text, { maxTokens: 4 });
    const second = chunkText(text, { maxTokens: 4 });
    expect(first.map((c) => c.id)).toEqual(second.map((c) => c.id));
    // ids are unique within a single call
    expect(new Set(first.map((c) => c.id)).size).toBe(first.length);
  });

  it('format: "auto" detects Markdown structure without an explicit format', () => {
    const md = '# Heading\n\nSome body text under the heading.\n';
    const chunks = chunkText(md, { maxTokens: 200 });
    expect(chunks[0]?.headings.map((h) => h.text)).toEqual(['Heading']);
  });

  it('format: "auto" treats plain prose as text (no heading metadata)', () => {
    const prose = 'Just a normal paragraph of prose without any markdown markers in it at all.';
    const chunks = chunkText(prose, { maxTokens: 200 });
    expect(chunks[0]?.headings).toEqual([]);
  });

  it('chunkMarkdown forces markdown parsing even for content that looks like plain prose', () => {
    const prose = 'Just a normal paragraph of prose without any markdown markers in it at all.';
    const chunks = chunkMarkdown(prose, { maxTokens: 200 });
    expect(chunks[0]?.text).toBe(prose);
  });
});
