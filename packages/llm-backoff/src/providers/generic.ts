/**
 * Provider-agnostic reset headers — delay-selection tier 3, below
 * `Retry-After` and below a matched provider profile, above the fallback
 * backoff.
 *
 * Only `RateLimit-Reset` (the IETF `draft-ietf-httpapi-ratelimit-headers`
 * field, delta-seconds — the same unambiguous shape as `Retry-After`'s
 * numeric form) is interpreted here. The vendor-prefixed `X-RateLimit-Reset`
 * *without* a `-requests`/`-tokens` qualifier is deliberately **not**
 * interpreted: different APIs use that exact header name for epoch seconds
 * (e.g. GitHub), for delta seconds, and for other units, with no way to tell
 * them apart from the value alone — exactly the kind of unit-guessing this
 * package refuses to do. When it is present, it is still recorded as an
 * unusable candidate with a reason, so the caller can see why it was skipped.
 */
import { parseDeltaSeconds } from '../delay/reset-value.js';
import type { RateLimitCandidate } from '../types.js';

export const GENERIC_RESET_HEADER_NAME = 'ratelimit-reset';
export const AMBIGUOUS_RESET_HEADER_NAME = 'x-ratelimit-reset';

export function parseGenericResetHeader(rawValue: string): RateLimitCandidate {
  const delayMs = parseDeltaSeconds(rawValue);
  if (delayMs === undefined) {
    return {
      headerName: GENERIC_RESET_HEADER_NAME,
      resource: 'generic',
      rawValue,
      format: 'unknown',
      usable: false,
      delayMs: undefined,
      reason: `malformed ${GENERIC_RESET_HEADER_NAME} value ${JSON.stringify(rawValue)}: expected non-negative integer delta-seconds`,
    };
  }
  return {
    headerName: GENERIC_RESET_HEADER_NAME,
    resource: 'generic',
    rawValue,
    format: 'delta-seconds',
    usable: true,
    delayMs,
    reason: undefined,
  };
}

/** Always unusable — see the module doc comment for why this header is never interpreted. */
export function flagAmbiguousResetHeader(rawValue: string): RateLimitCandidate {
  return {
    headerName: AMBIGUOUS_RESET_HEADER_NAME,
    resource: 'generic',
    rawValue,
    format: 'unknown',
    usable: false,
    delayMs: undefined,
    reason:
      `"${AMBIGUOUS_RESET_HEADER_NAME}" has no confirmed unit across providers (epoch seconds for some APIs, ` +
      `delta seconds for others); no provider profile claims this exact header name, so its value is ignored ` +
      `rather than guessed. Use a provider-specific header (e.g. "x-ratelimit-reset-requests") or "retry-after" instead.`,
  };
}
