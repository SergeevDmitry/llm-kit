/**
 * Grapheme/segmentation helpers for the approximate tokenizer and message
 * accounting.
 *
 * `Intl.Segmenter` (Node 20+, Bun, every evergreen browser) gives correct
 * grapheme-cluster boundaries — a base character plus its combining marks,
 * or a ZWJ emoji sequence, counts as one cluster, matching how a human reads
 * the text and how most real tokenizers group it before sub-word splitting.
 * It is feature-detected, not assumed: a runtime without it falls back to
 * iterating Unicode code points (`Array.from`, itself surrogate-pair-aware).
 * The fallback is deterministic but coarser — it does not merge combining
 * marks or ZWJ sequences — so it tends to report a few more "clusters" than
 * `Intl.Segmenter` would, which biases the token estimate further toward
 * over-counting rather than under-counting. That direction is safe for a
 * conservative estimator; the reverse would not be.
 */

let cachedSegmenter: Intl.Segmenter | undefined;
let segmenterChecked = false;

function getSegmenter(): Intl.Segmenter | undefined {
  if (!segmenterChecked) {
    segmenterChecked = true;
    try {
      const SegmenterCtor = (globalThis as { Intl?: typeof Intl }).Intl?.Segmenter;
      if (typeof SegmenterCtor === 'function') {
        cachedSegmenter = new SegmenterCtor(undefined, { granularity: 'grapheme' });
      }
    } catch {
      // A platform that exposes `Intl.Segmenter` but throws on construction
      // (unsupported locale data, for instance) degrades to the fallback
      // exactly like a platform that never had it.
      cachedSegmenter = undefined;
    }
  }
  return cachedSegmenter;
}

/** True when this runtime's `Intl.Segmenter` is being used, false when the code-point fallback is active. */
export function usesIntlSegmenter(): boolean {
  return getSegmenter() !== undefined;
}

/**
 * Splits `text` into grapheme clusters — the smallest units a reader would
 * call "one character", including multi-code-point sequences such as
 * `é` (e + combining acute) or `👨‍👩‍👧‍👦` (four people joined with ZWJ).
 */
export function graphemeClusters(text: string): string[] {
  const segmenter = getSegmenter();
  if (segmenter !== undefined) {
    return Array.from(segmenter.segment(text), (entry) => entry.segment);
  }
  // Code-point iteration: coarser than real grapheme segmentation, but still
  // correct for lone surrogate pairs and deterministic across runs.
  return Array.from(text);
}

/** Rough script/content classification for one grapheme cluster, used to weight the token estimate. */
export type ScriptClass =
  'latin' | 'other-alphabetic' | 'cjk' | 'emoji' | 'digit' | 'whitespace' | 'other';

// Unicode property escapes (ES2018+, supported by every runtime this
// package targets) — precise script/category membership without a bundled
// data table.
const EMOJI_PICTOGRAPH = /\p{Extended_Pictographic}/u;
const EMOJI_REGIONAL_INDICATOR = /\p{Regional_Indicator}/u;
const EMOJI_MODIFIER = /\p{Emoji_Modifier}/u;
const HAN_SCRIPT = /\p{Script=Han}/u;
const HIRAGANA_SCRIPT = /\p{Script=Hiragana}/u;
const KATAKANA_SCRIPT = /\p{Script=Katakana}/u;
const HANGUL_SCRIPT = /\p{Script=Hangul}/u;
const LATIN_SCRIPT = /\p{Script=Latin}/u;
const ALPHABETIC = /\p{L}/u;
const DIGIT = /\p{Nd}/u;
const WHITESPACE = /\p{White_Space}/u;

/**
 * Combining enclosing keycap (U+20E3), used by keycap emoji like `1️⃣`. Not a
 * Unicode "emoji" property by itself, so it is checked explicitly: without
 * it, a keycap cluster's digit code point would misclassify the whole
 * cluster as `digit` instead of `emoji`.
 */
const KEYCAP_COMBINING_MARK = '\u20e3';

/**
 * Classifies one grapheme cluster (as produced by {@link graphemeClusters}).
 * Digits deliberately do NOT match `\p{Extended_Pictographic}` or
 * `\p{Regional_Indicator}` on their own — only the presence of the keycap
 * combining mark, a pictograph, a modifier, or a regional indicator anywhere
 * in the cluster marks it `emoji`; a bare "1" stays `digit`.
 */
export function classifyGrapheme(cluster: string): ScriptClass {
  for (const codePoint of cluster) {
    if (
      EMOJI_PICTOGRAPH.test(codePoint) ||
      EMOJI_REGIONAL_INDICATOR.test(codePoint) ||
      EMOJI_MODIFIER.test(codePoint) ||
      codePoint === KEYCAP_COMBINING_MARK
    ) {
      return 'emoji';
    }
  }

  // Classification beyond "emoji" only needs the cluster's first code point:
  // a base character plus combining marks shares the base's script.
  const [first = ''] = cluster;
  if (first === '') {
    return 'other';
  }
  if (
    HAN_SCRIPT.test(first) ||
    HIRAGANA_SCRIPT.test(first) ||
    KATAKANA_SCRIPT.test(first) ||
    HANGUL_SCRIPT.test(first)
  ) {
    return 'cjk';
  }
  if (WHITESPACE.test(first)) {
    return 'whitespace';
  }
  if (DIGIT.test(first)) {
    return 'digit';
  }
  if (LATIN_SCRIPT.test(first)) {
    return 'latin';
  }
  if (ALPHABETIC.test(first)) {
    return 'other-alphabetic';
  }
  return 'other';
}

/** UTF-8 byte length of `text`, used to weight multi-byte clusters (emoji, CJK) conservatively. */
export function utf8ByteLength(text: string): number {
  const Encoder = (globalThis as { TextEncoder?: typeof TextEncoder }).TextEncoder;
  if (typeof Encoder === 'function') {
    return new Encoder().encode(text).length;
  }
  // Manual UTF-8 byte counting for a runtime without a global `TextEncoder`.
  // Deterministic and correct for any well-formed code point; lone
  // surrogates (never valid UTF-8) are counted as 3 bytes, matching the
  // WHATWG UTF-8 encoder's replacement-character behaviour.
  let bytes = 0;
  for (const char of text) {
    const codePoint = char.codePointAt(0) ?? 0;
    if (codePoint <= 0x7f) bytes += 1;
    else if (codePoint <= 0x7ff) bytes += 2;
    else if (codePoint <= 0xffff) bytes += 3;
    else bytes += 4;
  }
  return bytes;
}
