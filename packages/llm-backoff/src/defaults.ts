/**
 * Default policy constants. Centralized so `with-llm-backoff.ts`,
 * `fetch-with-llm-backoff.ts` and the tests reference one number, not a
 * scattered set of magic literals.
 */

export const DEFAULT_MAX_ATTEMPTS = 5;
export const DEFAULT_MAX_ELAPSED_MS = 60_000;
export const DEFAULT_BASE_DELAY_MS = 500;
export const DEFAULT_MAX_DELAY_MS = 30_000;

/**
 * `429` and `529` retry by default; `400` and `401` never do. Both sets win
 * over `retryableStatuses`/`nonRetryableStatuses` unconditionally: a caller
 * cannot configure their way out of either rule.
 */
export const MANDATORY_RETRYABLE_STATUSES: readonly number[] = [429, 529];
export const MANDATORY_NON_RETRYABLE_STATUSES: readonly number[] = [400, 401];

/**
 * Recognized transient network error codes (Node's `error.code`/`error.cause.code`,
 * shared by undici/fetch). Deliberately narrow — selected transient network
 * failures, not every thrown error.
 */
export const TRANSIENT_NETWORK_ERROR_CODES: ReadonlySet<string> = new Set([
  'ECONNRESET',
  'ETIMEDOUT',
  'ECONNREFUSED',
  'EAI_AGAIN',
  'ENOTFOUND',
  'EPIPE',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'UND_ERR_CONNECT_TIMEOUT',
  'UND_ERR_SOCKET',
  'UND_ERR_HEADERS_TIMEOUT',
  'UND_ERR_BODY_TIMEOUT',
]);

/** Header names never surfaced by name in a `RetryEvent`, even sanitized to just names — defense in depth. */
export const SENSITIVE_HEADER_NAMES: ReadonlySet<string> = new Set([
  'authorization',
  'proxy-authorization',
  'cookie',
  'set-cookie',
  'x-api-key',
  'api-key',
]);

/**
 * Floor under every fallback delay, including a `baseDelayMs: 0` /
 * `maxDelayMs: 0` configuration. Without it, that configuration produces a
 * same-tick busy retry loop — see the "zero-delay retry loop safeguard"
 * benchmark: a tight loop against a rate-limited endpoint is its own kind of
 * abuse and amounts to a hidden flood of network calls.
 */
export const MIN_FALLBACK_DELAY_MS = 1;

/**
 * The largest delay `setTimeout`/`setInterval` accept as a 32-bit signed
 * integer of milliseconds (`2^31 - 1`). Node (and browsers) silently clamp
 * anything larger to `1`ms and fire *immediately* rather than throwing or
 * waiting the requested time — see Node's `setTimeout` docs, "if delay is
 * larger than 2147483647 ... the delay will be set to 1". `maxDelayMs` caps
 * the *fallback* backoff well under this by default (30s), but a
 * header-derived delay is deliberately never capped — explicit server
 * timing is always honored — only bounded by `maxElapsedMs`, which a caller
 * can raise arbitrarily. A
 * caller who does that and receives e.g. `Retry-After: 2592000` (30 days)
 * would otherwise have `defaultSleep` call `setTimeout(2_592_000_000, ...)`,
 * silently turning a 30-day wait into an effectively-instant retry — the
 * opposite of honoring the server. `defaultSleep` (`delay/sleep.ts`) chains
 * timers in chunks of at most this many milliseconds so the full requested
 * delay is still honored exactly, never truncated.
 */
export const MAX_SAFE_TIMEOUT_MS = 2_147_483_647;
