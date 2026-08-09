/**
 * Internal storage interface, kept narrow and free of `better-sqlite3` types
 * so a future `node:sqlite`/`bun:sqlite` backend can implement it without
 * exposing database internals or requiring this package's public surface to
 * change.
 */
import type { PruneReport, VectorCacheStats, VectorEncoding } from '../types.js';

export interface StoredEmbedding {
  readonly cacheKey: string;
  readonly namespace: string;
  readonly modelId: string;
  readonly textHash: string;
  /** `undefined` unless `VectorCacheOptions.storeText` is enabled. */
  readonly textValue: string | undefined;
  readonly dimensions: number;
  readonly vectorEncoding: VectorEncoding;
  readonly vectorBlob: Buffer;
  readonly createdAtMs: number;
  /** `undefined` means "never expires". */
  readonly expiresAtMs: number | undefined;
}

export interface StorePruneOptions {
  readonly nowMs: number;
  readonly namespace?: string;
  readonly olderThanMs?: number;
}

export interface VectorCacheStore {
  /** Chunked under the hood to stay under SQLite's `IN (...)` parameter limit — never one query per key. Excludes rows expired as of `nowMs`. */
  getMany(keys: readonly string[], nowMs: number): readonly StoredEmbedding[];
  /** Upserts every entry inside one transaction. */
  putMany(entries: readonly StoredEmbedding[]): void;
  /** Returns the number of rows actually deleted. */
  deleteMany(keys: readonly string[]): number;
  prune(options: StorePruneOptions): PruneReport;
  stats(): VectorCacheStats;
  /** Returns the number of rows deleted. */
  clear(namespace?: string): number;
  close(): void;
}
