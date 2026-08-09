import { describe, expect, it } from 'vitest';
import { chunkMarkdown } from '../src/index.js';

describe('split-table edge cases', () => {
  it('falls back to a plain line split for a header-only table (no body rows) that is oversized', () => {
    const doc =
      '| a-very-long-column-header-name | another-long-header | yet-another |\n| --- | --- | --- |\n';
    const chunks = chunkMarkdown(doc, { maxTokens: 6 });
    expect(chunks.length).toBeGreaterThan(0);
    for (const chunk of chunks) {
      expect(chunk.text.length).toBeGreaterThan(0);
    }
    expect(chunks.map((c) => c.text).join('')).toBe(doc);
  });

  it('splits a single row too large to fit even with the header (header correctly dropped for that one chunk)', () => {
    // header(19) + this row(27) = 46 > hardBudget(30): the row still fits
    // *alone*, so `splitOversizedUnit` returns it as a single leaf rather
    // than subdividing it — and the header is then correctly dropped for
    // that one chunk (never forced over budget) rather than silently
    // exceeding maxTokens.
    const doc =
      '| category | description |\n| --- | --- |\n' +
      '| a | b |\n' +
      '| short | a somewhat longer description text here that takes more tokens |\n' +
      '| c | d |\n';
    const chunks = chunkMarkdown(doc, { maxTokens: 30 });
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.tokenCount).toBeLessThanOrEqual(30);
    }
    const withHeader = chunks.filter((c) => c.text.includes('| category | description |'));
    expect(withHeader.length).toBeGreaterThan(0);
    // every row still appears exactly once, even the one that lost its header
    for (const label of ['a | b', 'short |', 'c | d']) {
      const occurrences = chunks.filter((c) => c.text.includes(label)).length;
      expect(occurrences).toBe(1);
    }
  });

  it('repeats the header on every sub-piece when a single row is genuinely oversized and gets split further', () => {
    const longRow = `| short | ${'word '.repeat(40)}|\n`;
    const doc =
      '| category | description |\n| --- | --- |\n' + '| a | b |\n' + longRow + '| c | d |\n';
    const chunks = chunkMarkdown(doc, { maxTokens: 30 });
    expect(chunks.length).toBeGreaterThan(2);
    for (const chunk of chunks) {
      expect(chunk.tokenCount).toBeLessThanOrEqual(30);
      expect(chunk.text).toContain('| category | description |');
    }
  });

  it('splits when the very first row is itself the oversized one', () => {
    const doc =
      '| category | description |\n| --- | --- |\n' +
      '| short | a somewhat longer description text here that takes more tokens than the rest |\n' +
      '| a | b |\n';
    const chunks = chunkMarkdown(doc, { maxTokens: 30 });
    expect(chunks.length).toBeGreaterThan(0);
    for (const chunk of chunks) {
      expect(chunk.text.length).toBeGreaterThan(0);
    }
  });
});
