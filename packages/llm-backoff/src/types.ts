/**
 * Public type surface for `llm-backoff`.
 *
 * Every type here is either exported directly from `index.ts` or embedded in
 * something that is. Nothing in this file imports `node:` anything — the
 * whole package is browser-safe.
 */

/** A provider this package ships a header profile for (`src/providers/`). */
export type ProviderId = 'openai' | 'anthropic' | 'google';

/**
 * `fetchWithLlmBackoff`'s first parameter. Equivalent to the DOM lib's
 * `RequestInfo | URL`, spelled out because this package's `tsconfig` targets
 * `lib: ["ES2023"]` with no `"dom"` — the global `fetch` this package relies
 * on (and its consumers') comes from `@types/node`'s web-globals augmentation,
 * which does not declare a `RequestInfo` alias.
 */
export type FetchInput = Request | string | URL;

/**
 * The two header shapes every entry point accepts: a real `Headers`
 * instance, or a plain object whose values are a single string or a string
 * array (as many SDKs and Node's own `IncomingHttpHeaders` represent
 * repeated headers).
 */
export type HeadersLike = Headers | Record<string, string | string[] | undefined>;

/** Passed to the `operation` callback on every attempt, including the first. */
export interface RetryContext {
  /** 1-based: the attempt about to run. */
  readonly attempt: number;
  /**
   * True wall-clock time elapsed since `withLlmBackoff`/`fetchWithLlmBackoff`
   * was called, in milliseconds — measured with `LlmBackoffOptions.now`
   * (default `Date.now`). Includes time spent inside `operation` itself on
   * every prior attempt, not just time spent sleeping between attempts.
   * `maxElapsedMs` is measured on this same quantity. See the README's
   * "Performance" section for the one residual caveat: this is checked
   * *before* sleeping, not by interrupting an in-flight attempt, so a single
   * slow `operation` call can still push real elapsed time past the budget.
   */
  readonly elapsedMs: number;
  /**
   * Forward this to whatever your operation calls (`fetch`, a provider SDK) so
   * a cancellation actually reaches the in-flight request. It carries
   * `LlmBackoffOptions.signal` and, when `attemptTimeoutMs` is set, this
   * attempt's own timeout — combined, so either one cancels the call.
   */
  readonly signal?: AbortSignal;
}

export interface LlmBackoffOptions {
  /** Total attempts allowed, including the first. Default `5`. */
  readonly maxAttempts?: number;
  /**
   * Ceiling on true wall-clock elapsed time (see `RetryContext.elapsedMs`),
   * including time spent inside `operation`, not just time spent sleeping.
   * Checked before every sleep. Default `60_000`.
   */
  readonly maxElapsedMs?: number;
  /**
   * Ceiling on a *single* attempt, in milliseconds. Off by default.
   *
   * The failure this exists for is a hung call — connection established,
   * tokens never arrive — which `maxElapsedMs` cannot rescue you from, because
   * that budget is checked between attempts and one hung attempt eats all of
   * it. With this set, an attempt that outlives the ceiling is cancelled and
   * **retried**: a hung call is transient, so it flows through the normal
   * delay machinery like any other retryable failure, and surfaces as an
   * `AttemptTimeoutError` on `LlmBackoffError.cause` if every attempt times
   * out.
   *
   * Doing this yourself with `AbortSignal.timeout()` inside `operation` does
   * not work: its `TimeoutError` carries no status, so the classifier reads it
   * as a non-retryable failure and gives up after one attempt. Only this
   * package can tell "my own per-attempt ceiling fired" (transient, retry)
   * apart from "the caller cancelled" (propagate unwrapped, never retry) —
   * `options.signal` keeps absolute precedence over this in every race.
   *
   * Time spent waiting on a timed-out attempt still counts toward
   * `maxElapsedMs`, which is measured on the wall clock. The timer is armed
   * through the injectable `sleep`, so it never reaches a real platform timer
   * in a test that injects one, and it is cancelled the moment the attempt
   * settles.
   */
  readonly attemptTimeoutMs?: number;
  /** Cap applied to the *fallback* exponential delay only — never to an explicit server delay. Default `30_000`. */
  readonly maxDelayMs?: number;
  /** Base of the fallback exponential delay. Default `500`. */
  readonly baseDelayMs?: number;
  /** Added to the mandatory `429`/`529` retryable set. Cannot make `400`/`401` retryable — see `classifyLlmError`. */
  readonly retryableStatuses?: readonly number[];
  /** Added to the mandatory `400`/`401` non-retryable set. Cannot make `429`/`529` non-retryable. */
  readonly nonRetryableStatuses?: readonly number[];
  /** Which provider header profile to prefer. `'auto'` (default) detects from the headers present. */
  readonly provider?: ProviderId | 'auto' | string;
  readonly signal?: AbortSignal;
  /** The only observability this package has. Never called for a non-retryable failure. */
  readonly onRetry?: (event: RetryEvent) => void | Promise<void>;
  /** Injectable in tests — see `@llm-kit/test-utils`' `createSleepRecorder`. Defaults to a platform-timer sleep. */
  readonly sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
  /** Injectable in tests. Defaults to `Math.random`. Only used by the fallback backoff — never applied to an explicit server delay. */
  readonly random?: () => number;
  /**
   * Clock used to measure `RetryContext.elapsedMs`/`maxElapsedMs` and to
   * interpret an absolute header value (an HTTP-date or ISO timestamp) into a
   * relative delay. Matches `FakeClock.nowFn` from `@llm-kit/test-utils` so
   * tests can inject it directly, advancing it inside a recorded `sleep` and
   * inside a stub `operation` to simulate slow calls. Defaults to `Date.now`.
   * Timers and random sources are injectable throughout this package's retry
   * code.
   */
  readonly now?: () => number;
}

