/**
 * Fake-timer coverage for every supported delay format, using
 * `parseRateLimitHeaders` directly — the pure function every entry point
 * sits on top of. `now` is always injected via `createFakeClock`'s `nowFn`;
 * no test in this file uses a real timer.
 */
import { createFakeClock } from '@llm-kit/test-utils';
import { describe, expect, it } from 'vitest';
import {
  normalizeHeaders,
  parseRateLimitHeaders,
  recordCandidate,
} from '../src/delay/choose-delay.js';
import type { RateLimitCandidate } from '../src/types.js';

describe('Retry-After', () => {
  it('parses seconds', () => {
    const advice = parseRateLimitHeaders({ 'retry-after': '30' });
    expect(advice.delayMs).toBe(30_000);
    expect(advice.source).toBe('retry-after');
    expect(advice.headerName).toBe('retry-after');
  });

  it('parses zero seconds', () => {
    expect(parseRateLimitHeaders({ 'retry-after': '0' }).delayMs).toBe(0);
  });

  it('parses an HTTP date in the future relative to the injected clock', () => {
    const clock = createFakeClock();
    const future = new Date(clock.now() + 5000).toUTCString();
    const advice = parseRateLimitHeaders({ 'retry-after': future }, { now: clock.nowFn });
    expect(advice.delayMs).toBe(5000);
    expect(advice.source).toBe('retry-after');
  });

  it('clamps an HTTP date already in the past to 0, and reports it', () => {
    const clock = createFakeClock();
    const past = new Date(clock.now() - 5000).toUTCString();
    const advice = parseRateLimitHeaders({ 'retry-after': past }, { now: clock.nowFn });
    expect(advice.delayMs).toBe(0);
    expect(advice.warnings.some((w) => w.includes('already in the past'))).toBe(true);
  });

  it('treats a malformed Retry-After as unusable and falls through (reporting why)', () => {
    const advice = parseRateLimitHeaders({ 'retry-after': 'quite soon, probably' });
    expect(advice.delayMs).toBeUndefined();
    expect(advice.source).toBeUndefined();
    expect(advice.warnings.some((w) => w.startsWith('retry-after: malformed'))).toBe(true);
  });

  it('rejects a negative integer (not a valid Retry-After seconds form)', () => {
    const advice = parseRateLimitHeaders({ 'retry-after': '-5' });
    expect(advice.candidates[0]?.usable).toBe(false);
  });

  // `/^\d+(?:\.\d+)?$/` admits an unbounded digit string, and `Number()` maps
  // anything past ~309 digits to `Infinity`. `parseRateLimitHeaders` is a
  // public entry point on its own, with no downstream safety net guaranteed,
  // so the parser reports an overflowing value as malformed, exactly like any
  // other value it cannot make sense of, rather than as "valid explicit
  // server advice" that happens to be infinite. This doesn't shorten any
  // genuine server-mandated wait — no real server sends a delay within
  // light-years of this magnitude, so an overflowing value cannot represent a
  // real explicit timing in the first place.
  describe('an overflowing numeric value is treated as malformed', () => {
    it('treats a digit string dense enough to overflow Number() to Infinity as malformed', () => {
      const huge = '9'.repeat(400);
      const advice = parseRateLimitHeaders({ 'retry-after': huge });
      expect(advice.delayMs).toBeUndefined();
      expect(advice.source).toBeUndefined();
      expect(advice.candidates[0]?.usable).toBe(false);
      expect(advice.candidates[0]?.delayMs).toBeUndefined();
      expect(advice.warnings.some((w) => w.startsWith('retry-after: malformed'))).toBe(true);
    });

    it('also catches the case where `seconds` itself is finite but `seconds * 1000` overflows', () => {
      // ~306 nines: Number() alone stays finite here, but the *1000
      // seconds-to-milliseconds conversion pushes the product past
      // Number.MAX_VALUE and back out to Infinity.
      const stillFiniteSeconds = '9'.repeat(306);
      expect(Number.isFinite(Number(stillFiniteSeconds))).toBe(true);
      expect(Number.isFinite(Number(stillFiniteSeconds) * 1000)).toBe(false);

      const advice = parseRateLimitHeaders({ 'retry-after': stillFiniteSeconds });
      expect(advice.delayMs).toBeUndefined();
      expect(advice.candidates[0]?.usable).toBe(false);
    });

    it('never produces a candidate that fails to round-trip through JSON.stringify/parse', () => {
      const advice = parseRateLimitHeaders({ 'retry-after': '9'.repeat(400) });
      const roundTripped: unknown = JSON.parse(JSON.stringify(advice));
      expect(roundTripped).toEqual(advice);
    });

    it('an ordinary huge-but-realistic value (years, not light-years) is still honored exactly, uncapped', () => {
      // Guards against an overcorrection: only an overflowing value is
      // rejected. A merely huge one — bigger than any real server would
      // send, but nowhere near double-overflow — is still valid explicit
      // server advice and must be honored exactly, uncapped and never
      // truncated by the 32-bit setTimeout limit.
      const tenYearsInSeconds = 10 * 365 * 24 * 60 * 60;
      const advice = parseRateLimitHeaders({ 'retry-after': String(tenYearsInSeconds) });
      expect(advice.delayMs).toBe(tenYearsInSeconds * 1000);
      expect(advice.candidates[0]?.usable).toBe(true);
    });
  });
});

