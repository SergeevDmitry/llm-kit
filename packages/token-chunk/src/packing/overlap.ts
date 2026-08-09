/**
 * Builds deterministic overlap text for the start of a chunk, from the tail
 * of the previous chunk's own (non-overlap) content. Every tier below
 * produces a literal, contiguous substring of the source — overlap text is
 * never synthesized or decoded, so `overlap.sourceCharStart` is always a
 * genuine offset into the original document. Priority 1-2 use whole
 * units/words directly; the "exact token suffix" vs. "approximate text
 * suffix" distinction in priority 3-4 collapses to one code path here —
 * see the package README's overlap section for why that is safe and still
 * tokenizer-accurate.
 *
 * Every tier verifies its candidate against the real tokenizer and shrinks
 * (dropping the *earliest* included piece, keeping the most recent trailing
 * content) until it fits `budgetTokens` — the sum of per-piece token counts
 * used to pick candidates quickly is a heuristic, never trusted as the final
 * answer, exactly like `packing/budget.ts`.
 *
 * `shrinkToFit` re-joins and re-counts the whole remaining window on every
 * shrink step — O(k²) in candidate pieces, `k` bounded by roughly how many
 * pieces fit `overlapTokens`. Measured (`test/overlap-shrink-scaling.test.ts`):
 * for the bundled approximate tokenizer, a length-based exact tokenizer, and
 * a toy BPE-shaped exact tokenizer — anything whose cost is a pure function
 * of literal text content, which is what a real encoder is — it exits in
 * exactly one shrink step, even at `overlapTokens` in the tens of
 * thousands, because concatenation is subadditive for real encoders (you
 * can always fall back to the unmerged-boundary segmentation, so the whole
 * never costs more than the pieces summed). It genuinely can be forced to
 * loop many times, but only with a tokenizer engineered to be
 * *continuously* superadditive — cost growing with the square of how many
 * pieces are joined, invisible to any individual piece's own token count —
 * which is not how any real tokenizer behaves. Left as-is rather than
 * capped: see the README's Performance section and the test file above for
 * the measurement this rests on.
 */
import { splitWords } from '../boundaries/words.js';
import { maxSuffixWithinBudget } from '../boundaries/token-window.js';
import type { LeafUnit } from '../document/types.js';
import type { Tokenizer } from '../types.js';

export interface OverlapResult {
  readonly text: string;
  readonly tokens: number;
  readonly sourceStart?: number;
}

const NO_OVERLAP: OverlapResult = { text: '', tokens: 0 };

interface Piece {
  readonly text: string;
  readonly start: number;
}

/** Drops pieces from the front (oldest first) until the joined text fits `budgetTokens`, or nothing is left. */
function shrinkToFit(
  pieces: readonly Piece[],
  budgetTokens: number,
  tokenizer: Tokenizer,
): OverlapResult | undefined {
  let remaining = pieces;
  while (remaining.length > 0) {
    const text = remaining.map((p) => p.text).join('');
    const tokens = tokenizer.count(text);
    if (tokens <= budgetTokens) {
      const first = remaining[0];
      return first === undefined ? undefined : { text, tokens, sourceStart: first.start };
    }
    remaining = remaining.slice(1);
  }
  return undefined;
}

export function computeOverlap(
  previousUnits: readonly LeafUnit[],
  budgetTokens: number,
  tokenizer: Tokenizer,
): OverlapResult {
  if (budgetTokens <= 0 || previousUnits.length === 0) return NO_OVERLAP;

  // Tier 1: complete trailing units, accumulated from the end while their
  // summed per-unit cost fits, then verified (and shrunk if needed) against
  // the real joined-text count.
  const candidateUnits: LeafUnit[] = [];
  let sum = 0;
  for (let i = previousUnits.length - 1; i >= 0; i -= 1) {
    const unit = previousUnits[i];
    if (unit === undefined) break;
    if (sum + unit.tokenCount > budgetTokens) break;
    candidateUnits.unshift(unit);
    sum += unit.tokenCount;
  }
  const tier1 =
    candidateUnits.length > 0 ? shrinkToFit(candidateUnits, budgetTokens, tokenizer) : undefined;
  if (tier1 !== undefined && tier1.text.length > 0) return tier1;

  // Tier 2: the last unit alone doesn't fit — fall back to complete trailing
  // words within it, same accumulate-then-verify approach.
  const lastUnit = previousUnits[previousUnits.length - 1];
  if (lastUnit === undefined) return NO_OVERLAP;
  const words = splitWords(lastUnit.text, lastUnit.start);
  const candidateWords: Piece[] = [];
  let wordSum = 0;
  for (let i = words.length - 1; i >= 0; i -= 1) {
    const word = words[i];
    if (word === undefined) break;
    const cost = tokenizer.count(word.text);
    if (wordSum + cost > budgetTokens) break;
    candidateWords.unshift(word);
    wordSum += cost;
  }
  const tier2 =
    candidateWords.length > 0 ? shrinkToFit(candidateWords, budgetTokens, tokenizer) : undefined;
  if (tier2 !== undefined && tier2.text.length > 0) return tier2;

  // Tier 3: even the last word doesn't fit — carve a token-budgeted suffix
  // of the last unit's text. `maxSuffixWithinBudget` measures every
  // candidate directly, so it never needs a separate shrink pass.
  const suffix = maxSuffixWithinBudget(lastUnit.text, budgetTokens, tokenizer);
  if (suffix.text.length === 0) return NO_OVERLAP;
  return {
    text: suffix.text,
    tokens: tokenizer.count(suffix.text),
    sourceStart: lastUnit.start + suffix.start,
  };
}
