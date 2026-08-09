/**
 * Drives the user-supplied `Summarizer` over one dropped middle range.
 * Never calls anything but that callback — this package makes no network
 * call of its own.
 */
import type { MessageTokenCounter } from '@llm-kit/tokenizer';
import { throwIfAborted } from '../abort-utils.js';
import { ChatFitError } from '../errors.js';
import { countMessageSafe } from '../selection/budget.js';
import type { Summarizer, SummaryRequest } from '../types.js';
import { assertValidSummaryMessage } from './summary-validation.js';

export interface SummarizeMiddleParams<Message> {
  readonly rangeMessages: readonly Message[];
  readonly summarizer: Summarizer<Message>;
  readonly maxAttempts: number;
  /**
   * Token budget requested for the first attempt, already resolved by the
   * caller (a user-supplied `maxSummaryTokens`, or the package's default —
   * see `fit-chat-async.ts`). May be zero or negative, in which case the
   * range is dropped without ever calling `summarizer`.
   */
  readonly initialMaxSummaryTokens: number;
  readonly messageTokenCounter: MessageTokenCounter<Message>;
  readonly previousSummary?: Message;
  readonly signal?: AbortSignal;
}

export interface SummarizeMiddleOutcome<Message> {
  /** `undefined` when the range fell back to being dropped instead of summarized. */
  readonly summary?: Message;
  readonly summaryTokenCount?: number;
  readonly attempts: number;
  readonly warnings: readonly string[];
}

/** Shrinks the requested budget between retries; never below 1 so a retry always requests *something*. */
function shrinkBudget(tokens: number): number {
  return Math.max(1, Math.floor(tokens * 0.5));
}

export async function summarizeMiddle<Message>(
  params: SummarizeMiddleParams<Message>,
): Promise<SummarizeMiddleOutcome<Message>> {
  const {
    rangeMessages,
    summarizer,
    maxAttempts,
    initialMaxSummaryTokens,
    messageTokenCounter,
    previousSummary,
    signal,
  } = params;

  if (rangeMessages.length === 0) {
    return { attempts: 0, warnings: [] };
  }

  const warnings: string[] = [];

  if (initialMaxSummaryTokens <= 0) {
    warnings.push(
      'no token budget remained to request a summary for the dropped range; it was dropped instead',
    );
    return { attempts: 0, warnings };
  }

  let requestedMaxSummaryTokens = Math.floor(initialMaxSummaryTokens);
  let attempts = 0;

  while (attempts < maxAttempts) {
    throwIfAborted(signal);
    attempts += 1;

    const request: SummaryRequest<Message> = {
      messages: rangeMessages,
      maxSummaryTokens: requestedMaxSummaryTokens,
      previousSummary,
      signal,
    };

    let summaryMessage: Message;
    try {
      summaryMessage = await summarizer(request);
    } catch (error) {
      if (signal?.aborted) {
        // Abort propagates as itself — never rewrapped — so a caller can
        // `catch` the exact abort error/reason it expects.
        throw error;
      }
      throw new ChatFitError(`summarizer threw on attempt ${String(attempts)}`, 'SUMMARY_FAILED', {
        cause: error,
      });
    }
    throwIfAborted(signal);

    assertValidSummaryMessage(summaryMessage, attempts);
    const summaryTokenCount = countMessageSafe(messageTokenCounter, summaryMessage);

    if (summaryTokenCount <= requestedMaxSummaryTokens) {
      return { summary: summaryMessage, summaryTokenCount, attempts, warnings };
    }

    warnings.push(
      `summary attempt ${String(attempts)} produced ${String(summaryTokenCount)} tokens, ` +
        `exceeding the requested ${String(requestedMaxSummaryTokens)}`,
    );
    requestedMaxSummaryTokens = shrinkBudget(requestedMaxSummaryTokens);
  }

  warnings.push(
    `summary attempts exhausted (${String(attempts)}/${String(maxAttempts)}); ` +
      'the range was dropped instead of summarized',
  );
  return { attempts, warnings };
}
