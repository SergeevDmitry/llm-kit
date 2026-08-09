/**
 * Token-counting contracts shared by every llm-kit package. `Tokenizer` and
 * `MessageTokenCounter` are re-exported, verbatim, through the public
 * declarations of `token-chunk` and `chat-fit` — a shape change here is a
 * breaking change to both, not just to this package, and needs sign-off
 * from both consumers.
 */

/**
 * A token counter for raw text. `encode`/`decode` are optional on purpose:
 * the bundled approximate tokenizer (`approximate-tokenizer.ts`) can only
 * ever produce a count, never real token ids, and `token-chunk` must degrade
 * to word/text-boundary splitting when they are absent rather than fail.
 * Injected exact adapters (`adapters/`) may provide all three.
 */
export interface Tokenizer {
  /**
   * Stable identifier for the counting strategy in use, e.g. `approx-v1` or
   * a consumer-supplied encoder id. Every report that carries a token count
   * must also carry this id so the count is attributable and reproducible —
   * an approximate count must never be presented as if it were exact.
   */
  readonly id: string;
  /** Token count for `text`. Deterministic: the same string always yields the same count. */
  count(text: string): number;
  /** Token ids for `text`, when the underlying encoder can produce them. */
  encode?(text: string): readonly number[];
  /**
   * Text for `tokens`, when the underlying encoder can produce it. Not
   * guaranteed to round-trip — see `adapters/generic-encoder.ts`.
   */
  decode?(tokens: readonly number[]): string;
}

/**
 * A token counter over a consumer-defined `Message` shape, accounting for
 * per-message overhead (role, delimiters, tool-call structure) in addition
 * to content tokens. `chat-fit` is the primary consumer.
 */
export interface MessageTokenCounter<Message> {
  /** Stable identifier for the counting strategy, reproducible like `Tokenizer.id`. */
  readonly id: string;
  /** Token count for a single message, including its accounting overhead. */
  countMessage(message: Message): number;
  /**
   * Token count for a full conversation. Not simply the sum of
   * `countMessage`: implementations add conversation-level overhead (e.g. the
   * reply-priming tokens most chat APIs charge once per request).
   */
  countMessages(messages: readonly Message[]): number;
}

/**
 * Stable identifier for the bundled approximate tokenizer. Versioned so a
 * future recalibration ships as `approx-v2` under a new id rather than
 * silently changing counts reported under the same one.
 */
export const APPROX_TOKENIZER_ID = 'approx-v1';

/**
 * Stable string codes for every error this package throws. Documented here
 * so a `code` never drifts from what `TokenizerError` actually sets.
 *
 * - `INVALID_ENCODER_ID` — `fromEncoder`/`fromTiktokenLikeEncoder` received an
 *   object without a non-empty string `id` (or `id` argument).
 * - `INVALID_ENCODER_SHAPE` — the supplied encoder is missing a required
 *   `encode` function, or `encode`/`decode` is present but not callable.
 * - `INVALID_COUNTER_SHAPE` — `fromAnthropicLikeCounter` received an object
 *   without a callable `countTokens`.
 */
export type TokenizerErrorCode =
  'INVALID_ENCODER_ID' | 'INVALID_ENCODER_SHAPE' | 'INVALID_COUNTER_SHAPE';

/**
 * The only error type this package throws. A single class with a
 * discriminated `code` is enough: every failure mode here is the same shape
 * — a consumer-supplied adapter object doesn't match its declared contract —
 * so a taxonomy of subclasses would add ceremony without adding information.
 */
export class TokenizerError extends Error {
  readonly code: TokenizerErrorCode;

  constructor(message: string, code: TokenizerErrorCode, options?: { readonly cause?: unknown }) {
    super(message, options);
    this.name = 'TokenizerError';
    this.code = code;
  }
}
