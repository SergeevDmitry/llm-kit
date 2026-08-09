/**
 * The default, zero-dependency, provider-agnostic tokenizer.
 *
 * This is an ESTIMATE. It does not match any provider's real BPE
 * tokenization and must never be presented as if it did — every count it
 * produces carries {@link APPROX_TOKENIZER_ID} so a report
 * is always attributable to "approx-v1", not to a specific model's real
 * tokenizer. Consumers that need an exact count inject one of the adapters
 * in `adapters/` instead.
 *
 * ## Method
 *
 * The text is split into Unicode grapheme clusters ({@link graphemeClusters})
 * and each cluster is weighted by its script class:
 *
 * - **Latin** letters accumulate into runs and cost 1 token per 3 characters
 *   (real BPE vocabularies average closer to 4 for English prose, so this
 *   already overshoots).
 * - **Other-alphabetic** scripts (Cyrillic, Greek, Armenian, …) accumulate
 *   into runs and cost 1 token per 2 characters — English-centric BPE
 *   vocabularies typically spend more tokens per character on these scripts
 *   than on Latin text, so the run divisor is smaller (more tokens per
 *   character) to stay on the safe side.
 * - **CJK** ideographs and kana cost 1 token per character — dense scripts
 *   where most individual characters land on, or need more than, their own
 *   token.
 * - **Emoji** clusters (including ZWJ sequences and skin-tone modifiers)
 *   cost at least 2 tokens, or more for byte-heavy sequences — real BPE
 *   tokenizers frequently split a single emoji glyph into several tokens.
 * - **Digits** accumulate into their own run, separate from any adjacent
 *   Latin letter run, and cost 1 token per 3 characters — the same divisor
 *   as Latin, but *not* merged with a neighboring letter run even when
 *   adjacent (`v00`, `item42`). Real BPE tokenizers overwhelmingly split at
 *   a letter/digit boundary; treating `v00` as one 3-character run
 *   undercounts it by half relative to the two tokens (`v`, `00`) a real
 *   tokenizer spends on it. This is the dominant token cost in alphanumeric
 *   identifiers and short
 *   table-cell values (`user7`, `id1`, spreadsheet/Markdown-table cells),
 *   so getting the boundary right there matters more than the divisor
 *   itself.
 * - **Whitespace** costs 1 token per 3 characters for a run longer than one
 *   character — indentation, table padding, and repeated blank lines do need
 *   their own tokens. A run of exactly one character needs more care, because
 *   real BPE vocabularies fold an isolated separator into a neighboring
 *   token only in some contexts, not unconditionally (see
 *   {@link isolatedWhitespaceFolds}):
 *   - An isolated newline (`\n`, `\r`, `\r\n`, or other line-terminator
 *     grapheme) never folds — it tokenizes on its own regardless of what is
 *     on either side. This matters most for line-dense input (source code,
 *     CSV/TSV, chat transcripts, one-item-per-line Markdown lists), where
 *     most "isolated separators" are line breaks.
 *   - An isolated space folds before a letter or punctuation — reliably,
 *     across common, rare, and out-of-vocabulary words — but not before a
 *     digit or an emoji cluster, and not reliably before CJK. This matters
 *     most for tabular and identifier-shaped content mixing words with
 *     numbers (`name 100`, spreadsheet/Markdown-table cells).
 *   - An isolated tab never folds, regardless of what follows it. A leading
 *     tab before a Latin letter *looks* like the space case (`"\talpha"`
 *     does fold) but does not generalize: roughly a third of probed words
 *     did not fold at all, with no character-class rule predicting which —
 *     a tab is rare enough in real text that only a scattered, unpredictable
 *     subset of tab+word pairs made it into the trained vocabulary as
 *     merged tokens, unlike the near-universal leading-space merge. A tab
 *     is therefore charged far more often than a space in the same
 *     position; this matters most for TSV data, where a tab routinely
 *     precedes a word, a number, or another delimiter.
 *   - Any other whitespace character (e.g. a non-breaking space) never
 *     folds, in any position — the conservative default for a separator
 *     this package has not individually characterized.
 * - **Everything else** (punctuation, symbols) costs 1 token per character.
 *
 * Every one of these weights is `>= characters / 4` for the characters it
 * covers, so the total is provably at least `nonWhitespaceCharacters / 4` —
 * see the `conservative-estimate` tests, which check exactly that bound.
 *
 * Measured against real BPE tokenization on varied English prose, this
 * over-counts by roughly 1.2x to 2.3x depending on sentence structure and
 * vocabulary, and never drops below 1.0x on the corpora this package has
 * checked. Because it never under-counts, consumers default
 * `safetyMarginTokens` to 0 — stacking a second safety margin on top of an
 * already-conservative estimate compounds to nearly 2x waste.
 */
