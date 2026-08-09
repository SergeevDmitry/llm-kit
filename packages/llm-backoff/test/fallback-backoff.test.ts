import { createSeededRandom } from '@llm-kit/test-utils';
import { describe, expect, it } from 'vitest';
import { computeFallbackDelayMs } from '../src/delay/fallback-backoff.js';
import { MIN_FALLBACK_DELAY_MS } from '../src/defaults.js';

describe('computeFallbackDelayMs', () => {
  it('never exceeds the exponential cap for the attempt', () => {
    const random = createSeededRandom(1);
    for (let attempt = 1; attempt <= 8; attempt += 1) {
      const delay = computeFallbackDelayMs({
        attempt,
        baseDelayMs: 100,
        maxDelayMs: 10_000,
        random: random.next,
      });
      const cap = Math.min(10_000, 100 * 2 ** (attempt - 1));
      expect(delay).toBeLessThanOrEqual(Math.max(cap, MIN_FALLBACK_DELAY_MS));
    }
  });

  it('is bounded by maxDelayMs even at a high attempt number', () => {
    const random = createSeededRandom(2);
    const delay = computeFallbackDelayMs({
      attempt: 50,
      baseDelayMs: 500,
      maxDelayMs: 5000,
      random: random.next,
    });
    expect(delay).toBeLessThanOrEqual(5000);
  });

  it('is deterministic for a given seeded random and attempt', () => {
    const a = computeFallbackDelayMs({
      attempt: 3,
      baseDelayMs: 200,
      maxDelayMs: 5000,
      random: () => 0.5,
    });
    const b = computeFallbackDelayMs({
      attempt: 3,
      baseDelayMs: 200,
      maxDelayMs: 5000,
      random: () => 0.5,
    });
    expect(a).toBe(b);
    expect(a).toBe(Math.floor(0.5 * 800)); // cap = min(5000, 200*2^2) = 800
  });

  it('random() returning 0 still yields the safeguard floor, never a true 0ms delay', () => {
    const delay = computeFallbackDelayMs({
      attempt: 1,
      baseDelayMs: 500,
      maxDelayMs: 5000,
      random: () => 0,
    });
    expect(delay).toBe(MIN_FALLBACK_DELAY_MS);
  });

  it('a baseDelayMs:0/maxDelayMs:0 configuration still returns the safeguard floor, never 0', () => {
    for (const attempt of [1, 2, 10, 100]) {
      const delay = computeFallbackDelayMs({
        attempt,
        baseDelayMs: 0,
        maxDelayMs: 0,
        random: () => Math.random(),
      });
      expect(delay).toBe(MIN_FALLBACK_DELAY_MS);
    }
  });
});
