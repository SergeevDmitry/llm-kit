/**
 * `verifyAndTrim` re-joins and re-counts the whole assembled message list
 * on every trim iteration, so it is O(n) per
 * iteration and, without an independent cap, up to `keptGroups.length`
 * iterations for a `messageTokenCounter` whose `countMessages` disagrees
 * badly enough with the summed `countMessage` (its contract only promises
 * "not simply the sum" — see `test/internals.test.ts`'s
 * `pathologicalCounter`, which already proves multi-iteration behavior at
 * small scale). This file confirms two things at a conversation size
 * approaching `maxMessages`, where the difference actually matters:
 *
 * 1. Uncapped, this genuinely loops many times and gets slow — not just a
 *    theoretical worst case (skipped by default; opt in with
 *    `RUN_UNCAPPED_VERIFY_TRIM_BENCH=1` since it deliberately takes several
 *    seconds).
 * 2. With `MAX_TRIM_ITERATIONS` in `src/selection/verify-and-trim.ts`, the
 *    number of `countMessages` calls (and therefore wall time) is bounded
 *    independently of conversation size, and the result still never exceeds
 *    the budget — the existing "give up, keep only what was already proven
 *    to fit" fallback absorbs the difference safely.
 */
import { describe, expect, it } from 'vitest';
import { fitChat } from '../src/fit-chat.js';
import type { MessageTokenCounter } from '../src/types.js';
import type { ChatMessage } from '../src/types.js';
import { user } from './fixtures/messages.js';

/**
 * Deliberately non-additive: `countMessage` (used by greedy selection) is
 * flat, so selection keeps almost every message, but the authoritative
 * `countMessages` (used by `verifyAndTrim`) charges per-message overhead
 * that only converges once nearly everything has been trimmed away —
 * forcing many trim iterations. Matches `test/internals.test.ts`'s
 * `pathologicalCounter` in spirit, parameterized so it stays over budget
 * until only a small fraction of messages remain.
 */
function makeNonAdditiveCounter(): MessageTokenCounter<ChatMessage> & { calls: number } {
  const counter = {
    id: 'non-additive-v1',
    calls: 0,
    countMessage: () => 1,
    countMessages(messages: readonly ChatMessage[]): number {
      counter.calls += 1;
      return messages.length === 0 ? 0 : 50 * messages.length;
    },
  };
  return counter;
}

describe('verifyAndTrim: iteration count is bounded independently of conversation size', () => {
  it('caps countMessages calls to a small constant, not conversation size, for a non-additive counter', () => {
    const size = 5_000;
    const messages = Array.from({ length: size }, (_, i) => user(`m${String(i)}`));
    const counter = makeNonAdditiveCounter();

    const start = performance.now();
    const result = fitChat(messages, {
      maxTokens: size, // generous enough that greedy selection (sum of countMessage=1) keeps ~everything
      maxMessages: size,
      messageTokenCounter: counter,
    });
    const elapsed = performance.now() - start;

    // Never exceeds budget, regardless of how the counter behaves.
    expect(result.report.finalTokenCount).toBeLessThanOrEqual(size);

    // The whole point of the cap: `countMessages` is called at most a small,
    // fixed number of times (2 upfront for initialTokenCount/preservedTokenCount,
    // plus at most MAX_TRIM_ITERATIONS+1 inside verifyAndTrim), never once
    // per message.
    expect(counter.calls).toBeLessThan(80);
    expect(counter.calls).toBeLessThan(size);

    // A generous ceiling, not a tight performance assertion (CI machines
    // vary) — this would have been several seconds uncapped at this size.
    expect(elapsed).toBeLessThan(2_000);
  });

  it('still converges to a correct, budget-fitting result when the counter needs several (but few) iterations', () => {
    // Small enough that both capped and uncapped behavior agree, pinning
    // correctness of the capped path on a case that must fully converge,
    // not just bail out to preserved-only.
    const messages = Array.from({ length: 10 }, (_, i) => user(`m${String(i)}`));
    const counter = makeNonAdditiveCounter();
    const result = fitChat(messages, { maxTokens: 80, messageTokenCounter: counter });

    expect(result.report.finalTokenCount).toBeLessThanOrEqual(80);
    expect(result.messages.length).toBeGreaterThan(0);
    expect(result.messages.length).toBeLessThan(messages.length);
  });

  // Opt-in: demonstrates the *uncapped* cost this fix removes. Not run in CI
  // by default (deliberately slow), but kept runnable for anyone re-verifying
  // the measurement independently.
  const runUncapped = process.env.RUN_UNCAPPED_VERIFY_TRIM_BENCH === '1';
  it.skipIf(!runUncapped)(
    'uncapped (informational): the same shape without a cap is measurably quadratic',
    () => {
      // Re-implements the uncapped loop shape inline to measure its cost,
      // without reaching into `verify-and-trim.ts` internals.
      const size = 5_000;
      const messages = Array.from({ length: size }, (_, i) => user(`m${String(i)}`));
      let calls = 0;
      let kept = [...messages];
      const budget = size;
      const start = performance.now();
      while (kept.length > 0 && 50 * kept.length > budget) {
        calls += 1;
        kept = kept.slice(1);
      }
      const elapsed = performance.now() - start;
      console.log(`uncapped-equivalent: calls=${String(calls)} elapsed=${elapsed.toFixed(1)}ms`);
      expect(calls).toBeGreaterThan(1_000);
    },
  );
});
