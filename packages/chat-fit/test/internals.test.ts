/**
 * White-box tests for internal modules that are hard to exercise precisely
 * through the public API alone: the emergency-trim correction for a
 * non-additive custom counter, summary-message validation, and option
 * validation branches for `summary.maxAttempts`/`summary.maxSummaryTokens`.
 */
import type { MessageTokenCounter } from '@llm-kit/tokenizer';
import { describe, expect, it } from 'vitest';
import { fitChat } from '../src/fit-chat.js';
import { fitChatAsync } from '../src/fit-chat-async.js';
import { ChatFitError } from '../src/errors.js';
import { normalizeOptions } from '../src/normalize-options.js';
import { assertValidSummaryMessage } from '../src/summary/summary-validation.js';
import { verifyAndTrim } from '../src/selection/verify-and-trim.js';
import { countMessageSafe } from '../src/selection/budget.js';
import type { ChatMessage } from '../src/types.js';
import { system, user } from './fixtures/messages.js';

describe('normalizeOptions: summary option validation', () => {
  it('rejects a non-positive-integer maxAttempts', () => {
    expect(() =>
      normalizeOptions({
        maxTokens: 100,
        strategy: 'summarize-middle',
        summary: { summarizer: async () => user('x'), maxAttempts: 0 },
      }),
    ).toThrow(ChatFitError);
    expect(() =>
      normalizeOptions({
        maxTokens: 100,
        strategy: 'summarize-middle',
        summary: { summarizer: async () => user('x'), maxAttempts: 1.5 },
      }),
    ).toThrow(ChatFitError);
  });

  it('rejects a non-positive or non-finite maxSummaryTokens', () => {
    expect(() =>
      normalizeOptions({
        maxTokens: 100,
        strategy: 'summarize-middle',
        summary: { summarizer: async () => user('x'), maxSummaryTokens: 0 },
      }),
    ).toThrow(ChatFitError);
    expect(() =>
      normalizeOptions({
        maxTokens: 100,
        strategy: 'summarize-middle',
        summary: { summarizer: async () => user('x'), maxSummaryTokens: Number.POSITIVE_INFINITY },
      }),
    ).toThrow(ChatFitError);
  });

  it('accepts valid summary options', () => {
    const normalized = normalizeOptions({
      maxTokens: 100,
      strategy: 'summarize-middle',
      summary: { summarizer: async () => user('x'), maxAttempts: 5, maxSummaryTokens: 40 },
    });
    expect(normalized.summary).toEqual({
      summarizer: expect.any(Function),
      maxAttempts: 5,
      maxSummaryTokens: 40,
    });
  });
});

describe('normalizeOptions: maxMessages validation', () => {
  it('rejects a non-positive-integer maxMessages', () => {
    expect(() => normalizeOptions({ maxTokens: 100, maxMessages: 0 })).toThrow(ChatFitError);
    expect(() => normalizeOptions({ maxTokens: 100, maxMessages: -5 })).toThrow(ChatFitError);
    expect(() => normalizeOptions({ maxTokens: 100, maxMessages: 1.5 })).toThrow(ChatFitError);
    try {
      normalizeOptions({ maxTokens: 100, maxMessages: 0 });
    } catch (error) {
      expect((error as ChatFitError).code).toBe('INVALID_OPTIONS');
    }
  });

  it('defaults to 50_000 and accepts a caller-supplied override', () => {
    expect(normalizeOptions({ maxTokens: 100 }).maxMessages).toBe(50_000);
    expect(normalizeOptions({ maxTokens: 100, maxMessages: 3 }).maxMessages).toBe(3);
  });
});

describe('assertValidSummaryMessage', () => {
  it('throws SUMMARY_FAILED for a null or undefined summary message', () => {
    expect(() => assertValidSummaryMessage(null, 1)).toThrow(ChatFitError);
    expect(() => assertValidSummaryMessage(undefined, 2)).toThrow(ChatFitError);
    try {
      assertValidSummaryMessage(null, 1);
    } catch (error) {
      expect((error as ChatFitError).code).toBe('SUMMARY_FAILED');
    }
  });

  it('accepts any non-nullish value', () => {
    expect(() => assertValidSummaryMessage(user('ok'), 1)).not.toThrow();
    expect(() => assertValidSummaryMessage({}, 1)).not.toThrow();
  });
});

