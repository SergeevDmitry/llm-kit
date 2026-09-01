import { describe, expect, it } from 'vitest';
import { chunkMarkdown } from '../src/index.js';
import { normalizeLineEndings } from '../src/document/normalize.js';

describe('split-table edge cases', () => {
  it('a table at the end of the input (no trailing newline) reconstructs exactly, without a fabricated trailing newline', () => {
    // Every existing fixture in this file ends with `\n` after the table;
    // this one deliberately does not, matching a table that is the last
    // thing in the document — the shape that exposed `splitTable`
    // re-joining `${row.text}\n` for every row instead of slicing the
    // source, which pushed `source.charEnd` one character past
    // `input.length` and included a `\n` the input never had.
    const doc = '| h1 | h2 |\n| --- | --- |\n| a | b |';
    const chunks = chunkMarkdown(doc, { maxTokens: 1000 });
    expect(chunks.length).toBe(1);
    const chunk = chunks[0];
    expect(chunk?.source.charEnd).toBe(doc.length);
    expect(chunk?.text).toBe(doc);
    expect(chunk?.text).not.toMatch(/\n$/);
  });

  it('the same no-trailing-newline table forced to split across chunks still ends exactly at input.length', () => {
    const doc =
      '| id | name |\n| --- | --- |\n| 1 | alpha |\n| 2 | beta |\n| 3 | gamma |\n| 4 | delta |';
    expect(doc).not.toMatch(/\n$/);
    const chunks = chunkMarkdown(doc, { maxTokens: 15 });
    expect(chunks.length).toBeGreaterThan(1);
    const last = chunks[chunks.length - 1];
    expect(last?.source.charEnd).toBe(doc.length);
    expect(chunks.map((c) => c.text).join('')).toBe(doc);
    for (const chunk of chunks) {
      const slice = normalizeLineEndings(
        doc.slice(chunk.source.charStart, chunk.source.charEnd),
      ).text;
      expect(chunk.text).toBe(slice);
    }
  });

  it('the same shape with CRLF line endings also ends exactly at input.length', () => {
    const doc = '| h1 | h2 |\r\n| --- | --- |\r\n| a | b |';
    const chunks = chunkMarkdown(doc, { maxTokens: 1000 });
    expect(chunks.length).toBe(1);
    expect(chunks[0]?.source.charEnd).toBe(doc.length);
  });

  it('trailing blank lines folded into the table unit are no longer silently dropped from the final piece', () => {
    const doc = '| h1 | h2 |\n| --- | --- |\n| a | b |\n| c | d |\n\n\n';
    const chunks = chunkMarkdown(doc, { maxTokens: 15 });
    const last = chunks[chunks.length - 1];
    expect(last?.source.charEnd).toBe(doc.length);
    expect(chunks.map((c) => c.text).join('')).toBe(doc);
  });
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

  it('emits the header as real, source-backed text when the first body row leaves no room for it', () => {
    // The header fits the budget on its own (18 tokens against 22) but not
    // alongside the first row, so that row is split out on its own and never
    // reaches `flush()` — the only other place the header is emitted as text.
    // Without a header leaf of its own the header/separator span appears in
    // no chunk's `text` and in no chunk's `source` range: the column names
    // vanish from the result, leaving rows nobody can interpret.
    const doc =
      '| product | qty |\n| --- | --- |\n| widget alpha model 2000 | 12 |\n| widget beta | 7 |\n';
    const chunks = chunkMarkdown(doc, { maxTokens: 22 });

    const headerChunk = chunks.find((chunk) => chunk.text.includes('| product | qty |'));
    expect(headerChunk).toBeDefined();
    // Source-backed, not a synthesized prefix: the reported range really is
    // the header's own span in the input.
    expect(doc.slice(headerChunk?.source.charStart, headerChunk?.source.charEnd)).toContain(
      '| product | qty |\n| --- | --- |\n',
    );
    for (const chunk of chunks) {
      expect(chunk.tokenCount).toBeLessThanOrEqual(22);
    }
  });

  it('leaves no non-blank character of a table uncovered by some chunk source range', () => {
    // The union of every chunk's `source` range must cover the whole input.
    // Non-blank only: a row-terminating newline can still fall outside every
    // range when a single row is split at finer boundaries, which is a
    // separate defect from losing content. Budgets are swept because the
    // header-loss shape only appears in the band where the header fits alone
    // but not beside the first row.
    const docs = [
      '| product | qty |\n| --- | --- |\n| widget alpha model 2000 | 12 |\n| widget beta | 7 |\n',
      '| a | b |\n| --- | --- |\n| 1 | 2 |\n| 3 | 4 |\n',
      'Intro paragraph.\n\n| id | name |\n| --- | --- |\n| 1 | alpha beta gamma delta |\n| 2 | x |\n\nAfter.\n',
      '# Title\n\n| k | v |\n| --- | --- |\n| one | a longer value that will not fit beside a header |\n',
    ];
    for (const doc of docs) {
      for (let maxTokens = 8; maxTokens <= 40; maxTokens += 2) {
        const chunks = chunkMarkdown(doc, { maxTokens });
        const covered = new Uint8Array(doc.length);
        for (const chunk of chunks) {
          for (let index = chunk.source.charStart; index < chunk.source.charEnd; index += 1) {
            covered[index] = 1;
          }
        }
        for (let index = 0; index < doc.length; index += 1) {
          if (covered[index] === 1) continue;
          const character = doc[index] as string;
          expect(
            character.trim(),
            `uncovered non-blank character ${JSON.stringify(character)} at ${String(index)} ` +
              `of ${JSON.stringify(doc)} at maxTokens ${String(maxTokens)}`,
          ).toBe('');
        }
      }
    }
  });
});
