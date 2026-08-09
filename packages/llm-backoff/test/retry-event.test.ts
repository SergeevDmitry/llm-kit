/**
 * `RetryEvent`/`LlmBackoffError.attempts` must be JSON-serializable and must
 * never leak a secret header value. `assertJsonSerializable` is the
 * repository-wide helper for the first half of that; the second half is
 * asserted directly against `sanitizeHeaderNames`.
 */
import { assertJsonSerializable, createFakeClock, createSleepRecorder } from '@llm-kit/test-utils';
import { describe, expect, it } from 'vitest';
import { LlmBackoffError } from '../src/errors.js';
import { sanitizeHeaderNames } from '../src/retry-event.js';
import { withLlmBackoff } from '../src/with-llm-backoff.js';
import type { RetryEvent } from '../src/types.js';

describe('sanitizeHeaderNames', () => {
  it('drops Authorization, Cookie, and API-key-shaped header names, case-insensitively', () => {
    const names = [
      'Authorization',
      'x-ratelimit-reset-tokens',
      'COOKIE',
      'Set-Cookie',
      'X-Api-Key',
      'retry-after',
    ];
    expect(sanitizeHeaderNames(names)).toEqual(['x-ratelimit-reset-tokens', 'retry-after']);
  });

  it('is a no-op for an already-clean list', () => {
    const names = ['retry-after', 'x-ratelimit-reset-requests'];
    expect(sanitizeHeaderNames(names)).toEqual(names);
  });
});

describe('RetryEvent and LlmBackoffError.attempts are JSON-serializable and secret-free', () => {
  it('a RetryEvent captured from a real retry round-trips through JSON', async () => {
    const clock = createFakeClock();
    const sleep = createSleepRecorder(clock);
    let captured: RetryEvent | undefined;
    let call = 0;

    await withLlmBackoff(
      async () => {
        call += 1;
        if (call === 1) {
          throw {
            status: 429,
            headers: {
              'retry-after': '2',
              authorization: 'Bearer super-secret-token',
              'x-ratelimit-reset-requests': '90s',
            },
          };
        }
        return 'ok';
      },
      { sleep: sleep.sleep, now: clock.nowFn, onRetry: (event) => void (captured = event) },
    );

    expect(captured).toBeDefined();
    assertJsonSerializable(captured, 'RetryEvent');
    expect(JSON.stringify(captured)).not.toContain('super-secret-token');
    expect(captured?.headerNames).not.toContain('authorization');
  });

  it('LlmBackoffError.attempts round-trips through JSON and never carries the raw headers object', async () => {
    const clock = createFakeClock();
    const sleep = createSleepRecorder(clock);

    let caught: unknown;
    try {
      await withLlmBackoff(
        async () =>
          Promise.reject({
            status: 429,
            headers: { authorization: 'Bearer super-secret-token', 'retry-after': '1' },
          }),
        { sleep: sleep.sleep, now: clock.nowFn, maxAttempts: 2 },
      );
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(LlmBackoffError);
    const attempts = (caught as LlmBackoffError).attempts;
    assertJsonSerializable(attempts, 'attempts');
    expect(JSON.stringify(attempts)).not.toContain('super-secret-token');
  });
});
