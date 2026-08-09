import { createTempDatabase, type TempDatabase } from '@llm-kit/test-utils';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { VectorCache } from '../src/index.js';
import { createBetterSqliteStore } from '../src/storage/better-sqlite-store.js';
import { computeCacheKey } from '../src/identity/cache-key.js';
import { deterministicVector } from './helpers.js';

describe('VectorCache.setMany', () => {
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

  it('is a no-op for an empty array', () => {
    expect(() => cache.setMany([])).not.toThrow();
    expect(cache.stats().totalEntries).toBe(0);
  });

  it('written entries are immediately readable via getMany', () => {
    cache.setMany([
      { text: 'a', model: 'm', embedding: deterministicVector('a') },
      { text: 'b', model: 'm', embedding: deterministicVector('b') },
    ]);
    const result = cache.getMany(['a', 'b'], { model: 'm' });
    expect(result.report.hitCount).toBe(2);
  });

  it('written entries are hits for a subsequent getOrCreate, which never calls embed for them', async () => {
    cache.setMany([{ text: 'preseeded', model: 'm', embedding: deterministicVector('preseeded') }]);
    let called = false;
    await cache.getOrCreate(['preseeded'], {
      model: 'm',
      embed: (request) => {
        called = true;
        return Promise.resolve(request.texts.map((text) => deterministicVector(text)));
      },
    });
    expect(called).toBe(false);
  });

  it('upserts: writing the same (namespace, model, text) twice overwrites, not duplicates', () => {
    cache.setMany([{ text: 'x', model: 'm', embedding: new Float32Array([1, 1, 1, 1]) }]);
    cache.setMany([{ text: 'x', model: 'm', embedding: new Float32Array([2, 2, 2, 2]) }]);
    expect(cache.stats().totalEntries).toBe(1);
    const result = cache.getMany(['x'], { model: 'm' });
    expect(Array.from(result.embeddings[0] as Float32Array)).toEqual([2, 2, 2, 2]);
  });

  it('rejects an empty embedding vector with INVALID_INPUT', () => {
    expect(() =>
      cache.setMany([{ text: 'x', model: 'm', embedding: new Float32Array([]) }]),
    ).toThrowError(/INVALID_INPUT|non-empty/);
  });

  it('rejects a non-finite value inside the embedding with INVALID_INPUT', () => {
    expect(() =>
      cache.setMany([{ text: 'x', model: 'm', embedding: [1, Number.NaN, 3] }]),
    ).toThrow();
  });

  it('rejects a non-numeric value inside the embedding with INVALID_INPUT', () => {
    expect(() =>
      cache.setMany([
        { text: 'x', model: 'm', embedding: [1, 'not-a-number' as unknown as number, 3] },
      ]),
    ).toThrowError(expect.objectContaining({ code: 'INVALID_INPUT' }));
  });

  it('rejects null/undefined passed as the embedding with INVALID_INPUT', () => {
    expect(() =>
      cache.setMany([{ text: 'x', model: 'm', embedding: null as unknown as number[] }]),
    ).toThrowError(expect.objectContaining({ code: 'INVALID_INPUT' }));
  });

  it('rejects a finite value outside float32 range with INVALID_INPUT (default vectorEncoding: "float32") — it would become Infinity on write, not just lose precision', () => {
    expect(() => cache.setMany([{ text: 'x', model: 'm', embedding: [1, 1e39, 3] }])).toThrowError(
      expect.objectContaining({ code: 'INVALID_INPUT' }),
    );
    expect(cache.stats().totalEntries).toBe(0);
  });

  it('accepts the same out-of-float32-range value with vectorEncoding: "float64", and reads it back unchanged', () => {
    const wideDb = createTempDatabase();
    const wideCache = new VectorCache({ path: wideDb.databasePath, vectorEncoding: 'float64' });
    try {
      wideCache.setMany([{ text: 'x', model: 'm', embedding: [1, 1e39, 3] }]);
      const result = wideCache.getMany(['x'], { model: 'm' });
      expect(Array.from(result.embeddings[0] as Float64Array)).toEqual([1, 1e39, 3]);
    } finally {
      wideCache.close();
      wideDb.cleanup();
    }
  });

  it('rejects an empty model with INVALID_INPUT', () => {
    expect(() => cache.setMany([{ text: 'x', model: '', embedding: [1, 2] }])).toThrow();
  });

  it('plaintext storage is off by default: no text_value is persisted', () => {
    cache.setMany([
      {
        text: 'sensitive content',
        model: 'm',
        embedding: deterministicVector('sensitive content'),
      },
    ]);
    cache.close();

    const rawStore = createBetterSqliteStore({ path: db.databasePath });
    try {
      const key = computeCacheKey('default', 'm', 'sensitive content');
      const [row] = rawStore.getMany([key], Date.now());
      expect(row?.textValue).toBeUndefined();
    } finally {
      rawStore.close();
    }
  });

  it('an explicit dimensions matching embedding.length is accepted and isolates the entry', () => {
    cache.setMany([
      { text: 'x', model: 'm', embedding: new Float32Array([1, 2, 3, 4]), dimensions: 4 },
    ]);
    expect(cache.getMany(['x'], { model: 'm', dimensions: 4 }).report.hitCount).toBe(1);
    expect(cache.getMany(['x'], { model: 'm' }).report.hitCount).toBe(0); // different key: no dimensions requested
  });

  it('rejects an explicit dimensions that disagrees with embedding.length, with INVALID_INPUT', () => {
    expect(() =>
      cache.setMany([
        { text: 'x', model: 'm', embedding: new Float32Array([1, 2, 3, 4]), dimensions: 8 },
      ]),
    ).toThrowError(expect.objectContaining({ code: 'INVALID_INPUT' }));
    expect(cache.stats().totalEntries).toBe(0);
  });

  it('storeText: true persists the exact text', () => {
    const textCache = new VectorCache({ path: db.file('with-text.sqlite'), storeText: true });
    textCache.setMany([
      {
        text: 'sensitive content',
        model: 'm',
        embedding: deterministicVector('sensitive content'),
      },
    ]);
    textCache.close();

    const rawStore = createBetterSqliteStore({ path: db.file('with-text.sqlite') });
    try {
      const key = computeCacheKey('default', 'm', 'sensitive content');
      const [row] = rawStore.getMany([key], Date.now());
      expect(row?.textValue).toBe('sensitive content');
    } finally {
      rawStore.close();
    }
  });
});