import { APPROX_TOKENIZER_ID, type Tokenizer } from './types.js';
import { classifyGrapheme, graphemeClusters, utf8ByteLength, type ScriptClass } from './unicode.js';

/**
 * Characters per token for a run of Latin letters, and separately for a run
 * of digits (the two never merge into one run — see the module doc comment).
 * Lower than the ~4 real-world average for Latin letters on purpose; matches
 * real BPE's observed ~3-digit grouping for digit runs.
 */
const LATIN_CHARS_PER_TOKEN = 3;

/** Characters per token for a run of non-Latin alphabetic script (Cyrillic, Greek, …). */
const OTHER_ALPHABETIC_CHARS_PER_TOKEN = 2;

/** Tokens per CJK grapheme cluster. */
const CJK_TOKENS_PER_CHAR = 1;

/** Floor on the tokens charged to any single emoji cluster. */
const EMOJI_MIN_TOKENS = 2;

/** UTF-8 bytes per token for an emoji cluster, applied above the floor. */
const EMOJI_BYTES_PER_TOKEN = 2;

/** Characters per token for a whitespace run once it exceeds one character. */
const WHITESPACE_RUN_CHARS_PER_TOKEN = 3;

/** Tokens charged for an isolated whitespace grapheme that does not fold into a neighboring token — see {@link isolatedWhitespaceFolds}. */
const ISOLATED_SEPARATOR_TOKENS = 1;

/**
 * Matches a grapheme cluster that is entirely made of line-terminator code
 * points: LF, CR (including the CRLF pair, which `Intl.Segmenter` reports as
 * one grapheme cluster), NEL, LINE SEPARATOR, and PARAGRAPH SEPARATOR. Used
 * only to distinguish "isolated newline" from "isolated space/tab" — the one
 * case where an otherwise-free isolated separator still costs a token.
 */
const IS_NEWLINE_CLUSTER = /^[\n\r\u0085\u2028\u2029]+$/;

/**
 * Whether a single isolated (run-length-1) non-newline whitespace grapheme
 * folds into a neighboring token for free, or costs its own token. This is
 * not a property of the separator alone: whether an isolated space or tab
 * folds depends on *what follows it*, and the two separators do not behave
 * the same way:
 *
 * - A plain space (U+0020) folds before a Latin or other-alphabetic letter
 *   and before punctuation — reliably: measured across dozens of common,
 *   rare, and out-of-vocabulary probe words plus every ASCII punctuation
 *   mark, with no exceptions found. It does **not** fold before a digit
 *   (also measured with no exceptions), an emoji cluster, a CJK cluster
 *   (unreliable even for common characters — measured to sometimes fold and
 *   sometimes not, so treated as never folding, per the conservative
 *   default), or at the end of the string (nothing to fold into).
 * - A tab **never** folds, regardless of what follows it — including before
 *   a Latin letter, which looks like the space case at first (`"a\talpha"`
 *   does fold) but does not generalize: of 36 probe words tried after an
 *   isolated tab, 12 did not fold at all
 *   (`"eta"`, `"pi"`, `"omega"`, `"apple"`, `"hello"`, …), with no
 *   character-class rule (Greek-letter name, common English word, word
 *   length) predicting which. Unlike a leading space — which is frequent
 *   enough in real text that byte-level BPE training merges it into nearly
 *   every following word — a leading tab is rare enough that only a
 *   scattered, unpredictable subset of tab+word pairs made it into the
 *   vocabulary as merged tokens. Without a bundled vocabulary this package
 *   cannot tell which; treating an isolated tab as always costing its own
 *   token is the only choice consistent with "prefer over-estimating" once
 *   folding cannot be predicted from a character's script class alone.
 * - Any other whitespace character (e.g. a non-breaking space) is measured
 *   to never fold, in any position — the conservative default for a
 *   separator this package has not individually characterized.
 */
function isolatedWhitespaceFolds(separator: string, nextKind: ScriptClass | undefined): boolean {
  if (nextKind === undefined) {
    return false; // End of string: nothing to fold into.
  }
  if (separator === ' ') {
    return nextKind === 'latin' || nextKind === 'other-alphabetic' || nextKind === 'other';
  }
  // Tab, and every other non-newline whitespace character: never folds.
  return false;
}

type RunBucket = 'latin' | 'digit' | 'other-alphabetic';

function runBucketFor(kind: ScriptClass): RunBucket | undefined {
  if (kind === 'latin') return 'latin';
  if (kind === 'digit') return 'digit';
  if (kind === 'other-alphabetic') return 'other-alphabetic';
  return undefined;
}

