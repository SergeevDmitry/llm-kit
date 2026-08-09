/**
 * In-process concurrent requests for the same key are coalesced into one
 * `embed` call. Pure unit tests for the registry, plus end-to-end tests
 * through `VectorCache.getOrCreate`.
 */
import { createTempDatabase, type TempDatabase } from '@llm-kit/test-utils';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { VectorCache } from '../src/index.js';
import { createSingleFlightRegistry } from '../src/single-flight.js';
import { createControlledEmbed, createCountingEmbed, deterministicVector } from './helpers.js';

describe('createSingleFlightRegistry (unit)', () => {
  it('returns the same promise for a key already in flight', () => {
    const registry = createSingleFlightRegistry<number>();
    let resolveFirst: (value: number) => void = () => {};
    const first = new Promise<number>((resolve) => {
      resolveFirst = resolve;
    });
    const tracked = registry.register('k', first);
    expect(registry.get('k')).toBe(tracked);
    resolveFirst(1);
  });

  it('removes the registration once the promise settles (success)', async () => {
    const registry = createSingleFlightRegistry<number>();
    const tracked = registry.register('k', Promise.resolve(1));
    expect(registry.size).toBe(1);
    await tracked;
    expect(registry.get('k')).toBeUndefined();
    expect(registry.size).toBe(0);
  });

  it('removes the registration once the promise settles (failure)', async () => {
    const registry = createSingleFlightRegistry<number>();
    const tracked = registry.register('k', Promise.reject(new Error('boom')));
    await expect(tracked).rejects.toThrow('boom');
    expect(registry.get('k')).toBeUndefined();
  });

  it('a later registration for the same key after settlement starts fresh', async () => {
    const registry = createSingleFlightRegistry<number>();
    await registry.register('k', Promise.resolve(1));
    const second = registry.register('k', Promise.resolve(2));
    expect(await second).toBe(2);
  });
});

describe('VectorCache single-flight (end-to-end)', () => {
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

  it('concurrent getOrCreate calls for the same identical batch coalesce into one embed call', async () => {
    const controlled = createControlledEmbed();
    const first = cache.getOrCreate(['shared'], { model: 'm', embed: controlled.embed });
    const second = cache.getOrCreate(['shared'], { model: 'm', embed: controlled.embed });

    // Give both calls a chance to reach the "need to embed" decision before releasing.
    await Promise.resolve();
    await Promise.resolve();
    expect(controlled.callCount()).toBe(1);
    controlled.release();

    const [a, b] = await Promise.all([first, second]);
    expect(Array.from(a.embeddings[0] as Float32Array)).toEqual(
      Array.from(deterministicVector('shared')),
    );
    expect(Array.from(b.embeddings[0] as Float32Array)).toEqual(
      Array.from(deterministicVector('shared')),
    );
    expect(controlled.callCount()).toBe(1);

    // The result was actually persisted once — a third call is a pure hit.
    const followUp = createCountingEmbed();
    const third = await cache.getOrCreate(['shared'], { model: 'm', embed: followUp.embed });
    expect(followUp.callCount()).toBe(0);
    expect(third.report.hitCount).toBe(1);
  });

  it('overlapping-but-different batches each own their exclusive keys and share the overlap', async () => {
    const controlled = createControlledEmbed();
    const first = cache.getOrCreate(['a', 'shared'], { model: 'm', embed: controlled.embed });
    const second = cache.getOrCreate(['shared', 'c'], { model: 'm', embed: controlled.embed });

    await Promise.resolve();
    await Promise.resolve();
    // Both calls own an exclusive key ("a" and "c"), so each makes its own
    // embed call — but only once each, never twice for "shared".
    expect(controlled.callCount()).toBe(2);
    controlled.release();

    const [a, b] = await Promise.all([first, second]);
    expect(Array.from(a.embeddings[1] as Float32Array)).toEqual(
      Array.from(deterministicVector('shared')),
    );
    expect(Array.from(b.embeddings[0] as Float32Array)).toEqual(
      Array.from(deterministicVector('shared')),
    );
  });

  it('many concurrent requests for the same brand-new key result in exactly one embed call', async () => {
    const counting = createCountingEmbed();
    const results = await Promise.all(
      Array.from({ length: 10 }, () =>
        cache.getOrCreate(['popular'], { model: 'm', embed: counting.embed }),
      ),
    );
    expect(counting.callCount()).toBe(1);
    for (const result of results) {
      expect(Array.from(result.embeddings[0] as Float32Array)).toEqual(
        Array.from(deterministicVector('popular')),
      );
    }
  });
});
