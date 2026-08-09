/**
 * Cancellation (repository convention: "any async operation that waits,
 * calls a user callback, or sleeps accepts an `AbortSignal`").
 */
import { createTempDatabase, type TempDatabase } from '@llm-kit/test-utils';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { VectorCache } from '../src/index.js';
import { createControlledEmbed, deterministicVector } from './helpers.js';

describe('AbortSignal handling', () => {
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

  it('an already-aborted signal rejects before embed is called', async () => {
    const controller = new AbortController();
    controller.abort(new Error('pre-aborted'));
    let called = false;
    await expect(
      cache.getOrCreate(['x'], {
        model: 'm',
        embed: () => {
          called = true;
          return Promise.resolve([deterministicVector('x')]);
        },
        signal: controller.signal,
      }),
    ).rejects.toThrow('pre-aborted');
    expect(called).toBe(false);
  });

  it("the caller's signal is never forwarded to embed(), but still rejects the whole call promptly", async () => {
    const controller = new AbortController();
    let receivedSignal: AbortSignal | undefined = controller.signal; // deliberately pre-seeded to a truthy value
    const pending = cache.getOrCreate(['x'], {
      model: 'm',
      embed: (request) => {
        receivedSignal = request.signal;
        return new Promise(() => {
          // Never resolves on its own — this call only ever completes via
          // the caller's own signal aborting below. The embed call itself
          // is never given a signal, so it is left permanently pending here
          // (the documented cost of this package's cancellation contract).
        });
      },
      signal: controller.signal,
    });

    await Promise.resolve();
    expect(receivedSignal).toBeUndefined(); // the shared fetch is nobody's to cancel
    controller.abort(new Error('cancel now'));
    await expect(pending).rejects.toThrow('cancel now');
  });

  it("a joiner's own abort rejects its call promptly without affecting the owner's in-flight fetch", async () => {
    const controlled = createControlledEmbed();
    const ownerController = new AbortController();
    const joinerController = new AbortController();

    const owner = cache.getOrCreate(['shared'], {
      model: 'm',
      embed: controlled.embed,
      signal: ownerController.signal,
    });
    const joiner = cache.getOrCreate(['shared'], {
      model: 'm',
      embed: controlled.embed,
      signal: joinerController.signal,
    });

    await Promise.resolve();
    await Promise.resolve();
    expect(controlled.callCount()).toBe(1); // joiner coalesced onto the owner's fetch

    joinerController.abort(new Error('joiner cancelled'));
    await expect(joiner).rejects.toThrow('joiner cancelled');

    // The owner's fetch is unaffected by the joiner's cancellation.
    controlled.release();
    const ownerResult = await owner;
    expect(Array.from(ownerResult.embeddings[0] as Float32Array)).toEqual(
      Array.from(deterministicVector('shared')),
    );
  });

  it("the owner's abort does not cancel a joiner that passed no signal at all", async () => {
    const controlled = createControlledEmbed();
    const ownerController = new AbortController();

    // Caller A: owns the fetch (registers first) and supplies its own signal.
    const ownerResult = cache.getOrCreate(['shared'], {
      model: 'm',
      embed: controlled.embed,
      signal: ownerController.signal,
    });
    // Caller B: joins the same in-flight key, passes no signal at all.
    const joinerResult = cache.getOrCreate(['shared'], {
      model: 'm',
      embed: controlled.embed,
      // signal intentionally omitted
    });

    await Promise.resolve();
    await Promise.resolve();
    expect(controlled.callCount()).toBe(1); // B coalesced onto A's fetch

    // A's caller goes away.
    ownerController.abort(new Error("A's caller went away"));
    await expect(ownerResult).rejects.toThrow("A's caller went away");

    // B never supplied a signal and never aborted — it must still resolve,
    // and the underlying fetch A started must still complete and persist.
    controlled.release();
    const joined = await joinerResult;
    expect(Array.from(joined.embeddings[0] as Float32Array)).toEqual(
      Array.from(deterministicVector('shared')),
    );

    const lookup = cache.getMany(['shared'], { model: 'm' });
    expect(lookup.report.hitCount).toBe(1);
    expect(Array.from(lookup.embeddings[0] as Float32Array)).toEqual(
      Array.from(deterministicVector('shared')),
    );
  });

  it('a non-Error abort reason still produces a real Error (DOMException AbortError)', async () => {
    const controller = new AbortController();
    const pending = cache.getOrCreate(['x'], {
      model: 'm',
      embed: () => new Promise(() => {}),
      signal: controller.signal,
    });
    await Promise.resolve();
    controller.abort('a plain string reason'); // not an Error instance
    let caught: unknown;
    try {
      await pending;
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(DOMException);
    expect((caught as DOMException).name).toBe('AbortError');
  });

  it('an aborted call still persists the write once the in-flight embed resolves (documented in the README)', async () => {
    const controlled = createControlledEmbed();
    const controller = new AbortController();

    const pending = cache.getOrCreate(['sole-caller'], {
      model: 'm',
      embed: controlled.embed,
      signal: controller.signal,
    });

    await Promise.resolve();
    controller.abort(new Error('caller gave up'));
    await expect(pending).rejects.toThrow('caller gave up');

    // The embed call this now-rejected call started keeps running and its
    // result is still written when it resolves — even with no other joiner
    // waiting on it. A caller who aborts expecting "no write" (e.g. because
    // the tenant was deleted) does not get that guarantee; see the README's
    // "An aborted call can still write to the cache" note.
    controlled.release();
    await new Promise((resolve) => setTimeout(resolve, 0));

    const lookup = cache.getMany(['sole-caller'], { model: 'm' });
    expect(lookup.report.hitCount).toBe(1);
    expect(Array.from(lookup.embeddings[0] as Float32Array)).toEqual(
      Array.from(deterministicVector('sole-caller')),
    );
  });

  it('a normal (non-abort) rejection still propagates when a signal is present but never aborts', async () => {
    const controller = new AbortController();
    await expect(
      cache.getOrCreate(['x'], {
        model: 'm',
        embed: () => Promise.reject(new Error('provider failed')),
        signal: controller.signal,
      }),
    ).rejects.toThrow('provider failed');
  });
});
