/**
 * `mendStream`: the async-iteration adapter over `createJsonMender`.
 *
 * Two behaviors get their own coverage beyond "it forwards to push()":
 *  - the `finish()` snapshot is yielded as the *last* item, not only
 *    returned — `for await...of` silently drops a generator's return value,
 *    so a consumer that only reads yielded items must still see it;
 *  - `options.signal` is checked before consuming the source and again
 *    after every chunk, with the same abort-reason normalization
 *    `llm-backoff` uses (an `Error` reason preserved exactly, anything else
 *    becoming a `DOMException` named `"AbortError"`).
 */
import { describe, expect, it } from 'vitest';
import { mendStream } from '../src/mend-stream.js';
import { JsonMendDuplicateKeyError, JsonMendLimitError } from '../src/errors.js';

async function* chunks(...parts: (string | Uint8Array)[]): AsyncGenerator<string | Uint8Array> {
  for (const part of parts) {
    yield part;
  }
}

describe('mendStream — async-iteration adapter', () => {
  it('yields one snapshot per chunk, matching push() called directly', async () => {
    const results: unknown[] = [];
    for await (const snapshot of mendStream(chunks('{"a":1,', '"b":', '2}'))) {
      results.push({ value: snapshot.value, complete: snapshot.complete });
    }
    // Three push() snapshots, plus the finish() snapshot (unchanged here,
    // since the document was already fully complete before finish() runs).
    expect(results).toEqual([
      { value: { a: 1 }, complete: false },
      { value: { a: 1 }, complete: false },
      { value: { a: 1, b: 2 }, complete: true },
      { value: { a: 1, b: 2 }, complete: true },
    ]);
  });

  it('the last yielded item is the finish() snapshot, even when it differs from the last push()', async () => {
    // A root number under the default 'omit' policy: snapshot() (via push())
    // reports complete: false, but finish() legitimately terminates it —
    // exactly the divergence documented on decideLeaf's `isFinishing` power.
    const results: { value: unknown; complete: boolean }[] = [];
    for await (const snapshot of mendStream(chunks('12345'))) {
      results.push({ value: snapshot.value, complete: snapshot.complete });
    }
    expect(results).toEqual([
      { value: undefined, complete: false }, // push(): omit policy withholds an open root number
      { value: 12345, complete: true }, // finish(): end of input safely terminates it
    ]);
  });

  it('the finish() snapshot is also the generator return value', async () => {
    const gen = mendStream(chunks('{"a":1}'));
    let step = await gen.next();
    while (!step.done) {
      step = await gen.next();
    }
    expect(step.value.value).toEqual({ a: 1 });
    expect(step.value.complete).toBe(true);
  });

  it('an empty source yields exactly the finish() snapshot of an empty mender', async () => {
    const results: unknown[] = [];
    for await (const snapshot of mendStream(chunks())) {
      results.push({ value: snapshot.value, complete: snapshot.complete });
    }
    expect(results).toEqual([{ value: undefined, complete: false }]);
  });

  it('accepts freely mixed string and Uint8Array chunks, exactly like push()', async () => {
    const encoder = new TextEncoder();
    let last: { value: unknown; complete: boolean } | undefined;
    for await (const snapshot of mendStream(chunks(encoder.encode('{"x":'), '42}'))) {
      last = { value: snapshot.value, complete: snapshot.complete };
    }
    expect(last).toEqual({ value: { x: 42 }, complete: true });
  });

  it('forwards JsonMenderOptions to the underlying mender', async () => {
    await expect(async () => {
      for await (const _ of mendStream(chunks('{"a":{"b":1}}'), { maxDepth: 1 })) {
        // consume
      }
    }).rejects.toThrow(JsonMendLimitError);

    await expect(async () => {
      for await (const _ of mendStream(chunks('{"a":1,"a":2}'), { duplicateKeyPolicy: 'error' })) {
        // consume
      }
    }).rejects.toThrow(JsonMendDuplicateKeyError);
  });

  it('propagates an error thrown by the source itself, unchanged', async () => {
    async function* broken(): AsyncGenerator<string> {
      yield '{"a":1';
      throw new Error('source-broke');
    }
    await expect(async () => {
      for await (const _ of mendStream(broken())) {
        // consume
      }
    }).rejects.toThrow('source-broke');
  });

  describe('options.signal', () => {
    it('an already-aborted signal with an Error reason throws that exact reason before consuming the source', async () => {
      const controller = new AbortController();
      const reason = new Error('stop-early');
      controller.abort(reason);
      let sourceStarted = false;
      async function* source(): AsyncGenerator<string> {
        sourceStarted = true; // a generator body never runs until first advanced
        yield '{"a":1}';
      }

      const gen = mendStream(source(), { signal: controller.signal });
      await expect(gen.next()).rejects.toBe(reason);
      expect(sourceStarted).toBe(false);
    });

    it('an already-aborted signal with no reason throws a DOMException named "AbortError"', async () => {
      const controller = new AbortController();
      controller.abort();
      const gen = mendStream(chunks('{"a":1}'), { signal: controller.signal });
      try {
        await gen.next();
        expect.unreachable('expected an abort error');
      } catch (error) {
        expect(error).toBeInstanceOf(DOMException);
        expect((error as DOMException).name).toBe('AbortError');
      }
    });

    it('aborting between chunks stops consuming the source and throws before the next push()', async () => {
      const controller = new AbortController();
      const reason = new Error('stop-mid-stream');
      const pushed: string[] = [];

      async function* source(): AsyncGenerator<string> {
        yield '{"a":';
        controller.abort(reason);
        yield '1}'; // must never be observed by mendStream after the abort
      }

      try {
        for await (const snapshot of mendStream(source(), { signal: controller.signal })) {
          pushed.push(snapshot.repairedJson ?? '');
        }
        expect.unreachable('expected an abort error');
      } catch (error) {
        expect(error).toBe(reason);
      }
      // Only the first chunk's snapshot was yielded before the abort fired
      // ("a" has no value yet, so decideLeaf conservatively rolls it back).
      expect(pushed).toEqual(['{}']);
    });

    it('a non-Error reason is normalized to a DOMException, matching the already-aborted case', async () => {
      const controller = new AbortController();
      async function* source(): AsyncGenerator<string> {
        yield '{"a":';
        controller.abort('a plain string reason');
        yield '1}';
      }
      try {
        for await (const _ of mendStream(source(), { signal: controller.signal })) {
          // consume
        }
        expect.unreachable('expected an abort error');
      } catch (error) {
        expect(error).toBeInstanceOf(DOMException);
        expect((error as DOMException).name).toBe('AbortError');
      }
    });

    it('a signal that never aborts does not interfere with a normal stream', async () => {
      const controller = new AbortController();
      let last: { value: unknown; complete: boolean } | undefined;
      for await (const snapshot of mendStream(chunks('{"a":1}'), { signal: controller.signal })) {
        last = { value: snapshot.value, complete: snapshot.complete };
      }
      expect(last).toEqual({ value: { a: 1 }, complete: true });
    });
  });
});
