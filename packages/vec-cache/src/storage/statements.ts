/**
 * SQL text, row shapes, and the chunking helper `better-sqlite-store.ts`
 * builds prepared statements from. Kept separate from the store so the
 * "chunked IN queries, no N+1" invariant (9) has one obvious place to audit.
 */
import type { StoredEmbedding } from './store.js';
import type { VectorEncoding } from '../types.js';

/**
 * Conservative bound on the number of `?` placeholders in one `IN (...)`
 * clause. SQLite's actual compiled limit (`SQLITE_MAX_VARIABLE_NUMBER`) is
 * 999 on older builds and up to 32766 on builds compiled since SQLite
 * 3.32.0 — this stays safely under either, so a batch chunks the same way
 * regardless of how the bundled `better-sqlite3` binary was compiled. A
 * 1,000-key lookup therefore issues 2 `SELECT`s, never 1,000.
 */
export const MAX_IN_CLAUSE_PARAMS = 500;

export const SELECT_COLUMNS =
  'cache_key, namespace, model_id, text_hash, text_value, dimensions, vector_encoding, vector_blob, created_at_ms, expires_at_ms';

export const INSERT_OR_UPDATE_SQL = `
INSERT INTO embeddings (cache_key, namespace, model_id, text_hash, text_value, dimensions, vector_encoding, vector_blob, created_at_ms, expires_at_ms)
VALUES (@cacheKey, @namespace, @modelId, @textHash, @textValue, @dimensions, @vectorEncoding, @vectorBlob, @createdAtMs, @expiresAtMs)
ON CONFLICT(cache_key) DO UPDATE SET
  namespace = excluded.namespace,
  model_id = excluded.model_id,
  text_hash = excluded.text_hash,
  text_value = excluded.text_value,
  dimensions = excluded.dimensions,
  vector_encoding = excluded.vector_encoding,
  vector_blob = excluded.vector_blob,
  expires_at_ms = excluded.expires_at_ms
`;

export interface RawEmbeddingRow {
  readonly cache_key: string;
  readonly namespace: string;
  readonly model_id: string;
  readonly text_hash: string;
  readonly text_value: string | null;
  readonly dimensions: number;
  readonly vector_encoding: VectorEncoding;
  readonly vector_blob: Buffer;
  readonly created_at_ms: number;
  readonly expires_at_ms: number | null;
}

export function rowToStoredEmbedding(row: RawEmbeddingRow): StoredEmbedding {
  return {
    cacheKey: row.cache_key,
    namespace: row.namespace,
    modelId: row.model_id,
    textHash: row.text_hash,
    textValue: row.text_value ?? undefined,
    dimensions: row.dimensions,
    vectorEncoding: row.vector_encoding,
    vectorBlob: row.vector_blob,
    createdAtMs: row.created_at_ms,
    expiresAtMs: row.expires_at_ms ?? undefined,
  };
}

export function storedEmbeddingToParams(entry: StoredEmbedding): Record<string, unknown> {
  return {
    cacheKey: entry.cacheKey,
    namespace: entry.namespace,
    modelId: entry.modelId,
    textHash: entry.textHash,
    textValue: entry.textValue ?? null,
    dimensions: entry.dimensions,
    vectorEncoding: entry.vectorEncoding,
    vectorBlob: entry.vectorBlob,
    createdAtMs: entry.createdAtMs,
    expiresAtMs: entry.expiresAtMs ?? null,
  };
}

/** Splits `items` into groups of at most `size`, preserving order. */
export function chunk<T>(items: readonly T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}
