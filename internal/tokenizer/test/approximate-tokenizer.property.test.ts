import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { createSeededRandom } from '@llm-kit/test-utils';
import { estimateTokenCount } from '../src/approximate-tokenizer.js';
import { classifyGrapheme, graphemeClusters } from '../src/unicode.js';

/**
 * Every CI run must reproduce a failure from its printed seed alone.
 * `fast-check` prints its own seed on failure; pinning it here makes a green
 * run reproducible too, and `createSeededRandom` (below) builds the fixed
 * multi-script alphabet these properties are generated over, so both the
 * alphabet and the arrangement fast-check tries are fully deterministic.
 */
const FAST_CHECK_SEED = 0x746f_6b6e; // 'tokn'
const FAST_CHECK_RUNS = 200;

/**
 * A deterministic pool of characters spanning every script class the
 * estimator weights differently, built with the shared seeded PRNG rather
 * than hand-picked one at a time.
 */
function buildMixedScriptAlphabet(): string[] {
  const random = createSeededRandom(0xc0ffee);
  const pools = [
    Array.from('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'),
    Array.from('абвгдежзийклмнопрстуфхцчшщъыьэюя'),
    Array.from('大型语言模型的输出经常被截断分块器必须'),
    Array.from('ひらがなカタカナ한글'),
    ['🚀', '✅', '👋', '🇯🇵', '1️⃣', '👨‍👩‍👧‍👦', '👋🏽'],
    Array.from(' \t\n'),
    Array.from('.,;:!?-_/\\#*|()[]{}'),
  ];
  // Interleave the pools via the seeded shuffle so the resulting alphabet
  // order (irrelevant to the properties, relevant to reproducibility) is
  // fixed across runs without being hand-ordered.
  return random.shuffle(pools.flat());
}

const alphabet = buildMixedScriptAlphabet();
const mixedScriptString = fc.string({
  unit: fc.constantFrom(...alphabet),
  minLength: 0,
  maxLength: 200,
});

function nonWhitespaceCharLowerBound(text: string): number {
  const nonWhitespace = graphemeClusters(text).filter(
    (cluster) => classifyGrapheme(cluster) !== 'whitespace',
  );
  return Math.ceil(nonWhitespace.length / 4);
}

describe('estimateTokenCount — property tests (fast-check, seed pinned for reproducibility)', () => {
  it('is deterministic: repeated calls on the same input agree', () => {
    fc.assert(
      fc.property(mixedScriptString, (text) => {
        const first = estimateTokenCount(text);
        expect(estimateTokenCount(text)).toBe(first);
        expect(estimateTokenCount(text)).toBe(first);
      }),
      { seed: FAST_CHECK_SEED, numRuns: FAST_CHECK_RUNS },
    );
  });

  it('always returns a non-negative integer, and at least 1 for non-empty input', () => {
    fc.assert(
      fc.property(mixedScriptString, (text) => {
        const tokens = estimateTokenCount(text);
        expect(Number.isInteger(tokens)).toBe(true);
        expect(tokens).toBeGreaterThanOrEqual(text.length === 0 ? 0 : 1);
      }),
      { seed: FAST_CHECK_SEED, numRuns: FAST_CHECK_RUNS },
    );
  });

  it('never falls below the char-based conservative lower bound', () => {
    fc.assert(
      fc.property(mixedScriptString, (text) => {
        expect(estimateTokenCount(text)).toBeGreaterThanOrEqual(nonWhitespaceCharLowerBound(text));
      }),
      { seed: FAST_CHECK_SEED, numRuns: FAST_CHECK_RUNS },
    );
  });

  it('never decreases when the same text is repeated (super-additive on repetition, never sub-linear to zero)', () => {
    fc.assert(
      fc.property(mixedScriptString, fc.integer({ min: 1, max: 4 }), (text, repeats) => {
        const once = estimateTokenCount(text);
        const repeated = estimateTokenCount(text.repeat(repeats));
        if (text.length > 0) {
          expect(repeated).toBeGreaterThanOrEqual(once);
        }
      }),
      { seed: FAST_CHECK_SEED, numRuns: FAST_CHECK_RUNS },
    );
  });
});