function tokensForRun(bucket: RunBucket, length: number): number {
  const perToken =
    bucket === 'other-alphabetic' ? OTHER_ALPHABETIC_CHARS_PER_TOKEN : LATIN_CHARS_PER_TOKEN;
  return Math.ceil(length / perToken);
}

function tokensForEmojiCluster(cluster: string): number {
  return Math.max(EMOJI_MIN_TOKENS, Math.ceil(utf8ByteLength(cluster) / EMOJI_BYTES_PER_TOKEN));
}

/**
 * Estimates the token count for `text`. Pure and deterministic: the same
 * string always produces the same number, on any runtime this package
 * targets (Node 20+, Bun, and — via the `unicode.ts` fallback — anywhere
 * `Intl.Segmenter` is unavailable).
 */
export function estimateTokenCount(text: string): number {
  if (text.length === 0) {
    return 0;
  }

  let tokens = 0;
  let runBucket: RunBucket | undefined;
  let runLength = 0;
  let whitespaceRunLength = 0;
  // Only meaningful when whitespaceRunLength ends up at 1 — the single
  // cluster of that one-long run, so flushWhitespace can decide whether it
  // folds (see {@link isolatedWhitespaceFolds}) or costs its own token.
  let soleWhitespaceCluster = '';

  const flushRun = (): void => {
    if (runBucket !== undefined && runLength > 0) {
      tokens += tokensForRun(runBucket, runLength);
    }
    runBucket = undefined;
    runLength = 0;
  };

  // `nextKind` is the classification of the cluster that comes immediately
  // after this whitespace run (`undefined` at the end of the string) — an
  // isolated separator's fold behavior depends on it (see
  // {@link isolatedWhitespaceFolds}), so every call site passes whatever it
  // already knows is coming next.
  const flushWhitespace = (nextKind: ScriptClass | undefined): void => {
    if (whitespaceRunLength > 1) {
      tokens += Math.ceil(whitespaceRunLength / WHITESPACE_RUN_CHARS_PER_TOKEN);
    } else if (whitespaceRunLength === 1) {
      if (IS_NEWLINE_CLUSTER.test(soleWhitespaceCluster)) {
        // An isolated newline overwhelmingly tokenizes on its own rather
        // than folding into either neighbor — charged regardless of what
        // follows (see the module doc comment).
        tokens += ISOLATED_SEPARATOR_TOKENS;
      } else if (!isolatedWhitespaceFolds(soleWhitespaceCluster, nextKind)) {
        // A non-newline isolated separator folds into a neighboring token
        // for free in *some*, but not all, real BPE contexts. Charging 0
        // unconditionally would under-count the contexts where it does not
        // fold (see {@link isolatedWhitespaceFolds}).
        tokens += ISOLATED_SEPARATOR_TOKENS;
      }
    }
    whitespaceRunLength = 0;
    soleWhitespaceCluster = '';
  };

  for (const cluster of graphemeClusters(text)) {
    const kind = classifyGrapheme(cluster);
    const bucket = runBucketFor(kind);

    if (bucket !== undefined) {
      flushWhitespace(kind);
      if (runBucket !== undefined && runBucket !== bucket) {
        flushRun();
      }
      runBucket = bucket;
      runLength += 1;
      continue;
    }

    flushRun();

    if (kind === 'whitespace') {
      whitespaceRunLength += 1;
      soleWhitespaceCluster = whitespaceRunLength === 1 ? cluster : '';
      continue;
    }
    flushWhitespace(kind);

    if (kind === 'cjk') {
      tokens += CJK_TOKENS_PER_CHAR;
    } else if (kind === 'emoji') {
      tokens += tokensForEmojiCluster(cluster);
    } else {
      // 'other': punctuation and symbols, one token each.
      tokens += 1;
    }
  }
  flushRun();
  // End of string: nothing follows a trailing run, so `nextKind` is
  // `undefined` — a trailing isolated separator has nothing to fold into
  // and costs its own token (see {@link isolatedWhitespaceFolds}).
  flushWhitespace(undefined);

  // A non-empty string is never zero tokens, even if every character folded
  // into an isolated-whitespace run that charged nothing on its own.
  return Math.max(tokens, 1);
}

/**
 * Builds the default approximate {@link Tokenizer}. Stateless — safe to
 * share a single instance, which {@link approximateTokenizer} does.
 */
export function createApproximateTokenizer(): Tokenizer {
  return {
    id: APPROX_TOKENIZER_ID,
    count: estimateTokenCount,
  };
}

/** Shared default instance. Equivalent to `createApproximateTokenizer()`; provided so most consumers never need the factory. */
export const approximateTokenizer: Tokenizer = createApproximateTokenizer();
