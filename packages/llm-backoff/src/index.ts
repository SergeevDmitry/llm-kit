/**
 * llm-backoff — public entry point.
 *
 * Retries that read provider rate-limit headers instead of guessing an
 * exponential delay: `withLlmBackoff`/`fetchWithLlmBackoff` wrap an operation
 * or a `fetch` call, honor `Retry-After` and provider-specific
 * `x-ratelimit-reset-*`/`anthropic-ratelimit-*-reset` headers exactly, and
 * fall back to a bounded, jittered exponential backoff only when no usable
 * header exists. `parseRateLimitHeaders`/`classifyLlmError` are the two pure
 * functions the wrappers are built from, exported directly for callers who
 * want the decision without the loop. See the README for guarantees,
 * non-guarantees, and the idempotency warning.
 */
export { withLlmBackoff } from './with-llm-backoff.js';
export { fetchWithLlmBackoff } from './fetch-with-llm-backoff.js';
export { parseRateLimitHeaders } from './delay/choose-delay.js';
export { classifyLlmError } from './classify-error.js';
export {
  LlmBackoffError,
  AttemptTimeoutError,
  FetchRetryableStatusError,
  type LlmBackoffErrorCode,
} from './errors.js';

export type {
  AttemptRecord,
  ClassificationOptions,
  DelaySource,
  FetchInput,
  HeaderValueFormat,
  HeadersLike,
  LlmBackoffOptions,
  ParseHeadersOptions,
  ProviderId,
  RateLimitAdvice,
  RateLimitCandidate,
  RateLimitResource,
  RetryClassification,
  RetryContext,
  RetryEvent,
} from './types.js';
