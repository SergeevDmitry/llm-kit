/**
 * `withLlmBackoff` — the retry loop every other entry point sits on top of.
 * Implementation order: classification → delay precedence → fallback
 * backoff → abortable sleep → max-attempt/max-elapsed enforcement →
 * `onRetry` events.
 */
import { isAbortError, throwIfAborted, toAbortError } from './abort-utils.js';
import { classifyLlmError } from './classify-error.js';
import {
  DEFAULT_BASE_DELAY_MS,
  DEFAULT_MAX_ATTEMPTS,
  DEFAULT_MAX_DELAY_MS,
  DEFAULT_MAX_ELAPSED_MS,
} from './defaults.js';
import { parseRateLimitHeaders } from './delay/choose-delay.js';
import { computeFallbackDelayMs } from './delay/fallback-backoff.js';
import { defaultSleep } from './delay/sleep.js';
import { LlmBackoffError } from './errors.js';
import { sanitizeHeaderNames } from './retry-event.js';
import type {
  AttemptRecord,
  DelaySource,
  LlmBackoffOptions,
  ProviderId,
  RateLimitAdvice,
  RetryClassification,
  RetryContext,
  RetryEvent,
} from './types.js';

interface NormalizedOptions {
  readonly maxAttempts: number;
  readonly maxElapsedMs: number;
  readonly maxDelayMs: number;
  readonly baseDelayMs: number;
  readonly retryableStatuses: readonly number[];
  readonly nonRetryableStatuses: readonly number[];
  readonly provider: LlmBackoffOptions['provider'];
  readonly signal: AbortSignal | undefined;
  readonly onRetry: LlmBackoffOptions['onRetry'];
  readonly sleep: (ms: number, signal?: AbortSignal) => Promise<void>;
  readonly random: () => number;
  readonly now: () => number;
}

function invalidOptions(message: string): LlmBackoffError {
  return new LlmBackoffError(`llm-backoff: ${message}`, 'INVALID_OPTIONS', []);
}

function normalizeOptions(options: LlmBackoffOptions): NormalizedOptions {
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const maxElapsedMs = options.maxElapsedMs ?? DEFAULT_MAX_ELAPSED_MS;
  const maxDelayMs = options.maxDelayMs ?? DEFAULT_MAX_DELAY_MS;
  const baseDelayMs = options.baseDelayMs ?? DEFAULT_BASE_DELAY_MS;

  if (!Number.isFinite(maxAttempts) || maxAttempts < 1 || !Number.isInteger(maxAttempts)) {
    throw invalidOptions('options.maxAttempts must be a finite integer >= 1');
  }
  if (!Number.isFinite(maxElapsedMs) || maxElapsedMs < 0) {
    throw invalidOptions('options.maxElapsedMs must be a finite number >= 0');
  }
  if (!Number.isFinite(maxDelayMs) || maxDelayMs < 0) {
    throw invalidOptions('options.maxDelayMs must be a finite number >= 0');
  }
  if (!Number.isFinite(baseDelayMs) || baseDelayMs < 0) {
    throw invalidOptions('options.baseDelayMs must be a finite number >= 0');
  }

  return {
    maxAttempts,
    maxElapsedMs,
    maxDelayMs,
    baseDelayMs,
    retryableStatuses: options.retryableStatuses ?? [],
    nonRetryableStatuses: options.nonRetryableStatuses ?? [],
    provider: options.provider,
    signal: options.signal,
    onRetry: options.onRetry,
    sleep: options.sleep ?? defaultSleep,
    random: options.random ?? Math.random,
    now: options.now ?? Date.now,
  };
}

interface ChosenDelay {
  readonly delayMs: number;
  readonly source: DelaySource;
  readonly winningHeader: string | undefined;
  readonly provider: ProviderId | undefined;
}

function chooseFinalDelay(
  advice: RateLimitAdvice,
  attempt: number,
  cfg: NormalizedOptions,
): ChosenDelay {
  if (advice.delayMs !== undefined && advice.source !== undefined) {
    return {
      delayMs: advice.delayMs,
      source: advice.source,
      winningHeader: advice.headerName,
      provider: advice.provider,
    };
  }
  return {
    delayMs: computeFallbackDelayMs({
      attempt,
      baseDelayMs: cfg.baseDelayMs,
      maxDelayMs: cfg.maxDelayMs,
      random: cfg.random,
    }),
    source: 'fallback-backoff',
    winningHeader: undefined,
    provider: advice.provider,
  };
}

function toAttemptRecord(
  attempt: number,
  elapsedMs: number,
  classification: RetryClassification,
  chosen?: ChosenDelay,
): AttemptRecord {
  return {
    attempt,
    elapsedMs,
    retryable: classification.retryable,
    status: classification.status,
    reason: classification.reason,
    delayMs: chosen?.delayMs,
    delaySource: chosen?.source,
  };
}

