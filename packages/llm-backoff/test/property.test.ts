/**
 * Property tests, seeded so a CI failure reproduces exactly from the printed
 * seed.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { classifyStatus } from '../src/classify-error.js';
import { parseRateLimitHeaders } from '../src/delay/choose-delay.js';
import { parseDuration } from '../src/delay/reset-value.js';
import { MANDATORY_NON_RETRYABLE_STATUSES, MANDATORY_RETRYABLE_STATUSES } from '../src/defaults.js';

const FAST_CHECK_SEED = 0x6c6c6d62; // 'llmb'
const FAST_CHECK_RUNS = 300;

describe('property: Retry-After seconds always maps to seconds * 1000', () => {
  it('holds for every non-negative integer', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 1_000_000 }), (seconds) => {
        const advice = parseRateLimitHeaders({ 'retry-after': String(seconds) });
        expect(advice.delayMs).toBe(seconds * 1000);
        expect(advice.source).toBe('retry-after');
      }),
      { seed: FAST_CHECK_SEED, numRuns: FAST_CHECK_RUNS },
    );
  });
});

describe('property: the mandatory classification pair is never overridable', () => {
  it('429/529 are always retryable and 400/401 are never retryable, for any options', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 0, max: 599 }), { maxLength: 10 }),
        fc.array(fc.integer({ min: 0, max: 599 }), { maxLength: 10 }),
        (retryableStatuses, nonRetryableStatuses) => {
          for (const status of MANDATORY_RETRYABLE_STATUSES) {
            expect(
              classifyStatus(status, { retryableStatuses, nonRetryableStatuses }).retryable,
            ).toBe(true);
          }
          for (const status of MANDATORY_NON_RETRYABLE_STATUSES) {
            expect(
              classifyStatus(status, { retryableStatuses, nonRetryableStatuses }).retryable,
            ).toBe(false);
          }
        },
      ),
      { seed: FAST_CHECK_SEED, numRuns: FAST_CHECK_RUNS },
    );
  });
});

/** Generates a Go-style duration string plus the millisecond total it should parse to. */
const durationSegment = fc.oneof(
  fc.integer({ min: 0, max: 999 }).map((n) => ({ text: `${String(n)}ms`, ms: n })),
  fc.integer({ min: 0, max: 59 }).map((n) => ({ text: `${String(n)}s`, ms: n * 1000 })),
  fc.integer({ min: 0, max: 59 }).map((n) => ({ text: `${String(n)}m`, ms: n * 60_000 })),
  fc.integer({ min: 0, max: 23 }).map((n) => ({ text: `${String(n)}h`, ms: n * 3_600_000 })),
);

describe('property: OpenAI-style duration parsing sums every segment exactly', () => {
  it('holds for any concatenation of h/m/s/ms segments', () => {
    fc.assert(
      fc.property(fc.array(durationSegment, { minLength: 1, maxLength: 4 }), (segments) => {
        const text = segments.map((s) => s.text).join('');
        const expectedMs = segments.reduce((total, s) => total + s.ms, 0);
        expect(parseDuration(text)).toBe(expectedMs);
      }),
      { seed: FAST_CHECK_SEED, numRuns: FAST_CHECK_RUNS },
    );
  });
});

describe('property: parseRateLimitHeaders never throws and always returns JSON-serializable advice', () => {
  it('holds for arbitrary header bags of arbitrary strings', () => {
    fc.assert(
      fc.property(
        fc.dictionary(
          fc.oneof(
            fc.constantFrom(
              'retry-after',
              'x-ratelimit-reset-requests',
              'x-ratelimit-reset-tokens',
              'x-ratelimit-reset',
              'ratelimit-reset',
              'anthropic-ratelimit-requests-reset',
            ),
            fc.string({ minLength: 1, maxLength: 20 }),
          ),
          fc.string({ maxLength: 40 }),
          { maxKeys: 8 },
        ),
        fc.constantFrom<'auto' | 'openai' | 'anthropic' | 'google' | undefined>(
          undefined,
          'auto',
          'openai',
          'anthropic',
          'google',
        ),
        (headers, provider) => {
          const advice = parseRateLimitHeaders(headers, { provider });
          const roundTripped: unknown = JSON.parse(JSON.stringify(advice));
          expect(roundTripped).toEqual(advice);
          if (advice.delayMs !== undefined) {
            expect(advice.delayMs).toBeGreaterThanOrEqual(0);
          }
        },
      ),
      { seed: FAST_CHECK_SEED, numRuns: FAST_CHECK_RUNS },
    );
  });
});
