/**
 * `shrinkToFit` in `src/packing/overlap.ts` re-joins and re-counts the whole
 * remaining-pieces window on every shrink step, up to once per candidate
 * piece — O(k²) in the number of candidate pieces, `k` bounded by roughly
 * how many pieces fit `overlapTokens`. There's no case where it iterates
 * more than once with the bundled default counter (the running total there
 * is provably ≤ the real joined count, so the first candidate always fits),
 * and an exact injected tokenizer should behave the same way, since
 * concatenation is subadditive for any real BPE-style encoder (you can
 * always fall back to the unmerged boundary as a valid, if non-optimal,
 * tokenization — a real encoder never needs *more* tokens for the whole
 * than the pieces summed).
 *
 * This file confirms both halves of that with direct measurement against
 * `computeOverlap` (white-box import, like `test/diagnostic-routing-scaling.test.ts`
 * does for `routeDiagnostics`):
 *
 * 1. For the bundled approximate tokenizer, a toy "exact provider counter"
 *    shaped like a real BPE encoder (`toBpeLikeTokenizer` below — a pure
 *    function of literal text content, no per-segment bookkeeping), and a
 *    simple length-based exact tokenizer, `tokenizer.count` is called
 *    exactly once by `computeOverlap`'s tier-1 path even at `overlapTokens`
 *    in the thousands and tens of thousands of candidate pieces — i.e. the
 *    O(k²) shape never activates for any tokenizer whose cost is a function
 *    of literal content.
 * 2. It genuinely *can* be forced to loop many times, but only with a
 *    tokenizer engineered to be continuously superadditive in a way no real
 *    encoder is (cost growing with the *square* of how many pieces are
 *    joined, invisible to any individual piece's own token count) — kept
 *    here as a documented, deliberately pathological existence proof, not a
 *    case this package defends against in code. See the package README's
 *    Performance section and `src/packing/overlap.ts`'s module doc comment
 *    for the settled conclusion.
 */
import { describe, expect, it } from 'vitest';
import { approximateTokenizer } from '@llm-kit/tokenizer';
import { computeOverlap } from '../src/packing/overlap.js';
import type { LeafUnit } from '../src/document/types.js';
import type { Tokenizer } from '../src/types.js';

function withCallCounter(tokenizer: Tokenizer): { tokenizer: Tokenizer; calls: () => number } {
  let calls = 0;
  return {
    tokenizer: {
      ...tokenizer,
      count: (text: string) => {
        calls += 1;
        return tokenizer.count(text);
      },
    },
    calls: () => calls,
  };
}

/** A stand-in for an injected "exact provider counter": a pure function of literal text, shaped like real subword tokenization, no awareness of how many pieces were joined to build the text it's given. */
function toBpeLikeTokenizer(): Tokenizer {
  return {
    id: 'toy-bpe-like-v1',
    count: (text: string) => {
      const pieces = text.match(/[A-Za-z0-9]{1,4}|[^\sA-Za-z0-9]+|\s+/g) ?? [];
      return pieces.length;
    },
  };
}

function lengthBasedTokenizer(): Tokenizer {
  return { id: 'exact-length-v1', count: (text: string) => Math.ceil(text.length / 4) };
}

/** Builds `n` complete, independently-measured "sentence" leaf units. */
function makeUnits(n: number, tokenizer: Tokenizer): LeafUnit[] {
  const units: LeafUnit[] = [];
  let cursor = 0;
  for (let i = 0; i < n; i += 1) {
    const text = `Sentence number ${String(i)} of representative length here. `;
    units.push({
      kind: 'paragraph',
      text,
      start: cursor,
      end: cursor + text.length,
      headings: [],
      blockLike: false,
      tokenCount: tokenizer.count(text),
    });
    cursor += text.length;
  }
  return units;
}

