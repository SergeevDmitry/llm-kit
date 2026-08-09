/**
 * Final-fallback splitter: cuts text at grapheme-cluster boundaries (never
 * mid-surrogate-pair, mid-combining-mark, or mid-ZWJ-sequence) sized to fit
 * a token budget, measured with whichever tokenizer is in play. Used when a
 * single word (a URL, a hash, minified code with no spaces) is itself
 * oversized, and to build an approximate/exact overlap suffix.
 *
 * Grapheme cluster boundaries come from `@llm-kit/tokenizer`'s own
 * `graphemeClusters`, so a cluster this package treats as "one unit" is
 * exactly the unit the approximate tokenizer costs — and for any tokenizer,
 * cutting there at least never produces invalid, unpaired UTF-16.
 */
import { graphemeClusters } from '@llm-kit/tokenizer';
import type { TextSpan } from './paragraphs.js';
import type { Tokenizer } from '../types.js';

/** Cumulative character-length boundaries after each grapheme cluster, `[0, ...len(text)]`. */
function clusterBoundaries(text: string): number[] {
  const boundaries = [0];
  let offset = 0;
  for (const cluster of graphemeClusters(text)) {
    offset += cluster.length;
    boundaries.push(offset);
  }
  return boundaries;
}

/**
 * Largest cluster index `k > from` such that
 * `tokenizer.count(text.slice(boundaries[from], boundaries[k])) <= budget`,
 * found by exponential search (doubling) followed by a binary search over
 * the bracket it finds, rather than a single binary search over the whole
 * remaining text.
 *
 * This matters for pathological input — a multi-kilobyte unbroken run (a
 * long URL, a base64 blob, minified code with no spaces) split against a
 * small budget: a plain binary search's `mid` starts near the *whole*
 * remaining length on every piece, so `tokenizer.count` (itself O(length))
 * runs on huge candidates before narrowing down to a small answer, making
 * the whole split roughly quadratic in document length. Doubling from the
 * cursor instead means every candidate this function measures is within a
 * constant factor of the real answer size, so the total work across all
 * pieces of one call is close to linear in the text's length.
 *
 * Always returns at least `from + 1` (one cluster), even if that single
 * cluster alone exceeds budget — there is nothing finer to try, and the
 * caller is responsible for reporting the overflow.
 */
function maxPrefixClusterIndex(
  text: string,
  boundaries: readonly number[],
  from: number,
  budget: number,
  tokenizer: Tokenizer,
): number {
  const maxIndex = boundaries.length - 1;
  const base = boundaries[from] ?? 0;
  const fits = (endIndex: number): boolean => {
    const cut = boundaries[endIndex] ?? text.length;
    return tokenizer.count(text.slice(base, cut)) <= budget;
  };

  // Deliberately no eager `fits(maxIndex)` check here: on a huge remaining
  // span with a small budget (the common case for this splitter), that
  // single check would cost O(remaining length) on every piece — an
  // eager guess that is usually wrong — for a quadratic blowup across all
  // pieces. The doubling loop below reaches `maxIndex` on its own, at a
  // cost proportional to the real answer, whenever the whole remainder
  // genuinely fits.
  let good = from;
  let step = 1;
  let candidate = Math.min(from + step, maxIndex);
  while (candidate < maxIndex && fits(candidate)) {
    good = candidate;
    step *= 2;
    candidate = Math.min(from + step, maxIndex);
  }
  if (candidate === maxIndex && fits(candidate)) return maxIndex;

  // `good` fits, `candidate` does not: binary search the boundary between them.
  let lo = good + 1;
  let hi = candidate - 1;
  let best = Math.max(good, from + 1);
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (fits(mid)) {
      best = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return best;
}

/**
 * Splits `text` into consecutive pieces, each within `budgetPerPiece` tokens
 * where possible. A piece may still exceed budget if a single grapheme
 * cluster alone does — the smallest possible unit, reported by the caller.
 */
export function splitByTokenBudget(
  text: string,
  budgetPerPiece: number,
  tokenizer: Tokenizer,
  baseOffset = 0,
): TextSpan[] {
  if (text.length === 0) return [];
  const boundaries = clusterBoundaries(text);
  const maxIndex = boundaries.length - 1;
  const spans: TextSpan[] = [];
  let cursor = 0;
  while (cursor < maxIndex) {
    const endIndex = maxPrefixClusterIndex(text, boundaries, cursor, budgetPerPiece, tokenizer);
    const start = boundaries[cursor] ?? text.length;
    const end = boundaries[endIndex] ?? text.length;
    spans.push({ text: text.slice(start, end), start: baseOffset + start, end: baseOffset + end });
    cursor = endIndex;
  }
  return spans;
}

/**
 * Largest trailing substring of `text` whose token count is `<= budget`, cut
 * at a grapheme-cluster boundary. Used to build a token-budgeted overlap
 * suffix when neither a whole unit nor a whole word fits the reserved
 * overlap budget. Returns an empty string when `budget <= 0`.
 */
export function maxSuffixWithinBudget(
  text: string,
  budget: number,
  tokenizer: Tokenizer,
): { readonly text: string; readonly start: number } {
  if (budget <= 0 || text.length === 0) return { text: '', start: text.length };
  const boundaries = clusterBoundaries(text);
  const maxIndex = boundaries.length - 1;
  // Binary search the smallest cluster-count-from-the-end whose suffix still fits.
  let lo = 1;
  let hi = maxIndex;
  let best = 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const cutIndex = maxIndex - mid;
    const cut = boundaries[cutIndex] ?? 0;
    const candidate = text.slice(cut);
    if (tokenizer.count(candidate) <= budget) {
      best = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  const cutIndex = maxIndex - best;
  const cut = boundaries[cutIndex] ?? 0;
  return { text: text.slice(cut), start: cut };
}
