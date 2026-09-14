/**
 * Counting a conversation without trimming it.
 *
 * `src/token-accounting.ts`'s default counter is the only thing here that
 * reads `ChatMessage`-, OpenAI- and Anthropic-shaped messages correctly, and
 * `fitChat` is otherwise the only way to reach it. "How many tokens is this
 * conversation?" gets asked more often than "trim it", so the count is worth
 * exposing on its own.
 *
 * The two ways of asking without it both cost something. Running `fitChat`
 * against a huge `maxTokens` groups and selects every message to produce the
 * number. Writing a counter by hand lands back on the undercount
 * `token-accounting.ts`'s module doc describes.
 */
import { APPROX_TOKENIZER_ID, approximateTokenizer } from '@llm-kit/tokenizer';
import { assertMessagesWithinLimit, DEFAULT_MAX_MESSAGES } from './normalize-options.js';
import { countMessagesSafe } from './selection/budget.js';
import { createDefaultMessageTokenCounter } from './token-accounting.js';
import type { ChatMessage, Tokenizer } from './types.js';

export interface CountChatTokensOptions {
  /**
   * Tokenizer to count with. Defaults to the bundled approximate one, which
   * over-counts on purpose, so `approximate` comes back `true` and the count
   * is an upper bound. Pass an exact `Tokenizer` (see `fromEncoder` and
   * friends) to get `false`.
   */
  readonly tokenizer?: Tokenizer;
  /**
   * Ceiling on `messages.length`, same cap and default as `fitChat`. Above
   * it, this throws {@link ChatFitError} with code `INPUT_TOO_LARGE` before
   * counting anything. Default: 50,000.
   */
  readonly maxMessages?: number;
}

export interface ChatTokenCount {
  /** What the whole conversation costs, including per-message and per-conversation overhead. */
  readonly tokens: number;
  /** Id of the counter that produced `tokens`, the same value `FitChatReport.counterId` carries. */
  readonly counterId: string;
  /** Whether the bundled approximate tokenizer produced the count, in which case treat it as an upper bound. */
  readonly approximate: boolean;
  /**
   * Messages counted conservatively because their shape was unrecognized,
   * as `"message N: <reason>"`, plus one entry naming the tokenizer when
   * `approximate` is true. Same text `FitChatReport.warnings` uses.
   */
  readonly warnings: readonly string[];
}

/**
 * Counts a conversation with chat-fit's own message accounting, and reports
 * how much of that count was estimated.
 *
 * Nothing is grouped, selected, trimmed or summarized. `tokens` is exactly
 * what `fitChat`'s `report.initialTokenCount` would be for the same messages
 * and tokenizer.
 */
export function countChatTokens<Message = ChatMessage>(
  messages: readonly Message[],
  options?: CountChatTokensOptions,
): ChatTokenCount {
  assertMessagesWithinLimit(messages.length, options?.maxMessages ?? DEFAULT_MAX_MESSAGES);

  const tokenizer = options?.tokenizer ?? approximateTokenizer;
  const counter = createDefaultMessageTokenCounter<Message>(tokenizer);
  const tokens = countMessagesSafe(counter, messages);

  // Read the fallback reasons the count above already recorded rather than
  // calling `describeContentFallbacks`, which re-walks and re-tokenizes every
  // message. `finalize.ts` reads the same side channel for the same reason.
  const warnings: string[] = [];
  messages.forEach((message, index) => {
    const reasons = counter.fallbackReasons.get(message);
    if (reasons !== undefined && reasons.length > 0) {
      warnings.push(`message ${String(index)}: ${reasons.join('; ')}`);
    }
  });

  const approximate = tokenizer.id === APPROX_TOKENIZER_ID;
  if (approximate) {
    warnings.push(
      `token counts use the approximate tokenizer ("${counter.id}"); treat them as an ` +
        'upper bound, not an exact count',
    );
  }

  return { tokens, counterId: counter.id, approximate, warnings };
}
