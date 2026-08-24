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
 * Non-replayable bodies: a `ReadableStream` body can only be read once. If
 * more than one attempt is possible
 * (`options.maxAttempts ?? 5 > 1`) and the request body is a stream, this
 * throws `LlmBackoffError` with code `REQUEST_BODY_NOT_REPLAYABLE`
 * *before making any request* — refusing outright rather than risking a
 * second attempt that sends an empty body because the stream was already
 * consumed by the first. The safe paths: buffer the body into a
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

function bodyIsNonReplayable(input: FetchInput, init: RequestInit | undefined): boolean {
  const explicitBody = init?.body;
  if (explicitBody instanceof ReadableStream) return true;
  if (explicitBody !== undefined) return false; // any other body type is replayable across calls

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
      'llm-backoff: fetchWithLlmBackoff refuses to retry a request whose body is a ReadableStream ' +
        '(it cannot be re-sent after the first attempt consumes it). Buffer the body into a string/Blob/' +
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
      async () => {
        releasePending(); // the previous attempt's response, if any, is now dead
        const response = await fetch(input, { ...init, signal });
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
