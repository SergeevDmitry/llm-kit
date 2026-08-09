/**
 * Final correctness gate: recount the assembled result and, if it's over
 * budget, retry trimming within strict finite limits.
 *
 * Greedy selection (`newest-first.ts`) tracks its running total from
 * `messageTokenCounter.countMessage` summed per message, for speed on large
 * conversations. For the bundled default counter that sum is provably
 * identical to `countMessages` on the assembled result (both are
 * `priming + Σ countMessage`), so this step is a no-op verification in the
 * common case. A caller-supplied `messageTokenCounter` is not required to be
 * additive, though (its contract only promises "not simply the sum" —
 * `@llm-kit/tokenizer`'s `MessageTokenCounter` docs), so this function
 * re-checks the *authoritative* `countMessages` on the actual assembled
 * output and, only if that disagrees, trims the oldest still-kept optional
 * group (and, failing that, drops an inserted summary) until it fits or
 * nothing optional is left. Preserved groups are never touched here — they
 * were already proven to fit alone before selection began.
 *
 * Each iteration re-joins and re-counts the *whole* assembled message list,
 * so this loop is O(n) per iteration and, without a cap, up to
 * `keptGroups.length` iterations — O(n²) — for a
 * `messageTokenCounter` whose `countMessages` disagrees with the summed
 * `countMessage` badly enough that trimming one group at a time doesn't
 * converge quickly. The bundled default counter (and any genuinely additive
 * or subadditive custom counter — the realistic case for an exact provider
 * tokenizer, per the README's Performance section) exits on iteration 1, so
 * this never matters for them. It is reachable, though, not just
 * hypothetical: a deliberately non-additive counter forces exactly this —
 * see `test/internals.test.ts`'s `pathologicalCounter`, which needs 9
 * iterations to converge over only 10 messages, and
 * `test/verify-and-trim-scaling.test.ts`, which measures the same shape at
 * conversation sizes approaching `maxMessages` (tens of thousands of
 * `countMessages` calls, seconds of wall time, uncapped). Since a custom
 * counter is untrusted with respect to performance even when it is trusted
 * with respect to correctness (it may also be expensive per call — a real
 * exact tokenizer adapter can mean a network round trip), `MAX_TRIM_ITERATIONS`
 * below bounds both this loop's own reassembly cost *and* how many times a
 * possibly-expensive custom counter gets invoked, independently of
 * conversation size. Exceeding it does not risk correctness: the loop's
 * existing "give up" path (drop to preserved-only) already handles
 * non-convergence for an inconsistent counter, so hitting the cap just means
 * that path triggers a little earlier than "never," not a new failure mode.
 *
 * The give-up path itself does not call `countMessages` again.
 * `buildFitPlan` (`selection/plan.ts`) already computed
 * `preservedTokenCount` by calling the *same* `countMessages` on the *same*
 * assembled preserved-only content, as the authoritative proof that
 * `PRESERVED_MESSAGES_EXCEED_BUDGET` does not apply. A caller-supplied
 * counter is not contractually required to be a pure function of its input
 * — only "not simply the sum" — so re-deriving the give-up result with a
 * second call to `countMessages` on that identical content could, for a
 * counter that disagrees with its own earlier answer, produce a number
 * larger than `availableBudget` with no error raised: exactly the silent
 * over-budget result this package exists to prevent. `verifyAndTrim` is
 * therefore handed `preservedTokenCount` and reuses it verbatim for every
 * preserved-only return — both the in-loop `nothingLeftToTrim` case and the
 * cap-exhausted case below — instead of recomputing. This isn't a
 * defensive check; it removes the second call entirely, so there is nothing
 * left to disagree with. See `test/internals.test.ts`'s
 * `makeInflatingPreservedCounter`.
 */
import type { MessageTokenCounter } from '@llm-kit/tokenizer';
import type { MessageGroup } from '../types.js';
import { assembleFinalMessages, type SummaryInsertion } from './middle-range.js';
import { countMessagesSafe } from './budget.js';

