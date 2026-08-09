import { createFakeClock, createTempDatabase, type TempDatabase } from '@llm-kit/test-utils';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { VectorCache } from '../src/index.js';
import { deterministicVector } from './helpers.js';

describe('VectorCache.prune', () => {
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

  it('removes only TTL-expired entries by default', () => {
    cache.setMany([
      { text: 'expiring', model: 'm', embedding: deterministicVector('expiring'), ttlMs: 100 },
      { text: 'permanent', model: 'm', embedding: deterministicVector('permanent') },
    ]);
    clock.advance(200);

    const report = cache.prune();
    expect(report.deletedCount).toBe(1);
    expect(cache.getMany(['expiring'], { model: 'm' }).report.hitCount).toBe(0);
    expect(cache.getMany(['permanent'], { model: 'm' }).report.hitCount).toBe(1);
  });

  it('does not remove anything before expiry', () => {
    cache.setMany([{ text: 'x', model: 'm', embedding: deterministicVector('x'), ttlMs: 1000 }]);
    clock.advance(500);
    expect(cache.prune().deletedCount).toBe(0);
  });

  it('olderThanMs additionally removes entries with no TTL past that age', () => {
    cache.setMany([{ text: 'old', model: 'm', embedding: deterministicVector('old') }]);
    clock.advance(10_000);
    cache.setMany([{ text: 'new', model: 'm', embedding: deterministicVector('new') }]);

    const report = cache.prune({ olderThanMs: 5_000 });
    expect(report.deletedCount).toBe(1);
    expect(cache.getMany(['old'], { model: 'm' }).report.hitCount).toBe(0);
    expect(cache.getMany(['new'], { model: 'm' }).report.hitCount).toBe(1);
  });

  it.each([
    ['negative', -1],
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
    ['-Infinity', Number.NEGATIVE_INFINITY],
    ['fractional', 1.5],
    ['a string', '100' as unknown as number],
    ['a boolean', true as unknown as number],
    ['an object', {} as unknown as number],
    ['unsafe-large', 2 ** 60],
  ])(
    'rejects olderThanMs that is %s with INVALID_INPUT and deletes nothing',
    (_label, olderThanMs) => {
      cache.setMany([
        { text: 'a', model: 'm', embedding: deterministicVector('a') },
        { text: 'b', model: 'm', embedding: deterministicVector('b') },
      ]);
      expect(cache.stats().totalEntries).toBe(2);

      expect(() => cache.prune({ olderThanMs })).toThrowError(
        expect.objectContaining({ code: 'INVALID_INPUT' }),
      );

      // The other half of the guarantee: "throws" alone is not enough — an
      // unvalidated negative olderThanMs computes a *future* cutoff and
      // deletes every row, so confirm nothing changed.
      expect(cache.stats().totalEntries).toBe(2);
      expect(cache.getMany(['a'], { model: 'm' }).report.hitCount).toBe(1);
      expect(cache.getMany(['b'], { model: 'm' }).report.hitCount).toBe(1);
    },
  );

  it('a negative olderThanMs (-1) is rejected rather than wiping the cache', () => {
    cache.setMany([
      { text: 'one', model: 'm', embedding: deterministicVector('one') },
      { text: 'two', model: 'm', embedding: deterministicVector('two') },
    ]);

    expect(() => cache.prune({ olderThanMs: -1 })).toThrowError(
      expect.objectContaining({ code: 'INVALID_INPUT' }),
    );
    expect(cache.stats().totalEntries).toBe(2);
  });

  it('accepts olderThanMs: 0 as a valid boundary (prune anything already created)', () => {
    cache.setMany([{ text: 'x', model: 'm', embedding: deterministicVector('x') }]);
    clock.advance(1);
    expect(cache.prune({ olderThanMs: 0 }).deletedCount).toBe(1);
  });

  it('restricts pruning to one namespace when given', () => {
    cache.setMany([
      { text: 'x', model: 'm', namespace: 'ns-a', embedding: deterministicVector('x'), ttlMs: 100 },
      // No TTL for ns-b: this entry must survive regardless of the clock
      // advance below — only its *presence in the wrong namespace scope*
      // would be a bug, not its own expiry.
      { text: 'x', model: 'm', namespace: 'ns-b', embedding: deterministicVector('x') },
    ]);
    clock.advance(200);

    const report = cache.prune({ namespace: 'ns-a' });
    expect(report.deletedCount).toBe(1);
    expect(cache.getMany(['x'], { model: 'm', namespace: 'ns-a' }).report.hitCount).toBe(0);
    expect(cache.getMany(['x'], { model: 'm', namespace: 'ns-b' }).report.hitCount).toBe(1);
  });

  describe('namespace scoping default', () => {
    let scopedDb: TempDatabase;
    let scopedCache: VectorCache;

    beforeEach(() => {
      scopedDb = createTempDatabase();
      scopedCache = new VectorCache({
        path: scopedDb.databasePath,
        namespace: 'tenant-a',
        now: clock.nowFn,
      });
      // No TTL on either entry — deliberately, so `getMany`'s own TTL-expiry
      // filter (`expires_at_ms IS NULL OR expires_at_ms > nowMs`) can never
      // explain a "miss" below; only `prune()`'s namespace scoping and
      // `olderThanMs` criteria can.
      scopedCache.setMany([
        { text: 'x', model: 'm', namespace: 'tenant-a', embedding: deterministicVector('x') },
        { text: 'y', model: 'm', namespace: 'tenant-b', embedding: deterministicVector('y') },
      ]);
    });

    afterEach(() => {
      scopedCache.close();
      scopedDb.cleanup();
    });

    it('with no options, prune() scopes to the instance own namespace, not the whole database', () => {
      clock.advance(10_000);

      const report = scopedCache.prune({ olderThanMs: 5_000 }); // no namespace: must resolve to 'tenant-a' only
      expect(report.deletedCount).toBe(1);
      expect(
        scopedCache.getMany(['x'], { model: 'm', namespace: 'tenant-a' }).report.hitCount,
      ).toBe(0);
      // tenant-b's equally-old row must survive — it is outside the instance's own scope.
      expect(
        scopedCache.getMany(['y'], { model: 'm', namespace: 'tenant-b' }).report.hitCount,
      ).toBe(1);
    });

    it('allNamespaces: true is the explicit escape hatch back to a database-wide prune', () => {
      clock.advance(10_000);

      const report = scopedCache.prune({ allNamespaces: true, olderThanMs: 5_000 });
      expect(report.deletedCount).toBe(2);
      expect(
        scopedCache.getMany(['x'], { model: 'm', namespace: 'tenant-a' }).report.hitCount,
      ).toBe(0);
      expect(
        scopedCache.getMany(['y'], { model: 'm', namespace: 'tenant-b' }).report.hitCount,
      ).toBe(0);
    });

    it('rejects namespace + allNamespaces: true together with INVALID_INPUT and deletes nothing', () => {
      clock.advance(10_000);

      expect(() =>
        scopedCache.prune({ namespace: 'tenant-a', allNamespaces: true, olderThanMs: 5_000 }),
      ).toThrowError(expect.objectContaining({ code: 'INVALID_INPUT' }));
      expect(scopedCache.stats().totalEntries).toBe(2);
    });
  });
});

