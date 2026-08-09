/**
 * Validates and defaults `FitChatOptions`. Every default here is documented
 * in `types.ts`; this module is only responsible for enforcing and applying
 * them.
 */
import { approximateTokenizer } from '@llm-kit/tokenizer';
import type { MessageTokenCounter, Tokenizer } from '@llm-kit/tokenizer';
import { ChatFitError } from './errors.js';
import { createDefaultMessageTokenCounter } from './token-accounting.js';
import type { FallbackReasonLookup } from './token-accounting.js';
import type { FitChatOptions, MessageGroup, Summarizer } from './types.js';

export const DEFAULT_PRESERVE_ROLES: readonly string[] = ['system', 'developer'];
export const DEFAULT_MAX_SUMMARY_ATTEMPTS = 3;

/** Default for `FitChatOptions.maxMessages` — see the doc comment on that field in `types.ts` for the reasoning. */
export const DEFAULT_MAX_MESSAGES = 50_000;

export interface NormalizedSummaryOptions<Message> {
  readonly summarizer: Summarizer<Message>;
  readonly maxSummaryTokens: number | undefined;
  readonly maxAttempts: number;
}

export interface NormalizedOptions<Message> {
  readonly maxTokens: number;
  readonly reserveTokens: number;
  readonly safetyMarginTokens: number;
  readonly maxMessages: number;
  readonly tokenizer: Tokenizer;
  readonly messageTokenCounter: MessageTokenCounter<Message>;
  readonly usingDefaultCounter: boolean;
  /**
   * Only set when `usingDefaultCounter` is true — the same
   * `fallbackReasons` lookup `createDefaultMessageTokenCounter` returns,
   * carried alongside `messageTokenCounter` (which is typed as the plain
   * public `MessageTokenCounter<Message>` and so cannot carry it itself).
   * `finalize.ts` reads this instead of re-walking the input a second time.
   */
  readonly defaultCounterFallbacks: FallbackReasonLookup<Message> | undefined;
  readonly strategy: 'drop-oldest' | 'summarize-middle';
  readonly preserveRoles: readonly string[];
  readonly customGroupMessages:
    ((messages: readonly Message[]) => readonly MessageGroup<Message>[]) | undefined;
  readonly summary: NormalizedSummaryOptions<Message> | undefined;
}

function assertFiniteNumber(value: number, name: string, options: { allowZero: boolean }): void {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new ChatFitError(`options.${name} must be a finite number`, 'INVALID_OPTIONS');
  }
  if (value < 0 || (value === 0 && !options.allowZero)) {
    throw new ChatFitError(
      `options.${name} must be ${options.allowZero ? '>= 0' : '> 0'}`,
      'INVALID_OPTIONS',
    );
  }
}

export function normalizeOptions<Message>(
  options: FitChatOptions<Message>,
): NormalizedOptions<Message> {
  assertFiniteNumber(options.maxTokens, 'maxTokens', { allowZero: true });

  const reserveTokens = options.reserveTokens ?? 0;
  assertFiniteNumber(reserveTokens, 'reserveTokens', { allowZero: true });

  const safetyMarginTokens = options.safetyMarginTokens ?? 0;
  assertFiniteNumber(safetyMarginTokens, 'safetyMarginTokens', { allowZero: true });

  const maxMessages = options.maxMessages ?? DEFAULT_MAX_MESSAGES;
  if (!Number.isInteger(maxMessages) || maxMessages <= 0) {
    throw new ChatFitError(
      `options.maxMessages must be a positive integer, received ${String(maxMessages)}`,
      'INVALID_OPTIONS',
    );
  }

  const tokenizer = options.tokenizer ?? approximateTokenizer;
  const usingDefaultCounter = options.messageTokenCounter === undefined;
  let messageTokenCounter: MessageTokenCounter<Message>;
  let defaultCounterFallbacks: FallbackReasonLookup<Message> | undefined;
  if (options.messageTokenCounter !== undefined) {
    messageTokenCounter = options.messageTokenCounter;
  } else {
    const defaultCounter = createDefaultMessageTokenCounter<Message>(tokenizer);
    messageTokenCounter = defaultCounter;
    defaultCounterFallbacks = defaultCounter.fallbackReasons;
  }

  const strategy = options.strategy ?? 'drop-oldest';
  const preserveRoles = options.preserveRoles ?? DEFAULT_PRESERVE_ROLES;

  let summary: NormalizedSummaryOptions<Message> | undefined;
  if (strategy === 'summarize-middle') {
    if (options.summary?.summarizer === undefined) {
      throw new ChatFitError(
        'strategy "summarize-middle" requires options.summary.summarizer',
        'INVALID_OPTIONS',
      );
    }
    const maxAttempts = options.summary.maxAttempts ?? DEFAULT_MAX_SUMMARY_ATTEMPTS;
    if (!Number.isInteger(maxAttempts) || maxAttempts < 1) {
      throw new ChatFitError(
        'options.summary.maxAttempts must be a positive integer',
        'INVALID_OPTIONS',
      );
    }
    if (
      options.summary.maxSummaryTokens !== undefined &&
      (!Number.isFinite(options.summary.maxSummaryTokens) || options.summary.maxSummaryTokens <= 0)
    ) {
      throw new ChatFitError(
        'options.summary.maxSummaryTokens must be a positive finite number',
        'INVALID_OPTIONS',
      );
    }
    summary = {
      summarizer: options.summary.summarizer,
      maxSummaryTokens: options.summary.maxSummaryTokens,
      maxAttempts,
    };
  }

  return {
    maxTokens: options.maxTokens,
    reserveTokens,
    safetyMarginTokens,
    maxMessages,
    tokenizer,
    messageTokenCounter,
    usingDefaultCounter,
    defaultCounterFallbacks,
    strategy,
    preserveRoles,
    customGroupMessages: options.groupMessages,
    summary,
  };
}

/**
 * Enforced by `buildFitPlan` immediately after `normalizeOptions`, before any
 * grouping or token counting begins — mirrors `token-chunk`'s
 * `assertInputWithinLimit`, checked against the *actual* input length rather
 * than anything derived from it, so an oversized `messages` array is
 * rejected before any of the per-message work it would otherwise cause.
 */
export function assertMessagesWithinLimit(messagesLength: number, maxMessages: number): void {
  if (messagesLength > maxMessages) {
    throw new ChatFitError(
      `received ${String(messagesLength)} messages, exceeding options.maxMessages (${String(maxMessages)})`,
      'INPUT_TOO_LARGE',
    );
  }
}
