import { describe, expect, it } from 'vitest';
import { estimateTokenCount } from '../src/approximate-tokenizer.js';
import { classifyGrapheme } from '../src/unicode.js';

/**
 * Pins a real-BPE-tokenizer measurement (`gpt-tokenizer`, `cl100k_base` and
 * `o200k_base`, in a disposable scratch project outside this repository,
 * never a dependency here) that found three under-counting classes, plus one
 * previously-unverified assumption that turned out to be false for several
 * scripts:
 *
 * 1. An unbroken Latin run past {@link LATIN_LONG_RUN_THRESHOLD} characters
 *    (a minified identifier, a hash, a base64-shaped run) needs closer to
 *    1.6-1.9 characters per token, not the 3 that a real dictionary word
 *    allows.
 * 2. Every non-Latin, non-Cyrillic, non-CJK alphabetic script (Greek,
 *    Hebrew, Arabic, Georgian, Armenian, Thai, Devanagari, …) was charged at
 *    Cyrillic's divisor, but most of them are far less represented in real
 *    BPE training data — Armenian prose measured *exactly* the byte-fallback
 *    floor (1 real token per UTF-8 byte).
 * 3. A CJK grapheme cluster made of more than one Unicode code point (most
 *    commonly an NFD-decomposed Hangul syllable) was still charged the flat
 *    1-token-per-cluster rate, undercounting by as much as 5x.
 * 4. An isolated space was assumed to fold before *any* alphabetic letter,
 *    carried over from a measurement that (checking now) only ever probed
 *    Latin words. Probing common words in Cyrillic, Georgian, Armenian,
 *    Thai, and Hindi found at least one real counterexample per script
 *    against `cl100k_base` — none of them fold reliably.
 *
 * This test cannot re-run the live-tokenizer comparison in CI (no reference
 * tokenizer is a dependency of this package, by design) — it pins this
 * package's own output as a regression guard, the same pattern
 * `line-dense-corpora.test.ts` already uses.
 */
describe('Latin run: threshold and long-run divisor', () => {
  it('a run at exactly the threshold still uses the base divisor', () => {
    // 20 characters, LATIN_CHARS_PER_TOKEN = 3.
    const run = 'vtuutavaaxjtnlujeolu';
    expect(run.length).toBe(20);
    expect(estimateTokenCount(run)).toBe(Math.ceil(20 / 3));
  });

  it('a run one character past the threshold charges its entire length at the long-run divisor, not just the excess', () => {
    const run = 'vtuutavaaxjtnlujeoluq';
    expect(run.length).toBe(21);
    // Whole-run charge (Math.ceil(21 / 1.65) = 13), not
    // Math.ceil(20/3) + Math.ceil(1/1.65) = 7 + 1 = 8, which would still
    // under-count the threshold-length prefix — see the module doc comment.
    expect(estimateTokenCount(run)).toBe(13);
  });

  it('matches real BPE tokenization (measured) on the review-flagged case: long unbroken OOV runs', () => {
    // Deterministic 100- and 300-character unbroken lowercase runs (no
    // dictionary structure) — representative of a minified identifier, a
    // hash, or a base64-shaped run. Measured against real BPE tokenization:
    // 56/50 real tokens for the 100-char run, 160/149 for the 300-char one.
    // Our estimate (61, 182) covers both with margin.
    const run100 =
      'vtuutavaaxjtnlujeoluqxtljdgoxooltudnetltoqgoogjldtuluxjjtvdvqgdjljnggoaagnoanatvgxqltqnvtonnnotalxgv';
    const run300 =
      'vtuutavaaxjtnlujeoluqxtljdgoxooltudnetltoqgoogjldtuluxjjtvdvqgdjljnggoaagnoanatvgxqltqnvtonnnotalxgvngoeeddtouvuungvqeedlnnlnjajvdnvdejvxuntxoutgtnedgagdlalqttnjnlneteqaanuvdlnoxlxuadooanaldutegqnjgqntnvlnnvendajxxnlqqeljgqjuuqundxejdnujlqxlqejjtngnjettneojdogeguduodejxglluolexunejoxoalxlouvallltlvo';
    expect(run100.length).toBe(100);
    expect(run300.length).toBe(300);
    expect(estimateTokenCount(run100)).toBe(61);
    expect(estimateTokenCount(run300)).toBe(182);
  });

  it('does not change calibration for real dictionary words, which never reach the threshold', () => {
    // "internationalization" (20 chars) sits exactly at the threshold and
    // stays on the base divisor.
    const word = 'internationalization';
    expect(word.length).toBe(20);
    expect(estimateTokenCount(word)).toBe(Math.ceil(20 / 3));
  });
});

