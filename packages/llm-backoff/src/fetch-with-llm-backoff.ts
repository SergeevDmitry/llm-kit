/**
 * `fetchWithLlmBackoff` — `fetch` wrapped in `withLlmBackoff`.
 *
 * Contract, deliberately close to plain `fetch`'s own: a response whose
 * status this package does **not** classify as retryable — including a
 * success, and including a `400`/`401` — is returned normally, exactly like
 * `fetch` never throwing on an HTTP error status. Only a status classified
 * retryable (`429`/`529` always; anything in `options.retryableStatuses`)
 * drives a retry; the *final* response after retries are exhausted surfaces
 * as a thrown `LlmBackoffError` (its `.cause` is a `FetchRetryableStatusError`
 * carrying the last `Response`), not a returned one. This keeps
 * `response.ok`/`response.status` meaning exactly what they mean for plain
 * `fetch` on every status this package does not intervene on.
 *
 * Non-replayable bodies: a `ReadableStream` body can only be read once, and so
 * can an async iterable (a `node:stream` `Readable` is one) or a generator,
 * both of which Node's fetch also accepts. If more than one attempt is possible
 * (`options.maxAttempts ?? 5 > 1`) and the request body is any of those, this
 * throws `LlmBackoffError` with code `REQUEST_BODY_NOT_REPLAYABLE`
 * *before making any request* — refusing outright rather than risking a
 * second attempt that sends an empty body because the first already drained
 * the source. See `isSingleShotBody` below for which iterable bodies do
 * replay and are therefore allowed. The safe paths: buffer the body into a
 * `string`/`Blob`/`ArrayBuffer`/`Uint8Array` before calling this function (any
 * of those *can* be replayed — `fetch` reads them fresh on every call), or
 * pass `maxAttempts: 1` to accept no retries.
 *
 * Response body lifetime: every response fetched here except the one
 * that ultimately reaches the caller — the return value on success, or
 * `LlmBackoffError.cause.response` when retries are exhausted — has its body
 * cancelled before this function returns or throws. See `README.md`'s
 * "Response body lifetime" section for the caller-facing contract and why
 * this matters under a 429 storm.
 */
import { combineSignals } from './abort-utils.js';
import { classifyStatus } from './classify-error.js';
import { DEFAULT_MAX_ATTEMPTS } from './defaults.js';
import { FetchRetryableStatusError, LlmBackoffError } from './errors.js';
import { withLlmBackoff } from './with-llm-backoff.js';
import type { FetchInput, LlmBackoffOptions } from './types.js';

/**
 * A body value that can only be read once, so a second attempt would send
 * nothing.
 *
 * A `ReadableStream` is the obvious one, but Node's fetch (undici) also
 * accepts an async iterable — an async generator, or a `node:stream`
 * `Readable`, which is one — and a sync iterable, and turns either into a
 * stream internally. The distinction that matters is not "is it iterable" but
 * "does asking it for an iterator give a *fresh* one": every replayable
 * standard body type that happens to be iterable (`FormData`,
 * `URLSearchParams`, and an `Array`/`Set` of chunks) hands out a new iterator
 * per `fetch` call, so all of them genuinely replay.
 *
 * Two shapes do not, and both are treated as single-shot:
 * - anything with `Symbol.asyncIterator`. No replayable standard body type has
 *   it, and an async iterator is consumed as it is read.
 * - an *iterable iterator* — an object carrying both `next` and
 *   `Symbol.iterator`, which is exactly what a generator object is, and what a
 *   hand-rolled single-shot iterator looks like. Its `Symbol.iterator` returns
 *   itself, already partly consumed. None of the replayable types above carry
 *   a `next` method.
 *
 * Both checks read properties only; neither calls the iterator method, so
 * probing a body never consumes it.
 */
function isSingleShotBody(body: unknown): boolean {
  if (body instanceof ReadableStream) return true;
  // A string is iterable and replayable; `null` is an explicit *empty* body.
  if (typeof body !== 'object' || body === null) return false;
  const candidate = body as Partial<AsyncIterable<unknown> & Iterable<unknown> & Iterator<unknown>>;
  if (typeof candidate[Symbol.asyncIterator] === 'function') return true;
  return typeof candidate.next === 'function' && typeof candidate[Symbol.iterator] === 'function';
}

function bodyIsNonReplayable(input: FetchInput, init: RequestInit | undefined): boolean {
  const explicitBody = init?.body;
  if (explicitBody !== undefined) return isSingleShotBody(explicitBody);

  // No override body: a Request object's own body is used, and it is a
  // stream too — and, unlike a plain body value, is consumed the moment this
  // package's *first* fetch(input) call reads it, even before any retry.
  if (typeof Request !== 'undefined' && input instanceof Request) {
    return input.body instanceof ReadableStream;
  }
  return false;
}

