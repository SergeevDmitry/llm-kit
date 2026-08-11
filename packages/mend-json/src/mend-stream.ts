/**
 * `mendStream`: the async-iteration adapter over the stateful API.
 *
 * The package's core audience already has an `AsyncIterable` in hand — a
 * `fetch` response body, a Node `Readable`, an SDK's streaming-delta
 * iterator — and today hand-rolls the same `for await` loop around
 * `createJsonMender` seen in `examples/streaming-tool-args`. This function
 * is that loop, written once.
 */
import { createJsonMender } from './create-json-mender.js';
import type { JsonMendResult, MendStreamOptions } from './types.js';

/**
 * Normalizes an abort reason into a real `Error`: an `Error` reason (a
 * custom error, `AbortSignal.timeout()`'s `TimeoutError`, ...) is preserved
 * exactly; anything else (including `undefined`, the default when
 * `controller.abort()` is called with no argument) becomes a `DOMException`
 * named `"AbortError"`. Deliberately local rather than imported: this
 * package carries no foundations, and `AbortController`/`AbortSignal`/
 * `DOMException` are platform globals in every runtime it promises to
 * support (Node 20+, browsers, Bun) — this mirrors `llm-backoff`'s
 * `toAbortError` for a consistent abort shape across the repo, without
 * either package depending on the other.
 */
function toAbortError(reason: unknown): Error {
  if (reason instanceof Error) return reason;
  return new DOMException('The operation was aborted.', 'AbortError');
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted === true) {
    throw toAbortError(signal.reason);
  }
}

/**
 * Consumes `source` chunk by chunk through a fresh `JsonMender`, yielding
 * the resulting snapshot after every chunk. Once `source` is exhausted, the
 * `finish()` snapshot is yielded once more (`isFinishing`'s "one extra
 * power" — see `repair-suffix.ts` — can differ from the last `push()`
 * snapshot, e.g. a root number that only becomes safely closable once no
 * more input is coming) and is also the generator's return value, so both
 * `for await (const snapshot of mendStream(...))` and manual `.next()`
 * driving see the same final, most-complete result.
 *
 * `string` and `Uint8Array` chunks may be freely mixed, exactly as with
 * `JsonMender#push` — see its doc comment for the UTF-8 byte-splitting
 * guarantees this inherits unchanged.
 *
 * `options.signal`, if given, is checked before consuming `source` and
 * again after every chunk it yields — see `MendStreamOptions.signal`'s doc
 * comment for exactly what that does and does not interrupt.
 */
export async function* mendStream<T = unknown>(
  source: AsyncIterable<string | Uint8Array>,
  options?: MendStreamOptions,
): AsyncGenerator<JsonMendResult<T>, JsonMendResult<T>, void> {
  throwIfAborted(options?.signal);
  const mender = createJsonMender<T>(options);
  for await (const chunk of source) {
    throwIfAborted(options?.signal);
    yield mender.push(chunk);
  }
  const final = mender.finish();
  yield final;
  return final;
}
