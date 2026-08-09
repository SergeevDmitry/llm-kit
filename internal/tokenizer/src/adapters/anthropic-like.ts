/**
 * Adapter for Anthropic-shaped token counting.
 *
 * Anthropic's current public surface does not ship a local encoder the way
 * tiktoken does — the accurate count comes from a synchronous, consumer-
 * supplied `countTokens(text)` (for example, a thin wrapper the caller
 * writes over their own cached/offline count). Because there is no local
 * encoder, there are no token ids to hand back, so this adapter produces a
 * {@link Tokenizer} with `count` only — `encode`/`decode` are intentionally
 * absent, exercising the same "optional means optional" contract that
 * `token-chunk` must already handle for the approximate tokenizer.
 */
import { TokenizerError, type Tokenizer } from '../types.js';

export interface AnthropicLikeCounter {
  /** Optional id; defaults to `"anthropic-like"` when omitted. */
  readonly id?: string;
  countTokens(text: string): number;
}

const DEFAULT_ID = 'anthropic-like';

/**
 * Adapts a `{ id?, countTokens }` object into a `count`-only {@link Tokenizer}.
 *
 * @throws {TokenizerError} `INVALID_COUNTER_SHAPE` if `countTokens` is not a function.
 */
export function fromAnthropicLikeCounter(counter: AnthropicLikeCounter): Tokenizer {
  if (typeof counter.countTokens !== 'function') {
    throw new TokenizerError(
      'fromAnthropicLikeCounter requires a `countTokens(text)` function',
      'INVALID_COUNTER_SHAPE',
    );
  }
  const id = typeof counter.id === 'string' && counter.id.length > 0 ? counter.id : DEFAULT_ID;
  const { countTokens } = counter;
  return {
    id,
    count(text: string): number {
      return countTokens(text);
    },
  };
}
