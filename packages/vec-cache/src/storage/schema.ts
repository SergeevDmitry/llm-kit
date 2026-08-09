/**
 * SQLite schema and its version number. `CACHE_SCHEMA_VERSION`
 * is also the "schema-version" component of the cache identity
 * (`identity/cache-key.ts`) — bumping it invalidates every previously
 * computed key, which is intentional: a schema change is exactly the kind of
 * event that should force re-embedding rather than risk misreading old rows
 * under a new layout.
 *
 * There is deliberately no `accessed_at_ms` column. Recording one would mean
 * either writing a value no read ever updates (`prune` filters on
 * `expires_at_ms`/`created_at_ms` only), leaving a column whose name promises
 * LRU semantics this package does not implement, or turning every read into a
 * WAL-appending write. If access tracking is ever wanted it needs to be a
 * deliberate, opt-in feature, not a column nobody maintains.
 */

export const CACHE_SCHEMA_VERSION = 1;

export const CREATE_METADATA_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS metadata (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;

export const CREATE_EMBEDDINGS_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS embeddings (
  cache_key TEXT PRIMARY KEY,
  namespace TEXT NOT NULL,
  model_id TEXT NOT NULL,
  text_hash TEXT NOT NULL,
  text_value TEXT,
  dimensions INTEGER NOT NULL,
  vector_encoding TEXT NOT NULL,
  vector_blob BLOB NOT NULL,
  created_at_ms INTEGER NOT NULL,
  expires_at_ms INTEGER
);
`;

export const CREATE_INDEXES_SQL = `
CREATE INDEX IF NOT EXISTS embeddings_namespace_model ON embeddings(namespace, model_id);
CREATE INDEX IF NOT EXISTS embeddings_expiry ON embeddings(expires_at_ms);
`;
