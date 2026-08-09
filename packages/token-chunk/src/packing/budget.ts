import type { Tokenizer } from '../types.js';

export interface AssembleParts {
  /** Synthesized heading breadcrumb, not source-backed. Dropped first if the chunk doesn't fit. */
  prefix: string;
  /** Repeated trailing text from the previous chunk. Dropped second. */
  overlap: string;
  /** New content unit texts, in order. Dropped from the end, last first, but never below one. */
  unitTexts: string[];
}

export interface AssembleResult {
  readonly text: string;
  readonly tokenCount: number;
  /** True only in the documented exception: even the smallest possible chunk exceeds `hardBudget`. */
  readonly exceeded: boolean;
  readonly usedPrefix: boolean;
  readonly usedOverlap: boolean;
  /** How many of `parts.unitTexts`, from the start, made it into the final chunk. */
  readonly unitsUsed: number;
}

/**
 * Assembles a chunk's final text and verifies it against `hardBudget` with
 * the real tokenizer — the authoritative measurement, not the sum of
 * per-piece estimates used while packing. Most tokenizers are subadditive
 * under concatenation (merging at a boundary can only remove tokens, never
 * add them), but that isn't guaranteed by the `Tokenizer` contract, so this
 * always re-measures the assembled string and shrinks (overlap, then
 * trailing units, then the prefix) until it fits or nothing is left to
 * drop — which is exactly the documented exception to the budget invariant.
 */
export function assembleWithinBudget(
  parts: AssembleParts,
  hardBudget: number,
  tokenizer: Tokenizer,
): AssembleResult {
  let prefix = parts.prefix;
  let overlap = parts.overlap;
  const unitTexts = [...parts.unitTexts];

  for (;;) {
    const text = prefix + overlap + unitTexts.join('');
    const tokenCount = tokenizer.count(text);
    if (tokenCount <= hardBudget) {
      return {
        text,
        tokenCount,
        exceeded: false,
        usedPrefix: prefix.length > 0,
        usedOverlap: overlap.length > 0,
        unitsUsed: unitTexts.length,
      };
    }
    if (overlap.length > 0) {
      overlap = '';
      continue;
    }
    if (unitTexts.length > 1) {
      unitTexts.pop();
      continue;
    }
    if (prefix.length > 0) {
      prefix = '';
      continue;
    }
    // Nothing left to drop: a single unit alone already exceeds hardBudget.
    return {
      text,
      tokenCount,
      exceeded: true,
      usedPrefix: false,
      usedOverlap: false,
      unitsUsed: unitTexts.length,
    };
  }
}
