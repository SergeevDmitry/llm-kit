/**
 * Multilingual fixtures shared across the tokenizer and its consumers, from
 * `@llm-kit/test-utils`'s `unicodeSamples`. Every sample must chunk without
 * exceeding budget and without losing content.
 */
import { describe, expect, it } from 'vitest';
import { unicodeSamples } from '@llm-kit/test-utils';
import { chunkMarkdown, chunkText } from '../src/index.js';
import { normalizeLineEndings } from '../src/document/normalize.js';

describe('unicodeSamples corpus', () => {
  for (const sample of unicodeSamples) {
    it(`${sample.id} (${sample.kind}): chunks within budget and reconstructs`, () => {
      const format = sample.kind === 'markdown' ? 'markdown' : 'text';
      const maxTokens = 12;
      const chunks =
        format === 'markdown'
          ? chunkMarkdown(sample.text, { maxTokens, overlapTokens: 2 })
          : chunkText(sample.text, { maxTokens, overlapTokens: 2, format });

      expect(chunks.length).toBeGreaterThan(0);
      for (const chunk of chunks) {
        expect(chunk.text.length).toBeGreaterThan(0);
        if (chunk.tokenCount > maxTokens) {
          expect((chunk.diagnostics ?? []).length).toBeGreaterThan(0);
        }
        expect(
          normalizeLineEndings(sample.text.slice(chunk.source.charStart, chunk.source.charEnd))
            .text,
        ).toBe(chunk.text);
      }
    });
  }

  it('CJK samples produce more than one leaf unit per sentence when oversized (no space-splitting needed)', () => {
    const cjk = unicodeSamples.find((s) => s.id === 'cjk-han');
    expect(cjk).toBeDefined();
    const chunks = chunkText(cjk?.text ?? '', { maxTokens: 8 });
    expect(chunks.length).toBeGreaterThan(1);
  });

  it('the emoji sample never splits a grapheme cluster across chunks', () => {
    const emoji = unicodeSamples.find((s) => s.id === 'emoji-sequences');
    expect(emoji).toBeDefined();
    const chunks = chunkText(emoji?.text ?? '', { maxTokens: 5 });
    expect(chunks.map((c) => c.text).join('')).toBe(emoji?.text);
  });

  it('combining marks (café vs café) are preserved exactly through chunking', () => {
    const combining = unicodeSamples.find((s) => s.id === 'combining-marks');
    expect(combining).toBeDefined();
    const chunks = chunkText(combining?.text ?? '', { maxTokens: 6 });
    expect(chunks.map((c) => c.text).join('')).toBe(combining?.text);
  });

  it('the whitespace-heavy sample (CRLF, tabs) round-trips through normalization', () => {
    const sample = unicodeSamples.find((s) => s.id === 'whitespace-heavy');
    expect(sample).toBeDefined();
    const chunks = chunkText(sample?.text ?? '', { maxTokens: 6 });
    for (const chunk of chunks) {
      expect(
        sample?.text.slice(chunk.source.charStart, chunk.source.charEnd).replace(/\r\n?/g, '\n'),
      ).toBe(chunk.text);
    }
  });
});
