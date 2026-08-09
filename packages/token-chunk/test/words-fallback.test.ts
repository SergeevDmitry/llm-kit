/**
 * `splitWords` caches whether `Intl.Segmenter` is available at module load
 * (matching `@llm-kit/tokenizer`'s own `unicode.ts` pattern). To exercise
 * the regex fallback used by runtimes without it, this file removes
 * `Intl.Segmenter` and re-imports the module fresh in isolation.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('splitWords — Intl.Segmenter fallback', () => {
  const originalSegmenter = Intl.Segmenter;

  beforeEach(() => {
    vi.resetModules();
    delete (Intl as any).Segmenter;
  });

  afterEach(() => {
    (Intl as any).Segmenter = originalSegmenter;
    vi.resetModules();
  });

  it('splits on whitespace runs, merging isolated whitespace into the preceding word', async () => {
    const { splitWords } = await import('../src/boundaries/words.js');
    const spans = splitWords('hello   world\nfoo', 0);
    expect(spans.map((s) => s.text).join('')).toBe('hello   world\nfoo');
    expect(spans.every((s) => s.text.length > 0)).toBe(true);
    // no span is pure whitespace on its own (folded backward)
    expect(spans.some((s) => /^\s+$/.test(s.text))).toBe(false);
  });

  it('keeps a leading whitespace piece as its own span (nothing to merge into)', async () => {
    const { splitWords } = await import('../src/boundaries/words.js');
    const spans = splitWords('   leading', 0);
    expect(spans.map((s) => s.text).join('')).toBe('   leading');
  });

  it('still degrades to token-window splitting for an unbroken CJK/no-space run', async () => {
    const { chunkText } = await import('../src/index.js');
    const text = '大型语言模型的输出经常被截断分块器必须在语义边界上切分文本';
    const chunks = chunkText(text, { maxTokens: 5 });
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.tokenCount).toBeLessThanOrEqual(5);
    }
    expect(chunks.map((c) => c.text).join('')).toBe(text);
  });
});
