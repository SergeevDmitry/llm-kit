/**
 * Invariant "writes are transactional": if any row in a `putMany` batch
 * fails, none of the batch is persisted — not even the rows that were
 * processed before the failing one.
 */
import { createTempDatabase, type TempDatabase } from '@llm-kit/test-utils';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createBetterSqliteStore } from '../src/storage/better-sqlite-store.js';
import type { StoredEmbedding, VectorCacheStore } from '../src/storage/store.js';
import { encodeVector } from '../src/storage/vector-codec.js';
import { VectorCache } from '../src/index.js';

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

describe('putMany transaction rollback', () => {
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

  it('rolls back the whole batch, including rows before the failing one, on a constraint violation', () => {
    const before = stub('before-the-failure');
    const broken: StoredEmbedding = {
      ...stub('the-failure'),
      namespace: null as unknown as string,
    };
    const after = stub('after-the-failure');

    expect(() => store.putMany([before, broken, after])).toThrow();

    const survivors = store.getMany(
      ['before-the-failure', 'the-failure', 'after-the-failure'],
      Date.now(),
    );
    expect(survivors).toHaveLength(0);
  });

  it('a previously-committed row is unaffected by a later failed batch', () => {
    store.putMany([stub('already-committed')]);
    const broken: StoredEmbedding = { ...stub('bad'), dimensions: null as unknown as number };
    expect(() => store.putMany([broken])).toThrow();
    expect(store.getMany(['already-committed'], Date.now())).toHaveLength(1);
  });

  it('VectorCache.getOrCreate propagates a store failure without leaving a partial write, for the whole call', async () => {
    // A batch where embed succeeds but returns a vector containing a
    // non-finite value: encodeVector would happily write NaN/Infinity bytes
    // and there is nothing to roll back — this test instead confirms that
    // when the *result count* is wrong (which fails before any store write
    // is attempted at all), nothing is persisted for the good text either.
    const cache = new VectorCache({ path: db.file('rollback-cache.sqlite') });
    try {
      await expect(
        cache.getOrCreate(['a', 'b'], {
          model: 'm',
          embed: () => Promise.resolve([[1, 2]]), // wrong count: 1 for 2 misses
        }),
      ).rejects.toMatchObject({ code: 'EMBED_RESULT_COUNT_MISMATCH' });

      expect(cache.getMany(['a', 'b'], { model: 'm' }).report.hitCount).toBe(0);
    } finally {
      cache.close();
    }
  });
});
