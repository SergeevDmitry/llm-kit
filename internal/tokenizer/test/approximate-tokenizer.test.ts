import { describe, expect, it } from 'vitest';
import { unicodeSamples } from '@llm-kit/test-utils';
import { APPROX_TOKENIZER_ID } from '../src/types.js';
import {
  approximateTokenizer,
  createApproximateTokenizer,
  estimateTokenCount,
} from '../src/approximate-tokenizer.js';
import { classifyGrapheme, graphemeClusters } from '../src/unicode.js';

describe('createApproximateTokenizer', () => {
  it('exposes the stable, versioned id', () => {
    const tokenizer = createApproximateTokenizer();
    expect(tokenizer.id).toBe(APPROX_TOKENIZER_ID);
    expect(tokenizer.id).toBe('approx-v1');
  });

  it('has no encode/decode — it can never produce real token ids', () => {
    const tokenizer = createApproximateTokenizer();
    expect(tokenizer.encode).toBeUndefined();
    expect(tokenizer.decode).toBeUndefined();
  });

  it('delegates count() to estimateTokenCount', () => {
    const tokenizer = createApproximateTokenizer();
    expect(tokenizer.count('hello world')).toBe(estimateTokenCount('hello world'));
  });
});

describe('approximateTokenizer (shared instance)', () => {
  it('is a ready-to-use Tokenizer equivalent to a fresh factory instance', () => {
    expect(approximateTokenizer.id).toBe(APPROX_TOKENIZER_ID);
    expect(approximateTokenizer.count('hello world')).toBe(
      createApproximateTokenizer().count('hello world'),
    );
  });
});

describe('estimateTokenCount — basics', () => {
  it('returns 0 for an empty string', () => {
    expect(estimateTokenCount('')).toBe(0);
  });

  it('returns at least 1 for any non-empty string, including pure whitespace', () => {
    expect(estimateTokenCount(' ')).toBeGreaterThanOrEqual(1);
    expect(estimateTokenCount('   ')).toBeGreaterThanOrEqual(1);
    expect(estimateTokenCount('a')).toBeGreaterThanOrEqual(1);
  });

  it('is always an integer', () => {
    for (const sample of unicodeSamples) {
      expect(Number.isInteger(estimateTokenCount(sample.text))).toBe(true);
    }
  });

  it('charges more tokens for a long run of repeated whitespace than for a single separator', () => {
    const single = estimateTokenCount('a a');
    const long = estimateTokenCount(`a${' '.repeat(30)}a`);
    expect(long).toBeGreaterThan(single);
  });

  it('does not charge extra for a single space between words', () => {
    // Word lengths chosen as multiples of the Latin run divisor (3) so
    // ceiling rounding cannot itself account for a difference: any gap
    // between the two numbers below can only come from the separator.
    const withSpace = estimateTokenCount('abc def');
    const withoutSpace = estimateTokenCount('abcdef');
    // A single isolated separator contributes 0 tokens on its own, matching
    // how most BPE vocabularies attach a leading space to the following
    // token instead of spending a token on it.
    expect(withSpace).toBe(withoutSpace);
  });
});

describe('estimateTokenCount — determinism', () => {
  it('returns the same count for the same input across repeated calls', () => {
    for (const sample of unicodeSamples) {
      const first = estimateTokenCount(sample.text);
      for (let i = 0; i < 5; i += 1) {
        expect(estimateTokenCount(sample.text)).toBe(first);
      }
    }
  });

  it('is independent of a fresh tokenizer instance vs. the shared one', () => {
    for (const sample of unicodeSamples) {
      expect(createApproximateTokenizer().count(sample.text)).toBe(
        approximateTokenizer.count(sample.text),
      );
    }
  });
});

describe('estimateTokenCount — conservative-estimate property', () => {
  /**
   * A minimal, provably safe lower bound: every non-whitespace grapheme
   * cluster the estimator sees is weighted at `>= 1/4` token (the Latin
   * bucket alone is 1/3, CJK and emoji are >= 1, punctuation is 1), so the
   * total must be at least one quarter of the non-whitespace character
   * count. This is the "known-good char lower bound" the package brief asks
   * the conservative property to be checked against — not a claim about any
   * real tokenizer's actual output.
   */
  function charLowerBound(text: string): number {
    const nonWhitespace = graphemeClusters(text).filter(
      (cluster) => classifyGrapheme(cluster) !== 'whitespace',
    );
    return Math.ceil(nonWhitespace.length / 4);
  }

  it('never falls below the char-based lower bound, for every calibration sample', () => {
    for (const sample of unicodeSamples) {
      const bound = charLowerBound(sample.text);
      expect(estimateTokenCount(sample.text)).toBeGreaterThanOrEqual(bound);
    }
  });

  it('never falls below a whole-string byte-based lower bound (utf8 bytes / 8)', async () => {
    // A much weaker, deliberately loose byte-based floor as a second,
    // independent sanity check: even the densest single-byte-per-char ASCII
    // text is not real-tokenized at better than roughly 8 bytes/token by any
    // mainstream BPE vocabulary. This is intentionally looser than the
    // char-based bound above so it holds for every script, including
    // 2-3-byte-per-character Cyrillic and CJK.
    const { utf8ByteLength } = await import('../src/unicode.js');
    for (const sample of unicodeSamples) {
      const bound = Math.ceil(utf8ByteLength(sample.text) / 8);
      expect(estimateTokenCount(sample.text)).toBeGreaterThanOrEqual(bound);
    }
  });
});

describe('estimateTokenCount — script-class weighting', () => {
  it('weights CJK text far more densely than Latin text of the same character length', () => {
    const latin = 'abcdefghij'; // 10 Latin chars
    const cjk = '大型语言模型的输出经'; // 10 CJK chars
    expect(estimateTokenCount(cjk)).toBeGreaterThan(estimateTokenCount(latin));
  });

  it('charges at least 2 tokens for every emoji cluster, including simple ones', () => {
    expect(estimateTokenCount('🚀')).toBeGreaterThanOrEqual(2);
  });

  it('charges more for a ZWJ family emoji than for a single simple emoji', () => {
    const simple = estimateTokenCount('🚀');
    const family = estimateTokenCount('👨‍👩‍👧‍👦');
    expect(family).toBeGreaterThan(simple);
  });

  it('treats Cyrillic more expensively per character than Latin (non-Latin alphabetic penalty)', () => {
    const latinRun = estimateTokenCount('abcdefghijklmnopqrst'); // 20 chars, /3 per token
    const cyrillicRun = estimateTokenCount('абвгдежзийклмнопрст'); // 19 chars, /2 per token
    expect(cyrillicRun / 19).toBeGreaterThan(latinRun / 20);
  });
});
