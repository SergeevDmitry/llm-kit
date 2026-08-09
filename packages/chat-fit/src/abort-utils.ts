/**
 * Small `AbortSignal` helper, matching `llm-backoff`'s and `vec-cache`'s
 * `toAbortError` so a caller who already wrote a `catch` block against
 * those two packages' abort behaviour gets the same shape from this one,
 * rather than whatever `signal.throwIfAborted()` happens to throw directly.
 *
 * `AbortSignal`/`DOMException` are platform globals in Node 20+, browsers,
 * and Bun — no `node:` import, keeping this package browser-safe.
 */

/** Normalizes an abort reason into a real `Error`: an `Error` reason passes through unchanged, anything else becomes a `DOMException` named `AbortError`. */
export function toAbortError(reason: unknown): Error {
  if (reason instanceof Error) return reason;
  return new DOMException('The operation was aborted.', 'AbortError');
}

/** Throws the signal's (normalized) abort reason immediately if it is already aborted. */
export function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted === true) {
    throw toAbortError(signal.reason);
  }
}
