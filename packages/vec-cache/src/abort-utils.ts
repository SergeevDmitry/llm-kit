/**
 * Small `AbortSignal` helpers. `vec-cache` is Node-only, but `AbortSignal`,
 * `AbortController` and `DOMException` are the same platform globals Node
 * 20+ ships — no `node:` import needed for these.
 */

export function toAbortError(reason: unknown): Error {
  if (reason instanceof Error) return reason;
  return new DOMException('The operation was aborted.', 'AbortError');
}

export function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted === true) {
    throw toAbortError(signal.reason);
  }
}

/**
 * Awaits `promise`, but rejects immediately with the abort reason if
 * `signal` aborts first. Used so a caller's own signal cancels *their* wait
 * on a (possibly single-flight-shared) fetch promptly, without cancelling
 * the fetch itself.
 *
 * That distinction matters because the underlying `embed` call is never
 * given anyone's `AbortSignal` (see `batch/fetch-misses.ts`'s module doc):
 * the call that starts a fetch cannot
 * know at that moment whether another concurrent call will join it, so no
 * single caller's signal is allowed to cancel work another, non-aborted
 * joiner is depending on. Concretely: if caller A starts the fetch with its
 * own signal and caller B joins the same in-flight key with no signal at
 * all, A aborting must reject only A's own `getOrCreate` promise — B must
 * still resolve, and the fetch's result must still be persisted, once it
 * completes. `awaitWithAbort` is what scopes each caller's abort to its own
 * wait; the shared fetch keeps running regardless of who is still waiting on
 * it, including when *every* caller has aborted.
 */
export function awaitWithAbort<T>(
  promise: Promise<T>,
  signal: AbortSignal | undefined,
): Promise<T> {
  if (signal === undefined) return promise;
  if (signal.aborted) return Promise.reject(toAbortError(signal.reason));

  return new Promise<T>((resolve, reject) => {
    const onAbort = (): void => {
      reject(toAbortError(signal.reason));
    };
    signal.addEventListener('abort', onAbort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener('abort', onAbort);
        resolve(value);
      },
      (error: unknown) => {
        signal.removeEventListener('abort', onAbort);
        reject(error);
      },
    );
  });
}