export async function withLlmBackoff<T>(
  operation: (context: RetryContext) => Promise<T>,
  options: LlmBackoffOptions = {},
): Promise<T> {
  const cfg = normalizeOptions(options);
  const attempts: AttemptRecord[] = [];
  const startMs = cfg.now();

  for (let attempt = 1; ; attempt += 1) {
    throwIfAborted(cfg.signal);

    try {
      // True wall-clock elapsed time so far — includes every prior attempt's
      // own operation latency, not just time spent sleeping.
      return await operation({ attempt, elapsedMs: cfg.now() - startMs, signal: cfg.signal });
    } catch (error) {
      // A signal can fire while `operation()` is in flight. Two independent
      // ways an abort reaches here:
      //
      //  1. `cfg.signal` is now aborted, whatever `error` actually is. This is
      //     the common real path: `fetch` (and any operation that forwards
      //     `ctx.signal`) rejects with `signal.reason` verbatim, which isn't
      //     necessarily named "AbortError" — a caller's custom `Error`, a
      //     non-Error reason, or `AbortSignal.timeout()`'s `TimeoutError`
      //     DOMException all land here. Checking the signal itself, not the
      //     shape of `error`, is the only way to catch all of those, and it
      //     must run before classification: an unrelated rejection that
      //     happens to race with the abort must not be evaluated for
      //     retry-worthiness or reach `onRetry` — once the signal has fired,
      //     cancellation always wins. The thrown value is
      //     `toAbortError(cfg.signal.reason)`: unchanged for an
      //     `Error`/`DOMException` reason, normalized to a `DOMException`
      //     named `AbortError` otherwise, matching the normalization
      //     `throwIfAborted` and the default `sleep` apply at the other two
      //     abort points (before the first attempt, during sleep).
      //  2. `error` already identifies itself as an abort (`isAbortError`)
      //     with no `cfg.signal` involved — an operation that manages its own
      //     cancellation and throws a `DOMException`/`Error` named
      //     `AbortError` directly.
      if (cfg.signal?.aborted === true) throw toAbortError(cfg.signal.reason);
      if (isAbortError(error)) throw error; // never wrapped, never retried

      const elapsedMs = cfg.now() - startMs;

      const classification = classifyLlmError(error, {
        retryableStatuses: cfg.retryableStatuses,
        nonRetryableStatuses: cfg.nonRetryableStatuses,
      });

      if (!classification.retryable) {
        attempts.push(toAttemptRecord(attempt, elapsedMs, classification));
        throw new LlmBackoffError(
          `llm-backoff: attempt ${String(attempt)} failed with a non-retryable error (${classification.reason})`,
          'NON_RETRYABLE',
          attempts,
          { cause: error },
        );
      }

      if (attempt >= cfg.maxAttempts) {
        attempts.push(toAttemptRecord(attempt, elapsedMs, classification));
        throw new LlmBackoffError(
          `llm-backoff: exhausted maxAttempts (${String(cfg.maxAttempts)}) — the last error was retryable (${classification.reason})`,
          'MAX_ATTEMPTS_EXCEEDED',
          attempts,
          { cause: error },
        );
      }

      const advice = parseRateLimitHeaders(classification.headers ?? {}, {
        provider: cfg.provider,
        now: cfg.now,
      });
      const chosen = chooseFinalDelay(advice, attempt, cfg);

      // Checked before sleeping, not by interrupting operation() mid-flight —
      // a single slow attempt can still push real elapsedMs past the budget
      // by the time control returns here. See "Performance" in the README.
      if (elapsedMs + chosen.delayMs > cfg.maxElapsedMs) {
        attempts.push(toAttemptRecord(attempt, elapsedMs, classification, chosen));
        throw new LlmBackoffError(
          `llm-backoff: honoring a ${String(chosen.delayMs)}ms delay (source: ${chosen.source}) would exceed ` +
            `maxElapsedMs (${String(cfg.maxElapsedMs)}ms, ${String(elapsedMs)}ms of wall-clock time already elapsed)`,
          'MAX_ELAPSED_EXCEEDED',
          attempts,
          { cause: error },
        );
      }

      attempts.push(toAttemptRecord(attempt, elapsedMs, classification, chosen));

      if (cfg.onRetry) {
        const event: RetryEvent = {
          attempt,
          attemptsRemaining: cfg.maxAttempts - attempt,
          elapsedMs,
          status: classification.status,
          reason: classification.reason,
          delayMs: chosen.delayMs,
          delaySource: chosen.source,
          winningHeader: chosen.winningHeader,
          provider: chosen.provider,
          headerNames: sanitizeHeaderNames(
            advice.candidates.map((candidate) => candidate.headerName),
          ),
          advice,
        };
        try {
          await cfg.onRetry(event);
        } catch (onRetryError) {
          throw new LlmBackoffError(
            `llm-backoff: onRetry callback threw on attempt ${String(attempt)}`,
            'ON_RETRY_CALLBACK_FAILED',
            attempts,
            { cause: onRetryError },
          );
        }
      }

      throwIfAborted(cfg.signal); // abort during onRetry

      await cfg.sleep(chosen.delayMs, cfg.signal); // abort during sleep rejects here, unwrapped, uncaught
      // elapsedMs is recomputed from cfg.now() at the top of the next
      // iteration — it is not incremented manually, so it reflects true
      // wall-clock time (including this sleep and the next attempt's own
      // operation latency), not just the delays this loop chose.
    }
  }
}
