/**
 * Validates and resolves `ChunkOptions` into a fully-defaulted internal
 * shape, once per call, before any parsing or packing begins.
 */
import { resolveTokenizer } from './tokenizer.js';
import type { ChunkFormat, ChunkOptions, HardBoundary, Tokenizer } from './types.js';
import { TokenChunkError } from './types.js';

/**
 * Default `maxInputChars` cap. Peak memory while
 * chunking is roughly 5-8x input size — the original text, the
 * line-ending-normalized copy, the offset map back to it, parsed
 * structural units, leaf units, and the emitted chunks all live at once —
 * so an uncapped caller handing this an untrusted multi-hundred-MB string
 * is an OOM, and a large unbroken run also amplifies whatever cost remains
 * in the boundary scanners.
 *
 * 5,000,000 characters (roughly 5-10 MB depending on encoding) is chosen to
 * comfortably clear real RAG ingestion — a single ingested document (a
 * long PDF or manual converted to text, a large log export) is rarely more
 * than a few hundred KB to low single-digit MB — while still bounding
 * worst-case peak memory to double-digit MB rather than being unbounded.
 * Callers ingesting genuinely larger documents should chunk each section
 * independently (which this package's own boilerplate-reuse guidance in
 * the README already recommends for unrelated reasons) or raise the cap
 * explicitly.
 */
export const DEFAULT_MAX_INPUT_CHARS = 5_000_000;

export interface ResolvedOptions {
  readonly maxTokens: number;
  readonly overlapTokens: number;
  readonly tokenizer: Tokenizer;
  readonly format: ChunkFormat;
  readonly preserveHeadingPath: boolean;
  readonly includeHeadingTextInContent: boolean;
  readonly hardBoundary: HardBoundary;
  readonly safetyMarginTokens: number;
  /** `maxTokens - safetyMarginTokens`. The real ceiling every chunk is packed against. */
  readonly budget: number;
  readonly maxInputChars: number;
}

function requireNonNegativeInteger(
  value: number,
  label: string,
  code: 'INVALID_OVERLAP_TOKENS' | 'INVALID_SAFETY_MARGIN',
): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new TokenChunkError(
      `${label} must be a non-negative integer, received ${String(value)}`,
      code,
    );
  }
}

export function resolveOptions(options: ChunkOptions): ResolvedOptions {
  const { maxTokens } = options;
  if (!Number.isInteger(maxTokens) || maxTokens <= 0) {
    throw new TokenChunkError(
      `maxTokens must be a positive integer, received ${String(maxTokens)}`,
      'INVALID_MAX_TOKENS',
    );
  }

  const overlapTokens = options.overlapTokens ?? 0;
  requireNonNegativeInteger(overlapTokens, 'overlapTokens', 'INVALID_OVERLAP_TOKENS');

  const safetyMarginTokens = options.safetyMarginTokens ?? 0;
  requireNonNegativeInteger(safetyMarginTokens, 'safetyMarginTokens', 'INVALID_SAFETY_MARGIN');

  const budget = maxTokens - safetyMarginTokens;
  if (budget <= 0) {
    throw new TokenChunkError(
      `safetyMarginTokens (${String(safetyMarginTokens)}) leaves no budget under maxTokens (${String(maxTokens)})`,
      'BUDGET_NOT_POSITIVE',
    );
  }

  const maxInputChars = options.maxInputChars ?? DEFAULT_MAX_INPUT_CHARS;
  if (!Number.isInteger(maxInputChars) || maxInputChars <= 0) {
    throw new TokenChunkError(
      `maxInputChars must be a positive integer, received ${String(maxInputChars)}`,
      'INVALID_MAX_INPUT_CHARS',
    );
  }

  return {
    maxTokens,
    overlapTokens,
    tokenizer: resolveTokenizer(options.tokenizer),
    format: options.format ?? 'auto',
    preserveHeadingPath: options.preserveHeadingPath ?? true,
    includeHeadingTextInContent: options.includeHeadingTextInContent ?? false,
    hardBoundary: options.hardBoundary ?? 'token',
    safetyMarginTokens,
    budget,
    maxInputChars,
  };
}

/**
 * Enforced by `chunkText`/`chunkMarkdown` before `normalizeLineEndings`
 * allocates a normalized copy of `input` — checked
 * against the *original* input length, not anything derived from it, so it
 * rejects an oversized document before any of the 5-8x memory amplification
 * described on {@link DEFAULT_MAX_INPUT_CHARS} happens.
 */
export function assertInputWithinLimit(input: string, maxInputChars: number): void {
  if (input.length > maxInputChars) {
    throw new TokenChunkError(
      `input is ${String(input.length)} characters, exceeding maxInputChars (${String(maxInputChars)})`,
      'INPUT_TOO_LARGE',
    );
  }
}
