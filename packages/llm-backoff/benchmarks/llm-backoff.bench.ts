/**
 * Throughput baseline for `llm-backoff` (`vitest bench`), covering the two
 * scenarios that matter most: header-parsing throughput, and the zero-delay
 * retry-loop safeguard.
 *
 * Not a correctness check — `test/` owns that. `createSleepRecorder` is used
 * throughout so the retry-loop benchmarks measure this package's own
 * per-iteration overhead, never real wall-clock waiting.
 */
import { createFakeClock, createSleepRecorder } from '@llm-kit/test-utils';
import { bench, describe } from 'vitest';
import { classifyLlmError } from '../src/classify-error.js';
import { parseRateLimitHeaders } from '../src/delay/choose-delay.js';
import { withLlmBackoff } from '../src/with-llm-backoff.js';

const retryAfterHeaders = { 'retry-after': '30' };
const openaiHeaders = {
  'x-ratelimit-limit-requests': '3500',
  'x-ratelimit-limit-tokens': '90000',
  'x-ratelimit-remaining-requests': '0',
  'x-ratelimit-remaining-tokens': '5000',
  'x-ratelimit-reset-requests': '6m0s',
  'x-ratelimit-reset-tokens': '1s',
};
const anthropicHeaders = {
  'anthropic-ratelimit-requests-limit': '1000',
  'anthropic-ratelimit-requests-remaining': '0',
  'anthropic-ratelimit-requests-reset': '2026-01-01T00:00:00Z',
  'anthropic-ratelimit-tokens-limit': '100000',
  'anthropic-ratelimit-tokens-remaining': '5000',
  'anthropic-ratelimit-tokens-reset': '2026-01-01T00:05:00Z',
};
const noUsefulHeaders = { 'x-request-id': 'req_abc123', 'content-type': 'application/json' };
const openaiHeadersObject = new Headers(openaiHeaders);

describe('header-parsing throughput', () => {
  bench('Retry-After, plain object', () => {
    parseRateLimitHeaders(retryAfterHeaders);
  });

  bench('OpenAI-shaped headers, plain object, provider: auto', () => {
    parseRateLimitHeaders(openaiHeaders);
  });

  bench('OpenAI-shaped headers, real Headers instance, provider: auto', () => {
    parseRateLimitHeaders(openaiHeadersObject);
  });

  bench('Anthropic-shaped headers, plain object, provider: auto', () => {
    parseRateLimitHeaders(anthropicHeaders, { now: () => Date.parse('2025-12-31T23:55:00Z') });
  });

  bench('no usable rate-limit header present (falls through every tier)', () => {
    parseRateLimitHeaders(noUsefulHeaders);
  });

  bench('classifyLlmError on a Response with OpenAI headers, end to end', () => {
    classifyLlmError(new Response(null, { status: 429, headers: openaiHeaders }));
  });
});

describe('zero-delay retry loop safeguard', () => {
  // baseDelayMs: 0 / maxDelayMs: 0 must still make forward progress through
  // `MIN_FALLBACK_DELAY_MS`-floored sleeps, not spin the loop unbounded in a
  // single tick — see delay/fallback-backoff.ts and
  // test/fallback-backoff.test.ts for the correctness assertion this
  // benchmark backstops.
  //
  // `now: clock.nowFn` makes elapsedMs advance with the *fake* clock (the
  // same clock `sleep.sleep` advances), which is deliberate here: it lets a
  // benchmark run hundreds of "seconds" of simulated delay across its 100
  // forced retries without spending any real wall-clock time. That is
  // exactly why every bench below overrides `maxElapsedMs` generously — with
  // the default 60s budget, the accumulated *simulated* delay across 100
  // retries would legitimately trip MAX_ELAPSED_EXCEEDED partway through
  // (this package doing exactly what maxElapsedMs promises), which would
  // measure "how fast this throws" instead of "how fast the loop iterates."
  bench('100 forced retries with baseDelayMs:0/maxDelayMs:0 before success', async () => {
    const clock = createFakeClock();
    const sleep = createSleepRecorder(clock);
    let calls = 0;
    await withLlmBackoff(
      async () => {
        calls += 1;
        if (calls <= 100) throw { status: 529, headers: {} };
        return 'ok';
      },
      {
        sleep: sleep.sleep,
        now: clock.nowFn,
        baseDelayMs: 0,
        maxDelayMs: 0,
        maxAttempts: 200,
        maxElapsedMs: Number.MAX_SAFE_INTEGER,
      },
    );
  });

  bench('100 forced retries with a normal exponential fallback (baseDelayMs:500)', async () => {
    const clock = createFakeClock();
    const sleep = createSleepRecorder(clock);
    let calls = 0;
    await withLlmBackoff(
      async () => {
        calls += 1;
        if (calls <= 100) throw { status: 529, headers: {} };
        return 'ok';
      },
      {
        sleep: sleep.sleep,
        now: clock.nowFn,
        baseDelayMs: 500,
        maxDelayMs: 30_000,
        maxAttempts: 200,
        maxElapsedMs: Number.MAX_SAFE_INTEGER,
      },
    );
  });

  bench('100 retries honoring an explicit Retry-After header every time', async () => {
    const clock = createFakeClock();
    const sleep = createSleepRecorder(clock);
    let calls = 0;
    await withLlmBackoff(
      async () => {
        calls += 1;
        if (calls <= 100) throw { status: 429, headers: { 'retry-after': '1' } };
        return 'ok';
      },
      {
        sleep: sleep.sleep,
        now: clock.nowFn,
        maxAttempts: 200,
        maxElapsedMs: Number.MAX_SAFE_INTEGER,
      },
    );
  });
});
