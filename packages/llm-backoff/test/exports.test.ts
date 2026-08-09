import { exportNames } from '@llm-kit/test-utils';
import { describe, expect, it } from 'vitest';
import * as api from '../src/index.js';

describe('llm-backoff public surface', () => {
  it('exports exactly the documented public API', () => {
    // Snapshotted so an accidental addition or removal shows up as a
    // reviewable diff rather than a silent API change. Type-only exports
    // leave no runtime trace on the module namespace, so only value exports
    // appear here.
    expect(exportNames(api)).toEqual([
      'FetchRetryableStatusError',
      'LlmBackoffError',
      'classifyLlmError',
      'fetchWithLlmBackoff',
      'parseRateLimitHeaders',
      'withLlmBackoff',
    ]);
  });

  it('the four documented functions are callable', () => {
    expect(typeof api.withLlmBackoff).toBe('function');
    expect(typeof api.fetchWithLlmBackoff).toBe('function');
    expect(typeof api.parseRateLimitHeaders).toBe('function');
    expect(typeof api.classifyLlmError).toBe('function');
  });

  it('LlmBackoffError and FetchRetryableStatusError are Error subclasses', () => {
    expect(new api.LlmBackoffError('x', 'NON_RETRYABLE', [])).toBeInstanceOf(Error);
    expect(new api.FetchRetryableStatusError(new Response(null, { status: 429 }))).toBeInstanceOf(
      Error,
    );
  });
});
