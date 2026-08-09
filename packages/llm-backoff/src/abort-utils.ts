/**
 * Small `AbortSignal` helpers shared by `with-llm-backoff.ts` and
 * `fetch-with-llm-backoff.ts`. No `node:` import — `AbortController`/`AbortSignal`
 * and `DOMException` are platform globals in Node 20+, browsers, and Bun.
 */

/** Normalizes an abort reason into a real `Error`, matching `createSleepRecorder`'s contract. */
export function toAbortError(reason: unknown): Error {
  if (reason instanceof Error) return reason;
  return new DOMException('The operation was aborted.', 'AbortError');
}

export function isAbortError(error: unknown): boolean {
  if (typeof DOMException !== 'undefined' && error instanceof DOMException) {
    return error.name === 'AbortError';
  }
  return error instanceof Error && error.name === 'AbortError';
}

/** Throws the signal's abort reason immediately if it is already aborted. */
export function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted === true) {
    throw toAbortError(signal.reason);
  }
}

/** Result of `combineSignals` — the combined signal plus its cleanup. */
export interface CombinedSignal {
  readonly signal: AbortSignal | undefined;
  /**
   * Detaches every listener this call attached to the *input* signals.
   * Idempotent (safe to call more than once) and safe to call even when
   * `signal` is `undefined`, or is one of the inputs unchanged (the
   * zero/one-signal cases attach nothing, so there is nothing to detach).
   * Callers must call this once the combined signal is no longer needed —
   * see the note on `combineSignals` below.
   */
  dispose(): void;
}

const NOOP_DISPOSE = (): void => undefined;

/**
 * Combines any number of optional signals into one. Used by
 * `fetchWithLlmBackoff` so `options.signal` and a caller-supplied `init.signal`
 * both cancel the whole retry operation, not just one attempt.
 *
 * Callers MUST call the returned `dispose()` once they are done with the
 * combined signal (typically in a `finally`). Without it, the manual-fallback
 * path below (runtimes without `AbortSignal.any`) attaches an `abort`
 * listener to each input signal that is never removed on the success path —
 * a caller holding one long-lived signal across many calls (a per-request
 * signal reused across provider calls, or an app-lifetime shutdown signal)
 * accumulates one permanently-retained listener and closure per call, which
 * eventually trips Node's `MaxListenersExceededWarning`. `AbortSignal.any`
 * itself does not leak — its listeners are the platform's responsibility —
 * so `dispose()` is a no-op on that path, and on the zero/one-signal paths,
 * where nothing was ever attached.
 */
export function combineSignals(signals: readonly (AbortSignal | undefined)[]): CombinedSignal {
  const present = signals.filter((signal): signal is AbortSignal => signal !== undefined);
  if (present.length === 0) return { signal: undefined, dispose: NOOP_DISPOSE };
  if (present.length === 1) return { signal: present[0], dispose: NOOP_DISPOSE };

  if (typeof AbortSignal.any === 'function') {
    return { signal: AbortSignal.any(present), dispose: NOOP_DISPOSE };
  }

  // Fallback for runtimes without AbortSignal.any (widely available since
  // Node 20.3 / evergreen browsers, but not guaranteed by "Node >=20" alone).
  const controller = new AbortController();
  const detachers: (() => void)[] = [];
  for (const signal of present) {
    if (signal.aborted) {
      controller.abort(signal.reason);
      break;
    }
    const onAbort = (): void => controller.abort(signal.reason);
    signal.addEventListener('abort', onAbort, { once: true });
    detachers.push(() => signal.removeEventListener('abort', onAbort));
  }

  let disposed = false;
  return {
    signal: controller.signal,
    dispose: () => {
      if (disposed) return;
      disposed = true;
      for (const detach of detachers) detach();
    },
  };
}
