/**
 * `attemptTimeoutMs` — the per-attempt ceiling, and the timeout-vs-abort race
 * matrix it introduces.
 *
 * The whole point of the option is that a hung attempt is *retried* rather
 * than propagated, which puts it on the opposite side of two rules the rest of
 * this package enforces hard: an abort is never retried, and a non-retryable
 * failure is never retried. So every test here is really asking one of two
 * questions — did the ceiling correctly claim this failure, or did it
 * correctly leave it alone.
 */
import { createFakeClock, createSleepRecorder, type FakeClock } from '@llm-kit/test-utils';
import { describe, expect, it, vi } from 'vitest';
import { toAbortError } from '../src/abort-utils.js';
import { AttemptTimeoutError, LlmBackoffError } from '../src/errors.js';
import { fetchWithLlmBackoff } from '../src/fetch-with-llm-backoff.js';
import { withLlmBackoff } from '../src/with-llm-backoff.js';
import type { RetryEvent } from '../src/types.js';

const CEILING_MS = 10_000;

/**
 * Two sleep shapes, because the ceiling and the retry delay share one
 * injectable `sleep` and the tests need opposite things from it.
 *
 * `impatient` is the plain recorder: the ceiling resolves on the next
 * microtask, so any operation that does not settle immediately loses the race
 * — that is how a hung call is simulated without a real timer.
 *
 * `patient` never resolves the ceiling at all, only rejects it when the
 * attempt settles and cancels it. That is the shape for asserting the ceiling
 * does *not* fire, and for counting cancellations to prove no timer is left
 * armed.
 */
function createSleeps(clock: FakeClock): {
  impatient: (ms: number, signal?: AbortSignal) => Promise<void>;
  patient: (ms: number, signal?: AbortSignal) => Promise<void>;
  durations: () => readonly number[];
  ceilingsCancelled: () => number;
} {
  const recorder = createSleepRecorder(clock);
  let cancelled = 0;

  return {
    impatient: recorder.sleep.bind(recorder),
    patient: (ms, signal) => {
      if (ms !== CEILING_MS) return recorder.sleep(ms, signal);
      return new Promise<void>((_resolve, reject) => {
        signal?.addEventListener(
          'abort',
          () => {
            cancelled += 1;
            reject(toAbortError(signal.reason));
          },
          { once: true },
        );
      });
    },
    durations: () => recorder.durations(),
    ceilingsCancelled: () => cancelled,
  };
}

/** An operation that never settles on its own — the hung LLM call. */
function hangs(record?: (signal: AbortSignal | undefined) => void) {
  return async (context: { signal?: AbortSignal }): Promise<never> => {
    record?.(context.signal);
    return new Promise<never>((_resolve, reject) => {
      context.signal?.addEventListener(
        'abort',
        () => reject(toAbortError(context.signal?.reason)),
        {
          once: true,
        },
      );
    });
  };
}