describe('OpenAI duration format (x-ratelimit-reset-requests / -tokens)', () => {
  it('parses a bare seconds duration', () => {
    const advice = parseRateLimitHeaders(
      { 'x-ratelimit-reset-requests': '1s' },
      { provider: 'openai' },
    );
    expect(advice.delayMs).toBe(1000);
    expect(advice.source).toBe('provider-reset-header');
    expect(advice.headerName).toBe('x-ratelimit-reset-requests');
    expect(advice.provider).toBe('openai');
  });

  it('parses a compound minutes+seconds duration', () => {
    const advice = parseRateLimitHeaders(
      { 'x-ratelimit-reset-tokens': '6m0s' },
      { provider: 'openai' },
    );
    expect(advice.delayMs).toBe(360_000);
  });

  it('parses milliseconds and hour+minute+second compounds', () => {
    expect(
      parseRateLimitHeaders({ 'x-ratelimit-reset-tokens': '12ms' }, { provider: 'openai' }).delayMs,
    ).toBe(12);
    expect(
      parseRateLimitHeaders({ 'x-ratelimit-reset-tokens': '1h2m3s' }, { provider: 'openai' })
        .delayMs,
    ).toBe(3_723_000);
  });

  it('auto-detects the OpenAI profile from the header names alone', () => {
    const advice = parseRateLimitHeaders({ 'x-ratelimit-reset-requests': '2s' });
    expect(advice.provider).toBe('openai');
    expect(advice.delayMs).toBe(2000);
  });

  it('treats a malformed duration as unusable and reports why', () => {
    const advice = parseRateLimitHeaders(
      { 'x-ratelimit-reset-requests': 'soon' },
      { provider: 'openai' },
    );
    expect(advice.delayMs).toBeUndefined();
    expect(advice.candidates[0]?.usable).toBe(false);
    expect(advice.candidates[0]?.reason).toMatch(/malformed/);
  });
});

describe('Anthropic ISO-timestamp format (anthropic-ratelimit-*-reset)', () => {
  it('parses a future timestamp relative to the injected clock', () => {
    const clock = createFakeClock();
    const future = new Date(clock.now() + 12_345).toISOString();
    const advice = parseRateLimitHeaders(
      { 'anthropic-ratelimit-requests-reset': future },
      { provider: 'anthropic', now: clock.nowFn },
    );
    expect(advice.delayMs).toBe(12_345);
    expect(advice.source).toBe('provider-reset-header');
    expect(advice.provider).toBe('anthropic');
  });

  it('clamps a past timestamp to 0 and reports it', () => {
    const clock = createFakeClock();
    const past = new Date(clock.now() - 1000).toISOString();
    const advice = parseRateLimitHeaders(
      { 'anthropic-ratelimit-tokens-reset': past },
      { provider: 'anthropic', now: clock.nowFn },
    );
    expect(advice.delayMs).toBe(0);
    expect(advice.warnings.some((w) => w.includes('already in the past'))).toBe(true);
  });

  it('auto-detects the Anthropic profile and picks the maximum among input/output token resets', () => {
    const clock = createFakeClock();
    const inputReset = new Date(clock.now() + 1000).toISOString();
    const outputReset = new Date(clock.now() + 9000).toISOString();
    const advice = parseRateLimitHeaders(
      {
        'anthropic-ratelimit-input-tokens-reset': inputReset,
        'anthropic-ratelimit-output-tokens-reset': outputReset,
      },
      { now: clock.nowFn },
    );
    expect(advice.provider).toBe('anthropic');
    expect(advice.delayMs).toBe(9000);
    expect(advice.headerName).toBe('anthropic-ratelimit-output-tokens-reset');
  });

  it('treats a non-ISO value as unusable', () => {
    const advice = parseRateLimitHeaders(
      { 'anthropic-ratelimit-requests-reset': '1699999999' },
      { provider: 'anthropic' },
    );
    expect(advice.candidates[0]?.usable).toBe(false);
  });
});