/**
 * Independent of `keptGroups.length` — see the module doc comment. Any
 * realistic (additive or subadditive) counter converges well inside this
 * on iteration 1; it exists to bound the pathological case.
 */
const MAX_TRIM_ITERATIONS = 64;

export interface VerifyAndTrimParams<Message> {
  readonly preservedGroups: readonly MessageGroup<Message>[];
  /** Ascending (oldest-first) among the non-preserved groups selected for keeping. */
  readonly keptGroups: readonly MessageGroup<Message>[];
  readonly summaryInsertion?: SummaryInsertion<Message>;
  readonly availableBudget: number;
  readonly messageTokenCounter: MessageTokenCounter<Message>;
  /**
   * `countMessagesSafe(messageTokenCounter, assembleFinalMessages(preservedGroups))`
   * — already computed once by `buildFitPlan` (`selection/plan.ts`) as the
   * authoritative proof that preserved content alone fits (the
   * `PRESERVED_MESSAGES_EXCEED_BUDGET` check). The give-up path below
   * returns this value verbatim instead of calling `countMessages` again on
   * the identical content; see the module doc comment.
   */
  readonly preservedTokenCount: number;
}

export interface VerifyAndTrimResult<Message> {
  readonly finalMessages: readonly Message[];
  readonly finalTokenCount: number;
  readonly keptGroups: readonly MessageGroup<Message>[];
  readonly trimmedGroups: readonly MessageGroup<Message>[];
  readonly summaryDropped: boolean;
}

export function verifyAndTrim<Message>(
  params: VerifyAndTrimParams<Message>,
): VerifyAndTrimResult<Message> {
  const kept = [...params.keptGroups];
  const trimmedGroups: MessageGroup<Message>[] = [];
  let summaryInsertion = params.summaryInsertion;
  let summaryDropped = false;

  const maxIterations = Math.min(params.keptGroups.length + 2, MAX_TRIM_ITERATIONS);
  for (let iteration = 0; iteration <= maxIterations; iteration += 1) {
    if (kept.length === 0 && summaryInsertion === undefined) {
      // Give up down to preserved-only. Reuse the count already proven to
      // fit (`preservedTokenCount`) instead of asking the counter again for
      // the same content — see the module doc comment and
      // `VerifyAndTrimParams.preservedTokenCount`.
      const finalMessages = assembleFinalMessages(params.preservedGroups);
      return {
        finalMessages,
        finalTokenCount: params.preservedTokenCount,
        keptGroups: kept,
        trimmedGroups,
        summaryDropped,
      };
    }

    const finalMessages = assembleFinalMessages(
      [...params.preservedGroups, ...kept],
      summaryInsertion,
    );
    const finalTokenCount = countMessagesSafe(params.messageTokenCounter, finalMessages);

    if (finalTokenCount <= params.availableBudget) {
      return { finalMessages, finalTokenCount, keptGroups: kept, trimmedGroups, summaryDropped };
    }

    if (kept.length > 0) {
      trimmedGroups.push(kept.shift() as MessageGroup<Message>);
    } else {
      summaryInsertion = undefined;
      summaryDropped = true;
    }
  }

  // Reached only when MAX_TRIM_ITERATIONS caps the loop above before `kept`
  // empties out (a `keptGroups.length` large enough that the cap binds first
  // — see the module doc comment) and a truly inconsistent counter never
  // converged in time. Give up down to preserved-only, same as the in-loop
  // case above, and for the same reason: reuse `preservedTokenCount` rather
  // than recomputing it.
  const finalMessages = assembleFinalMessages(params.preservedGroups);
  return {
    finalMessages,
    finalTokenCount: params.preservedTokenCount,
    keptGroups: [],
    trimmedGroups: [...trimmedGroups, ...kept],
    summaryDropped: summaryDropped || summaryInsertion !== undefined,
  };
}
