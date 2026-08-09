/**
 * Adapter for tiktoken-shaped encoders — objects with `encode(text): number[]`
 * and `decode(tokens): string | Uint8Array`, matching both the official
 * `tiktoken` WASM binding (`decode` returns bytes) and pure-JS ports like
 * `js-tiktoken` (`decode` returns a string). Neither library is a dependency
 * of this package; the consumer instantiates its own encoder and passes it
 * in.
 *
 * `decode(encode(x))` is not guaranteed to equal `x` for a real BPE
 * tokenizer — whitespace normalization and byte-fallback for malformed
 * UTF-8 can both change the round trip. This adapter does not paper over
 * that: it passes the encoder's real behaviour straight through, which is
 * exactly what `token-chunk`'s round-trip contract tests need to see.
 */
import { fromEncoder } from './generic-encoder.js';
import type { Tokenizer } from '../types.js';

export interface TiktokenLikeEncoder {
  encode(text: string): readonly number[];
  decode(tokens: readonly number[]): string | Uint8Array;
}

/**
 * Wraps a tiktoken-shaped encoder under the given `id` (there is no
 * standard id on the encoder object itself, so the caller supplies one —
 * typically the encoding name, e.g. `"cl100k_base"`).
 */
export function fromTiktokenLikeEncoder(id: string, encoder: TiktokenLikeEncoder): Tokenizer {
  return fromEncoder({
    id,
    encode: (text: string) => encoder.encode(text),
    decode: (tokens: readonly number[]) => {
      const decoded = encoder.decode(tokens);
      return typeof decoded === 'string' ? decoded : new TextDecoder().decode(decoded);
    },
  });
}
