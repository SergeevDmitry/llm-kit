/**
 * `close()` lifecycle, including the edge case "close() called during an
 * active operation" (deliverables list).
 */
import { createTempDatabase, type TempDatabase } from '@llm-kit/test-utils';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { VectorCache } from '../src/index.js';
import { createControlledEmbed, deterministicVector } from './helpers.js';

describe('VectorCache.close', () => {
  let db: TempDatabase;

  beforeEach(() => {
    db = createTempDatabase();
  });

  afterEach(() => {
    db.cleanup();
  });

  it('is idempotent — calling it twice does not throw', () => {
    const cache = new VectorCache({ path: db.databasePath });
    expect(() => {
      cache.close();
      cache.close();
    }).not.toThrow();
  });

  it('every method throws STORE_CLOSED after close()', async () => {
    const cache = new VectorCache({ path: db.databasePath });
    cache.close();

    await expect(
      cache.getOrCreate(['a'], { model: 'm', embed: () => Promise.resolve([]) }),
    ).rejects.toMatchObject({ code: 'STORE_CLOSED' });
    expect(() => cache.getMany(['a'], { model: 'm' })).toThrowError(
      expect.objectContaining({ code: 'STORE_CLOSED' }),
    );
    expect(() => cache.setMany([{ text: 'a', model: 'm', embedding: [1] }])).toThrowError(
      expect.objectContaining({ code: 'STORE_CLOSED' }),
    );
    expect(() => cache.deleteMany(['a'], { model: 'm' })).toThrowError(
      expect.objectContaining({ code: 'STORE_CLOSED' }),
    );
    expect(() => cache.prune()).toThrowError(expect.objectContaining({ code: 'STORE_CLOSED' }));
    expect(() => cache.stats()).toThrowError(expect.objectContaining({ code: 'STORE_CLOSED' }));
    expect(() => cache.clear()).toThrowError(expect.objectContaining({ code: 'STORE_CLOSED' }));
  });

  it('close() while a getOrCreate() call is awaiting embed rejects that call with STORE_CLOSED, cleanly', async () => {
    const cache = new VectorCache({ path: db.databasePath });
    const controlled = createControlledEmbed();

    const pending = cache.getOrCreate(['in-flight'], { model: 'm', embed: controlled.embed });
    // Let the call reach its embed await point before closing.
    await Promise.resolve();
    await Promise.resolve();

    cache.close();
    controlled.release();

    await expect(pending).rejects.toMatchObject({ code: 'STORE_CLOSED' });
  });

  it('a fresh VectorCache reopened on the same path after close() sees previously written data', () => {
    const first = new VectorCache({ path: db.databasePath });
    first.setMany([{ text: 'x', model: 'm', embedding: deterministicVector('x') }]);
    first.close();

    const second = new VectorCache({ path: db.databasePath });
    try {
      expect(second.getMany(['x'], { model: 'm' }).report.hitCount).toBe(1);
    } finally {
      second.close();
    }
  });
});
