/**
 * `defaultSleep` — the production `sleep` implementation used whenever
 * `LlmBackoffOptions.sleep` is not supplied. Every other test in this package
 * injects `createSleepRecorder` instead (per the package brief, "no test may
 * use a real timer"); this file is the deliberate, narrow exception needed to
 * prove `defaultSleep` actually wires up `setTimeout`/`AbortSignal` correctly
 * — and it uses Vitest's *fake* timers (`vi.useFakeTimers`), not the real
 * clock, so no wall-clock time passes while it runs.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MAX_SAFE_TIMEOUT_MS } from '../src/defaults.js';
import { defaultSleep } from '../src/delay/sleep.js';

describe('defaultSleep', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('resolves once the requested time elapses', async () => {
    let resolved = false;
    const promise = defaultSleep(1000).then(() => {
      resolved = true;
    });
    await vi.advanceTimersByTimeAsync(999);
    expect(resolved).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await promise;
    expect(resolved).toBe(true);
  });

  it('resolves normally and cleans up its listener when a non-aborting signal was passed', async () => {
    const controller = new AbortController();
    let resolved = false;
    const promise = defaultSleep(100, controller.signal).then(() => {
      resolved = true;
    });
    await vi.advanceTimersByTimeAsync(100);
    await promise;
    expect(resolved).toBe(true);
  });

  it('rejects immediately if the signal is already aborted', async () => {
    const controller = new AbortController();
    const reason = new Error('already cancelled');
    controller.abort(reason);
    await expect(defaultSleep(1000, controller.signal)).rejects.toBe(reason);
  });

  it('rejects with the abort reason if the signal aborts during the wait, before the timer fires', async () => {
    const controller = new AbortController();
    const reason = new Error('cancelled mid-wait');
    const promise = defaultSleep(1000, controller.signal);
    await vi.advanceTimersByTimeAsync(500);
    controller.abort(reason);
    await expect(promise).rejects.toBe(reason);
  });

  it('does not resolve after an abort, even once the original timer duration would have elapsed', async () => {
    const controller = new AbortController();
    let settled: 'resolved' | 'rejected' | undefined;
    const promise = defaultSleep(1000, controller.signal).then(
      () => {
        settled = 'resolved';
      },
      () => {
        settled = 'rejected';
      },
    );
    await vi.advanceTimersByTimeAsync(200);
    controller.abort();
    await promise;
    expect(settled).toBe('rejected');
    // Advancing further must not throw an unhandled resolution from a stray timer.
    await vi.advanceTimersByTimeAsync(2000);
  });

  it('wraps a non-Error abort reason in a DOMException named AbortError', async () => {
    const controller = new AbortController();
    controller.abort(); // default reason
    let caught: unknown;
    try {
      await defaultSleep(10, controller.signal);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(DOMException);
    expect((caught as DOMException).name).toBe('AbortError');
  });

  describe('a delay past the 32-bit setTimeout limit (observation, with-llm-backoff.ts:97-104)', () => {
    // `Retry-After` is deliberately never capped by `maxDelayMs` — explicit
    // server timing is always honored — only bounded by `maxElapsedMs`,
    // which a caller can set arbitrarily high. A delay > MAX_SAFE_TIMEOUT_MS
    // (~24.8 days) is therefore reachable,
    // not hypothetical, whenever a caller wants to actually honor a very long
    // server-mandated wait. Node's real `setTimeout` would clamp such a value
    // to 1ms and fire immediately; these tests prove `defaultSleep` chains
    // timers instead, so the full requested delay is still honored.

    it('does not resolve merely because MAX_SAFE_TIMEOUT_MS worth of time has passed, when more was requested', async () => {
      const totalMs = MAX_SAFE_TIMEOUT_MS + 5000;
      let resolved = false;
      const promise = defaultSleep(totalMs).then(() => {
        resolved = true;
      });

      // A single setTimeout(totalMs) — the pre-fix, unclamped-under-fake-timers
      // behavior — would already have fired by now if this were a plain
      // pass-through; the whole point of chaining is that it must not.
      await vi.advanceTimersByTimeAsync(MAX_SAFE_TIMEOUT_MS);
      expect(resolved).toBe(false);

      await vi.advanceTimersByTimeAsync(4999);
      expect(resolved).toBe(false);

      await vi.advanceTimersByTimeAsync(1);
      await promise;
      expect(resolved).toBe(true);
    });

    it('chains setTimeout calls of at most MAX_SAFE_TIMEOUT_MS each, honoring the exact total requested', async () => {
      const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');
      const totalMs = MAX_SAFE_TIMEOUT_MS * 2 + 1000;

      const promise = defaultSleep(totalMs);
      await vi.advanceTimersByTimeAsync(totalMs);
      await promise;

      const delaysRequested = setTimeoutSpy.mock.calls.map((call) => call[1]);
      expect(delaysRequested).toEqual([MAX_SAFE_TIMEOUT_MS, MAX_SAFE_TIMEOUT_MS, 1000]);
      expect(delaysRequested.every((ms) => (ms ?? 0) <= MAX_SAFE_TIMEOUT_MS)).toBe(true);

      setTimeoutSpy.mockRestore();
    });

    it('a delay of exactly MAX_SAFE_TIMEOUT_MS is not chained (single chunk, no off-by-one)', async () => {
      const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');

      const promise = defaultSleep(MAX_SAFE_TIMEOUT_MS);
      await vi.advanceTimersByTimeAsync(MAX_SAFE_TIMEOUT_MS);
      await promise;

      expect(setTimeoutSpy.mock.calls.map((call) => call[1])).toEqual([MAX_SAFE_TIMEOUT_MS]);
      setTimeoutSpy.mockRestore();
    });

    it('an abort during the first chunk of an oversized delay rejects immediately, without waiting for later chunks', async () => {
      const controller = new AbortController();
      const reason = new Error('cancelled during a long wait');
      const totalMs = MAX_SAFE_TIMEOUT_MS + 10_000;

      const promise = defaultSleep(totalMs, controller.signal);
      await vi.advanceTimersByTimeAsync(1000);
      controller.abort(reason);

      await expect(promise).rejects.toBe(reason);
    });

    it('an abort during a later chunk (after an earlier chunk already completed) still rejects', async () => {
      const controller = new AbortController();
      const reason = new Error('cancelled late');
      const totalMs = MAX_SAFE_TIMEOUT_MS + 10_000;

      const promise = defaultSleep(totalMs, controller.signal);
      await vi.advanceTimersByTimeAsync(MAX_SAFE_TIMEOUT_MS); // first chunk completes; second chunk starts
      controller.abort(reason);

      await expect(promise).rejects.toBe(reason);
    });
  });
});
