/**
 * Unit tests for the batch planner pieces in isolation — `plan-batch.ts` is
 * effectively the core of this package, so it gets tested both
 * here (white-box, against the real store) and end-to-end through
 * `VectorCache.getOrCreate` (`test/get-or-create.test.ts`) and the property
 * test (`test/property.test.ts`).
 */
import { createTempDatabase } from '@llm-kit/test-utils';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { dedupeInOrder } from '../src/batch/deduplicate.js';
import { planBatch } from '../src/batch/plan-batch.js';
import { restoreOrder } from '../src/batch/restore-order.js';
import { VectorCacheError } from '../src/errors.js';
import { createBetterSqliteStore } from '../src/storage/better-sqlite-store.js';
import type { StoredEmbedding, VectorCacheStore } from '../src/storage/store.js';
import { encodeVector } from '../src/storage/vector-codec.js';
import type { EmbeddingVector } from '../src/types.js';

describe('dedupeInOrder', () => {
  it('keeps only the first occurrence of each value, in original order', () => {
    expect(dedupeInOrder(['a', 'b', 'a', 'c', 'b', 'a'])).toEqual(['a', 'b', 'c']);
  });

  it('returns an empty array for empty input', () => {
    expect(dedupeInOrder([])).toEqual([]);
  });

  it('leaves an already-unique array unchanged', () => {
    expect(dedupeInOrder(['x', 'y', 'z'])).toEqual(['x', 'y', 'z']);
  });
});

function stub(cacheKey: string, dims = 2): StoredEmbedding {
  const vector = [1, 2].slice(0, dims);
  return {
    cacheKey,
    namespace: 'ns',
    modelId: 'model',
    textHash: 'hash',
    textValue: undefined,
    dimensions: dims,
    vectorEncoding: 'float32',
    vectorBlob: encodeVector(vector, 'float32'),
    createdAtMs: 1000,
    expiresAtMs: undefined,
  };
}