describe('VectorCache.deleteMany', () => {
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

  it('returns 0 for an empty array', () => {
    expect(cache.deleteMany([], { model: 'm' })).toBe(0);
  });

  it('deletes entries and they subsequently miss', () => {
    cache.setMany([
      { text: 'a', model: 'm', embedding: deterministicVector('a') },
      { text: 'b', model: 'm', embedding: deterministicVector('b') },
    ]);
    const deleted = cache.deleteMany(['a'], { model: 'm' });
    expect(deleted).toBe(1);
    expect(cache.getMany(['a'], { model: 'm' }).report.hitCount).toBe(0);
    expect(cache.getMany(['b'], { model: 'm' }).report.hitCount).toBe(1);
  });

  it('deduplicates repeated texts before deleting, still returns the true row count deleted', () => {
    cache.setMany([{ text: 'a', model: 'm', embedding: deterministicVector('a') }]);
    const deleted = cache.deleteMany(['a', 'a', 'a'], { model: 'm' });
    expect(deleted).toBe(1);
  });

  it('deleting a non-existent text is a no-op that returns 0', () => {
    expect(cache.deleteMany(['never-written'], { model: 'm' })).toBe(0);
  });

  it('only deletes within the given (namespace, model) identity — never mixes across models', () => {
    cache.setMany([
      { text: 'shared', model: 'model-a', embedding: deterministicVector('shared') },
      { text: 'shared', model: 'model-b', embedding: deterministicVector('shared') },
    ]);
    cache.deleteMany(['shared'], { model: 'model-a' });
    expect(cache.getMany(['shared'], { model: 'model-a' }).report.hitCount).toBe(0);
    expect(cache.getMany(['shared'], { model: 'model-b' }).report.hitCount).toBe(1);
  });
});
