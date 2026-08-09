/**
 * The only error type `chat-fit` throws. A single class with a discriminated
 * `code`: every failure mode below is a distinct, documented, stable
 * condition a caller can branch on.
 */

/**
 * - `PRESERVED_MESSAGES_EXCEED_BUDGET` — the messages that must always be
 *   kept (system/developer roles by default, wherever they appear) do not
 *   fit inside `maxTokens - reserveTokens - safetyMarginTokens` on their
 *   own. `chat-fit` never truncates a system prompt to make room — it
 *   reports this instead. A non-positive available budget also surfaces
 *   here, since nothing can fit it either.
 * - `INVALID_OPTIONS` — `maxTokens`, `reserveTokens`, `safetyMarginTokens`, or
 *   `maxMessages` was not a finite, appropriately-signed number, or
 *   `strategy: 'summarize-middle'` was requested without
 *   `summary.summarizer`.
 * - `SUMMARY_FAILED` — the `summarizer` callback threw. The original error is
 *   available as `.cause`. Not raised for an oversized summary (that is
 *   retried and then falls back to dropping the range) or for an aborted
 *   signal (that propagates as the abort error itself, unwrapped).
 * - `TOKEN_COUNTING_FAILED` — the injected `tokenizer` or
 *   `messageTokenCounter` threw while counting. The original error is
 *   available as `.cause`.
 * - `INPUT_TOO_LARGE` — `messages.length` exceeds `options.maxMessages`
 *   (default documented on `FitChatOptions.maxMessages` in `types.ts`).
 *   Matches `token-chunk`'s `INPUT_TOO_LARGE`/`maxInputChars` naming so the
 *   two packages read consistently. Raised before any grouping or token
 *   counting begins.
 */
export type ChatFitErrorCode =
  | 'PRESERVED_MESSAGES_EXCEED_BUDGET'
  | 'INVALID_OPTIONS'
  | 'SUMMARY_FAILED'
  | 'TOKEN_COUNTING_FAILED'
  | 'INPUT_TOO_LARGE';

export class ChatFitError extends Error {
  readonly code: ChatFitErrorCode;

  constructor(message: string, code: ChatFitErrorCode, options?: { readonly cause?: unknown }) {
    super(message, options);
    this.name = 'ChatFitError';
    this.code = code;
  }
}