describe('generic RateLimit-Reset (IETF draft, delta-seconds)', () => {
  it('parses delta-seconds', () => {
    const advice = parseRateLimitHeaders({ 'ratelimit-reset': '15' });
    expect(advice.delayMs).toBe(15_000);
    expect(advice.source).toBe('generic-reset-header');
    expect(advice.headerName).toBe('ratelimit-reset');
  });

  it('never outranks Retry-After or a provider header', () => {
    const advice = parseRateLimitHeaders({ 'ratelimit-reset': '999', 'retry-after': '1' });
    expect(advice.delayMs).toBe(1000);
    expect(advice.source).toBe('retry-after');
  });
});

describe('the ambiguous bare x-ratelimit-reset header', () => {
  it('is never interpreted, and is reported as unusable with a reason', () => {
    const advice = parseRateLimitHeaders({ 'x-ratelimit-reset': '1699999999' });
    expect(advice.delayMs).toBeUndefined();
    const flagged = advice.candidates.find((c) => c.headerName === 'x-ratelimit-reset');
    expect(flagged?.usable).toBe(false);
    expect(flagged?.reason).toMatch(/no confirmed unit/);
  });

  it('does not block a usable Retry-After that is also present', () => {
    const advice = parseRateLimitHeaders({ 'x-ratelimit-reset': '1699999999', 'retry-after': '3' });
    expect(advice.delayMs).toBe(3000);
  });
});

describe('case-insensitivity and header shapes', () => {
  it('reads a plain object with mixed-case keys', () => {
    const advice = parseRateLimitHeaders({ 'Retry-After': '4' });
    expect(advice.delayMs).toBe(4000);
  });

  it('reads a real Headers instance identically to an equivalent plain object', () => {
    const fromHeaders = parseRateLimitHeaders(new Headers({ 'RETRY-AFTER': '4' }));
    const fromPlain = parseRateLimitHeaders({ 'retry-after': '4' });
    expect(fromHeaders.delayMs).toBe(fromPlain.delayMs);
  });

  it('accepts a string-array header value (Node-style repeated headers), joining it', () => {
    // Not meaningful for retry-after specifically, but proves the shape is accepted without throwing.
    const advice = parseRateLimitHeaders({ 'x-request-id': ['a', 'b'], 'retry-after': '1' });
    expect(advice.delayMs).toBe(1000);
  });

  it('skips a plain-object entry whose value is explicitly undefined', () => {
    const advice = parseRateLimitHeaders({ 'x-optional': undefined, 'retry-after': '1' });
    expect(advice.delayMs).toBe(1000);
  });

  it('normalizeHeaders(undefined) behaves like an empty header bag', () => {
    const empty = normalizeHeaders(undefined);
    expect(empty.get('retry-after')).toBeUndefined();
    expect(empty.has('retry-after')).toBe(false);
    expect(empty.names()).toEqual([]);
  });
});

describe('conflicting reset headers: several exhausted resources', () => {
  it('picks the maximum among provider reset headers and reports which one won', () => {
    const advice = parseRateLimitHeaders(
      { 'x-ratelimit-reset-requests': '1s', 'x-ratelimit-reset-tokens': '6m0s' },
      { provider: 'openai' },
    );
    expect(advice.delayMs).toBe(360_000);
    expect(advice.headerName).toBe('x-ratelimit-reset-tokens');
    expect(advice.warnings.some((w) => w.includes('multiple exhausted resources'))).toBe(true);
    expect(advice.warnings.some((w) => w.includes('x-ratelimit-reset-requests (1000ms)'))).toBe(
      true,
    );
  });
});

describe('no usable header at all', () => {
  it('returns undefined delay/source so the caller falls back', () => {
    const advice = parseRateLimitHeaders({});
    expect(advice.delayMs).toBeUndefined();
    expect(advice.source).toBeUndefined();
    expect(advice.headerName).toBeUndefined();
    expect(advice.candidates).toEqual([]);
  });
});

