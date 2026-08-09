/**
 * vec-cache — SQLite-backed embedding cache.
 *
 * Public surface: {@link VectorCache} (stateful, canonical lifecycle) and
 * {@link createVectorCache} (factory alias). See the README for the
 * "940 hits, 60 misses" headline example, the callback contract, and the
 * concurrency/privacy limitations.
 */
export { VectorCache, createVectorCache } from './vector-cache.js';
export { VectorCacheError, type VectorCacheErrorCode } from './errors.js';
export type {
  CacheIdentityOptions,
  CacheLookupOptions,
  CacheLookupResult,
  CacheWriteEntry,
  CachedEmbeddingBatch,
  ClearOptions,
  DimensionMismatchDiagnostic,
  EmbedBatch,
  EmbedBatchRequest,
  EmbeddingVector,
  GetOrCreateOptions,
  NamespaceStats,
  PruneOptions,
  PruneReport,
  VectorCacheBatchReport,
  VectorCacheLookupReport,
  VectorCacheOptions,
  VectorCacheStats,
  VectorEncoding,
} from './types.js';
