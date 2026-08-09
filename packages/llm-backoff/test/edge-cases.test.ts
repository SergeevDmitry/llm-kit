/**
 * The package's edge-case checklist, run end to end through
 * `withLlmBackoff`/`fetchWithLlmBackoff` (not just the pure parsers) so each
 * case is proven in the shape a real caller hits it.
 * Per-format parser coverage lives in `header-parsing.test.ts`; per-status
 * classification coverage lives in `classify-error.test.ts`; this file is the
 * integration pass.
 */
import { createFakeClock, createSleepRecorder } from '@llm-kit/test-utils';
import { describe, expect, it } from 'vitest';
import type { LlmBackoffError } from '../src/errors.js';
import { withLlmBackoff } from '../src/with-llm-backoff.js';

describe('edge case: conflicting reset headers', () => {
  it('the retry loop sleeps for the maximum of two exhausted resources and reports which header won', async () => {
    const clock = createFakeClock();
    const sleep = createSleepRecorder(clock);
    const events: unknown[] = [];
    let call = 0;

    await withLlmBackoff(
      async () => {
        call += 1;
        if (call === 1) {
          throw {
            status: 429,
            headers: { 'x-ratelimit-reset-requests': '2s', 'x-ratelimit-reset-tokens': '20s' },
          };
        }
        return 'ok';
      },
      { sleep: sleep.sleep, now: clock.nowFn, onRetry: (event) => void events.push(event) },
    );

    expect(sleep.durations()).toEqual([20_000]);
    expect((events[0] as { winningHeader?: string }).winningHeader).toBe(
      'x-ratelimit-reset-tokens',
    );
  });
});

describe('edge case: malformed Retry-After falls through to a usable provider header', () => {
  it('does not give up just because the top-priority header was garbage', async () => {
    const clock = createFakeClock();
    const sleep = createSleepRecorder(clock);
    let call = 0;

    await withLlmBackoff(
      async () => {
        call += 1;
        if (call === 1) {
          throw {
            status: 429,
            headers: { 'retry-after': 'not-a-number', 'x-ratelimit-reset-requests': '3s' },
          };
        }
        return 'ok';
      },
      { sleep: sleep.sleep, now: clock.nowFn },
    );

    expect(sleep.durations()).toEqual([3000]);
  });
});

describe('edge case: a reset time already in the past', () => {
  it('clamps to a 0ms delay rather than a negative one, and the loop still sleeps 0, not skip the wait', async () => {
    const clock = createFakeClock();
    const sleep = createSleepRecorder(clock);
    const past = new Date(clock.now() - 10_000).toUTCString();
    let call = 0;

    await withLlmBackoff(
      async () => {
        call += 1;
        if (call === 1) throw { status: 429, headers: { 'retry-after': past } };
        return 'ok';
      },
      { sleep: sleep.sleep, now: clock.nowFn },
    );

    expect(sleep.durations()).toEqual([0]);
  });
});

describe('edge case: uppercase and mixed-case headers', () => {
  it('RETRY-AFTER and Retry-After are read identically', async () => {
    const clock = createFakeClock();
    const sleep = createSleepRecorder(clock);
    let call = 0;

    await withLlmBackoff(
      async () => {
        call += 1;
        if (call === 1) throw { status: 429, headers: { 'RETRY-AFTER': '7' } };
        return 'ok';
      },
      { sleep: sleep.sleep, now: clock.nowFn },
    );

    expect(sleep.durations()).toEqual([7000]);
  });
});

describe('edge case: an SDK error carrying plain-object headers (not a Headers instance)', () => {
  it('drives the exact same delay computation as a real Headers instance would', async () => {
    const clock = createFakeClock();
    const sleep = createSleepRecorder(clock);
    let call = 0;

    // A plain object is exactly what many SDK error shapes carry (see
    // extract-http-error.test.ts) — no `new Headers(...)` anywhere here.
    await withLlmBackoff(
      async () => {
        call += 1;
        if (call === 1) {
          throw { status: 429, headers: { 'retry-after': '6' } as Record<string, string> };
        }
        return 'ok';
      },
      { sleep: sleep.sleep, now: clock.nowFn },
    );

    expect(sleep.durations()).toEqual([6000]);
  });
});

describe('edge case: maxElapsedMs reached before the next allowed server reset', () => {
  it('fails fast instead of sleeping past the budget', async () => {
    const clock = createFakeClock();
    const sleep = createSleepRecorder(clock);

    let caught: unknown;
    try {
      await withLlmBackoff(
        async () => Promise.reject({ status: 429, headers: { 'retry-after': '3600' } }),
        { sleep: sleep.sleep, now: clock.nowFn, maxElapsedMs: 1000 },
      );
    } catch (error) {
      caught = error;
    }

    expect(sleep.calls).toHaveLength(0);
    expect((caught as LlmBackoffError).code).toBe('MAX_ELAPSED_EXCEEDED');
  });
});

describe('edge case: a 400 arriving after a retryable response', () => {
  it('stops immediately on the 400 without a third attempt', async () => {
    const clock = createFakeClock();
    const sleep = createSleepRecorder(clock);
    const calls: number[] = [];

    let caught: unknown;
    try {
      await withLlmBackoff(
        async () => {
          calls.push(calls.length + 1);
          if (calls.length === 1) throw { status: 529, headers: {} };
          throw { status: 400, headers: {} };
        },
        { sleep: sleep.sleep, now: clock.nowFn, maxAttempts: 10 },
      );
    } catch (error) {
      caught = error;
    }

    expect(calls).toEqual([1, 2]);
    expect((caught as LlmBackoffError).code).toBe('NON_RETRYABLE');
  });
});

describe('edge case: abort before the first attempt', () => {
  it('the operation is never called', async () => {
    const controller = new AbortController();
    controller.abort(new Error('cancelled before starting'));
    let called = false;

    await expect(
      withLlmBackoff(
        async () => {
          called = true;
          return 'unreachable';
        },
        { signal: controller.signal },
      ),
    ).rejects.toThrow();
    expect(called).toBe(false);
  });
});
