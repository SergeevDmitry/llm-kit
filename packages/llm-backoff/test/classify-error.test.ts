import { describe, expect, it } from 'vitest';
import { classifyLlmError, classifyStatus } from '../src/classify-error.js';

describe('classifyStatus — the classification matrix', () => {
  it('retries 429 and 529 by default', () => {
    expect(classifyStatus(429).retryable).toBe(true);
    expect(classifyStatus(529).retryable).toBe(true);
  });

  it('never retries 400 or 401 by default', () => {
    expect(classifyStatus(400).retryable).toBe(false);
    expect(classifyStatus(401).retryable).toBe(false);
  });

  it('400/401 stay non-retryable even if the caller adds them to retryableStatuses', () => {
    expect(classifyStatus(400, { retryableStatuses: [400] }).retryable).toBe(false);
    expect(classifyStatus(401, { retryableStatuses: [401] }).retryable).toBe(false);
  });

  it('429/529 stay retryable even if the caller adds them to nonRetryableStatuses', () => {
    expect(classifyStatus(429, { nonRetryableStatuses: [429] }).retryable).toBe(true);
    expect(classifyStatus(529, { nonRetryableStatuses: [529] }).retryable).toBe(true);
  });

  it('an unlisted status is not retryable by default', () => {
    for (const status of [402, 403, 404, 408, 418, 500, 502, 503, 504]) {
      expect(classifyStatus(status).retryable, `status ${String(status)}`).toBe(false);
    }
  });

  it('retryableStatuses opts an otherwise-neutral status in', () => {
    expect(classifyStatus(503, { retryableStatuses: [503] }).retryable).toBe(true);
  });

  it('nonRetryableStatuses opts an otherwise-neutral status out (redundant with the default, but explicit)', () => {
    expect(classifyStatus(404, { nonRetryableStatuses: [404] }).retryable).toBe(false);
  });

  it('every classification carries a non-empty, stable-ish reason', () => {
    for (const status of [400, 401, 429, 529, 500]) {
      expect(classifyStatus(status).reason.length).toBeGreaterThan(0);
    }
  });
});

describe('classifyLlmError', () => {
  it('classifies a thrown Response by status and extracts its headers', () => {
    const response = new Response(null, {
      status: 429,
      headers: { 'retry-after': '30' },
    });
    const classification = classifyLlmError(response);
    expect(classification.retryable).toBe(true);
    expect(classification.status).toBe(429);
    expect(classification.isAbort).toBe(false);
    expect(classification.headers).toBeInstanceOf(Headers);
  });

  it('classifies an SDK-shaped error with a top-level status/headers', () => {
    const error = { status: 401, headers: { 'x-request-id': 'abc' } };
    const classification = classifyLlmError(error);
    expect(classification.retryable).toBe(false);
    expect(classification.status).toBe(401);
  });

  it('classifies an SDK-shaped error nested under response.status/response.headers', () => {
    const error = { response: { status: 429, headers: { 'retry-after': '5' } } };
    const classification = classifyLlmError(error);
    expect(classification.retryable).toBe(true);
    expect(classification.status).toBe(429);
    expect(classification.headers).toEqual({ 'retry-after': '5' });
  });

  it('classifies an SDK error with statusCode instead of status', () => {
    const classification = classifyLlmError({ statusCode: 529 });
    expect(classification.retryable).toBe(true);
    expect(classification.status).toBe(529);
  });

  it('classifies a recognized transient network error code', () => {
    const error = Object.assign(new Error('socket hang up'), { code: 'ECONNRESET' });
    const classification = classifyLlmError(error);
    expect(classification.retryable).toBe(true);
    expect(classification.status).toBeUndefined();
  });

  it('classifies a transient network error code carried on error.cause', () => {
    const inner = Object.assign(new Error('connect ETIMEDOUT'), { code: 'ETIMEDOUT' });
    const error = new TypeError('fetch failed', { cause: inner });
    const classification = classifyLlmError(error);
    expect(classification.retryable).toBe(true);
  });

  it('never retries an abort error, and reports isAbort', () => {
    const abortError = new DOMException('The operation was aborted.', 'AbortError');
    const classification = classifyLlmError(abortError);
    expect(classification.retryable).toBe(false);
    expect(classification.isAbort).toBe(true);
  });

  it('an abort error wins even if it happens to also carry a retryable status', () => {
    const abortError = Object.assign(new DOMException('aborted', 'AbortError'), { status: 429 });
    const classification = classifyLlmError(abortError);
    expect(classification.retryable).toBe(false);
    expect(classification.isAbort).toBe(true);
  });

  it('an unknown error shape with no status and no recognized network code is not retried', () => {
    expect(classifyLlmError(new Error('something odd happened')).retryable).toBe(false);
    expect(classifyLlmError('a bare string throw').retryable).toBe(false);
    expect(classifyLlmError(null).retryable).toBe(false);
    expect(classifyLlmError(undefined).retryable).toBe(false);
  });
});
