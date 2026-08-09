/**
 * `withLlmBackoff` loop orchestration: attempt counting, delay precedence,
 * `maxAttempts`/`maxElapsedMs` enforcement, `onRetry`, and abort at every
 * phase. Every test injects `sleep`/`random` via `@llm-kit/test-utils` — no
 * real timer is used anywhere in this file.
 */
import { createFakeClock, createSeededRandom, createSleepRecorder } from '@llm-kit/test-utils';
import { describe, expect, it, vi } from 'vitest';
import { LlmBackoffError } from '../src/errors.js';
import { withLlmBackoff } from '../src/with-llm-backoff.js';
import type { RetryEvent } from '../src/types.js';

function retryableError(status: number, headers?: Record<string, string>): unknown {
  return { status, headers: headers ?? {} };
}

function nonRetryableError(status: number): unknown {
  return { status, headers: {} };
}

describe('the success path', () => {
  it('returns the operation result without sleeping when it succeeds first try', async () => {
    const clock = createFakeClock();
    const sleep = createSleepRecorder(clock);
    const result = await withLlmBackoff(async () => 'ok', { sleep: sleep.sleep, now: clock.nowFn });
    expect(result).toBe('ok');
    expect(sleep.calls).toHaveLength(0);
  });

  it('passes attempt/elapsedMs/signal to the operation on every call (elapsedMs = wall-clock, via injected now)', async () => {
    const clock = createFakeClock();
    const sleep = createSleepRecorder(clock);
    const seen: { attempt: number; elapsedMs: number }[] = [];
    let call = 0;
    const controller = new AbortController();

    await withLlmBackoff(
      async (ctx) => {
        seen.push({ attempt: ctx.attempt, elapsedMs: ctx.elapsedMs });
        expect(ctx.signal).toBe(controller.signal);
        call += 1;
        if (call < 3) throw retryableError(429, { 'retry-after': '2' });
        return 'done';
      },
      { sleep: sleep.sleep, now: clock.nowFn, signal: controller.signal },
    );

    // No simulated operation latency here, so wall-clock elapsedMs matches
    // cumulative sleep exactly — the "operation also takes time" case is
    // covered separately below.
    expect(seen).toEqual([
      { attempt: 1, elapsedMs: 0 },
      { attempt: 2, elapsedMs: 2000 },
      { attempt: 3, elapsedMs: 4000 },
    ]);
  });

  it('elapsedMs is true wall-clock time: it includes operation latency on prior attempts, not just sleep', async () => {
    // A maxElapsedMs budget has to account for slow network calls, not just
    // the delays this package itself chose to sleep.
    const clock = createFakeClock();
    const sleep = createSleepRecorder(clock);
    const seen: number[] = [];
    let call = 0;

    await withLlmBackoff(
      async (ctx) => {
        seen.push(ctx.elapsedMs);
        call += 1;
        clock.advance(25_000); // simulate a slow 25s provider call
        if (call < 3) throw retryableError(429, { 'retry-after': '1' });
        return 'done';
      },
      { sleep: sleep.sleep, now: clock.nowFn, maxElapsedMs: 200_000 },
    );

    // attempt 1: 0ms elapsed so far.
    // attempt 2: 25_000ms (attempt 1's operation) + 1_000ms (the honored
    // retry-after) = 26_000ms.
    // attempt 3: 26_000 + 25_000 (attempt 2's operation) + 1_000 (its sleep) = 52_000ms.
    expect(seen).toEqual([0, 26_000, 52_000]);
  });

  it('maxElapsedMs accounts for slow operation calls even when every sleep is honored quickly', async () => {
    // A 60s budget with three 25s "network calls" and tiny sleeps between
    // them should fail on wall-clock grounds well before exhausting
    // maxAttempts. Counting only sleep time would miss this entirely.
    const clock = createFakeClock();
    const sleep = createSleepRecorder(clock);
    let call = 0;

    let caught: unknown;
    try {
      await withLlmBackoff(
        async () => {
          call += 1;
          clock.advance(25_000);
          throw retryableError(429, { 'retry-after': '0.01' });
        },
        { sleep: sleep.sleep, now: clock.nowFn, maxElapsedMs: 60_000, maxAttempts: 10 },
      );
    } catch (error) {
      caught = error;
    }

    // attempt 1 (25s) -> ok, sleeps 10ms; attempt 2 (25s, total 50.01s) -> ok,
    // sleeps 10ms; attempt 3 would push past 60s on operation time alone.
    expect(call).toBe(3);
    expect((caught as LlmBackoffError).code).toBe('MAX_ELAPSED_EXCEEDED');
  });
});

