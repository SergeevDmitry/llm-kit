/**
 * Injectable clock and sleep recorder.
 *
 * `llm-backoff` and `vec-cache` must never call the real timer in tests: delay
 * policy and TTL behaviour are asserted on recorded durations, not wall time.
 */

export interface SleepCall {
  /** Requested duration in milliseconds. */
  readonly ms: number;
  /** Fake-clock timestamp at which the sleep started. */
  readonly startedAtMs: number;
  /** Whether the sleep was cancelled by an abort signal. */
  readonly aborted: boolean;
}

export interface FakeClock {
  /** Current fake time in milliseconds since the epoch. */
  now(): number;
  /** Moves time forward without any sleeping. */
  advance(ms: number): void;
  /** Sets absolute fake time. */
  set(ms: number): void;
  /** A `Date`-compatible now function for code that takes one. */
  readonly nowFn: () => number;
}

export interface SleepRecorder {
  /** Drop-in replacement for a `sleep(ms, signal)` implementation. */
  sleep(ms: number, signal?: AbortSignal): Promise<void>;
  /** Every sleep requested, in order. */
  readonly calls: readonly SleepCall[];
  /** Convenience view: just the requested durations. */
  durations(): readonly number[];
  /** Total fake time spent sleeping. */
  totalMs(): number;
}

export function createFakeClock(startMs = 1_700_000_000_000): FakeClock {
  let current = startMs;
  const nowFn = (): number => current;
  return {
    now: nowFn,
    nowFn,
    advance(ms: number): void {
      if (!Number.isFinite(ms) || ms < 0) {
        throw new RangeError('createFakeClock().advance expects a non-negative finite number');
      }
      current += ms;
    },
    set(ms: number): void {
      current = ms;
    },
  };
}

/**
 * Records sleep requests and advances the fake clock instead of waiting.
 *
 * Abort behaviour mirrors the production contract: an already-aborted signal
 * rejects immediately, and aborting during the sleep rejects with the signal's
 * reason.
 */
export function createSleepRecorder(clock: FakeClock): SleepRecorder {
  const calls: SleepCall[] = [];

  return {
    calls,
    durations(): readonly number[] {
      return calls.map((call) => call.ms);
    },
    totalMs(): number {
      return calls.reduce((total, call) => (call.aborted ? total : total + call.ms), 0);
    },
    async sleep(ms: number, signal?: AbortSignal): Promise<void> {
      const startedAtMs = clock.now();
      if (signal?.aborted === true) {
        calls.push({ ms, startedAtMs, aborted: true });
        throw signal.reason instanceof Error
          ? signal.reason
          : new DOMException('The operation was aborted.', 'AbortError');
      }
      calls.push({ ms, startedAtMs, aborted: false });
      clock.advance(ms);
      // Yield to the microtask queue so awaiting code interleaves realistically.
      await Promise.resolve();
    },
  };
}
