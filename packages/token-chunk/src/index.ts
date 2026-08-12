/**
 * token-chunk — public entry point.
 *
 * RAG pipelines need chunks under a model's token budget, but naïve
 * character windows destroy semantic boundaries and Markdown context.
 * `token-chunk` splits coarse to fine — heading -> paragraph/block ->
 * sentence -> word -> token — preserving parent heading breadcrumbs and
 * producing deterministic overlap. See the README for the full guide.
 */
export { chunkText, chunkMarkdown, createChunker } from './chunk-text.js';

/**
 * Stable identifier for the bundled default tokenizer (`'approx-v1'`).
 * `TextChunk` itself carries no per-chunk tokenizer id — the tokenizer is a
 * property of the whole call, not of any one chunk, and the caller always
 * knows it (either they passed `options.tokenizer`, or this default was
 * used). Re-exported so callers can attribute a report's `tokenCount`
 * values without hardcoding the string themselves (invariant: "an
 * approximate count must never look exact — report the tokenizer id").
 */
export { APPROX_TOKENIZER_ID } from './tokenizer.js';

export type {
  ChunkOptions,
  ChunkFormat,
  HardBoundary,
  HeadingRef,
  TextChunk,
  ChunkOverlap,
  ChunkDiagnostic,
  ChunkDiagnosticCode,
  BlockKind,
  Tokenizer,
  TokenChunkErrorCode,
} from './types.js';

export { TokenChunkError } from './types.js';