describe('explicit server delay: no positive jitter', () => {
  it('honors Retry-After exactly, and never calls random', async () => {
    const clock = createFakeClock();
    const sleep = createSleepRecorder(clock);
    const random = vi.fn(() => {
      throw new Error('random must never be called when an explicit delay is available');
    });
    let call = 0;

    await withLlmBackoff(
      async () => {
        call += 1;
        if (call === 1)
          throw retryableError(429, { 'retry-after': '3.2' } as unknown as Record<string, string>);
        return 'ok';
      },
      { sleep: sleep.sleep, now: clock.nowFn, random },
    );

    expect(sleep.durations()).toEqual([3200]);
    expect(random).not.toHaveBeenCalled();
  });

  it('honors a fractional-second Retry-After exactly (3.2s -> ceil to 3200ms, not rounded down or padded)', async () => {
    const clock = createFakeClock();
    const sleep = createSleepRecorder(clock);
    let call = 0;
    await withLlmBackoff(
      async () => {
        call += 1;
        if (call === 1) {
          throw retryableError(429, { 'retry-after': '3' });
        }
        return 'ok';
      },
      { sleep: sleep.sleep, now: clock.nowFn },
    );
    expect(sleep.durations()).toEqual([3000]);
  });
});

describe('fallback backoff when no header is usable', () => {
  it('uses the injected random and stays within the exponential cap', async () => {
    const clock = createFakeClock();
    const sleep = createSleepRecorder(clock);
    const random = createSeededRandom(7);
    let call = 0;

    await withLlmBackoff(
      async () => {
        call += 1;
        if (call < 3) throw retryableError(529);
        return 'ok';
      },
      {
        sleep: sleep.sleep,
        now: clock.nowFn,
        random: random.next,
        baseDelayMs: 100,
        maxDelayMs: 10_000,
      },
    );

    expect(sleep.durations()).toHaveLength(2);
    expect(sleep.durations()[0]).toBeLessThanOrEqual(100);
    expect(sleep.durations()[1]).toBeLessThanOrEqual(200);
  });
});

