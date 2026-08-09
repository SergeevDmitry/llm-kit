/**
 * Budget arithmetic and safe wrappers around a caller-supplied
 * `MessageTokenCounter`. Any counting call can throw (edge case: "tokenizer
 * callback throws") — every one of them goes through these wrappers so the
 * failure surfaces as a documented `ChatFitError` with `cause` preserved,
 * never an unlabeled exception from inside this package's internals.
 */
import type { MessageTokenCounter } from '@llm-kit/tokenizer';
import { ChatFitError } from '../errors.js';

/** `maxTokens - reserveTokens - safetyMarginTokens`. Can be zero or negative; callers must handle that. */
export function calculateAvailableBudget(
  maxTokens: number,
  reserveTokens: number,
  safetyMarginTokens: number,
): number {
  return maxTokens - reserveTokens - safetyMarginTokens;
}

export function countMessageSafe<Message>(
  counter: MessageTokenCounter<Message>,
  message: Message,
): number {
  try {
    return counter.countMessage(message);
  } catch (error) {
    throw new ChatFitError(
      `messageTokenCounter.countMessage threw (counter id "${counter.id}")`,
      'TOKEN_COUNTING_FAILED',
      { cause: error },
    );
  }
}

export function countMessagesSafe<Message>(
  counter: MessageTokenCounter<Message>,
  messages: readonly Message[],
): number {
  try {
    return counter.countMessages(messages);
  } catch (error) {
    throw new ChatFitError(
      `messageTokenCounter.countMessages threw (counter id "${counter.id}")`,
      'TOKEN_COUNTING_FAILED',
      { cause: error },
    );
  }
}