describe('VectorCache.stats', () => {
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

  it('reports zero entries on a fresh database', () => {
    const stats = cache.stats();
    expect(stats.totalEntries).toBe(0);
    expect(stats.totalBytes).toBe(0);
    expect(stats.namespaces).toEqual([]);
    expect(stats.oldestEntryMs).toBeUndefined();
    expect(stats.newestEntryMs).toBeUndefined();
  });

  it('counts entries and bytes, broken down by namespace and model', () => {
    cache.setMany([
      { text: 'a', model: 'model-1', namespace: 'ns-a', embedding: deterministicVector('a') },
      { text: 'b', model: 'model-1', namespace: 'ns-a', embedding: deterministicVector('b') },
      { text: 'c', model: 'model-2', namespace: 'ns-b', embedding: deterministicVector('c') },
    ]);
    const stats = cache.stats();
    expect(stats.totalEntries).toBe(3);
    expect(stats.totalBytes).toBeGreaterThan(0);
    expect(stats.namespaces).toEqual(
      expect.arrayContaining([
        { namespace: 'ns-a', modelId: 'model-1', count: 2, bytes: expect.any(Number) },
        { namespace: 'ns-b', modelId: 'model-2', count: 1, bytes: expect.any(Number) },
      ]),
    );
  });
});

describe('VectorCache.clear', () => {
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

  it('with no options, clears only the instance own namespace, not every namespace', () => {
    cache.setMany([
      // Instance default namespace is "default" (no `namespace` given to the constructor).
      { text: 'a', model: 'm', embedding: deterministicVector('a') },
      { text: 'b', model: 'm', namespace: 'ns-b', embedding: deterministicVector('b') },
    ]);
    expect(cache.clear()).toBe(1);
    expect(cache.getMany(['a'], { model: 'm' }).report.hitCount).toBe(0);
    // ns-b is outside the instance's own scope and must survive an unqualified clear().
    expect(cache.getMany(['b'], { model: 'm', namespace: 'ns-b' }).report.hitCount).toBe(1);
  });

  it('allNamespaces: true is the explicit escape hatch for a database-wide clear', () => {
    cache.setMany([
      { text: 'a', model: 'm', embedding: deterministicVector('a') },
      { text: 'b', model: 'm', namespace: 'ns-b', embedding: deterministicVector('b') },
    ]);
    expect(cache.clear({ allNamespaces: true })).toBe(2);
    expect(cache.stats().totalEntries).toBe(0);
  });

  it('rejects namespace + allNamespaces: true together with INVALID_INPUT and deletes nothing', () => {
    cache.setMany([{ text: 'a', model: 'm', embedding: deterministicVector('a') }]);
    expect(() => cache.clear({ namespace: 'default', allNamespaces: true })).toThrowError(
      expect.objectContaining({ code: 'INVALID_INPUT' }),
    );
    expect(cache.stats().totalEntries).toBe(1);
  });

  it('clears only the given namespace when provided', () => {
    cache.setMany([
      { text: 'a', model: 'm', namespace: 'ns-a', embedding: deterministicVector('a') },
      { text: 'b', model: 'm', namespace: 'ns-b', embedding: deterministicVector('b') },
    ]);
    expect(cache.clear({ namespace: 'ns-a' })).toBe(1);
    expect(cache.getMany(['a'], { model: 'm', namespace: 'ns-a' }).report.hitCount).toBe(0);
    expect(cache.getMany(['b'], { model: 'm', namespace: 'ns-b' }).report.hitCount).toBe(1);
  });
});
