import type { TextSpan } from './paragraphs.js';

let cachedSegmenter: Intl.Segmenter | undefined;
let checked = false;

function getWordSegmenter(): Intl.Segmenter | undefined {
  if (!checked) {
    checked = true;
    try {
      const SegmenterCtor = (globalThis as { Intl?: typeof Intl }).Intl?.Segmenter;
      if (typeof SegmenterCtor === 'function') {
        cachedSegmenter = new SegmenterCtor(undefined, { granularity: 'word' });
      }
    } catch {
      cachedSegmenter = undefined;
    }
  }
  return cachedSegmenter;
}

/**
 * Merges a whitespace-only piece into the end of the previous span rather
 * than keeping it as its own unit — otherwise, an isolated trailing blank
 * line (or run of spaces) can become a standalone leaf that is technically
 * non-empty but carries no real content, most visibly when gap-closing
 * (`document/close-gaps.ts`) has folded a blank-line separator onto the end
 * of a heading or paragraph that a tiny budget then splits word-by-word.
 * Only merges backward — a *leading* whitespace piece (nothing before it
 * yet) is kept as its own span; still exact and contiguous either way.
 */
function pushMerging(
  spans: TextSpan[],
  piece: { text: string; start: number; end: number },
  isWhitespaceOnly: boolean,
): void {
  const previous = spans[spans.length - 1];
  if (isWhitespaceOnly && previous !== undefined) {
    spans[spans.length - 1] = {
      text: previous.text + piece.text,
      start: previous.start,
      end: piece.end,
    };
    return;
  }
  spans.push(piece);
}

/**
 * Splits `text` into word-boundary spans covering it exactly and
 * contiguously — the join of all spans always reconstructs `text` verbatim.
 * Whitespace-only spans are folded onto the end of the preceding word (see
 * {@link pushMerging}), so every non-leading span carries real content.
 *
 * Uses `Intl.Segmenter` (word granularity) when available — this is what
 * gives correct boundaries for CJK text with no spaces, which our target
 * runtimes (Node 20+, Bun, evergreen browsers) all provide. Without it,
 * falls back to splitting on whitespace runs only: coarser (an unbroken CJK
 * or code run stays a single "word"), but still exact and contiguous, and
 * anything still oversized after this tier falls through to the token-window
 * splitter, which never assumes word segmentation succeeded.
 */
export function splitWords(text: string, baseOffset = 0): TextSpan[] {
  if (text.length === 0) return [];
  const segmenter = getWordSegmenter();
  const spans: TextSpan[] = [];
  if (segmenter !== undefined) {
    for (const entry of segmenter.segment(text)) {
      const span = {
        text: entry.segment,
        start: baseOffset + entry.index,
        end: baseOffset + entry.index + entry.segment.length,
      };
      pushMerging(spans, span, entry.isWordLike !== true);
    }
    return spans;
  }

  let cursor = 0;
  for (const piece of text.split(/(\s+)/)) {
    if (piece.length === 0) continue;
    const span = {
      text: piece,
      start: baseOffset + cursor,
      end: baseOffset + cursor + piece.length,
    };
    pushMerging(spans, span, /^\s+$/.test(piece));
    cursor += piece.length;
  }
  return spans;
}