describe('planBatch', () => {
  let db: ReturnType<typeof createTempDatabase>;
  let store: VectorCacheStore;

  beforeEach(() => {
    db = createTempDatabase();
    store = createBetterSqliteStore({ path: db.databasePath });
  });

  afterEach(() => {
    store.close();
    db.cleanup();
  });

  it('preseeded texts are hits; everything else is a deterministically-ordered unique miss', () => {
    const texts = ['hit-1', 'miss-1', 'hit-1', 'miss-2', 'miss-1', 'hit-2'];
    // Seed "hit-1" and "hit-2" directly via the real key computation path by
    // round-tripping through getMany's own key derivation: easiest is to
    // plan once to learn the keys, then seed those keys.
    const firstPlan = planBatch(texts, 'ns', 'model', store, 0);
    const hitTexts = new Set(['hit-1', 'hit-2']);
    const keyForText = new Map(texts.map((text, index) => [text, firstPlan.keys[index] as string]));
    const seedEntries = [...hitTexts].map((text) => stub(keyForText.get(text) as string));
    store.putMany(seedEntries);

    const plan = planBatch(texts, 'ns', 'model', store, 0);
    expect(plan.keys).toHaveLength(texts.length);
    expect(plan.hitMap.size).toBe(2);
    // Deterministic order: first occurrence in the original array.
    expect(plan.uniqueMissKeys).toEqual([keyForText.get('miss-1'), keyForText.get('miss-2')]);
    expect(plan.missTextByKey.get(keyForText.get('miss-1') as string)).toBe('miss-1');
    expect(plan.missTextByKey.get(keyForText.get('miss-2') as string)).toBe('miss-2');
  });

  it('excludes expired rows from the hit map (treated as a miss)', () => {
    const texts = ['expiring'];
    const plan1 = planBatch(texts, 'ns', 'model', store, 0);
    const key = plan1.keys[0] as string;
    store.putMany([{ ...stub(key), createdAtMs: 0, expiresAtMs: 500 }]);

    const stillFresh = planBatch(texts, 'ns', 'model', store, 100);
    expect(stillFresh.hitMap.has(key)).toBe(true);

    const nowExpired = planBatch(texts, 'ns', 'model', store, 1000);
    expect(nowExpired.hitMap.has(key)).toBe(false);
    expect(nowExpired.uniqueMissKeys).toEqual([key]);
  });

  it('returns an empty plan for an empty text array without querying the store for anything odd', () => {
    const plan = planBatch([], 'ns', 'model', store, 0);
    expect(plan.keys).toEqual([]);
    expect(plan.hitMap.size).toBe(0);
    expect(plan.uniqueMissKeys).toEqual([]);
    expect(plan.dimensionMismatches).toEqual([]);
  });

  describe('dimensionMismatches', () => {
    it('reports no mismatches and hits normally when nothing disagrees', () => {
      const texts = ['a'];
      const key = planBatch(texts, 'ns', 'model', store, 0).keys[0] as string;
      store.putMany([stub(key, 4)]);

      const plan = planBatch(texts, 'ns', 'model', store, 0);
      expect(plan.hitMap.has(key)).toBe(true);
      expect(plan.dimensionMismatches).toEqual([]);
    });

    it('demotes a hit to a miss when its stored dimensions disagree with an explicitly requested value', () => {
      const texts = ['a'];
      // `computeCacheKeys` folds `expectedDimensions` into the key itself,
      // so the key here must be computed with the *same*
      // explicit dimensions as the read below — this simulates a row whose
      // actual stored vector width (4) disagrees with the width its own key
      // claims (8), e.g. an `embed` callback that ignored a requested
      // `dimensions: 8` and returned 4-wide vectors anyway.
      const key = planBatch(texts, 'ns', 'model', store, 0, 8).keys[0] as string;
      store.putMany([stub(key, 4)]); // actually stored at 4 dimensions

      const plan = planBatch(texts, 'ns', 'model', store, 0, 8); // caller expects 8
      expect(plan.hitMap.has(key)).toBe(false);
      expect(plan.uniqueMissKeys).toEqual([key]);
      expect(plan.dimensionMismatches).toEqual([
        { cacheKey: key, expectedDimensions: 8, actualDimensions: 4 },
      ]);
    });

    it('does not demote a hit that matches the explicitly requested dimensions', () => {
      const texts = ['a'];
      const key = planBatch(texts, 'ns', 'model', store, 0, 4).keys[0] as string;
      store.putMany([stub(key, 4)]);

      const plan = planBatch(texts, 'ns', 'model', store, 0, 4);
      expect(plan.hitMap.has(key)).toBe(true);
      expect(plan.dimensionMismatches).toEqual([]);
    });

    it('without an explicit request, locks onto the first hit (original text order) and demotes a later disagreeing hit', () => {
      const texts = ['first', 'second'];
      const [keyFirst, keySecond] = planBatch(texts, 'ns', 'model', store, 0).keys as [
        string,
        string,
      ];
      store.putMany([stub(keyFirst, 4), stub(keySecond, 8)]);

      const plan = planBatch(texts, 'ns', 'model', store, 0);
      expect(plan.hitMap.has(keyFirst)).toBe(true); // reference — never demoted
      expect(plan.hitMap.has(keySecond)).toBe(false); // disagrees with the reference
      expect(plan.uniqueMissKeys).toEqual([keySecond]);
      expect(plan.dimensionMismatches).toEqual([
        { cacheKey: keySecond, expectedDimensions: 4, actualDimensions: 8 },
      ]);
    });

    it('a single hit with no explicit request and nothing else to compare against is never demoted', () => {
      const texts = ['solo'];
      const key = planBatch(texts, 'ns', 'model', store, 0).keys[0] as string;
      store.putMany([stub(key, 4)]);

      const plan = planBatch(texts, 'ns', 'model', store, 0);
      expect(plan.hitMap.has(key)).toBe(true);
      expect(plan.dimensionMismatches).toEqual([]);
    });

    it('a demoted key appears only once in dimensionMismatches even when the text repeats in the batch', () => {
      const texts = ['dup', 'dup', 'dup'];
      const key = planBatch(texts, 'ns', 'model', store, 0, 8).keys[0] as string;
      store.putMany([stub(key, 4)]);

      const plan = planBatch(texts, 'ns', 'model', store, 0, 8);
      expect(plan.dimensionMismatches).toHaveLength(1);
      expect(plan.uniqueMissKeys).toEqual([key]);
    });
  });
});

describe('restoreOrder', () => {
  it('resolves every position from the hit map or the miss map, cloning either way', () => {
    const hit: EmbeddingVector = new Float32Array([1, 1]);
    const miss: EmbeddingVector = new Float32Array([2, 2]);
    const hitVectors = new Map([['k1', hit]]);
    const missVectors = new Map([['k2', miss]]);

    const result = restoreOrder(['k1', 'k2', 'k1'], hitVectors, missVectors);
    expect(result).toHaveLength(3);
    expect(Array.from(result[0] as Float32Array)).toEqual([1, 1]);
    expect(Array.from(result[1] as Float32Array)).toEqual([2, 2]);
    expect(Array.from(result[2] as Float32Array)).toEqual([1, 1]);
    // Cloned, not aliased — mutating one duplicate position must not affect the other.
    expect(result[0]).not.toBe(hit);
    expect(result[2]).not.toBe(result[0]);
  });

  it('throws a stable internal error if a key is in neither map (defensive — should be unreachable via the public API)', () => {
    expect(() => restoreOrder(['missing'], new Map(), new Map())).toThrowError(VectorCacheError);
    try {
      restoreOrder(['missing'], new Map(), new Map());
    } catch (error) {
      expect((error as VectorCacheError).code).toBe('INTERNAL');
    }
  });
});
