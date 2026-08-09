/**
 * Default tokenizer wiring. `@llm-kit/tokenizer` is the one approved
 * foundation for this package and is bundled into `dist/` at build time —
 * no `@llm-kit/*` specifier survives.
 */
import { APPROX_TOKENIZER_ID, approximateTokenizer } from '@llm-kit/tokenizer';
import type { Tokenizer } from './types.js';

export { APPROX_TOKENIZER_ID };

/** Resolves the tokenizer to budget against: the caller's, or the bundled approximate default. */
export function resolveTokenizer(tokenizer: Tokenizer | undefined): Tokenizer {
  return tokenizer ?? approximateTokenizer;
}