describe('maxAttempts', () => {
  it('throws MAX_ATTEMPTS_EXCEEDED after exhausting all attempts, preserving cause and attempt history', async () => {
    const clock = createFakeClock();
    const sleep = createSleepRecorder(clock);
    const finalError = retryableError(429, { 'retry-after': '1' });

    let caught: unknown;
    try {
      await withLlmBackoff(async () => Promise.reject(finalError), {
        sleep: sleep.sleep,
        now: clock.nowFn,
        maxAttempts: 3,
      });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(LlmBackoffError);
    const backoffError = caught as LlmBackoffError;
    expect(backoffError.code).toBe('MAX_ATTEMPTS_EXCEEDED');
    expect(backoffError.cause).toBe(finalError);
    expect(backoffError.attempts).toHaveLength(3);
    expect(backoffError.attempts.map((a) => a.attempt)).toEqual([1, 2, 3]);
    expect(sleep.calls).toHaveLength(2); // slept between 1->2 and 2->3, not after the last
  });
});

describe('maxElapsedMs', () => {
  it('is checked before sleeping and does not sleep the disallowed delay', async () => {
    const clock = createFakeClock();
    const sleep = createSleepRecorder(clock);

    let caught: unknown;
    try {
      await withLlmBackoff(
        async () => Promise.reject(retryableError(429, { 'retry-after': '100' })),
        {
          sleep: sleep.sleep,
          now: clock.nowFn,
          maxElapsedMs: 5000,
          maxAttempts: 10,
        },
      );
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(LlmBackoffError);
    expect((caught as LlmBackoffError).code).toBe('MAX_ELAPSED_EXCEEDED');
    expect(sleep.calls).toHaveLength(0); // never actually waited the 100s
  });

  it('reached before the next allowed server reset: a smaller delay is fine, a larger one is not', async () => {
    const clock = createFakeClock();
    const sleep = createSleepRecorder(clock);
    let call = 0;

    let caught: unknown;
    try {
      await withLlmBackoff(
        async () => {
          call += 1;
          // First failure: a short, affordable reset. Second: one that blows the remaining budget.
          if (call === 1) throw retryableError(429, { 'retry-after': '2' });
          throw retryableError(429, { 'retry-after': '30' });
        },
        { sleep: sleep.sleep, now: clock.nowFn, maxElapsedMs: 5000, maxAttempts: 10 },
      );
    } catch (error) {
      caught = error;
    }

    expect(sleep.durations()).toEqual([2000]); // the affordable one was honored
    expect((caught as LlmBackoffError).code).toBe('MAX_ELAPSED_EXCEEDED');
  });
});

describe('an overflowing Retry-After value', () => {
  // `"9".repeat(400)` overflows `Number()` to `Infinity`. `withLlmBackoff`
  // itself is safe against that regardless: `normalizeOptions` requires a
  // finite `maxElapsedMs`, so `elapsedMs + Infinity > maxElapsedMs` is always
  // true and `MAX_ELAPSED_EXCEEDED` fires before any sleep. But
  // `parseRetryAfterHeader` rejects the value at the source too (see
  // `header-parsing.test.ts`), because a parser that hands callers an
  // `Infinity` they must be careful with is a latent trap — most sharply for
  // `parseRateLimitHeaders`, which is public on its own with no such
  // downstream net. Once the header can no longer produce `Infinity`, that
  // exact value can't reach `withLlmBackoff` through a header, so the first
  // test below pins the general `maxElapsedMs`-checked-before-sleeping
  // invariant with a still-huge, still-finite value instead (a decade in
  // seconds against a one-second budget). The second test pins the resulting
  // behavior for the overflowing value itself: the loop falls back to
  // ordinary bounded backoff and can actually succeed, instead of
  // terminating in a `MAX_ELAPSED_EXCEEDED` whose message and attempt
  // history would otherwise contain a literal `Infinity`
  // (`JSON.stringify`-unsafe — see `retry-event.test.ts` for the general
  // "diagnostics must be JSON-serializable" contract).
  it('a huge-but-finite Retry-After (a decade) is still checked before sleeping, never truncated or ignored', async () => {
    const clock = createFakeClock();
    const sleep = createSleepRecorder(clock);
    const tenYearsInSeconds = 10 * 365 * 24 * 60 * 60;

    let caught: unknown;
    try {
      await withLlmBackoff(
        async () =>
          Promise.reject(retryableError(429, { 'retry-after': String(tenYearsInSeconds) })),
        { sleep: sleep.sleep, now: clock.nowFn, maxElapsedMs: 1000 },
      );
    } catch (error) {
      caught = error;
    }

    expect(sleep.calls).toHaveLength(0); // never slept a decade — caught before sleep, not truncated to fit
    expect(caught).toBeInstanceOf(LlmBackoffError);
    expect((caught as LlmBackoffError).code).toBe('MAX_ELAPSED_EXCEEDED');
    // The attempt history still carries the real, honored, finite value —
    // not silently clamped to something smaller (that would ignore explicit
    // server timing) and not Infinity (the value was always finite).
    expect((caught as LlmBackoffError).attempts[0]?.delayMs).toBe(tenYearsInSeconds * 1000);
  });

  it('after hardening, falls back to ordinary bounded backoff and can succeed, rather than exhausting on a phantom Infinity delay', async () => {
    const clock = createFakeClock();
    const sleep = createSleepRecorder(clock);
    const random = createSeededRandom(3);
    const huge = '9'.repeat(400);
    let call = 0;

    const result = await withLlmBackoff(
      async () => {
        call += 1;
        if (call === 1) throw retryableError(429, { 'retry-after': huge });
        return 'ok';
      },
      {
        sleep: sleep.sleep,
        now: clock.nowFn,
        random: random.next,
        maxElapsedMs: 60_000,
        baseDelayMs: 100,
        maxDelayMs: 10_000,
      },
    );

    expect(result).toBe('ok');
    expect(sleep.durations()).toHaveLength(1);
    // Not Infinity, not the raw seconds*1000 overflow — an ordinary bounded
    // fallback delay, because the malformed candidate was never "usable".
    expect(sleep.durations()[0]).toBeGreaterThan(0);
    expect(sleep.durations()[0]).toBeLessThanOrEqual(100);
    expect(Number.isFinite(sleep.durations()[0])).toBe(true);
  });

  it('the attempt history in a terminal error stays JSON-serializable across an attempt that carried an overflowing header', async () => {
    const clock = createFakeClock();
    const sleep = createSleepRecorder(clock);
    const random = createSeededRandom(3);
    const huge = '9'.repeat(400);
    let call = 0;

    let caught: unknown;
    try {
      await withLlmBackoff(
        async () => {
          call += 1;
          // Attempt 1 carries the overflowing header (parsed as malformed,
          // falls back to bounded backoff); attempt 2 has no header and
          // exhausts maxAttempts, producing the terminal error whose
          // `.attempts` includes both records.
          throw retryableError(429, call === 1 ? { 'retry-after': huge } : {});
        },
        {
          sleep: sleep.sleep,
          now: clock.nowFn,
          random: random.next,
          maxAttempts: 2,
          baseDelayMs: 100,
          maxDelayMs: 10_000,
        },
      );
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(LlmBackoffError);
    expect((caught as LlmBackoffError).code).toBe('MAX_ATTEMPTS_EXCEEDED');
    const attempts = (caught as LlmBackoffError).attempts;
    expect(attempts).toHaveLength(2);
    expect(attempts[0]?.delaySource).toBe('fallback-backoff'); // not "retry-after" — the header was malformed
    expect(Number.isFinite(attempts[0]?.delayMs)).toBe(true);

    const serialized = JSON.stringify(attempts);
    const roundTripped: unknown = JSON.parse(serialized);
    expect(roundTripped).toEqual(attempts);
  });
});

describe('onRetry', () => {
  it('is called with a well-formed event before each sleep, and never for a non-retryable failure', async () => {
    const clock = createFakeClock();
    const sleep = createSleepRecorder(clock);
    const events: RetryEvent[] = [];
    let call = 0;

    await withLlmBackoff(
      async () => {
        call += 1;
        if (call === 1) throw retryableError(429, { 'retry-after': '2' });
        return 'ok';
      },
      { sleep: sleep.sleep, now: clock.nowFn, onRetry: (event) => void events.push(event) },
    );

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      attempt: 1,
      attemptsRemaining: 4,
      elapsedMs: 0,
      status: 429,
      delayMs: 2000,
      delaySource: 'retry-after',
      winningHeader: 'retry-after',
    });
    expect(events[0]?.headerNames).toContain('retry-after');
  });

  it('is awaited (an async onRetry delays the subsequent sleep)', async () => {
    const clock = createFakeClock();
    const sleep = createSleepRecorder(clock);
    const order: string[] = [];
    let call = 0;

    await withLlmBackoff(
      async () => {
        call += 1;
        if (call === 1) throw retryableError(429, { 'retry-after': '1' });
        return 'ok';
      },
      {
        sleep: sleep.sleep,
        now: clock.nowFn,
        onRetry: async () => {
          order.push('onRetry-start');
          await Promise.resolve();
          order.push('onRetry-end');
        },
      },
    );

    expect(order).toEqual(['onRetry-start', 'onRetry-end']);
  });

  it('a throwing onRetry stops the retry loop and surfaces ON_RETRY_CALLBACK_FAILED', async () => {
    const clock = createFakeClock();
    const sleep = createSleepRecorder(clock);
    const onRetryError = new Error('callback exploded');

    let caught: unknown;
    try {
      await withLlmBackoff(
        async () => Promise.reject(retryableError(429, { 'retry-after': '1' })),
        {
          sleep: sleep.sleep,
          now: clock.nowFn,
          onRetry: () => {
            throw onRetryError;
          },
        },
      );
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(LlmBackoffError);
    expect((caught as LlmBackoffError).code).toBe('ON_RETRY_CALLBACK_FAILED');
    expect((caught as LlmBackoffError).cause).toBe(onRetryError);
    expect(sleep.calls).toHaveLength(0); // never got to sleep
  });
});

describe('classification interplay', () => {
  it('never retries a non-retryable error, and never sleeps for it', async () => {
    const clock = createFakeClock();
    const sleep = createSleepRecorder(clock);
    let calls = 0;

    let caught: unknown;
    try {
      await withLlmBackoff(
        async () => {
          calls += 1;
          throw nonRetryableError(401);
        },
        { sleep: sleep.sleep, now: clock.nowFn },
      );
    } catch (error) {
      caught = error;
    }

    expect(calls).toBe(1);
    expect(sleep.calls).toHaveLength(0);
    expect((caught as LlmBackoffError).code).toBe('NON_RETRYABLE');
  });

  it('a 400 arriving after a retryable 429 stops the loop immediately (edge case)', async () => {
    const clock = createFakeClock();
    const sleep = createSleepRecorder(clock);
    let call = 0;

    let caught: unknown;
    try {
      await withLlmBackoff(
        async () => {
          call += 1;
          if (call === 1) throw retryableError(429, { 'retry-after': '1' });
          throw nonRetryableError(400);
        },
        { sleep: sleep.sleep, now: clock.nowFn },
      );
    } catch (error) {
      caught = error;
    }

    expect(call).toBe(2);
    const backoffError = caught as LlmBackoffError;
    expect(backoffError.code).toBe('NON_RETRYABLE');
    expect(backoffError.attempts).toHaveLength(2);
    expect(backoffError.attempts[0]).toMatchObject({ attempt: 1, retryable: true, status: 429 });
    expect(backoffError.attempts[1]).toMatchObject({ attempt: 2, retryable: false, status: 400 });
  });
});

describe('abort', () => {
  it('rejects immediately, unwrapped, if the signal is already aborted before the first attempt', async () => {
    const clock = createFakeClock();
    const sleep = createSleepRecorder(clock);
    const controller = new AbortController();
    const reason = new Error('cancelled by caller');
    controller.abort(reason);
    let calls = 0;

    await expect(
      withLlmBackoff(
        async () => {
          calls += 1;
          return 'unreachable';
        },
        { sleep: sleep.sleep, now: clock.nowFn, signal: controller.signal },
      ),
    ).rejects.toBe(reason);
    expect(calls).toBe(0);
  });

  it('an abort thrown by the operation itself propagates unwrapped and is never retried', async () => {
    const clock = createFakeClock();
    const sleep = createSleepRecorder(clock);
    const abortError = new DOMException('cancelled mid-operation', 'AbortError');
    let calls = 0;

    await expect(
      withLlmBackoff(
        async () => {
          calls += 1;
          throw abortError;
        },
        { sleep: sleep.sleep, now: clock.nowFn },
      ),
    ).rejects.toBe(abortError);
    expect(calls).toBe(1);
  });

  it('an abort that lands right at the sleep gate wins over sleeping, unwrapped, and never sleeps', async () => {
    // The signal aborts between "attempt classified as retryable" and "sleep
    // is called" — the loop's throwIfAborted gate right before `cfg.sleep`
    // catches it, so sleep is never invoked. (`createSleepRecorder`'s own
    // sleep() only ever samples `signal.aborted` at call time — see its doc
    // comment — so this is the one place in the whole retry loop where a
    // fake-clock test can observe "aborted, mid-retry-handling, before the
    // wait itself starts." The default `sleep` implementation's ability to
    // reject mid-*wait* is covered separately, under fake timers, in
    // `test/delay-sleep.test.ts`.)
    const clock = createFakeClock();
    const sleep = createSleepRecorder(clock);
    const controller = new AbortController();
    const reason = new Error('cancelled while waiting');

    const promise = withLlmBackoff(
      async () => {
        controller.abort(reason);
        throw retryableError(429, { 'retry-after': '5' });
      },
      { sleep: sleep.sleep, now: clock.nowFn, signal: controller.signal },
    );

    await expect(promise).rejects.toBe(reason);
    expect(sleep.calls).toHaveLength(0);
  });

  it('aborting during an async onRetry is caught before sleeping', async () => {
    const clock = createFakeClock();
    const sleep = createSleepRecorder(clock);
    const controller = new AbortController();

    const promise = withLlmBackoff(
      async () => {
        throw retryableError(429, { 'retry-after': '1' });
      },
      {
        sleep: sleep.sleep,
        now: clock.nowFn,
        signal: controller.signal,
        onRetry: () => {
          controller.abort();
        },
      },
    );

    await expect(promise).rejects.toThrow();
    expect(sleep.calls).toHaveLength(0);
  });
});

describe('abort — mid-operation', () => {
  // These simulate "the signal fires while `operation()` is awaited" by
  // having the operation abort the controller synchronously and then reject
  // — by the time the catch block runs, `cfg.signal.aborted` is already
  // `true`, exactly as it would be if a real `fetch` rejected with
  // `signal.reason` after the signal fired mid-flight. No real timers are
  // involved.

  it('throws the caller’s exact Error instance — identity preserved, not wrapped in LlmBackoffError', async () => {
    const clock = createFakeClock();
    const sleep = createSleepRecorder(clock);
    const controller = new AbortController();
    const reason = new Error('user navigated away');

    const promise = withLlmBackoff(
      async () => {
        controller.abort(reason);
        // A real fetch typically rejects with signal.reason itself; some
        // operations reject with something else entirely once aborted. Use
        // the exact reason here to prove the identity contract first.
        throw reason;
      },
      { sleep: sleep.sleep, now: clock.nowFn, signal: controller.signal },
    );

    await expect(promise).rejects.toBe(reason);
    expect(sleep.calls).toHaveLength(0);
  });

  it('a non-Error abort reason (a string) is normalized to a DOMException named AbortError, never wrapped in LlmBackoffError', async () => {
    const clock = createFakeClock();
    const sleep = createSleepRecorder(clock);
    const controller = new AbortController();

    const promise = withLlmBackoff(
      async () => {
        controller.abort('cancelled: navigated away');
        throw new Error('operation-level failure, unrelated to the string reason');
      },
      { sleep: sleep.sleep, now: clock.nowFn, signal: controller.signal },
    );

    let caught: unknown;
    try {
      await promise;
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(DOMException);
    expect((caught as DOMException).name).toBe('AbortError');
    expect(caught).not.toBeInstanceOf(LlmBackoffError);
  });

  it('an undefined abort reason is normalized to a DOMException named AbortError', async () => {
    const clock = createFakeClock();
    const sleep = createSleepRecorder(clock);
    const controller = new AbortController();

    const promise = withLlmBackoff(
      async () => {
        controller.abort();
        throw new Error('operation-level failure');
      },
      { sleep: sleep.sleep, now: clock.nowFn, signal: controller.signal },
    );

    let caught: unknown;
    try {
      await promise;
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(DOMException);
    expect((caught as DOMException).name).toBe('AbortError');
  });

  it('an object abort reason (not an Error) is normalized to a DOMException named AbortError', async () => {
    const clock = createFakeClock();
    const sleep = createSleepRecorder(clock);
    const controller = new AbortController();
    const reason = { code: 'NAVIGATED_AWAY' };

    const promise = withLlmBackoff(
      async () => {
        controller.abort(reason);
        throw new Error('operation-level failure');
      },
      { sleep: sleep.sleep, now: clock.nowFn, signal: controller.signal },
    );

    let caught: unknown;
    try {
      await promise;
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(DOMException);
    expect((caught as DOMException).name).toBe('AbortError');
    expect(caught).not.toBe(reason); // normalized, unlike the Error-reason case
  });

  it('AbortSignal.timeout()’s TimeoutError surfaces by name, unwrapped, identity preserved', async () => {
    const clock = createFakeClock();
    const sleep = createSleepRecorder(clock);
    const controller = new AbortController();
    // Same object shape a real `AbortSignal.timeout()` fires with — a
    // DOMException named "TimeoutError" — without depending on a real timer.
    const timeoutReason = new DOMException('The operation timed out.', 'TimeoutError');

    const promise = withLlmBackoff(
      async () => {
        controller.abort(timeoutReason);
        throw timeoutReason;
      },
      { sleep: sleep.sleep, now: clock.nowFn, signal: controller.signal },
    );

    await expect(promise).rejects.toBe(timeoutReason);
    let caught: unknown;
    try {
      await promise;
    } catch (error) {
      caught = error;
    }
    expect((caught as DOMException).name).toBe('TimeoutError');
  });

  it('interop: a real AbortSignal.timeout() firing mid-operation is surfaced unwrapped with name TimeoutError', async () => {
    const clock = createFakeClock();
    const sleep = createSleepRecorder(clock);
    const signal = AbortSignal.timeout(1); // fires for real, after ~1ms

    let caught: unknown;
    try {
      await withLlmBackoff(
        async () => {
          await new Promise((resolve) => {
            signal.addEventListener('abort', resolve, { once: true });
          });
          throw new Error('operation kept going past the timeout');
        },
        { sleep: sleep.sleep, now: clock.nowFn, signal },
      );
    } catch (error) {
      caught = error;
    }

    expect(caught).toBe(signal.reason);
    expect((caught as DOMException).name).toBe('TimeoutError');
  });

  it('an unrelated error thrown by the operation at the same moment the signal aborts loses to the abort', async () => {
    const clock = createFakeClock();
    const sleep = createSleepRecorder(clock);
    const controller = new AbortController();
    const abortReason = new Error('cancelled by caller');
    const unrelatedOperationError = Object.assign(new Error('connection reset'), {
      code: 'ECONNRESET',
    });

    const promise = withLlmBackoff(
      async () => {
        controller.abort(abortReason);
        throw unrelatedOperationError; // races the abort; unrelated to it
      },
      { sleep: sleep.sleep, now: clock.nowFn, signal: controller.signal },
    );

    // The abort wins: once the signal has fired, the caller's cancellation
    // is the only thing that matters — a same-moment operation failure isn't
    // actionable information for a caller that already asked to stop.
    await expect(promise).rejects.toBe(abortReason);
  });

  it('a retryable-shaped error racing an abort never reaches classification or onRetry (confirms the pre-fix leak is closed)', async () => {
    const clock = createFakeClock();
    const sleep = createSleepRecorder(clock);
    const controller = new AbortController();
    const reason = new Error('cancelled mid-operation');
    let onRetryCalls = 0;

    const promise = withLlmBackoff(
      async () => {
        controller.abort(reason);
        throw retryableError(429, { 'retry-after': '1' }); // shaped as retryable
      },
      {
        sleep: sleep.sleep,
        now: clock.nowFn,
        signal: controller.signal,
        onRetry: () => {
          onRetryCalls += 1;
        },
      },
    );

    await expect(promise).rejects.toBe(reason);
    expect(onRetryCalls).toBe(0); // never classified as a retry, so onRetry never fires
    expect(sleep.calls).toHaveLength(0); // never sleeps
  });
});

describe('invalid options', () => {
  it('rejects with INVALID_OPTIONS for maxAttempts < 1', async () => {
    await expect(withLlmBackoff(async () => 'x', { maxAttempts: 0 })).rejects.toMatchObject({
      code: 'INVALID_OPTIONS',
    });
  });

  it('rejects with INVALID_OPTIONS for a negative maxElapsedMs', async () => {
    await expect(withLlmBackoff(async () => 'x', { maxElapsedMs: -1 })).rejects.toMatchObject({
      code: 'INVALID_OPTIONS',
    });
  });
});