/** How a chosen delay was decided: the header-precedence priority list, plus the fallback tier. */
export type DelaySource =
  'retry-after' | 'provider-reset-header' | 'generic-reset-header' | 'fallback-backoff';

export type HeaderValueFormat =
  | 'retry-after-seconds'
  | 'retry-after-http-date'
  | 'duration'
  | 'epoch-seconds'
  | 'epoch-milliseconds'
  | 'iso-timestamp'
  | 'delta-seconds'
  | 'unknown';

export type RateLimitResource =
  'retry-after' | 'requests' | 'tokens' | 'input-tokens' | 'output-tokens' | 'generic';

/** One header this package looked at while building a `RateLimitAdvice`. */
export interface RateLimitCandidate {
  /** Canonical lowercase header name, e.g. `"x-ratelimit-reset-tokens"`. */
  readonly headerName: string;
  readonly resource: RateLimitResource;
  /** The header's literal string value. Never a secret — this is rate-limit metadata, not credentials. */
  readonly rawValue: string;
  readonly format: HeaderValueFormat;
  /** `false` means this candidate could not safely contribute a delay — see `reason`. */
  readonly usable: boolean;
  /** Resolved delay in milliseconds, clamped to `>= 0`. `undefined` when `usable` is `false`. */
  readonly delayMs: number | undefined;
  /** Present whenever the candidate is unusable, or was clamped (e.g. a stale timestamp). */
  readonly reason: string | undefined;
}

/** The result of `parseRateLimitHeaders` — fully JSON-serializable. */
export interface RateLimitAdvice {
  /** `undefined` when no header produced a usable delay; the caller should fall back. */
  readonly delayMs: number | undefined;
  readonly source: DelaySource | undefined;
  /** The header name that won, when several were in play — see `candidates`. */
  readonly headerName: string | undefined;
  /** The provider profile actually applied (explicit option or auto-detected), if any. */
  readonly provider: ProviderId | undefined;
  /** Every header this function looked at, usable or not. */
  readonly candidates: readonly RateLimitCandidate[];
  /** Human-readable explanations for skipped/clamped candidates and for the winner, when more than one resource was in play. */
  readonly warnings: readonly string[];
}

export interface ParseHeadersOptions {
  readonly provider?: ProviderId | 'auto' | string;
  /**
   * Clock used only to convert an *absolute* header value (an HTTP date or an
   * ISO timestamp) into a relative delay. Matches `FakeClock.nowFn` from
   * `@llm-kit/test-utils` so tests can inject it directly. Defaults to
   * `Date.now`. Relative formats (seconds, durations) never call this.
   */
  readonly now?: () => number;
}

export interface ClassificationOptions {
  readonly retryableStatuses?: readonly number[];
  readonly nonRetryableStatuses?: readonly number[];
}

/** The result of `classifyLlmError`. */
export interface RetryClassification {
  readonly retryable: boolean;
  /** Human-readable explanation, stable enough to assert on in tests. */
  readonly reason: string;
  readonly status: number | undefined;
  readonly isAbort: boolean;
  /** Headers extracted from the error, if any — feed to `parseRateLimitHeaders`. */
  readonly headers: HeadersLike | undefined;
}

/**
 * Emitted to `onRetry` right before each sleep. Deliberately flatter than
 * `RetryClassification` (no raw `Headers` object) so every field survives
 * `JSON.stringify` — see `test/retry-event.test.ts`.
 */
export interface RetryEvent {
  readonly attempt: number;
  readonly attemptsRemaining: number;
  readonly elapsedMs: number;
  readonly status: number | undefined;
  readonly reason: string;
  readonly delayMs: number;
  readonly delaySource: DelaySource;
  readonly winningHeader: string | undefined;
  readonly provider: ProviderId | undefined;
  /** Sanitized: header names only, never `Authorization`/`Cookie` values or names. */
  readonly headerNames: readonly string[];
  readonly advice: RateLimitAdvice;
}

/** One entry in `LlmBackoffError.attempts`, forming the attempt history the final thrown error carries alongside the original cause. */
export interface AttemptRecord {
  readonly attempt: number;
  readonly elapsedMs: number;
  readonly retryable: boolean;
  readonly status: number | undefined;
  readonly reason: string;
  /** The delay chosen after this attempt, if the loop got that far. `undefined` on the terminal record. */
  readonly delayMs: number | undefined;
  readonly delaySource: DelaySource | undefined;
}
