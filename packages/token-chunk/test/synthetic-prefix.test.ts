/**
 * `TextChunk.syntheticPrefixLength`: how many leading characters of `text`
 * were synthesized rather than sliced out of the input — a rendered heading
 * breadcrumb, a repeated table header, or both — and therefore correspond to
 * no input offsets at all.
 *
 * The invariant every case below checks is the same one the README states in
 * prose: `text.slice(syntheticPrefixLength)` is exactly
 * `normalizeLineEndings(input.slice(source.charStart, source.charEnd))`.
 */
import { describe, expect, it } from 'vitest';
import { chunkMarkdown, chunkText } from '../src/index.js';
import { normalizeLineEndings } from '../src/document/normalize.js';
import type { TextChunk } from '../src/index.js';

/** The documented relationship, asserted for every chunk of every case here. */
function expectSourceBackedSuffix(chunks: readonly TextChunk[], input: string): void {
  for (const chunk of chunks) {
    const slice = normalizeLineEndings(
      input.slice(chunk.source.charStart, chunk.source.charEnd),
    ).text;
    expect(chunk.text.slice(chunk.syntheticPrefixLength)).toBe(slice);
    expect(chunk.syntheticPrefixLength).toBeGreaterThanOrEqual(0);
    expect(chunk.syntheticPrefixLength).toBeLessThanOrEqual(chunk.text.length);
  }
}

describe('TextChunk.syntheticPrefixLength', () => {
  it('is 0 when nothing is prepended', () => {
    const doc = '# Guide\n\nSome body text here.\n';
    const chunks = chunkMarkdown(doc, { maxTokens: 100 });
    expect(chunks.length).toBe(1);
    expect(chunks[0]?.syntheticPrefixLength).toBe(0);
    expectSourceBackedSuffix(chunks, doc);
  });

  it('counts a rendered heading breadcrumb', () => {
    const doc = '# Guide\n\n## Install\n\nRun the installer and wait.\n';
    const chunks = chunkMarkdown(doc, { maxTokens: 40, includeHeadingTextInContent: true });
    const withPrefix = chunks.filter((chunk) => chunk.syntheticPrefixLength > 0);
    expect(withPrefix.length).toBeGreaterThan(0);
    for (const chunk of withPrefix) {
      // The prefix is the breadcrumb itself: rendered headings, blank line.
      expect(chunk.text.slice(0, chunk.syntheticPrefixLength)).toMatch(/^#{1,6} .*\n\n$/s);
    }
    expectSourceBackedSuffix(chunks, doc);
  });

  it('counts a repeated table header on a continuation chunk', () => {
    const doc =
      '| product | qty |\n| --- | --- |\n| widget alpha model 2000 | 12 |\n| widget beta | 7 |\n';
    const chunks = chunkMarkdown(doc, { maxTokens: 28 });
    const repeated = chunks.filter((chunk) => chunk.syntheticPrefixLength > 0);
    expect(repeated.length).toBeGreaterThan(0);
    for (const chunk of repeated) {
      expect(chunk.text.slice(0, chunk.syntheticPrefixLength)).toBe(
        '| product | qty |\n| --- | --- |\n',
      );
    }
    expectSourceBackedSuffix(chunks, doc);
  });

  it('counts a breadcrumb and a repeated table header together', () => {
    const doc =
      '# Data\n\n| id | name |\n| --- | --- |\n| 1 | alpha |\n| 2 | beta |\n| 3 | gamma |\n';
    const chunks = chunkMarkdown(doc, { maxTokens: 30, includeHeadingTextInContent: true });
    const both = chunks.filter((chunk) =>
      chunk.text.slice(0, chunk.syntheticPrefixLength).includes('| --- | --- |'),
    );
    expect(both.length).toBeGreaterThan(0);
    for (const chunk of both) {
      expect(chunk.text.slice(0, chunk.syntheticPrefixLength)).toBe(
        '# Data\n\n| id | name |\n| --- | --- |\n',
      );
    }
    expectSourceBackedSuffix(chunks, doc);
  });

  it('is 0 when a prefix would have been rendered but was dropped to fit the budget', () => {
    // `assembleWithinBudget` drops the prefix last, after overlap and trailing
    // units, and does so silently. The field describes the `text` actually
    // returned, not the intent — so a caller stripping
    // `syntheticPrefixLength` characters never eats real content.
    const doc =
      '# A very long heading title indeed\n\n## Another quite long subheading\n\nbody words here to fill\n';
    const chunks = chunkMarkdown(doc, { maxTokens: 12, includeHeadingTextInContent: true });
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.syntheticPrefixLength).toBe(0);
    }
    expectSourceBackedSuffix(chunks, doc);
  });

  it('holds across CRLF normalization, where text and source slice differ in length', () => {
    const doc = '# Guide\r\n\r\n## Install\r\n\r\nRun the installer and wait for it.\r\n';
    const chunks = chunkMarkdown(doc, { maxTokens: 40, includeHeadingTextInContent: true });
    expectSourceBackedSuffix(chunks, doc);
  });

  it('is present and 0 for plain text, which never renders a prefix', () => {
    const doc = 'Just some ordinary prose. Nothing structural about it at all.';
    const chunks = chunkText(doc, { maxTokens: 8, format: 'text', overlapTokens: 3 });
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.syntheticPrefixLength).toBe(0);
    }
    expectSourceBackedSuffix(chunks, doc);
  });
});