export async function fetchWithLlmBackoff(
  input: FetchInput,
  init?: RequestInit,
  options: LlmBackoffOptions = {},
): Promise<Response> {
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;

  if (maxAttempts > 1 && bodyIsNonReplayable(input, init)) {
    throw new LlmBackoffError(
      'llm-backoff: fetchWithLlmBackoff refuses to retry a request whose body can only be read once ' +
        '(a ReadableStream, an async iterable such as a node:stream Readable, or a generator — it cannot ' +
        'be re-sent after the first attempt consumes it). Buffer the body into a string/Blob/' +
        'ArrayBuffer/Uint8Array first, or pass { maxAttempts: 1 } to accept no retries.',
      'REQUEST_BODY_NOT_REPLAYABLE',
      [],
    );
  }

  // Three cancellation channels reach this function, not two: `options.signal`,
  // `init.signal`, and the signal a `Request` always carries. The third has to
  // be combined in explicitly, because passing `signal` in the init bag
  // *replaces* the Request's own signal per the fetch spec — omitting it would
  // make `fetchWithLlmBackoff(request)` ignore an abort that plain
  // `fetch(request)` honors. It also matters when no other signal is present:
  // a Request's signal is always defined, so combining it gives the retry loop
  // a signal to interrupt a `Retry-After` sleep with, and to classify the
  // resulting rejection as an abort (propagated unwrapped) rather than a
  // non-retryable failure wrapped in `LlmBackoffError`.
  const requestSignal =
    typeof Request !== 'undefined' && input instanceof Request ? input.signal : undefined;
  const combined = combineSignals([options.signal, init?.signal ?? undefined, requestSignal]);
  const signal = combined.signal;

  // A response fetched on any attempt that isn't the one reaching the caller
  // needs its body released, or in Node/undici an unconsumed body pins its
  // connection out of the keep-alive pool until GC — exactly when a 429
  // storm makes that expensive.
  //
  // `pending` tracks the in-flight attempt's response and gets cancelled two
  // ways: eagerly at the top of the next attempt (a next attempt happening at
  // all proves the previous response was retried away), and in the `catch`
  // below for the last fetched response, covering the case where the loop
  // stops without a next attempt for a reason unrelated to that response
  // (`onRetry` throwing, or an abort during `onRetry`/the sleep) — either way
  // `withLlmBackoff` throws something other than `FetchRetryableStatusError`
  // for it, so it's unreachable to the caller and still needs releasing.
  //
  // Not keyed off `RetryContext.attempt < maxAttempts`: that can't tell a
  // normal retry apart from an attempt about to become final via
  // `MAX_ELAPSED_EXCEEDED` (both look identical from inside the operation
  // callback, since that check runs later in `withLlmBackoff`), and canceling
  // on it alone would race-cancel a response about to become
  // `LlmBackoffError.cause`.
  let pending: Response | undefined;
  function releasePending(): void {
    if (pending !== undefined) {
      void pending.body?.cancel().catch(() => undefined);
      pending = undefined;
    }
  }

  try {
    return await withLlmBackoff(
      async (context) => {
        releasePending(); // the previous attempt's response, if any, is now dead
        // `context.signal`, not the combined signal built above: when
        // `options.attemptTimeoutMs` is set the retry loop hands each attempt
        // its own signal, carrying that ceiling *and* everything combined
        // here. Using the outer one would leave a timed-out request in flight,
        // holding its connection, while the loop moved on. With no attempt
        // timeout the two are the same signal.
        const response = await fetch(input, { ...init, signal: context.signal });
        pending = response;
        const { retryable } = classifyStatus(response.status, {
          retryableStatuses: options.retryableStatuses,
          nonRetryableStatuses: options.nonRetryableStatuses,
        });
        if (retryable) {
          throw new FetchRetryableStatusError(response);
        }
        pending = undefined; // returned below — this is the caller's response now
        return response;
      },
      { ...options, signal },
    );
  } catch (error) {
    // The one case where `pending` must survive uncancelled: retries were
    // exhausted (attempts or elapsed budget) on exactly this response, so it
    // is about to reach the caller as `LlmBackoffError.cause.response`.
    const survivor =
      error instanceof LlmBackoffError && error.cause instanceof FetchRetryableStatusError
        ? error.cause.response
        : undefined;
    if (pending !== survivor) {
      releasePending();
    }
    throw error;
  } finally {
    combined.dispose(); // detach any manual-fallback abort listeners
  }
}
