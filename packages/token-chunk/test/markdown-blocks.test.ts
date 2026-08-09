import { describe, expect, it } from 'vitest';
import { chunkMarkdown } from '../src/index.js';

describe('Markdown block behaviour', () => {
  it('keeps a fenced code block atomic when it fits the budget', () => {
    const doc = '# Guide\n\n```bash\nnpm install token-chunk\n```\n\nafter\n';
    const chunks = chunkMarkdown(doc, { maxTokens: 200 });
    const withFence = chunks.find((c) => c.text.includes('npm install'));
    expect(withFence?.text).toContain('```bash\nnpm install token-chunk\n```');
  });

  it('splits an oversized fenced code block by line, not mid-line', () => {
    const lines = Array.from({ length: 20 }, (_, i) => `console.log("line ${String(i)}");`);
    const doc = '```js\n' + lines.join('\n') + '\n```\n';
    const chunks = chunkMarkdown(doc, { maxTokens: 15 });
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      // every non-empty line inside the chunk must be a *whole* source line
      for (const line of chunk.text.split('\n')) {
        if (line.trim().length === 0 || line.startsWith('```')) continue;
        expect(lines.includes(line) || line === '```js'.slice(0, 0)).toBe(true);
      }
    }
  });

  it('flags an unclosed code fence with a diagnostic and still emits the content', () => {
    const doc = '# Doc\n\n```bash\nnpm install token-chunk\n';
    const chunks = chunkMarkdown(doc, { maxTokens: 200 });
    const all = chunks.flatMap((c) => c.diagnostics ?? []);
    expect(all.some((d) => d.code === 'UNCLOSED_CODE_FENCE')).toBe(true);
    expect(chunks.some((c) => c.text.includes('npm install token-chunk'))).toBe(true);
  });

  it('retains block quote markers', () => {
    const doc = '> line one\n> line two\n> line three\n';
    const chunks = chunkMarkdown(doc, { maxTokens: 200 });
    expect(chunks[0]?.text).toContain('> line one');
    expect(chunks[0]?.text).toContain('> line three');
  });

  it('keeps list item boundaries where possible', () => {
    const doc = '- first item\n- second item\n- third item\n';
    const chunks = chunkMarkdown(doc, { maxTokens: 200 });
    expect(chunks[0]?.text).toBe(doc);
  });

  it('handles nested lists', () => {
    const doc = '- top item one\n  - nested a\n  - nested b\n- top item two\n';
    const chunks = chunkMarkdown(doc, { maxTokens: 200 });
    expect(chunks[0]?.text).toContain('nested a');
    expect(chunks[0]?.text).toContain('nested b');
    expect(chunks[0]?.text).toContain('top item two');
  });

  it('keeps a table together when it fits the budget', () => {
    const doc = '| a | b |\n| --- | --- |\n| 1 | 2 |\n| 3 | 4 |\n';
    const chunks = chunkMarkdown(doc, { maxTokens: 200 });
    expect(chunks[0]?.text).toBe(doc);
  });

  it('splits an oversized table by row and repeats the header', () => {
    const rows = Array.from({ length: 30 }, (_, i) => `| row-${String(i)} | value-${String(i)} |`);
    const doc = '| name | value |\n| --- | --- |\n' + rows.join('\n') + '\n';
    // header ~16 tokens, each row ~10 tokens — a budget of 50 fits header +
    // a few rows per chunk without fitting the whole 30-row table at once.
    const chunks = chunkMarkdown(doc, { maxTokens: 50 });
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      if (chunk.text.includes('row-')) {
        expect(chunk.text).toContain('| name | value |');
        expect(chunk.text).toContain('| --- | --- |');
      }
      expect(chunk.tokenCount).toBeLessThanOrEqual(50);
    }
    // every row should appear exactly once across all chunks
    const allText = chunks.map((c) => c.text).join('\n');
    for (let i = 0; i < 30; i += 1) {
      const matches = allText.split(`row-${String(i)} `).length - 1;
      expect(matches).toBe(1);
    }
  });

  it('falls back to a plain line split when even the repeated header cannot fit the budget', () => {
    const rows = Array.from(
      { length: 5 },
      (_, i) => `| a-fairly-long-row-label-${String(i)} | value |`,
    );
    const doc = '| a-fairly-long-column-header | value |\n| --- | --- |\n' + rows.join('\n') + '\n';
    const chunks = chunkMarkdown(doc, { maxTokens: 5 });
    for (const chunk of chunks) {
      expect(chunk.text.length).toBeGreaterThan(0);
    }
  });
});
