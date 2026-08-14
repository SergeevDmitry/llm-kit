/**
 * `TextChunk.kinds`: the structural `BlockKind`s packed into a chunk, each
 * appearing once, in document order of first occurrence.
 */
import { describe, expect, it } from 'vitest';
import { chunkMarkdown, chunkText } from '../src/index.js';

describe('TextChunk.kinds', () => {
  it('is never empty, even for the documented over-budget exception', () => {
    const inputs = ['', '   ', '\n\n\n', 'a', '# heading only', 'x'.repeat(500)];
    for (const input of inputs) {
      for (const chunk of chunkText(input, { maxTokens: 5 })) {
        expect(chunk.kinds.length).toBeGreaterThan(0);
      }
    }
    // A single indivisible unit that alone exceeds maxTokens still reports
    // its kind — kinds describes what's present, independent of budget.
    const over = chunkText('👨‍👩‍👧‍👦', { maxTokens: 1 });
    expect(over[0]?.kinds).toEqual(['paragraph']);
  });

  it('plain text is always "paragraph"', () => {
    const chunks = chunkText('Just some ordinary prose, nothing structural about it.', {
      maxTokens: 20,
      format: 'text',
    });
    for (const chunk of chunks) {
      expect(chunk.kinds).toEqual(['paragraph']);
    }
  });

  it('reports the correct kind for each Markdown block type in isolation', () => {
    const cases: [string, string][] = [
      ['# A heading', 'heading'],
      ['An ordinary paragraph of text.', 'paragraph'],
      ['```\ncode here\n```', 'code-fence'],
      ['- one\n- two', 'list-item'],
      ['| a | b |\n| --- | --- |\n| 1 | 2 |', 'table'],
      ['> quoted text', 'blockquote'],
    ];
    for (const [input, expected] of cases) {
      const chunks = chunkMarkdown(input, { maxTokens: 100 });
      for (const chunk of chunks) {
        expect(chunk.kinds).toEqual([expected]);
      }
    }
  });

  it('lists every kind packed into a chunk, deduplicated, in order of first occurrence', () => {
    const doc = '# Title\n\nA short paragraph right after the heading.\n';
    const chunks = chunkMarkdown(doc, { maxTokens: 100 });
    expect(chunks.length).toBe(1);
    expect(chunks[0]?.kinds).toEqual(['heading', 'paragraph']);
  });

  it('an oversized block split across chunks reports its kind on every chunk it spans', () => {
    const fence =
      '```\n' + Array.from({ length: 20 }, (_, i) => `line ${String(i)}`).join('\n') + '\n```';
    const chunks = chunkMarkdown(fence, { maxTokens: 10 });
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.kinds).toEqual(['code-fence']);
    }
  });

  it('an oversized table split across rows reports "table" on every chunk it spans, including the repeated header', () => {
    const header = '| col1 | col2 |\n| --- | --- |\n';
    const rows = Array.from(
      { length: 15 },
      (_, i) => `| row${String(i)}a | row${String(i)}b |`,
    ).join('\n');
    const chunks = chunkMarkdown(header + rows, { maxTokens: 15 });
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.kinds).toEqual(['table']);
    }
  });

  it('a heading breadcrumb rendered into chunk text does not add a spurious "heading" kind', () => {
    // includeHeadingTextInContent renders a synthesized, non-source-backed
    // prefix — it must not be mistaken for a packed heading unit.
    const doc = '# Section\n\nBody text under the section.\n';
    const chunks = chunkMarkdown(doc, {
      maxTokens: 100,
      includeHeadingTextInContent: true,
    });
    // The heading unit itself is still packed first, so 'heading' legitimately
    // appears — assert it isn't duplicated by the rendered breadcrumb.
    for (const chunk of chunks) {
      const headingOccurrences = chunk.kinds.filter((k) => k === 'heading').length;
      expect(headingOccurrences).toBeLessThanOrEqual(1);
    }
  });
});
