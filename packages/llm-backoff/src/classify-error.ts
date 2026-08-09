/**
 * `classifyLlmError` and the shared status classifier `fetch-with-llm-backoff.ts`
 * also uses, so a `fetch` response and an SDK error are classified by exactly
 * one rule set.
 *
 * Default policy — `429` and `529` retry, `400` and `401` never do:
 *   - `429` and `529` are retried, always — cannot be disabled via
 *     `nonRetryableStatuses`.
 *   - `400` and `401` are never retried, always — cannot be enabled via
 *     `retryableStatuses`.
 *   - Any other status is retryable only if listed in `retryableStatuses`;
 *     nothing else is retryable by default. Additional 5xx statuses can be
 *     enabled through configuration, but this package never enables extra
 *     ones on its own, so the default set stays exactly `{429, 529}` and is
 *     trivial to audit.
 *   - A handful of well-known transient network error codes (`ECONNRESET`,
 *     `ETIMEDOUT`, ...) are retried regardless of status, since they never
 *     carry one.
 *   - An abort is never retryable, regardless of any option.
 */
import { isAbortError } from './abort-utils.js';
import {
  MANDATORY_NON_RETRYABLE_STATUSES,
  MANDATORY_RETRYABLE_STATUSES,
  TRANSIENT_NETWORK_ERROR_CODES,
} from './defaults.js';
import { extractHttpError } from './extract-http-error.js';
import type { ClassificationOptions, RetryClassification } from './types.js';

export function classifyStatus(
  status: number,
  options: ClassificationOptions = {},
): { retryable: boolean; reason: string } {
  if (MANDATORY_NON_RETRYABLE_STATUSES.includes(status)) {
    return {
      retryable: false,
      reason: `HTTP ${String(status)} is never retried by default (authentication/validation failures are not transient)`,
    };
  }
  if (MANDATORY_RETRYABLE_STATUSES.includes(status)) {
    return {
      retryable: true,
      reason: `HTTP ${String(status)} is retried by default (rate limiting/overload is transient by definition)`,
    };
  }
  if (options.nonRetryableStatuses?.includes(status) === true) {
    return {
      retryable: false,
      reason: `HTTP ${String(status)} is configured as non-retryable via nonRetryableStatuses`,
    };
  }
  if (options.retryableStatuses?.includes(status) === true) {
    return {
      retryable: true,
      reason: `HTTP ${String(status)} is configured as retryable via retryableStatuses`,
    };
  }
  return {
    retryable: false,
    reason: `HTTP ${String(status)} is not retried by default; add it to retryableStatuses to enable retrying it`,
  };
}

function extractErrorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null) return undefined;
  const direct = (error as { code?: unknown }).code;
  if (typeof direct === 'string') return direct;
  const cause = (error as { cause?: unknown }).cause;
  if (typeof cause === 'object' && cause !== null) {
    const causeCode = (cause as { code?: unknown }).code;
    if (typeof causeCode === 'string') return causeCode;
  }
  return undefined;
}

function classifyTransientNetworkError(
  error: unknown,
): { retryable: boolean; reason: string } | undefined {
  const code = extractErrorCode(error);
  if (code !== undefined && TRANSIENT_NETWORK_ERROR_CODES.has(code)) {
    return {
      retryable: true,
      reason: `network error code "${code}" is a recognized transient failure`,
    };
  }
  return undefined;
}

export function classifyLlmError(
  error: unknown,
  options: ClassificationOptions = {},
): RetryClassification {
  if (isAbortError(error)) {
    return {
      retryable: false,
      reason: 'the operation was aborted',
      status: undefined,
      isAbort: true,
      headers: undefined,
    };
  }

  const { status, headers } = extractHttpError(error);
  if (status !== undefined) {
    const { retryable, reason } = classifyStatus(status, options);
    return { retryable, reason, status, isAbort: false, headers };
  }

  const transient = classifyTransientNetworkError(error);
  if (transient !== undefined) {
    return { ...transient, status: undefined, isAbort: false, headers: undefined };
  }

  return {
    retryable: false,
    reason:
      'error has no extractable HTTP status and no recognized transient network code; not retried by default (pass retryableStatuses, or normalize the error before throwing it, to change this)',
    status: undefined,
    isAbort: false,
    headers: undefined,
  };
}