describe('provider option handling', () => {
  it('an unrecognized provider string applies no profile (falls back to Retry-After/generic only)', () => {
    const advice = parseRateLimitHeaders(
      { 'x-ratelimit-reset-requests': '1s', 'retry-after': '2' },
      { provider: 'some-unknown-gateway' },
    );
    expect(advice.provider).toBeUndefined();
    expect(advice.delayMs).toBe(2000);
    expect(advice.source).toBe('retry-after');
  });

  it('forcing a provider with none of its headers present yields no delay from that tier', () => {
    const advice = parseRateLimitHeaders({}, { provider: 'anthropic' });
    expect(advice.provider).toBe('anthropic');
    expect(advice.delayMs).toBeUndefined();
  });
});

describe('sensitive header names are never surfaced as a candidate', () => {
  // No shipped candidate source (retry-after, a provider profile's reset
  // headers, ratelimit-reset, the ambiguous x-ratelimit-reset) is
  // sensitive-named today, so this guard cannot be exercised through
  // `parseRateLimitHeaders` with real headers. It is defense in depth for the
  // day a candidate source widens (see the doc comment on `recordCandidate`)
  // — tested directly against a synthetic candidate here.
  function syntheticCandidate(headerName: string): RateLimitCandidate {
    return {
      headerName,
      resource: 'generic',
      rawValue: 'Bearer super-secret-token',
      format: 'unknown',
      usable: true,
      delayMs: 1000,
      reason: undefined,
    };
  }

  it('drops a candidate whose header name is on the sensitive list, and never adds it', () => {
    const candidates: RateLimitCandidate[] = [];
    const warnings: string[] = [];
    recordCandidate(candidates, warnings, syntheticCandidate('authorization'));
    expect(candidates).toEqual([]);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('authorization');
    expect(warnings[0]).not.toContain('super-secret-token');
  });

  it('matches case-insensitively', () => {
    const candidates: RateLimitCandidate[] = [];
    const warnings: string[] = [];
    recordCandidate(candidates, warnings, syntheticCandidate('X-Api-Key'));
    expect(candidates).toEqual([]);
  });

  it('drops every name on SENSITIVE_HEADER_NAMES', () => {
    for (const name of [
      'authorization',
      'proxy-authorization',
      'cookie',
      'set-cookie',
      'x-api-key',
      'api-key',
    ]) {
      const candidates: RateLimitCandidate[] = [];
      const warnings: string[] = [];
      recordCandidate(candidates, warnings, syntheticCandidate(name));
      expect(candidates, name).toEqual([]);
    }
  });

  it('keeps a non-sensitive candidate exactly as before, including its extra warning', () => {
    const candidates: RateLimitCandidate[] = [];
    const warnings: string[] = [];
    const candidate = syntheticCandidate('retry-after');
    recordCandidate(candidates, warnings, candidate, 'retry-after: some note');
    expect(candidates).toEqual([candidate]);
    expect(warnings).toEqual(['retry-after: some note']);
  });

  it('none of the real headers this package reads today are ever dropped by the guard', () => {
    // Regression guard for the claim in the doc comment: today's real
    // candidate sources never trip the sensitive-name filter.
    const advice = parseRateLimitHeaders(
      {
        'retry-after': '5',
        'x-ratelimit-reset-requests': '1s',
        'x-ratelimit-reset-tokens': '2s',
        'ratelimit-reset': '3',
        'x-ratelimit-reset': '4',
      },
      { provider: 'openai' },
    );
    const droppedForSensitivity = advice.warnings.filter((w) => w.includes('sensitive list'));
    expect(droppedForSensitivity).toEqual([]);
    expect(advice.candidates).toHaveLength(5);
  });
});

describe('RateLimitAdvice is JSON-serializable', () => {
  it('round-trips through JSON.stringify/parse', () => {
    const advice = parseRateLimitHeaders(
      {
        'x-ratelimit-reset-requests': '1s',
        'x-ratelimit-reset-tokens': '6m0s',
        'x-ratelimit-reset': 'weird',
      },
      { provider: 'openai' },
    );
    const roundTripped = JSON.parse(JSON.stringify(advice)) as unknown;
    expect(roundTripped).toEqual(advice);
  });
});
