/**
 * `prune`'s `olderThanMs` is the most destructive case of an unvalidated
 * millisecond-duration option: a negative value computes a *future* cutoff
 * and deletes every row (see `test/prune-stats-clear.test.ts`). But the same
 * class of defect — a duration reaching arithmetic (`nowMs + ttlMs`) or a raw
 * SQL pragma string (`busyTimeoutMs`) with no validation — exists at every
 * other place a caller supplies one. This file sweeps every
 * `ttlMs`/`busyTimeoutMs` entry point, plus the `vectorEncoding` enum option
 * (an invalid value there reaches `Buffer.allocUnsafe(NaN)` and leaks a raw
 * Node `RangeError` instead of a stable `VectorCacheError`).
 */
import { createTempDatabase, type TempDatabase } from '@llm-kit/test-utils';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { VectorCache } from '../src/index.js';
import { deterministicVector } from './helpers.js';

const INVALID_DURATIONS: readonly [string, unknown][] = [
  ['negative', -1],
  ['NaN', Number.NaN],
  ['Infinity', Number.POSITIVE_INFINITY],
  ['-Infinity', Number.NEGATIVE_INFINITY],
  ['fractional', 1.5],
  ['a numeric string', '100'],
  ['a boolean', true],
  ['an object', {}],
  ['not a safe integer', 2 ** 60],
];

describe('VectorCacheOptions.busyTimeoutMs validation', () => {
  let db: TempDatabase;

  beforeEach(() => {
    db = createTempDatabase();
  });

  afterEach(() => {
    db.cleanup();
  });

  it.each(INVALID_DURATIONS)('rejects a busyTimeoutMs that is %s', (_label, busyTimeoutMs) => {
    expect(
      () => new VectorCache({ path: db.databasePath, busyTimeoutMs: busyTimeoutMs as never }),
    ).toThrowError(expect.objectContaining({ code: 'INVALID_INPUT' }));
  });

  it('accepts a valid busyTimeoutMs, including 0', () => {
    for (const value of [0, 1, 10_000]) {
      const cache = new VectorCache({
        path: db.file(`bt-${String(value)}.sqlite`),
        busyTimeoutMs: value,
      });
      cache.close();
    }
  });
});

describe('VectorCacheOptions.ttlMs validation (instance default)', () => {
  let db: TempDatabase;

  beforeEach(() => {
    db = createTempDatabase();
  });

  afterEach(() => {
    db.cleanup();
  });

  it.each(INVALID_DURATIONS)('rejects an instance-default ttlMs that is %s', (_label, ttlMs) => {
    expect(() => new VectorCache({ path: db.databasePath, ttlMs: ttlMs as never })).toThrowError(
      expect.objectContaining({ code: 'INVALID_INPUT' }),
    );
  });

  it('accepts a valid instance-default ttlMs, including 0', () => {
    for (const value of [0, 1, 60_000]) {
      const cache = new VectorCache({ path: db.file(`ttl-${String(value)}.sqlite`), ttlMs: value });
      cache.close();
    }
  });
});

describe('VectorCacheOptions.vectorEncoding validation', () => {
  let db: TempDatabase;

  beforeEach(() => {
    db = createTempDatabase();
  });

  afterEach(() => {
    db.cleanup();
  });

  it('rejects an unrecognized vectorEncoding with a stable INVALID_INPUT error, not a raw internal error', () => {
    expect(
      () => new VectorCache({ path: db.databasePath, vectorEncoding: 'bogus' as never }),
    ).toThrowError(expect.objectContaining({ code: 'INVALID_INPUT' }));
  });

  it('accepts both documented encodings', () => {
    for (const encoding of ['float32', 'float64'] as const) {
      const cache = new VectorCache({
        path: db.file(`enc-${encoding}.sqlite`),
        vectorEncoding: encoding,
      });
      cache.close();
    }
  });
});

describe('GetOrCreateOptions.ttlMs validation (per-call override)', () => {
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

  it.each(INVALID_DURATIONS)(
    'rejects a per-call ttlMs override that is %s, and writes nothing',
    async (_label, ttlMs) => {
      await expect(
        cache.getOrCreate(['a'], {
          model: 'm',
          ttlMs: ttlMs as never,
          embed: () => Promise.resolve([deterministicVector('a')]),
        }),
      ).rejects.toMatchObject({ code: 'INVALID_INPUT' });

      // Validation runs before planning/embedding — nothing was written.
      expect(cache.stats().totalEntries).toBe(0);
    },
  );

  it('a valid per-call ttlMs override still works', async () => {
    const result = await cache.getOrCreate(['a'], {
      model: 'm',
      ttlMs: 1000,
      embed: () => Promise.resolve([deterministicVector('a')]),
    });
    expect(result.report.hitCount).toBe(0);
    expect(cache.stats().totalEntries).toBe(1);
  });
});

describe('CacheWriteEntry.ttlMs validation (setMany, per entry)', () => {
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

  it.each(INVALID_DURATIONS)(
    'rejects a setMany entry.ttlMs that is %s, and writes nothing from that call',
    (_label, ttlMs) => {
      expect(() =>
        cache.setMany([
          { text: 'ok-before', model: 'm', embedding: deterministicVector('ok-before') },
          { text: 'bad', model: 'm', embedding: deterministicVector('bad'), ttlMs: ttlMs as never },
        ]),
      ).toThrowError(expect.objectContaining({ code: 'INVALID_INPUT' }));

      // Validation happens while building rows, before `putMany` runs — an
      // invalid entry anywhere in the batch means nothing in the batch is
      // written, including entries that validated fine on their own.
      expect(cache.stats().totalEntries).toBe(0);
    },
  );

  it('a valid entry.ttlMs still works, including 0', () => {
    cache.setMany([{ text: 'x', model: 'm', embedding: deterministicVector('x'), ttlMs: 0 }]);
    expect(cache.stats().totalEntries).toBe(1);
  });
});
