import { createFakeClock, createTempDatabase, type TempDatabase } from '@llm-kit/test-utils';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { VectorCache } from '../src/index.js';
import { deterministicVector } from './helpers.js';

describe('VectorCache.getMany', () => {
  let db: TempDatabase;
  let cache: VectorCache;

  beforeEach(() => {
    db = createTempDatabase();
    cache = new VectorCache({ path: db.databasePath });
  });

  afterEach(() => {
    cache.close();
    db.cleanup();
  });

  it('never calls an embedding callback — there is no callback parameter at all', () => {
    expect(cache.getMany).toHaveLength(2); // (texts, options) — no `embed` slot
  });

  it('returns undefined at miss positions and the stored vector at hit positions, preserving order', () => {
    cache.setMany([{ text: 'known', model: 'm', embedding: deterministicVector('known') }]);
    const result = cache.getMany(['unknown-1', 'known', 'unknown-2'], { model: 'm' });

    expect(result.embeddings).toHaveLength(3);
    expect(result.embeddings[0]).toBeUndefined();
    expect(Array.from(result.embeddings[1] as Float32Array)).toEqual(
      Array.from(deterministicVector('known')),
    );
    expect(result.embeddings[2]).toBeUndefined();
    expect(result.report).toEqual({
      totalCount: 3,
      hitCount: 1,
      missCount: 2,
      elapsedMs: expect.any(Number),
      dimensionMismatches: [],
    });
  });

  it('returns an empty result for an empty input array', () => {
    const result = cache.getMany([], { model: 'm' });
    expect(result.embeddings).toEqual([]);
    expect(result.report.totalCount).toBe(0);
  });

  it('treats an expired entry as a miss', () => {
    const clock = createFakeClock();
    const ttlCache = new VectorCache({ path: db.file('ttl.sqlite'), now: clock.nowFn });
    try {
      ttlCache.setMany([
        { text: 'expiring', model: 'm', embedding: deterministicVector('expiring'), ttlMs: 100 },
      ]);
      expect(ttlCache.getMany(['expiring'], { model: 'm' }).report.hitCount).toBe(1);
      clock.advance(200);
      expect(ttlCache.getMany(['expiring'], { model: 'm' }).report.hitCount).toBe(0);
    } finally {
      ttlCache.close();
    }
  });

  it('respects a per-call namespace override', () => {
    cache.setMany([
      { text: 'x', model: 'm', namespace: 'special', embedding: deterministicVector('x') },
    ]);
    expect(cache.getMany(['x'], { model: 'm' }).report.hitCount).toBe(0);
    expect(cache.getMany(['x'], { model: 'm', namespace: 'special' }).report.hitCount).toBe(1);
  });

  it('decoded vectors are independent per call — mutating one result does not affect the next read', () => {
    cache.setMany([{ text: 'x', model: 'm', embedding: deterministicVector('x') }]);
    const first = cache.getMany(['x'], { model: 'm' });
    (first.embeddings[0] as Float32Array)[0] = 999;
    const second = cache.getMany(['x'], { model: 'm' });
    expect(Array.from(second.embeddings[0] as Float32Array)).toEqual(
      Array.from(deterministicVector('x')),
    );
  });

  describe('dimensions', () => {
    it('an explicit dimensions option isolates a lookup from an entry written at a different width', () => {
      cache.setMany([
        { text: 'x', model: 'm', embedding: new Float32Array([1, 2, 3, 4]), dimensions: 4 },
      ]);
      expect(cache.getMany(['x'], { model: 'm', dimensions: 4 }).report.hitCount).toBe(1);
      expect(cache.getMany(['x'], { model: 'm', dimensions: 8 }).report.hitCount).toBe(0);
    });

    it('a hit whose stored dimensions disagree with another hit in the same lookup batch is demoted to a miss and reported', () => {
      cache.setMany([
        { text: 'four-dim', model: 'm', embedding: new Float32Array([1, 2, 3, 4]) },
        { text: 'eight-dim', model: 'm', embedding: new Float32Array([1, 2, 3, 4, 5, 6, 7, 8]) },
      ]);
      const result = cache.getMany(['four-dim', 'eight-dim'], { model: 'm' });
      expect(result.report.hitCount).toBe(1);
      expect(result.report.missCount).toBe(1);
      expect(result.embeddings[0]).toBeDefined(); // four-dim: reference, stays a hit
      expect(result.embeddings[1]).toBeUndefined(); // eight-dim: demoted
      expect(result.report.dimensionMismatches).toEqual([
        {
          cacheKey: expect.any(String),
          expectedDimensions: 4,
          actualDimensions: 8,
        },
      ]);
    });
  });
});
