/**
 * Error types thrown by `llm-backoff`.
 *
 * A single class with a discriminated `code`, matching `chat-fit`'s
 * `ChatFitError` shape. The original failure is always available as `.cause`,
 * and every retry this package made is available as `.attempts`: the final
 * thrown error preserves the original cause and carries attempt history.
 *
 * Aborts are the deliberate exception: they are never wrapped. `withLlmBackoff`
 * and `fetchWithLlmBackoff` rethrow an abort exactly as `operation`/`fetch`
 * threw it, unwrapped — see `src/with-llm-backoff.ts`.
 */
import type { AttemptRecord } from './types.js';

export type LlmBackoffErrorCode =
  | 'INVALID_OPTIONS'
  | 'NON_RETRYABLE'
  | 'MAX_ATTEMPTS_EXCEEDED'
  | 'MAX_ELAPSED_EXCEEDED'
  | 'ON_RETRY_CALLBACK_FAILED'
  | 'REQUEST_BODY_NOT_REPLAYABLE';

export class LlmBackoffError extends Error {
  readonly code: LlmBackoffErrorCode;
  /** Every attempt made, oldest first, including the terminal one that produced this error. */
  readonly attempts: readonly AttemptRecord[];

  constructor(
    message: string,
    code: LlmBackoffErrorCode,
    attempts: readonly AttemptRecord[],
    options?: { readonly cause?: unknown },
  ) {
    super(message, options);
    this.name = 'LlmBackoffError';
    this.code = code;
    this.attempts = attempts;
  }
}

/**
 * Thrown internally by `fetchWithLlmBackoff`'s operation when a response's
 * status is classified retryable, so the shared retry loop in
 * `with-llm-backoff.ts` can drive it through the same classification/delay
 * machinery as any other error. Exported so a caller inspecting
 * `LlmBackoffError.cause` after `fetchWithLlmBackoff` exhausts its retries can
 * reach the last failed `Response` (e.g. to read its body for a provider error
 * message) without this package doing that reading — and therefore that
 * error-body handling — on the caller's behalf.
 */
export class FetchRetryableStatusError extends Error {
  readonly status: number;
  readonly headers: Headers;
  readonly response: Response;

  constructor(response: Response) {
    super(`llm-backoff: fetch received HTTP ${String(response.status)}, classified as retryable`);
    this.name = 'FetchRetryableStatusError';
    this.status = response.status;
    this.headers = response.headers;
    this.response = response;
  }
}