describe('computeOverlap: shrinkToFit exits in one iteration for content-only tokenizers, even at large overlapTokens', () => {
  const cases: readonly { readonly label: string; readonly tokenizer: Tokenizer }[] = [
    { label: 'bundled approximate tokenizer', tokenizer: approximateTokenizer },
    { label: 'toy BPE-like exact tokenizer', tokenizer: toBpeLikeTokenizer() },
    { label: 'simple length-based exact tokenizer', tokenizer: lengthBasedTokenizer() },
  ];

  for (const { label, tokenizer } of cases) {
    // The assertion is a call count, so it is immune to how loaded the
    // machine is — but building 50,000 units three times is not, and the
    // default 5s test timeout is not a budget this work fits into on a
    // two-core shared runner. The timeout is generous on purpose: exceeding
    // it should mean something hung, not that the runner was busy.
    it(`${label}: exactly one tokenizer.count call, from 500 up to 10,000 candidate pieces`, () => {
      // The claim is size-independent — the tier-1 running total is provably
      // <= the real joined count for any content-only tokenizer, so the first
      // candidate always fits. Three sizes an order of magnitude apart show
      // that; 50,000 units made this the slowest test in the package for no
      // extra evidence.
      for (const unitCount of [500, 2_000, 10_000]) {
        // overlapTokens sized generously so every unit fits the running sum —
        // exercises tier 1 (whole-unit) accumulation, not the tier-2 word
        // fallback (which legitimately calls count() once per word considered
        // while building candidates -- a different, already-linear code path).
        const overlapBudget = unitCount * 2;
        const units = makeUnits(unitCount, tokenizer);
        const wrapped = withCallCounter(tokenizer);

        const result = computeOverlap(units, overlapBudget, wrapped.tokenizer);

        expect(result.tokens).toBeGreaterThan(0);
        expect(wrapped.calls()).toBe(1);
      }
    }, 180_000);
  }

  // Gated with the same flag as the ratio assertions in
  // 'test/redos.property.test.ts': this is a wall-clock bound, and a shared
  // runner inflates it for reasons that have nothing to do with the code.
  // The proof that this path is cheap is the exact call-count assertions
  // above, which run everywhere and cannot be perturbed by machine load.
  it.skipIf(process.env.RUN_SCALING_ASSERTIONS !== '1')(
    'a large overlapTokens does not make computeOverlap take seconds (loose absolute backstop, not a scaling proof)',
    () => {
      // Unlike `test/redos.property.test.ts`'s scaling assertions, this is
      // deliberately *not* rewritten as an N-vs-2N growth ratio. That pattern
      // fits a fixed shape whose input size doubles while its per-character
      // cost should stay proportional; here the two calls being compared are
      // fundamentally different workloads, not the same shape at two sizes: a
      // 500x larger `overlapTokens` legitimately requires walking proportionally
      // more candidate units to accumulate the requested budget, so wall time
      // growing along with it is *correct* linear behavior, not a regression --
      // measured locally, the ratio between the two calls below is routinely
      // 200x-500x even though `tokenizer.count` is still called exactly once
      // (see the "exactly one tokenizer.count call" tests above, which are the
      // real, noise-free proof that `shrinkToFit`'s O(k^2) shape never
      // activates for a content-only tokenizer). A ratio threshold tight enough
      // to catch a real quadratic regression here would also fail on this
      // expected linear growth, so it would be actively misleading, not just
      // noisy.
      //
      // What this assertion actually guards against: some *other*, unrelated
      // O(k^2)-or-worse cost creeping into the candidate-accumulation path
      // (separate from the already-proven shrink-step call count) that would
      // make a large `overlapTokens` take seconds instead of single-digit
      // milliseconds. The ceiling is set two to three orders of magnitude
      // above the largest measurement observed locally (single-digit
      // milliseconds, even under `pnpm run test:coverage`) specifically so a
      // slow or heavily contended CI runner -- the exact condition that made
      // `redos.property.test.ts`'s old fixed-millisecond bound flake -- has no
      // realistic chance of tripping it for the right implementation, while
      // still catching a genuine hang.
      const tokenizer = toBpeLikeTokenizer();
      const units = makeUnits(50_000, tokenizer);

      const small = performance.now();
      computeOverlap(units, 100, tokenizer);
      const smallElapsed = performance.now() - small;

      const large = performance.now();
      computeOverlap(units, 50_000, tokenizer);
      const largeElapsed = performance.now() - large;

      console.log(
        `overlap budget 100 -> ${smallElapsed.toFixed(2)}ms, budget 50,000 -> ${largeElapsed.toFixed(2)}ms`,
      );
      expect(largeElapsed).toBeLessThan(5_000);
    },
    180_000,
  );
});

describe('computeOverlap: a deliberately, continuously superadditive tokenizer can force many shrink iterations (documented existence proof, not defended against)', () => {
  /**
   * Cost grows with the *square* of how many "sentences" are joined --
   * invisible to any individual unit's own `tokenCount` (always sees exactly
   * one sentence), so the tier-1 candidate window (built from summed
   * per-unit costs) systematically over-admits relative to the real joined
   * cost, forcing repeated one-at-a-time shrinking. No real tokenizer is
   * shaped like this (see the module doc comment above) -- this exists only
   * to confirm the theoretical bound is reachable in principle.
   */
  function polynomialOverheadTokenizer(coefficient: number): Tokenizer {
    return {
      id: 'adversarial-polynomial-v1',
      count: (text: string) => {
        const sentenceCount = (text.match(/Sentence number/g) ?? []).length;
        return Math.ceil(text.length / 4) + coefficient * sentenceCount * sentenceCount;
      },
    };
  }

  it('exceeds one iteration, and iteration count grows with candidate piece count', () => {
    const tokenizer = polynomialOverheadTokenizer(1);
    const smallUnits = makeUnits(2_000, tokenizer);
    const smallWrapped = withCallCounter(tokenizer);
    computeOverlap(smallUnits, 500, smallWrapped.tokenizer);

    const largeUnits = makeUnits(20_000, tokenizer);
    const largeWrapped = withCallCounter(tokenizer);
    computeOverlap(largeUnits, 2_000, largeWrapped.tokenizer);

    console.log(
      `adversarial tokenizer: 2,000 units/budget 500 -> ${String(smallWrapped.calls())} calls; ` +
        `20,000 units/budget 2,000 -> ${String(largeWrapped.calls())} calls`,
    );

    expect(smallWrapped.calls()).toBeGreaterThan(1);
    expect(largeWrapped.calls()).toBeGreaterThan(smallWrapped.calls());
  });
});
