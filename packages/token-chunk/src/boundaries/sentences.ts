import type { TextSpan } from './paragraphs.js';

/**
 * Sentence-ending punctuation. Latin/`.!?` endings only count as a boundary
 * when followed by whitespace or end-of-string (a deterministic heuristic,
 * not real NLP — "Mr. Smith" is not immune, per the package's documented
 * non-goal of language-specific sentence detection). CJK enders (`。！？`)
 * split unconditionally since CJK prose is not space-delimited.
 *
 * The Latin branch matches only the *last* character of a punctuation run
 * (`(?![.!?])` rules out any position that isn't the run's end), not the
 * whole run via `+`. `match.index + match[0].length` still lands on exactly
 * the same boundary either way, since the caller only ever reads that sum —
 * everything from `cursor` up to the run's end is already part of the
 * emitted span regardless of how much of the run the match itself covers.
 * A `[.!?]+(?=\s|$)` version matched the whole run, so a run not followed by
 * whitespace (e.g. `'!'.repeat(n) + 'x'`) made the engine retry the
 * lookahead at every backtracked run-length, at every starting offset —
 * quadratic in the run length. Anchoring to a single character removes the
 * retry: each position does one O(1) lookahead and never backtracks.
 */
const SENTENCE_BOUNDARY = /[.!?](?![.!?])(?=\s|$)|[。！？]+/gu;

/**
 * Splits `text` into sentence spans covering it exactly and contiguously —
 * `spans.map(s => s.text).join('')` always reconstructs `text` verbatim, so
 * source offsets stay exact through this tier.
 */
export function splitSentences(text: string, baseOffset = 0): TextSpan[] {
  const spans: TextSpan[] = [];
  let cursor = 0;
  SENTENCE_BOUNDARY.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = SENTENCE_BOUNDARY.exec(text)) !== null) {
    const boundary = match.index + match[0].length;
    if (boundary > cursor) {
      spans.push({
        text: text.slice(cursor, boundary),
        start: baseOffset + cursor,
        end: baseOffset + boundary,
      });
      cursor = boundary;
    }
  }
  if (cursor < text.length) {
    spans.push({
      text: text.slice(cursor),
      start: baseOffset + cursor,
      end: baseOffset + text.length,
    });
  }
  return spans.length > 0 ? spans : [{ text, start: baseOffset, end: baseOffset + text.length }];
}