describe('countMessageSafe', () => {
  it('wraps a throwing per-message counter as TOKEN_COUNTING_FAILED with cause', () => {
    const originalError = new Error('per-message boom');
    const counter: MessageTokenCounter<ChatMessage> = {
      id: 'x',
      countMessage: () => {
        throw originalError;
      },
      countMessages: () => 0,
    };
    let caught: unknown;
    try {
      countMessageSafe(counter, user('hi'));
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(ChatFitError);
    expect((caught as ChatFitError).cause).toBe(originalError);
  });
});

describe('verifyAndTrim: emergency correction for a non-additive custom counter', () => {
  // A pathological counter whose `countMessages` is *not* the sum of
  // `countMessage` — the one case the default counter never produces, but
  // the `MessageTokenCounter` contract does not forbid (@llm-kit/tokenizer:
  // "not simply the sum of countMessage"). Greedy selection (which sums
  // `countMessage`) will therefore disagree with the authoritative
  // `countMessages`, and the emergency trim in `verifyAndTrim` must still
  // guarantee the final result fits.
  const pathologicalCounter: MessageTokenCounter<ChatMessage> = {
    id: 'pathological-v1',
    countMessage: () => 1,
    countMessages: (messages) => (messages.length === 0 ? 0 : 50 * messages.length),
  };

  it('trims the oldest kept groups until the authoritative recount fits', () => {
    const messages = Array.from({ length: 10 }, (_, i) => user(`m${String(i)}`));
    const result = fitChat(messages, { maxTokens: 80, messageTokenCounter: pathologicalCounter });

    expect(result.report.finalTokenCount).toBeLessThanOrEqual(80);
    expect(result.messages.length).toBeLessThan(messages.length);
  });

  it('drops an inserted summary too, if even an empty kept set cannot make room for it', async () => {
    // A small enough availableBudget that greedy selection (using the cheap
    // `countMessage` sum) still picks a few groups, but the authoritative
    // `countMessages` rejects any assembly at all — forcing every kept
    // group, and then the summary itself, to be given up in turn.
    const messages = Array.from({ length: 20 }, (_, i) => user(`m${String(i)}`));
    const result = await fitChatAsync(messages, {
      maxTokens: 3,
      strategy: 'summarize-middle',
      messageTokenCounter: pathologicalCounter,
      summary: { summarizer: async () => user('a tiny summary') },
    });

    expect(result.report.finalTokenCount).toBeLessThanOrEqual(3);
    expect(result.report.summarizedRange).toBeUndefined();
    expect(result.messages).toEqual([]);
  });

  it('is a total function even with nothing preserved, nothing kept, and no summary', () => {
    const outcome = verifyAndTrim({
      preservedGroups: [],
      keptGroups: [],
      availableBudget: 5,
      messageTokenCounter: pathologicalCounter,
      preservedTokenCount: 0,
    });
    expect(outcome.finalMessages).toEqual([]);
    expect(outcome.finalTokenCount).toBe(0);
  });
});

describe('verifyAndTrim: give-up path never re-derives its result from a second, disagreeing countMessages call', () => {
  /**
   * A counter stronger than merely non-additive: it disagrees with its own
   * earlier answer for the exact same preserved-only content. `buildFitPlan`
   * calls `countMessages` on the preserved-only assembly exactly once to
   * prove `PRESERVED_MESSAGES_EXCEED_BUDGET` does not apply
   * (`preservedTokenCount`, `selection/plan.ts`); if `verifyAndTrim`'s
   * give-up path called `countMessages` on that same content a second time,
   * a counter like this one could make the "proof" and the returned
   * `finalTokenCount` disagree — silently returning an over-budget result
   * without ever raising the error. The fix is architectural, not
   * defensive: the give-up path is handed `preservedTokenCount` and reuses
   * it instead of recomputing, so there is no second call to disagree with
   * in the first place.
   */
  function makeInflatingPreservedCounter(): MessageTokenCounter<ChatMessage> {
    let preservedOnlyCalls = 0;
    return {
      id: 'inflating-preserved-v1',
      countMessage: () => 1,
      countMessages(messages) {
        if (messages.length === 1) {
          preservedOnlyCalls += 1;
          // First call: the authoritative preserved-only proof in
          // buildFitPlan. Any later call on the same one-message content:
          // wildly inflated, simulating a counter that disagrees with
          // itself.
          return preservedOnlyCalls === 1 ? 1 : 1_000_000;
        }
        return messages.length === 0 ? 0 : 50 * messages.length;
      },
    };
  }

  it('reports the already-proven preserved-only count, not a re-inflated one, when trimming gives up down to preserved-only', () => {
    const messages = [
      system('keep me'),
      ...Array.from({ length: 9 }, (_, i) => user(`m${String(i)}`)),
    ];
    const counter = makeInflatingPreservedCounter();

    const result = fitChat(messages, { maxTokens: 10, messageTokenCounter: counter });

    expect(result.report.finalTokenCount).toBe(1);
    expect(result.report.finalTokenCount).toBeLessThanOrEqual(10);
    expect(result.messages).toEqual([system('keep me')]);
  });
});
