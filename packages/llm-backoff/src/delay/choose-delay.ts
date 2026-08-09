/**
 * `parseRateLimitHeaders` and the case-insensitive header reader every entry
 * point shares.
 *
 * Delay-selection priority, implemented as four tiers, highest first:
 *   1. `Retry-After` — real HTTP-spec backing, so it wins outright when usable.
 *   2. A matched provider profile's reset headers (`x-ratelimit-reset-*`,
 *      `anthropic-ratelimit-*-reset`, ...) — several may be present at once
 *      (several exhausted resources); the maximum usable delay wins, and the
 *      winning header name is reported.
 *   3. The generic `RateLimit-Reset` header.
 *   4. Nothing usable — `delayMs`/`source` come back `undefined`, and the
 *      caller (`with-llm-backoff.ts`) falls back to `computeFallbackDelayMs`.
 */
import { SENSITIVE_HEADER_NAMES } from '../defaults.js';
import { parseDuration, parseIsoTimestamp } from './reset-value.js';
import { parseRetryAfterHeader } from './retry-after.js';
import {
  AMBIGUOUS_RESET_HEADER_NAME,
  GENERIC_RESET_HEADER_NAME,
  flagAmbiguousResetHeader,
  parseGenericResetHeader,
} from '../providers/generic.js';
import { resolveProviderProfile } from '../providers/registry.js';
import type {
  DelaySource,
  HeadersLike,
  ParseHeadersOptions,
  RateLimitAdvice,
  RateLimitCandidate,
} from '../types.js';

interface NormalizedHeaders {
  get(name: string): string | undefined;
  has(name: string): boolean;
  /** Lowercase names of every header actually present. */
  names(): readonly string[];
}

const EMPTY_HEADERS: NormalizedHeaders = {
  get: () => undefined,
  has: () => false,
  names: () => [],
};

/** Case-insensitive reader over a `Headers` instance or a plain header bag. */
export function normalizeHeaders(headers: HeadersLike | undefined): NormalizedHeaders {
  if (headers === undefined) return EMPTY_HEADERS;

  const map = new Map<string, string>();

  if (typeof Headers !== 'undefined' && headers instanceof Headers) {
    headers.forEach((value, key) => {
      map.set(key.toLowerCase(), value);
    });
  } else {
    for (const [key, value] of Object.entries(headers)) {
      if (value === undefined) continue;
      map.set(key.toLowerCase(), Array.isArray(value) ? value.join(', ') : value);
    }
  }

  return {
    get: (name) => map.get(name.toLowerCase()),
    has: (name) => map.has(name.toLowerCase()),
    names: () => [...map.keys()],
  };
}

/** Clamps a possibly-negative raw delay to `>= 0` and reports the clamp. */
function finalizeDelay(
  candidate: Omit<RateLimitCandidate, 'delayMs' | 'usable' | 'reason'>,
  rawDelayMs: number | undefined,
  staleReason: string,
): RateLimitCandidate {
  if (rawDelayMs === undefined) {
    return {
      ...candidate,
      usable: false,
      delayMs: undefined,
      reason: `malformed ${candidate.headerName} value ${JSON.stringify(candidate.rawValue)} for format "${candidate.format}"`,
    };
  }
  if (rawDelayMs < 0) {
    return { ...candidate, usable: true, delayMs: 0, reason: staleReason };
  }
  // Ceil, never floor: never sleep for less than the server actually asked.
  return { ...candidate, usable: true, delayMs: Math.ceil(rawDelayMs), reason: undefined };
}

/**
 * `sanitizeHeaderNames` (`../retry-event.ts`) filters `RetryEvent.headerNames`,
 * but that doesn't cover `RateLimitAdvice.candidates`, whose `rawValue` is a
 * header's literal value, not just its name. None of today's candidate
 * sources can ever match `SENSITIVE_HEADER_NAMES`, so this has never dropped
 * anything in practice — it exists so it fires the day a candidate source
 * widens (a future provider profile reading an authenticated header, say),
 * instead of silently shipping a credential value in `rawValue`.
 */
function isSensitiveHeaderName(name: string): boolean {
  return SENSITIVE_HEADER_NAMES.has(name.toLowerCase());
}

/**
 * The single place every candidate enters `RateLimitAdvice.candidates` —
 * dropping a sensitive-named one here (rather than filtering the array
 * afterward) means a caller can never observe it via `candidates`,
 * `warnings`, or a downstream `RetryEvent`, not even for one tick. Exported
 * so the guard itself is directly testable with a synthetic candidate,
 * without needing a real header source that happens to be sensitive-named
 * (today, none is).
 */
export function recordCandidate(
  candidates: RateLimitCandidate[],
  warnings: string[],
  candidate: RateLimitCandidate,
  extraWarning?: string,
): void {
  if (isSensitiveHeaderName(candidate.headerName)) {
    warnings.push(
      `${candidate.headerName}: dropped from rate-limit advice — this header name is on the ` +
        'sensitive list (SECURITY.md) and is never surfaced as a candidate, even though it was ' +
        'encountered while building advice',
    );
    return;
  }
  candidates.push(candidate);
  if (extraWarning !== undefined) warnings.push(extraWarning);
}