describe('withLlmBackoff — attemptTimeoutMs retries a hung attempt', () => {
  it('abandons a hung attempt at the ceiling and succeeds on the next one', async () => {
    const clock = createFakeClock();
    const sleeps = createSleeps(clock);
    let calls = 0;

    const result = await withLlmBackoff(
      async (context) => {
        calls += 1;
        if (calls === 1) return hangs()(context);
        return 'ok';
      },
      {
        attemptTimeoutMs: CEILING_MS,
        sleep: sleeps.impatient,
        now: clock.nowFn,
        random: () => 0,
      },
    );

    expect(result).toBe('ok');
    expect(calls).toBe(2);
    // The ceiling, then the retry delay. Time spent hung is real time.
    expect(sleeps.durations()[0]).toBe(CEILING_MS);
  });

  it('cancels the in-flight call rather than only walking away from it', async () => {
    const clock = createFakeClock();
    const sleeps = createSleeps(clock);
    const signals: (AbortSignal | undefined)[] = [];
    let calls = 0;

    await withLlmBackoff(
      async (context) => {
        calls += 1;
        if (calls === 1) return hangs((signal) => signals.push(signal))(context);
        return 'ok';
      },
      { attemptTimeoutMs: CEILING_MS, sleep: sleeps.impatient, now: clock.nowFn, random: () => 0 },
    );

    const [first] = signals;
    expect(first?.aborted).toBe(true);
    // The reason names the ceiling, so an operation that surfaces its own
    // abort reason produces something diagnosable rather than a bare
    // "aborted".
    expect(first?.reason).toBeInstanceOf(AttemptTimeoutError);
    expect((first?.reason as AttemptTimeoutError).attemptTimeoutMs).toBe(CEILING_MS);
  });

  it('exhausts attempts on a permanently hung call and reports the timeout as the cause', async () => {
    const clock = createFakeClock();
    const sleeps = createSleeps(clock);

    let caught: unknown;
    try {
      await withLlmBackoff(hangs(), {
        attemptTimeoutMs: CEILING_MS,
        maxAttempts: 3,
        maxElapsedMs: 10 * 60_000,
        sleep: sleeps.impatient,
        now: clock.nowFn,
        random: () => 0,
      });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(LlmBackoffError);
    const backoffError = caught as LlmBackoffError;
    expect(backoffError.code).toBe('MAX_ATTEMPTS_EXCEEDED');
    expect(backoffError.cause).toBeInstanceOf(AttemptTimeoutError);
    expect((backoffError.cause as AttemptTimeoutError).attempt).toBe(3);
    expect(backoffError.attempts).toHaveLength(3);
    expect(backoffError.attempts[0]?.retryable).toBe(true);
    expect(backoffError.attempts[0]?.status).toBeUndefined();
    expect(backoffError.attempts[0]?.reason).toContain('attemptTimeoutMs');
  });

  it('counts time spent hung against maxElapsedMs', async () => {
    const clock = createFakeClock();
    const sleeps = createSleeps(clock);

    let caught: unknown;
    try {
      await withLlmBackoff(hangs(), {
        attemptTimeoutMs: CEILING_MS,
        maxAttempts: 10,
        maxElapsedMs: 15_000, // room for one ceiling, not two
        sleep: sleeps.impatient,
        now: clock.nowFn,
        random: () => 0,
      });
    } catch (error) {
      caught = error;
    }

    const backoffError = caught as LlmBackoffError;
    expect(backoffError.code).toBe('MAX_ELAPSED_EXCEEDED');
    expect(backoffError.cause).toBeInstanceOf(AttemptTimeoutError);
    expect(backoffError.attempts).toHaveLength(2);
  });

  it('reports the timeout through onRetry as a retryable, statusless, JSON-serializable event', async () => {
    const clock = createFakeClock();
    const sleeps = createSleeps(clock);
    const events: RetryEvent[] = [];
    let calls = 0;

    await withLlmBackoff(
      async (context) => {
        calls += 1;
        if (calls === 1) return hangs()(context);
        return 'ok';
      },
      {
        attemptTimeoutMs: CEILING_MS,
        sleep: sleeps.impatient,
        now: clock.nowFn,
        random: () => 0,
        onRetry: (event) => {
          events.push(event);
        },
      },
    );

    expect(events).toHaveLength(1);
    const [event] = events;
    expect(event?.status).toBeUndefined();
    expect(event?.reason).toContain('attemptTimeoutMs (10000ms)');
    // No headers to read, so delay selection falls through to the bounded
    // fallback tier exactly like any other header-less retryable failure.
    expect(event?.delaySource).toBe('fallback-backoff');
    expect(event?.headerNames).toEqual([]);
    expect(JSON.parse(JSON.stringify(event))).toBeTruthy();
  });
});

describe('withLlmBackoff — attemptTimeoutMs leaves everything else alone', () => {
  it('does not fire for an attempt that finishes in time, and cancels its own timer', async () => {
    const clock = createFakeClock();
    const sleeps = createSleeps(clock);

    const result = await withLlmBackoff(async () => 'ok', {
      attemptTimeoutMs: CEILING_MS,
      sleep: sleeps.patient,
      now: clock.nowFn,
    });

    expect(result).toBe('ok');
    // The armed ceiling was cancelled when the attempt settled — a leaked one
    // would keep a real timer alive per attempt in production.
    expect(sleeps.ceilingsCancelled()).toBe(1);
    expect(sleeps.durations()).toEqual([]);
  });

  it('classifies a failure that arrived before the ceiling as itself, not as a timeout', async () => {
    const clock = createFakeClock();
    const sleeps = createSleeps(clock);

    let caught: unknown;
    try {
      await withLlmBackoff(
        async () => {
          throw Object.assign(new Error('bad request'), { status: 400 });
        },
        { attemptTimeoutMs: CEILING_MS, sleep: sleeps.patient, now: clock.nowFn },
      );
    } catch (error) {
      caught = error;
    }

    const backoffError = caught as LlmBackoffError;
    expect(backoffError.code).toBe('NON_RETRYABLE');
    expect(backoffError.attempts).toHaveLength(1);
    expect(sleeps.ceilingsCancelled()).toBe(1);
  });

  it('still honors a server delay when the attempt fails fast under a ceiling', async () => {
    const clock = createFakeClock();
    const sleeps = createSleeps(clock);
    let calls = 0;

    await withLlmBackoff(
      async () => {
        calls += 1;
        if (calls === 1) {
          throw Object.assign(new Error('rate limited'), {
            status: 429,
            headers: { 'retry-after': '4' },
          });
        }
        return 'ok';
      },
      { attemptTimeoutMs: CEILING_MS, sleep: sleeps.patient, now: clock.nowFn },
    );

    expect(sleeps.durations()).toEqual([4000]);
  });

  it('is off by default — a hung call is not interrupted when no ceiling is set', async () => {
    const clock = createFakeClock();
    const sleeps = createSleeps(clock);
    let settled = false;

    const promise = withLlmBackoff(hangs(), { sleep: sleeps.impatient, now: clock.nowFn }).then(
      () => {
        settled = true;
      },
      () => {
        settled = true;
      },
    );

    await Promise.resolve();
    await Promise.resolve();
    expect(settled).toBe(false);
    void promise; // deliberately left hanging: that is the behaviour under test
  });

  it.each([
    ['zero', 0],
    ['negative', -1],
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
  ])('rejects a %s attemptTimeoutMs as INVALID_OPTIONS', async (_label, value) => {
    await expect(
      withLlmBackoff(async () => 'never runs', { attemptTimeoutMs: value }),
    ).rejects.toMatchObject({ code: 'INVALID_OPTIONS' });
  });
});

describe('withLlmBackoff — a caller abort outranks the ceiling', () => {
  it('propagates the caller reason unwrapped when both are in play', async () => {
    const clock = createFakeClock();
    const sleeps = createSleeps(clock);
    const controller = new AbortController();
    const reason = new Error('user navigated away');

    const promise = withLlmBackoff(hangs(), {
      attemptTimeoutMs: CEILING_MS,
      sleep: sleeps.patient, // the ceiling never fires; only the caller does
      now: clock.nowFn,
      signal: controller.signal,
    });
    controller.abort(reason);

    await expect(promise).rejects.toBe(reason);
  });

  it('wins even when the ceiling has already fired on the same attempt', async () => {
    const clock = createFakeClock();
    const sleeps = createSleeps(clock);
    const controller = new AbortController();
    const reason = new Error('cancelled while the ceiling was firing');

    // The operation hangs and the ceiling is impatient, so the timeout is
    // racing. Aborting before the loop observes the rejection means both
    // conditions are true at the moment of classification — the caller must
    // still win, and must not be retried.
    const promise = withLlmBackoff(
      async (context) => {
        controller.abort(reason);
        return hangs()(context);
      },
      {
        attemptTimeoutMs: CEILING_MS,
        sleep: sleeps.impatient,
        now: clock.nowFn,
        signal: controller.signal,
        random: () => 0,
      },
    );

    await expect(promise).rejects.toBe(reason);
  });

  it('an AttemptTimeoutError is not an abort — it is retried, and never propagates unwrapped', () => {
    const error = new AttemptTimeoutError(2, CEILING_MS);
    // `isAbortError` keys off the name, and the retry loop rethrows anything
    // it recognizes as an abort without wrapping or retrying it.
    expect(error.name).not.toBe('AbortError');
    expect(error.code).toBe('ATTEMPT_TIMEOUT');
  });
});

describe('fetchWithLlmBackoff — attemptTimeoutMs', () => {
  it('cancels a hung fetch at the ceiling and retries it', async () => {
    const clock = createFakeClock();
    const sleeps = createSleeps(clock);
    const seen: (AbortSignal | undefined)[] = [];
    let calls = 0;

    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input: unknown, init?: RequestInit) => {
        calls += 1;
        seen.push(init?.signal ?? undefined);
        if (calls === 1) {
          return new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener(
              'abort',
              () => reject(toAbortError(init.signal?.reason)),
              { once: true },
            );
          });
        }
        return new Response('ok', { status: 200 });
      }),
    );

    try {
      const response = await fetchWithLlmBackoff('https://example.test/resource', undefined, {
        attemptTimeoutMs: CEILING_MS,
        sleep: sleeps.impatient,
        now: clock.nowFn,
        random: () => 0,
      });

      expect(response.status).toBe(200);
      expect(calls).toBe(2);
      // The signal handed to `fetch` carries the ceiling, not just the
      // caller's own signal — otherwise the timed-out request would stay in
      // flight holding its connection while the loop moved on.
      expect(seen[0]?.aborted).toBe(true);
      expect(seen[0]?.reason).toBeInstanceOf(AttemptTimeoutError);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