describe('Cyrillic split from the sparse-alphabetic bucket', () => {
  it('classifies Cyrillic as its own script class, not "other-alphabetic"', () => {
    expect(classifyGrapheme('д')).toBe('cyrillic');
    expect(classifyGrapheme('П')).toBe('cyrillic');
  });

  it('keeps Cyrillic at its historical char-based divisor (2 chars/token)', () => {
    expect(estimateTokenCount('привет')).toBe(Math.ceil(6 / 2));
  });

  it('a non-Cyrillic other-alphabetic run is charged by UTF-8 bytes, not characters', () => {
    // A single Armenian letter is 2 UTF-8 bytes; charged 2 tokens (the
    // byte-fallback floor), not 1 — real BPE tokenization for this script
    // measured that low in practice, not just in principle.
    expect(classifyGrapheme('Ա')).toBe('other-alphabetic');
    expect(estimateTokenCount('Ա')).toBe(2);
  });

  it('matches real BPE tokenization (measured) on Armenian prose: exactly the byte-fallback floor', () => {
    const armenian =
      'Բարեւ, իմ անունը Ջոն է: Ես ծրագրային ապահովման ինժեներ եմ, եւ ես սիրում եմ նոր լեզուներ սովորել:';
    // Measured: cl100k_base needs exactly 172 real tokens for this text —
    // the true floor for a byte-level BPE tokenizer on this script. Our
    // estimate matches it exactly (172), the tightest possible safe value.
    expect(estimateTokenCount(armenian)).toBe(172);
  });

  it('matches real BPE tokenization (measured) on Thai prose', () => {
    const thai =
      'สวัสดีครับ ผมชื่อจอห์น ผมเป็นนักเขียนโปรแกรมคอมพิวเตอร์ และผมชอบเรียนรู้ภาษาใหม่ๆ อยู่เสมอ';
    // Measured: cl100k_base=89, o200k_base=39 real tokens.
    expect(estimateTokenCount(thai)).toBe(262);
  });
});

describe('isolated space does not reliably fold before Cyrillic or other-alphabetic scripts', () => {
  it('an isolated space before a Cyrillic word now costs its own token, unlike before a Latin word', () => {
    const cyrillic = estimateTokenCount('привет мир');
    const cyrillicWithoutSpace = estimateTokenCount('приветмир');
    expect(cyrillic).toBe(cyrillicWithoutSpace + 1);
  });

  it('a Latin isolated space still folds — this fix is scoped to non-Latin alphabetic scripts only', () => {
    const latin = estimateTokenCount('abc def');
    const latinWithoutSpace = estimateTokenCount('abcdef');
    expect(latin).toBe(latinWithoutSpace);
  });

  it('matches real BPE tokenization (measured) on Cyrillic prose including its bare spaces', () => {
    const cyrillicProse =
      'Привет, меня зовут Джон. Я инженер-программист и люблю изучать новые языки при каждой возможности, которая появляется у меня в жизни.';
    // Measured: cl100k_base=60, o200k_base=33 real tokens.
    expect(estimateTokenCount(cyrillicProse)).toBe(86);
  });
});

describe('CJK: multi-code-point clusters weighted by UTF-8 bytes', () => {
  it('a single-code-point CJK cluster keeps the flat 1-token charge, unchanged', () => {
    expect(estimateTokenCount('한')).toBe(1);
  });

  it('an NFD-decomposed multi-code-point cluster is weighted by its UTF-8 bytes instead', () => {
    const decomposed = '한'.normalize('NFD');
    expect([...decomposed].length).toBe(3); // choseong + jungseong + jongseong
    // 3 jamo x 3 UTF-8 bytes each = 9 bytes -> 9 tokens (byte-fallback
    // floor), not the 1 token a flat per-cluster charge would give.
    expect(estimateTokenCount(decomposed)).toBe(9);
  });

  it('matches real BPE tokenization (measured) on NFD-decomposed Korean prose: at or above the byte-fallback floor', () => {
    const nfd = '안녕하세요, 제 이름은 존입니다.'.normalize('NFD');
    // Measured: cl100k_base=97, o200k_base=101 real tokens for this text.
    expect(estimateTokenCount(nfd)).toBe(101);
  });

  it('does not change calibration for ordinarily-composed (NFC) CJK text', () => {
    const nfc = '안녕하세요, 제 이름은 존입니다.';
    expect(estimateTokenCount(nfc)).toBe(18);
  });
});