export function parseRateLimitHeaders(
  headers: HeadersLike,
  options: ParseHeadersOptions = {},
): RateLimitAdvice {
  const now = options.now ?? Date.now;
  const nowMs = now();
  const normalized = normalizeHeaders(headers);
  const headerNames = new Set(normalized.names());
  const candidates: RateLimitCandidate[] = [];
  const warnings: string[] = [];

  // --- tier 1: Retry-After -------------------------------------------------
  const retryAfterValue = normalized.get('retry-after');
  if (retryAfterValue !== undefined) {
    const candidate = parseRetryAfterHeader(retryAfterValue, nowMs);
    recordCandidate(
      candidates,
      warnings,
      candidate,
      candidate.reason !== undefined ? `retry-after: ${candidate.reason}` : undefined,
    );
  }

  // --- tier 2: provider-specific reset headers ------------------------------
  const profile = resolveProviderProfile(options.provider, headerNames);
  if (profile !== undefined) {
    for (const rule of profile.rules) {
      const rawValue = normalized.get(rule.headerName);
      if (rawValue === undefined) continue;

      const base = {
        headerName: rule.headerName,
        resource: rule.resource,
        rawValue,
        format: rule.format,
      } as const;

      // Only two formats are wired to a shipped profile today — see the doc
      // comment on `ProviderHeaderFormat` in `../providers/types.ts` for why
      // epoch-seconds/epoch-milliseconds have parsers but no rule (yet).
      const candidate: RateLimitCandidate =
        rule.format === 'duration'
          ? finalizeDelay(
              base,
              parseDuration(rawValue),
              `${rule.headerName} described a negative duration; clamped to 0`,
            )
          : finalizeDelay(
              base,
              parseIsoTimestamp(rawValue, nowMs),
              `${rule.headerName} reset time is already in the past; clamped to 0`,
            );
      recordCandidate(
        candidates,
        warnings,
        candidate,
        candidate.reason !== undefined ? `${rule.headerName}: ${candidate.reason}` : undefined,
      );
    }
  }

  // --- tier 3: generic reset headers -----------------------------------------
  const genericRaw = normalized.get(GENERIC_RESET_HEADER_NAME);
  if (genericRaw !== undefined) {
    const candidate = parseGenericResetHeader(genericRaw);
    recordCandidate(
      candidates,
      warnings,
      candidate,
      !candidate.usable ? `${GENERIC_RESET_HEADER_NAME}: ${String(candidate.reason)}` : undefined,
    );
  }

  // Always flagged for visibility when present, regardless of tier outcome —
  // never contributes a delay (see providers/generic.ts).
  const ambiguousRaw = normalized.get(AMBIGUOUS_RESET_HEADER_NAME);
  if (ambiguousRaw !== undefined) {
    const candidate = flagAmbiguousResetHeader(ambiguousRaw);
    recordCandidate(
      candidates,
      warnings,
      candidate,
      `${AMBIGUOUS_RESET_HEADER_NAME}: ${String(candidate.reason)}`,
    );
  }

  const winner = pickWinner(candidates, warnings);

  return {
    delayMs: winner?.delayMs,
    source: winner?.source,
    headerName: winner?.candidate.headerName,
    provider: profile?.id,
    candidates,
    warnings,
  };
}

function pickWinner(
  candidates: readonly RateLimitCandidate[],
  warnings: string[],
): { candidate: RateLimitCandidate; delayMs: number; source: DelaySource } | undefined {
  const retryAfter = candidates.find((c) => c.resource === 'retry-after' && c.usable);
  if (retryAfter !== undefined) {
    return { candidate: retryAfter, delayMs: retryAfter.delayMs as number, source: 'retry-after' };
  }

  const providerTier = candidates.filter(
    (c) =>
      c.usable &&
      (c.resource === 'requests' ||
        c.resource === 'tokens' ||
        c.resource === 'input-tokens' ||
        c.resource === 'output-tokens'),
  );
  const providerWinner = pickMax(providerTier);
  if (providerWinner !== undefined) {
    if (providerTier.length > 1) {
      warnings.push(describeConflict(providerWinner, providerTier));
    }
    return {
      candidate: providerWinner,
      delayMs: providerWinner.delayMs as number,
      source: 'provider-reset-header',
    };
  }

  const genericTier = candidates.filter((c) => c.usable && c.resource === 'generic');
  const genericWinner = pickMax(genericTier);
  if (genericWinner !== undefined) {
    return {
      candidate: genericWinner,
      delayMs: genericWinner.delayMs as number,
      source: 'generic-reset-header',
    };
  }

  return undefined;
}

function pickMax(candidates: readonly RateLimitCandidate[]): RateLimitCandidate | undefined {
  let best: RateLimitCandidate | undefined;
  for (const candidate of candidates) {
    if (best === undefined || (candidate.delayMs as number) > (best.delayMs as number)) {
      best = candidate;
    }
  }
  return best;
}

function describeConflict(winner: RateLimitCandidate, all: readonly RateLimitCandidate[]): string {
  const others = all
    .filter((c) => c !== winner)
    .map((c) => `${c.headerName} (${String(c.delayMs)}ms)`);
  return `multiple exhausted resources reported reset headers; chose "${winner.headerName}" (${String(winner.delayMs)}ms), the maximum, over: ${others.join(', ')}`;
}
