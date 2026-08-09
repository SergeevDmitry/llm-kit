/**
 * Wraps a consumer-supplied encoder object into a {@link Tokenizer}.
 *
 * This is the only way this package ever produces an exact count: it never
 * imports a provider tokenizer library itself, not even as a devDependency.
 * The consumer owns that dependency and hands this package a small object;
 * `fromEncoder` just adapts its shape.
 */
import { TokenizerError, type Tokenizer } from '../types.js';

export interface EncoderLike {
  /** Stable id for this encoder, carried through as `Tokenizer.id`. */
  readonly id: string;
  encode(text: string): readonly number[];
  /**
   * Optional. When absent, the resulting `Tokenizer.decode` is also absent —
   * `token-chunk` must degrade to word/text-boundary splitting rather than
   * assume every encoder can decode.
   */
  decode?(tokens: readonly number[]): string;
}

/**
 * Adapts an `{ id, encode, decode? }` object into a {@link Tokenizer}.
 * `count` is derived as `encode(text).length` — the only correct definition
 * of "how many tokens" for a real encoder.
 *
 * @throws {TokenizerError} `INVALID_ENCODER_ID` if `id` is missing or empty;
 *   `INVALID_ENCODER_SHAPE` if `encode` is not a function.
 */
export function fromEncoder(encoder: EncoderLike): Tokenizer {
  if (typeof encoder.id !== 'string' || encoder.id.length === 0) {
    throw new TokenizerError('fromEncoder requires a non-empty string `id`', 'INVALID_ENCODER_ID');
  }
  if (typeof encoder.encode !== 'function') {
    throw new TokenizerError(
      'fromEncoder requires an `encode(text)` function',
      'INVALID_ENCODER_SHAPE',
    );
  }
  if (encoder.decode !== undefined && typeof encoder.decode !== 'function') {
    throw new TokenizerError(
      'fromEncoder requires `decode` to be a function when provided',
      'INVALID_ENCODER_SHAPE',
    );
  }

  const { id, encode, decode } = encoder;
  const tokenizer: Tokenizer = {
    id,
    count(text: string): number {
      return encode(text).length;
    },
    encode(text: string): readonly number[] {
      return encode(text);
    },
  };
  if (decode === undefined) {
    return tokenizer;
  }
  return {
    ...tokenizer,
    decode(tokens: readonly number[]): string {
      return decode(tokens);
    },
  };
}
