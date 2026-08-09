import { createFakeClock, createTempDatabase, type TempDatabase } from '@llm-kit/test-utils';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { VectorCache, VectorCacheError } from '../src/index.js';
import { createControlledEmbed, createCountingEmbed, deterministicVector } from './helpers.js';

describe('VectorCache.getOrCreate', () => {
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

  it('a full-hit batch never calls the embedding callback', async () => {
    const seed = createCountingEmbed();
    await cache.getOrCreate(['x', 'y'], { model: 'm', embed: seed.embed });
    expect(seed.callCount()).toBe(1);

    const rerun = createCountingEmbed();
    const result = await cache.getOrCreate(['x', 'y'], { model: 'm', embed: rerun.embed });
    expect(rerun.callCount()).toBe(0);
    expect(result.report.hitCount).toBe(2);
    expect(result.report.missCount).toBe(0);
    expect(result.report.embedCallCount).toBe(0);
  });

  it('the headline scenario: 1,000 inputs, 940 cached, 60 unique misses sent', async () => {
    const cachedTexts = Array.from({ length: 940 }, (_, i) => `cached-${String(i)}`);
    const missTexts = Array.from({ length: 60 }, (_, i) => `fresh-${String(i)}`);

    cache.setMany(
      cachedTexts.map((text) => ({
        text,
        model: 'embed-model',
        embedding: deterministicVector(text),
      })),
    );

    const texts = [...cachedTexts, ...missTexts];
    const counting = createCountingEmbed();
    const result = await cache.getOrCreate(texts, { model: 'embed-model', embed: counting.embed });

    expect(result.report.totalCount).toBe(1000);
    expect(result.report.hitCount).toBe(940);
    expect(result.report.missCount).toBe(60);
    expect(result.report.uniqueMissCount).toBe(60);
    expect(counting.callCount()).toBe(1);
    expect(counting.allTexts()).toEqual(missTexts);

    texts.forEach((text, index) => {
      expect(Array.from(result.embeddings[index] as Float32Array)).toEqual(
        Array.from(deterministicVector(text)),
      );
    });
  });

  it('deduplicates repeated texts within a batch: embed sees each unique miss exactly once, in first-occurrence order', async () => {
    const counting = createCountingEmbed();
    const texts = ['b', 'a', 'b', 'c', 'a', 'a'];
    const result = await cache.getOrCreate(texts, { model: 'm', embed: counting.embed });

    expect(counting.callCount()).toBe(1);
    expect(counting.allTexts()).toEqual(['b', 'a', 'c']);
    expect(result.report.missCount).toBe(6);
    expect(result.report.uniqueMissCount).toBe(3);

    texts.forEach((text, index) => {
      expect(Array.from(result.embeddings[index] as Float32Array)).toEqual(
        Array.from(deterministicVector(text)),
      );
    });
  });

  it('reconstructs exact original order for a mix of hits, misses and duplicates', async () => {
    cache.setMany([
      { text: 'hit-1', model: 'm', embedding: deterministicVector('hit-1') },
      { text: 'hit-2', model: 'm', embedding: deterministicVector('hit-2') },
    ]);
    const texts = ['miss-a', 'hit-1', 'miss-b', 'hit-1', 'hit-2', 'miss-a', 'miss-c'];
    const counting = createCountingEmbed();
    const result = await cache.getOrCreate(texts, { model: 'm', embed: counting.embed });

    expect(result.embeddings).toHaveLength(texts.length);
    texts.forEach((text, index) => {
      expect(Array.from(result.embeddings[index] as Float32Array)).toEqual(
        Array.from(deterministicVector(text)),
      );
    });
    expect(result.report.hitCount).toBe(3); // hit-1, hit-1, hit-2
    expect(result.report.missCount).toBe(4); // miss-a, miss-b, miss-a, miss-c
    expect(result.report.uniqueMissCount).toBe(3); // miss-a, miss-b, miss-c
  });

  it('returns immediately for an empty batch without calling embed', async () => {
    const counting = createCountingEmbed();
    const result = await cache.getOrCreate([], { model: 'm', embed: counting.embed });
    expect(result.embeddings).toEqual([]);
    expect(result.report).toMatchObject({
      totalCount: 0,
      hitCount: 0,
      missCount: 0,
      uniqueMissCount: 0,
      embedCallCount: 0,
    });
    expect(counting.callCount()).toBe(0);
  });

  it('treats "a", "a " and "a\\n" as three distinct cache entries', async () => {
    const counting = createCountingEmbed();
    await cache.getOrCreate(['a', 'a ', 'a\n'], { model: 'm', embed: counting.embed });
    expect(counting.callCount()).toBe(1);
    expect(counting.allTexts()).toEqual(['a', 'a ', 'a\n']);

    const rerun = createCountingEmbed();
    const result = await cache.getOrCreate(['a', 'a ', 'a\n'], { model: 'm', embed: rerun.embed });
    expect(rerun.callCount()).toBe(0);
    expect(result.report.hitCount).toBe(3);
  });

  it('isolates identical text across models', async () => {
    const first = createCountingEmbed();
    await cache.getOrCreate(['shared text'], { model: 'model-a', embed: first.embed });
    expect(first.callCount()).toBe(1);

    const second = createCountingEmbed();
    const result = await cache.getOrCreate(['shared text'], {
      model: 'model-b',
      embed: second.embed,
    });
    expect(second.callCount()).toBe(1); // model-b has never seen this text
    expect(result.report.hitCount).toBe(0);
  });

  it('isolates identical text across namespaces', async () => {
    const nsA = new VectorCache({ path: db.databasePath, namespace: 'tenant-a' });
    const nsB = new VectorCache({ path: db.databasePath, namespace: 'tenant-b' });
    try {
      const first = createCountingEmbed();
      await nsA.getOrCreate(['shared text'], { model: 'm', embed: first.embed });
      expect(first.callCount()).toBe(1);

      const second = createCountingEmbed();
      const result = await nsB.getOrCreate(['shared text'], { model: 'm', embed: second.embed });
      expect(second.callCount()).toBe(1);
      expect(result.report.hitCount).toBe(0);
    } finally {
      nsA.close();
      nsB.close();
    }
  });

  it('a per-call namespace override reaches an isolated partition, independent of the instance default', async () => {
    const first = createCountingEmbed();
    await cache.getOrCreate(['shared text'], {
      model: 'm',
      namespace: 'override-ns',
      embed: first.embed,
    });

    const second = createCountingEmbed();
    const result = await cache.getOrCreate(['shared text'], { model: 'm', embed: second.embed });
    expect(second.callCount()).toBe(1); // default namespace never saw this text
    expect(result.report.hitCount).toBe(0);
  });

  it('throws EMBED_RESULT_COUNT_MISMATCH with no guessed mapping when embed returns the wrong count', async () => {
    const badEmbed = () => Promise.resolve([deterministicVector('only-one')]);
    let caught: unknown;
    try {
      await cache.getOrCreate(['a', 'b', 'c'], { model: 'm', embed: badEmbed });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(VectorCacheError);
    expect((caught as VectorCacheError).code).toBe('EMBED_RESULT_COUNT_MISMATCH');

    // Nothing was written for any of the misses — a failed batch writes nothing.
    const followUp = createCountingEmbed();
    await cache.getOrCreate(['a', 'b', 'c'], { model: 'm', embed: followUp.embed });
    expect(followUp.callCount()).toBe(1);
    expect(followUp.allTexts()).toEqual(['a', 'b', 'c']);
  });

  it('throws EMBED_DIMENSION_MISMATCH (a stable, distinct code) when returned vectors have inconsistent dimensions', async () => {
    const badEmbed = () => Promise.resolve([new Float32Array([1, 2, 3]), new Float32Array([1, 2])]);
    let caught: unknown;
    try {
      await cache.getOrCreate(['a', 'b'], { model: 'm', embed: badEmbed });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(VectorCacheError);
    expect((caught as VectorCacheError).code).toBe('EMBED_DIMENSION_MISMATCH');
    expect((caught as VectorCacheError).code).not.toBe('EMBED_RESULT_COUNT_MISMATCH');
  });

  it('throws EMBED_DIMENSION_MISMATCH for an empty vector', async () => {
    const badEmbed = () => Promise.resolve([new Float32Array([])]);
    await expect(cache.getOrCreate(['a'], { model: 'm', embed: badEmbed })).rejects.toMatchObject({
      code: 'EMBED_DIMENSION_MISMATCH',
    });
  });

  describe('a poisoned embed result is rejected, never written to disk', () => {
    // These four shapes would otherwise be silently written and decoded back
    // as-is: `encodeVector`'s `Buffer.writeFloatLE` coerces a
    // NaN/Infinity/non-number element without complaint, so a poisoned
    // vector would become a permanent, silent cache hit. `setMany` already
    // rejects all four via `validateVector`; this covers the `embed`-callback
    // path the same way.
    it.each([
      ['a NaN element', [1, Number.NaN, 3]],
      ['an Infinity element', [1, Number.POSITIVE_INFINITY, 3]],
      ['a non-numeric string element', ['x', 2, 3] as unknown as number[]],
      [
        'an undefined element (sparse-array-shaped input)',
        [1, undefined, 3] as unknown as number[],
      ],
    ])(
      'rejects a vector with %s as EMBED_RESULT_INVALID, before writing anything',
      async (_label, vector) => {
        const badEmbed = () => Promise.resolve([vector]);
        let caught: unknown;
        try {
          await cache.getOrCreate(['poison'], { model: 'm', embed: badEmbed });
        } catch (error) {
          caught = error;
        }
        expect(caught).toBeInstanceOf(VectorCacheError);
        expect((caught as VectorCacheError).code).toBe('EMBED_RESULT_INVALID');
        expect((caught as VectorCacheError).code).not.toBe('INVALID_INPUT');

        // Nothing was persisted — a subsequent call still misses and can
        // still call embed for the same text.
        const followUp = createCountingEmbed();
        await cache.getOrCreate(['poison'], { model: 'm', embed: followUp.embed });
        expect(followUp.callCount()).toBe(1);
      },
    );

    it('rejects the whole batch if only one of several vectors is poisoned — nothing from the batch is written', async () => {
      const badEmbed = () =>
        Promise.resolve([new Float32Array([1, 2, 3]), [1, Number.NaN, 3] as unknown as number[]]);
      await expect(
        cache.getOrCreate(['good', 'poisoned'], { model: 'm', embed: badEmbed }),
      ).rejects.toMatchObject({ code: 'EMBED_RESULT_INVALID' });

      const lookup = cache.getMany(['good', 'poisoned'], { model: 'm' });
      expect(lookup.report.hitCount).toBe(0);
    });
  });

  describe('an out-of-float32-range element is rejected, not silently turned into Infinity', () => {
    // `validateVector` proves every element finite, but a finite float64
    // element with |x| > ~3.4028235e38 becomes `Infinity` once narrowed to
    // float32 (`Buffer.writeFloatLE` rounds it there silently) and decodes
    // back as `Infinity` on every future read — the exact "created a
    // non-finite value it did not receive" case this package already
    // refuses to do for a directly-supplied NaN/Infinity. This is the
    // default `vectorEncoding: 'float32'` cache, so the bound applies.
    it('rejects an embed result element beyond float32 range as EMBED_RESULT_INVALID, before writing anything', async () => {
      const badEmbed = () => Promise.resolve([[1, 1e39, 3]]);
      let caught: unknown;
      try {
        await cache.getOrCreate(['too-big'], { model: 'm', embed: badEmbed });
      } catch (error) {
        caught = error;
      }
      expect(caught).toBeInstanceOf(VectorCacheError);
      expect((caught as VectorCacheError).code).toBe('EMBED_RESULT_INVALID');

      // Nothing was persisted.
      const followUp = createCountingEmbed();
      await cache.getOrCreate(['too-big'], { model: 'm', embed: followUp.embed });
      expect(followUp.callCount()).toBe(1);
    });

    it('accepts the same value under vectorEncoding: "float64", and it round-trips exactly (the documented remedy actually works)', async () => {
      const wideDb = createTempDatabase();
      const wideCache = new VectorCache({ path: wideDb.databasePath, vectorEncoding: 'float64' });
      try {
        const embed = () => Promise.resolve([[1, 1e39, 3]]);
        const result = await wideCache.getOrCreate(['too-big'], { model: 'm', embed });
        expect(Array.from(result.embeddings[0] as Float64Array)).toEqual([1, 1e39, 3]);

        const lookup = wideCache.getMany(['too-big'], { model: 'm' });
        expect(Array.from(lookup.embeddings[0] as Float64Array)).toEqual([1, 1e39, 3]);
      } finally {
        wideCache.close();
        wideDb.cleanup();
      }
    });
  });

  it('rejects non-string entries in texts with INVALID_INPUT, before calling embed', async () => {
    const counting = createCountingEmbed();
    const texts = ['a', 42 as unknown as string];
    await expect(
      cache.getOrCreate(texts, { model: 'm', embed: counting.embed }),
    ).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    expect(counting.callCount()).toBe(0);
  });

  it('rejects an empty model string with INVALID_INPUT', async () => {
    const counting = createCountingEmbed();
    await expect(
      cache.getOrCreate(['a'], { model: '', embed: counting.embed }),
    ).rejects.toMatchObject({ code: 'INVALID_INPUT' });
  });

  it('rejects an empty-string namespace override with INVALID_INPUT', async () => {
    const counting = createCountingEmbed();
    await expect(
      cache.getOrCreate(['a'], { model: 'm', namespace: '', embed: counting.embed }),
    ).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    expect(counting.callCount()).toBe(0);
  });

  it('applies a per-call ttlMs override so entries expire and become misses again', async () => {
    const clock = createFakeClock();
    const ttlCache = new VectorCache({ path: db.file('ttl.sqlite'), now: clock.nowFn });
    try {
      const counting = createCountingEmbed();
      await ttlCache.getOrCreate(['short-lived'], {
        model: 'm',
        embed: counting.embed,
        ttlMs: 1000,
      });
      expect(counting.callCount()).toBe(1);

      clock.advance(500);
      const stillCached = createCountingEmbed();
      const hitResult = await ttlCache.getOrCreate(['short-lived'], {
        model: 'm',
        embed: stillCached.embed,
      });
      expect(stillCached.callCount()).toBe(0);
      expect(hitResult.report.hitCount).toBe(1);

      clock.advance(600); // total 1100ms > 1000ms ttl
      const expired = createCountingEmbed();
      const missResult = await ttlCache.getOrCreate(['short-lived'], {
        model: 'm',
        embed: expired.embed,
      });
      expect(expired.callCount()).toBe(1);
      expect(missResult.report.hitCount).toBe(0);
    } finally {
      ttlCache.close();
    }
  });

  it('an already-aborted signal rejects immediately without calling embed', async () => {
    const controller = new AbortController();
    controller.abort();
    const counting = createCountingEmbed();
    await expect(
      cache.getOrCreate(['a'], { model: 'm', embed: counting.embed, signal: controller.signal }),
    ).rejects.toThrow();
    expect(counting.callCount()).toBe(0);
  });

  describe('dimensions as identity and defensive re-embed', () => {
    it('an explicit dimensions value isolates the same text/model like a different model would', async () => {
      const wide = createCountingEmbed(1536);
      await cache.getOrCreate(['shared'], { model: 'm', dimensions: 1536, embed: wide.embed });
      expect(wide.callCount()).toBe(1);

      const narrow = createCountingEmbed(512);
      const result = await cache.getOrCreate(['shared'], {
        model: 'm',
        dimensions: 512,
        embed: narrow.embed,
      });
      expect(narrow.callCount()).toBe(1); // never hit the 1536-dim entry
      expect(result.report.hitCount).toBe(0);
      expect(result.report.dimensionMismatches).toEqual([]); // distinct keys, not a mismatch
    });

    it('the Monday/Tuesday scenario: switching requested dimensions without callers ever setting it demotes the old hit to a miss, not a wrong-width return', async () => {
      // Monday: index at full width, without opting into `dimensions` at all
      // (today's default behavior).
      const wide = createCountingEmbed(1536);
      await cache.getOrCreate(['doc'], { model: 'text-embedding-3-small', embed: wide.embed });
      expect(wide.callCount()).toBe(1);

      // Tuesday: someone switches to truncated vectors and, this time, names
      // the width explicitly.
      const narrow = createCountingEmbed(512);
      const result = await cache.getOrCreate(['doc'], {
        model: 'text-embedding-3-small',
        dimensions: 512,
        embed: narrow.embed,
      });
      expect(narrow.callCount()).toBe(1); // re-embedded, not silently served at 1536
      expect(result.report.hitCount).toBe(0);
      expect(result.embeddings[0]).toHaveLength(512);
    });

    it('without an explicit dimensions option, a hit whose stored width disagrees with another hit in the same batch is demoted and reported', async () => {
      cache.setMany([
        { text: 'four-dim', model: 'm', embedding: new Float32Array([1, 2, 3, 4]) },
        { text: 'eight-dim', model: 'm', embedding: new Float32Array([1, 2, 3, 4, 5, 6, 7, 8]) },
      ]);
      const counting = createCountingEmbed(4);
      const result = await cache.getOrCreate(['four-dim', 'eight-dim'], {
        model: 'm',
        embed: counting.embed,
      });

      // "four-dim" is first in the batch, so it sets the reference and stays
      // a hit; "eight-dim" disagrees and is demoted to a miss and re-embedded.
      expect(result.report.hitCount).toBe(1);
      expect(result.report.missCount).toBe(1);
      expect(counting.allTexts()).toEqual(['eight-dim']);
      expect(result.report.dimensionMismatches).toHaveLength(1);
      expect(result.report.dimensionMismatches[0]).toMatchObject({
        expectedDimensions: 4,
        actualDimensions: 8,
      });
    });

    it('report.dimensionMismatches is JSON-serializable, including a non-empty diagnostic', async () => {
      cache.setMany([
        { text: 'four-dim', model: 'm', embedding: new Float32Array([1, 2, 3, 4]) },
        { text: 'eight-dim', model: 'm', embedding: new Float32Array([1, 2, 3, 4, 5, 6, 7, 8]) },
      ]);
      const result = await cache.getOrCreate(['four-dim', 'eight-dim'], {
        model: 'm',
        embed: createCountingEmbed(4).embed,
      });
      expect(result.report.dimensionMismatches.length).toBeGreaterThan(0);
      expect(() => JSON.stringify(result.report)).not.toThrow();
      expect(JSON.parse(JSON.stringify(result.report))).toEqual(result.report);
    });
  });

  describe('a cached hit vs. a freshly embedded vector must agree on width', () => {
    it('throws DIMENSION_IDENTITY_CONFLICT — the coordinator repro: primed at width 4, re-requested with a fresh embed at width 2 — and writes nothing', async () => {
      await cache.getOrCreate(['a', 'b'], {
        model: 'text-embedding-3-small',
        embed: () =>
          Promise.resolve([
            [1, 2, 3, 4],
            [1, 2, 3, 4],
          ]),
      });
      // 'a' and 'b' are now cached at width 4.

      let caught: unknown;
      try {
        await cache.getOrCreate(['a', 'b', 'c'], {
          model: 'text-embedding-3-small',
          embed: () => Promise.resolve([[9, 9]]), // width 2 for the sole miss 'c'
        });
      } catch (error) {
        caught = error;
      }
      expect(caught).toBeInstanceOf(VectorCacheError);
      expect((caught as VectorCacheError).code).toBe('DIMENSION_IDENTITY_CONFLICT');
      expect((caught as VectorCacheError).code).not.toBe('EMBED_DIMENSION_MISMATCH');
      // Names the actual widths and the model, and tells the caller how to get out.
      const message = (caught as VectorCacheError).message;
      expect(message).toContain('text-embedding-3-small');
      expect(message).toContain('4');
      expect(message).toContain('2');
      expect(message).toMatch(/dimensions/i);
      expect(message).toMatch(/namespace/i);

      // Nothing was written for 'c' — a subsequent, width-consistent call
      // still misses and can still populate the cache normally.
      const followUp = createCountingEmbed(4);
      const result = await cache.getOrCreate(['c'], {
        model: 'text-embedding-3-small',
        embed: followUp.embed,
      });
      expect(followUp.callCount()).toBe(1);
      expect(result.report.hitCount).toBe(0);

      // 'a' and 'b' were never touched by the failed call either — still
      // hits, still width 4.
      const stillCached = cache.getMany(['a', 'b'], { model: 'text-embedding-3-small' });
      expect(stillCached.report.hitCount).toBe(2);
      expect(stillCached.embeddings[0]).toHaveLength(4);
    });

    it('throws when a hit disagrees with a fresh miss even if the fresh miss is the only thing that changed', async () => {
      cache.setMany([
        { text: 'cached-wide', model: 'm', embedding: new Float32Array([1, 2, 3, 4]) },
      ]);
      const badEmbed = () => Promise.resolve([new Float32Array([9, 9])]); // width 2

      await expect(
        cache.getOrCreate(['cached-wide', 'brand-new'], { model: 'm', embed: badEmbed }),
      ).rejects.toMatchObject({ code: 'DIMENSION_IDENTITY_CONFLICT' });

      expect(cache.getMany(['brand-new'], { model: 'm' }).report.hitCount).toBe(0);
    });

    it('does not throw when the hit and the fresh embed agree on width', async () => {
      cache.setMany([{ text: 'cached', model: 'm', embedding: new Float32Array([1, 2, 3, 4]) }]);
      const result = await cache.getOrCreate(['cached', 'fresh'], {
        model: 'm',
        embed: () => Promise.resolve([new Float32Array([5, 6, 7, 8])]), // also width 4
      });
      expect(result.embeddings.map((v) => v.length)).toEqual([4, 4]);
    });

    it('an explicit dimensions request never triggers this conflict — mismatched widths get separate keys instead (round 1 handles it)', async () => {
      await cache.getOrCreate(['x'], {
        model: 'm',
        dimensions: 4,
        embed: () => Promise.resolve([[1, 2, 3, 4]]),
      });
      // Same text, different explicit width: a distinct key, not a conflict.
      const result = await cache.getOrCreate(['x'], {
        model: 'm',
        dimensions: 2,
        embed: () => Promise.resolve([[9, 9]]),
      });
      expect(result.embeddings[0]).toHaveLength(2);
      expect(result.report.hitCount).toBe(0);
    });

    it("deterministically throws for a concurrent joiner whose own hits disagree with the width it ends up receiving from someone else's in-flight fetch", async () => {
      // Pre-seed a hit this joiner's batch will carry, at width 8.
      cache.setMany([{ text: 'existing-hit', model: 'm', embedding: new Float32Array(8) }]);

      const controlled = createControlledEmbed(4); // the eventual winner returns width 4
      // Owner: claims the single-flight slot for "new-text" and will supply
      // whatever every joiner receives for it.
      const owner = cache.getOrCreate(['new-text'], { model: 'm', embed: controlled.embed });
      // Joiner: same missing key ("new-text"), plus its own unrelated hit at
      // a different width (8). Started immediately after the owner so it
      // reaches the single-flight registry after the owner has registered.
      const joiner = cache.getOrCreate(['existing-hit', 'new-text'], {
        model: 'm',
        embed: controlled.embed, // never actually invoked for this call — coalesced
      });

      // Let both calls reach the "need to embed" decision before releasing.
      await Promise.resolve();
      await Promise.resolve();
      expect(controlled.callCount()).toBe(1); // coalesced: exactly one embed call for "new-text"
      controlled.release();

      const ownerResult = await owner; // width 4 end-to-end, no conflicting hit — succeeds
      expect(ownerResult.embeddings[0]).toHaveLength(4);

      await expect(joiner).rejects.toMatchObject({ code: 'DIMENSION_IDENTITY_CONFLICT' });

      // Deterministic, not a race: rerunning the same shape fails the same way every time.
      const controlled2 = createControlledEmbed(4);
      const owner2 = cache.getOrCreate(['another-new-text'], {
        model: 'm',
        embed: controlled2.embed,
      });
      const joiner2 = cache.getOrCreate(['existing-hit', 'another-new-text'], {
        model: 'm',
        embed: controlled2.embed,
      });
      await Promise.resolve();
      await Promise.resolve();
      controlled2.release();
      await owner2;
      await expect(joiner2).rejects.toMatchObject({ code: 'DIMENSION_IDENTITY_CONFLICT' });
    });
  });
});
