/**
 * The internal fallback normalizer `calculateCost` runs on
 * `PriceRequest.usage` — not a public export, exercised through its module
 * directly since it is the mechanism behind `usage: LlmUsage | unknown`.
 */
import { describe, expect, it } from 'vitest';
import { InvalidUsageError } from '../src/errors.js';
import { normalizeRequestUsage } from '../src/normalize/generic.js';

describe('normalizeRequestUsage', () => {
  it('passes an already-shaped LlmUsage through unchanged', () => {
    const { usage, warnings } = normalizeRequestUsage({
      inputTokens: 10,
      outputTokens: 5,
      cachedInputTokens: 2,
    });
    expect(usage).toEqual({ inputTokens: 10, outputTokens: 5, cachedInputTokens: 2 });
    expect(warnings).toEqual([]);
  });

  it('warns on, but preserves visibility of, an unrecognized extra field', () => {
    const { warnings } = normalizeRequestUsage({ inputTokens: 1, outputTokens: 1, audioTokens: 3 });
    expect(warnings).toEqual([
      { code: 'UNSUPPORTED_USAGE_FIELD', field: 'audioTokens', message: expect.any(String) },
    ]);
  });

  it('throws InvalidUsageError for a non-object value', () => {
    expect(() => normalizeRequestUsage(null)).toThrow(InvalidUsageError);
    expect(() => normalizeRequestUsage('usage')).toThrow(InvalidUsageError);
    expect(() => normalizeRequestUsage(42)).toThrow(InvalidUsageError);
  });

  it('throws InvalidUsageError when inputTokens/outputTokens are missing or non-numeric', () => {
    expect(() => normalizeRequestUsage({})).toThrow(InvalidUsageError);
    expect(() => normalizeRequestUsage({ inputTokens: '10', outputTokens: 5 })).toThrow(
      InvalidUsageError,
    );
  });
});
