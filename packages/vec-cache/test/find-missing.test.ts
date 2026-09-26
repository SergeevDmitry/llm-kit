import { createFakeClock, createTempDatabase, type TempDatabase } from '@llm-kit/test-utils';
import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { VectorCache } from '../src/index.js';
import { createCountingEmbed, deterministicVector } from './helpers.js';

describe('VectorCache.findMissing', () => {
  let db: TempDatabase;
  let clock: ReturnType<typeof createFakeClock>;
  let cache: VectorCache;

  beforeEach(() => {
    db = createTempDatabase();
    clock = createFakeClock();
    cache = new VectorCache({ path: db.databasePath, now: clock.nowFn });
  });

  afterEach(() => {
    cache.close();
    db.cleanup();
  });

  it('returns each distinct miss once, in first-occurrence order, and never a hit', () => {
    cache.setMany([{ text: 'cached', model: 'm', embedding: deterministicVector('cached') }]);
    expect(cache.findMissing(['b', 'cached', 'a', 'b', 'cached', 'a'], { model: 'm' })).toEqual([
      'b',
      'a',
    ]);
  });

  it('returns an empty array for an empty batch and for a full hit', () => {
    cache.setMany([{ text: 'x', model: 'm', embedding: deterministicVector('x') }]);
    expect(cache.findMissing([], { model: 'm' })).toEqual([]);
    expect(cache.findMissing(['x', 'x'], { model: 'm' })).toEqual([]);
  });

  it('reports an expired entry as missing', () => {
    cache.setMany([{ text: 'x', model: 'm', embedding: deterministicVector('x'), ttlMs: 100 }]);
    expect(cache.findMissing(['x'], { model: 'm' })).toEqual([]);
    clock.advance(100);
    expect(cache.findMissing(['x'], { model: 'm' })).toEqual(['x']);
  });

  it('keys on model, namespace and an explicit dimensions request like getMany', () => {
    cache.setMany([
      { text: 'x', model: 'm', embedding: deterministicVector('x', 4), dimensions: 4 },
    ]);
    expect(cache.findMissing(['x'], { model: 'm', dimensions: 4 })).toEqual([]);
    expect(cache.findMissing(['x'], { model: 'm', dimensions: 8 })).toEqual(['x']);
    expect(cache.findMissing(['x'], { model: 'other', dimensions: 4 })).toEqual(['x']);
    expect(cache.findMissing(['x'], { model: 'm', dimensions: 4, namespace: 'other' })).toEqual([
      'x',
    ]);
  });

  it('reports a hit demoted for a dimension mismatch as missing', () => {
    cache.setMany([
      { text: 'four-dim', model: 'm', embedding: deterministicVector('four-dim', 4) },
      { text: 'eight-dim', model: 'm', embedding: deterministicVector('eight-dim', 8) },
    ]);
    expect(cache.findMissing(['four-dim', 'eight-dim'], { model: 'm' })).toEqual(['eight-dim']);
  });

  it('names exactly the texts getOrCreate then sends to embed', async () => {
    cache.setMany([
      { text: 'fresh', model: 'm', embedding: deterministicVector('fresh', 4) },
      { text: 'expiring', model: 'm', embedding: deterministicVector('expiring', 4), ttlMs: 10 },
      { text: 'too-wide', model: 'm', embedding: deterministicVector('too-wide', 8) },
    ]);
    clock.advance(10);
    const texts = ['fresh', 'new-1', 'expiring', 'too-wide', 'new-1', 'new-2', 'fresh'];

    const missing = cache.findMissing(texts, { model: 'm' });
    const counting = createCountingEmbed(4);
    await cache.getOrCreate(texts, { model: 'm', embed: counting.embed });

    expect(missing).toEqual(['new-1', 'expiring', 'too-wide', 'new-2']);
    expect(counting.allTexts()).toEqual(missing);
  });

  it('handles a batch larger than one IN-clause chunk', () => {
    const cached = Array.from({ length: 1_200 }, (_, i) => `cached-${String(i)}`);
    cache.setMany(cached.map((text) => ({ text, model: 'm', embedding: [1, 2] })));
    expect(cache.findMissing([...cached, 'new'], { model: 'm' })).toEqual(['new']);
  });

  it('never selects the vector column', () => {
    cache.setMany([{ text: 'x', model: 'm', embedding: deterministicVector('x') }]);
    const prepareSpy = vi.spyOn(Database.prototype, 'prepare');
    try {
      cache.findMissing(['x', 'y'], { model: 'm' });
      const sql = prepareSpy.mock.calls.map(([source]) => source);
      expect(sql.length).toBeGreaterThan(0);
      for (const source of sql) expect(source).not.toContain('vector_blob');
    } finally {
      prepareSpy.mockRestore();
    }
  });

  it('rejects invalid input with INVALID_INPUT', () => {
    expect(() => cache.findMissing(['a', 42 as unknown as string], { model: 'm' })).toThrowError(
      expect.objectContaining({ code: 'INVALID_INPUT' }),
    );
    expect(() => cache.findMissing(['a'], { model: '' })).toThrowError(
      expect.objectContaining({ code: 'INVALID_INPUT' }),
    );
    expect(() => cache.findMissing(['a'], { model: 'm', namespace: '' })).toThrowError(
      expect.objectContaining({ code: 'INVALID_INPUT' }),
    );
  });
});
