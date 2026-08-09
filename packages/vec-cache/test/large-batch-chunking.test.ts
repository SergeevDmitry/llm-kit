/**
 * `IN` queries are chunked to stay under SQLite's parameter limit, without
 * falling back to one query per key. `chunk()`'s grouping math is checked
 * directly, and a `Database.prototype.prepare` spy proves a large batch
 * lookup issues a small, bounded number of prepared statements rather than
 * one per key.
 */
import Database from 'better-sqlite3';
import { createTempDatabase, type TempDatabase } from '@llm-kit/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { chunk, MAX_IN_CLAUSE_PARAMS } from '../src/storage/statements.js';
import { createBetterSqliteStore } from '../src/storage/better-sqlite-store.js';
import type { StoredEmbedding, VectorCacheStore } from '../src/storage/store.js';
import { encodeVector } from '../src/storage/vector-codec.js';

describe('chunk', () => {
  it('splits evenly-divisible input into equal groups', () => {
    expect(chunk([1, 2, 3, 4, 5, 6], 2)).toEqual([
      [1, 2],
      [3, 4],
      [5, 6],
    ]);
  });

  it('leaves a smaller final group for a remainder', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it('a batch of 1,200 items chunked at MAX_IN_CLAUSE_PARAMS (500) produces 3 groups, never 1,200', () => {
    const items = Array.from({ length: 1200 }, (_, i) => i);
    const groups = chunk(items, MAX_IN_CLAUSE_PARAMS);
    expect(groups).toHaveLength(3);
    expect(groups[0]).toHaveLength(500);
    expect(groups[1]).toHaveLength(500);
    expect(groups[2]).toHaveLength(200);
  });

  it('returns [] for empty input', () => {
    expect(chunk([], 500)).toEqual([]);
  });
});

function stub(cacheKey: string): StoredEmbedding {
  return {
    cacheKey,
    namespace: 'ns',
    modelId: 'model',
    textHash: 'hash',
    textValue: undefined,
    dimensions: 2,
    vectorEncoding: 'float32',
    vectorBlob: encodeVector([1, 2], 'float32'),
    createdAtMs: 1,
    expiresAtMs: undefined,
  };
}

describe('getMany does not issue one query per key (no N+1)', () => {
  let db: TempDatabase;
  let store: VectorCacheStore;

  beforeEach(() => {
    db = createTempDatabase();
    store = createBetterSqliteStore({ path: db.databasePath });
  });

  afterEach(() => {
    store.close();
    db.cleanup();
  });

  it('a 1,000-key lookup prepares only a handful of statements, not 1,000', () => {
    const keys = Array.from({ length: 1000 }, (_, i) => `key-${String(i)}`);
    store.putMany(keys.map((key) => stub(key)));

    const prepareSpy = vi.spyOn(Database.prototype, 'prepare');
    prepareSpy.mockClear();

    const rows = store.getMany(keys, Date.now());

    expect(rows).toHaveLength(1000);
    // 1,000 keys at MAX_IN_CLAUSE_PARAMS=500 is 2 chunks -> at most 2 new
    // prepared statements (cached by chunk size for reuse), nowhere near
    // 1,000 — the literal signature of an N+1 lookup.
    expect(prepareSpy.mock.calls.length).toBeLessThan(10);

    prepareSpy.mockRestore();
  });

  it('repeated lookups of the same size reuse the cached prepared statement (0 new prepares)', () => {
    const keys = Array.from({ length: 50 }, (_, i) => `warm-${String(i)}`);
    store.putMany(keys.map((key) => stub(key)));
    store.getMany(keys, Date.now()); // warms the size-50 statement cache

    const prepareSpy = vi.spyOn(Database.prototype, 'prepare');
    prepareSpy.mockClear();
    store.getMany(keys, Date.now());
    expect(prepareSpy.mock.calls.length).toBe(0);
    prepareSpy.mockRestore();
  });
});
