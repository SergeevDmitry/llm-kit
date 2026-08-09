/**
 * Error types thrown by `vec-cache`.
 *
 * A single class with a stable, discriminated `code`, matching
 * `llm-backoff`'s `LlmBackoffError` shape. Every code is deliberately
 * distinct and never guessed from context: a wrong callback result count and
 * a dimension mismatch each get their own code so a caller can tell them
 * apart programmatically. `EMBED_RESULT_INVALID` is its own code too,
 * distinct from `setMany`'s `INVALID_INPUT`: the same non-finite/non-numeric
 * check runs on both paths, but the code tells a caller whether *their own*
 * input was bad (`setMany`) or a third-party `embed` callback's result was
 * (`getOrCreate`).
 *
 * `DIMENSION_IDENTITY_CONFLICT` is distinct from
 * `EMBED_DIMENSION_MISMATCH` for the same reason: `EMBED_DIMENSION_MISMATCH`
 * means the vectors one `embed` call returned don't even agree with each
 * other; `DIMENSION_IDENTITY_CONFLICT` means a cache hit disagrees with a
 * freshly embedded (or concurrently in-flight) vector elsewhere in the same
 * batch — see `batch/assert-dimension-consistency.ts`.
 *
 * `cause` is always preserved when wrapping another error (a native
 * `better-sqlite3` failure, an `embed` rejection). Aborts are never wrapped
 * here — `getOrCreate` rethrows an abort exactly as it arrived, unwrapped,
 * same convention as `llm-backoff`.
 */

export type VectorCacheErrorCode =
  | 'INVALID_INPUT'
  | 'EMBED_RESULT_COUNT_MISMATCH'
  | 'EMBED_DIMENSION_MISMATCH'
  | 'EMBED_RESULT_INVALID'
  | 'DIMENSION_IDENTITY_CONFLICT'
  | 'STORE_CLOSED'
  | 'STORE_OPEN_FAILED'
  | 'STORE_CORRUPT'
  | 'SCHEMA_TOO_NEW'
  | 'INTERNAL';

export class VectorCacheError extends Error {
  override readonly name = 'VectorCacheError';
  readonly code: VectorCacheErrorCode;

  constructor(message: string, code: VectorCacheErrorCode, options?: { readonly cause?: unknown }) {
    super(message, options);
    this.code = code;
  }
}
