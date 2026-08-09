/**
 * Regression coverage: a known usage field present with a non-conforming
 * value — wrong type, `NaN`, `Infinity`, negative, or fractional — must
 * throw `InvalidUsageError`, never be silently treated as absent and priced
 * as zero. `null` is the one exception: providers (see Anthropic's published
 * OpenAPI schema, cited in the README) emit `null` for "not applicable", so
 * it stays equivalent to "absent".
 *
 * Every recognized optional field in every adapter is covered here, plus
 * required fields (which must reject a malformed *present* value the same
 * way they already reject a missing one), plus an end-to-end assertion that
 * a malformed cache/reasoning field can never become an unwarned zero cost
 * through `calculateCost`.
 */
import { describe, expect, it } from 'vitest';
import { calculateCost } from '../src/calculate-cost.js';
import { createPriceOverride } from '../src/overrides.js';
import { InvalidUsageError } from '../src/errors.js';
import { normalizeAnthropicUsage } from '../src/normalize/anthropic.js';
import { normalizeGoogleUsage } from '../src/normalize/google.js';
import { normalizeOpenAICompatibleUsage } from '../src/normalize/openai-compatible.js';
import { normalizeOpenAIUsage } from '../src/normalize/openai.js';
import { normalizeRequestUsage } from '../src/normalize/generic.js';
import type { NormalizedUsageResult } from '../src/types.js';

/**
 * Present-but-invalid values every known numeric usage field must reject.
 * Includes `bigint` — a value type node-postgres and mysql2 both routinely
 * hand back for a `BIGINT` column, and the one type `JSON.stringify` throws
 * on, so the error-message-building code has to render it without itself
 * throwing a raw `TypeError` in place of `InvalidUsageError`.
 */
const MALFORMED_VALUES: ReadonlyArray<[label: string, value: unknown]> = [
  ['a numeric string', '1000000'],
  ['a boolean', true],
  ['an empty object', {}],
  ['an array', [1, 2, 3]],
  ['a bigint', 100n],
  ['NaN', Number.NaN],
  ['Infinity', Number.POSITIVE_INFINITY],
  ['-Infinity', Number.NEGATIVE_INFINITY],
  ['a negative integer', -5],
  ['a fractional number', 1.5],
];

/**
 * Builds a usage object from a base plus one overridden key, runs the
 * adapter, and asserts it throws `InvalidUsageError` for every malformed
 * value and treats `null` as absent (no throw, field excluded from the
 * result and from warnings).
 */
function testKnownField<T extends Record<string, unknown>>(
  describeLabel: string,
  normalize: (value: unknown) => NormalizedUsageResult,
  base: T,
  field: string,
  resultField: string,
  options: { required?: boolean } = {},
): void {
  describe(describeLabel, () => {
    for (const [label, value] of MALFORMED_VALUES) {
      it(`rejects ${label}`, () => {
        expect(() => normalize({ ...base, [field]: value })).toThrow(InvalidUsageError);
      });
    }

    if (options.required) {
      // `null` is absent, like any other missing-field state — but this
      // field is required, so absence must still throw, just via the
      // "missing required field(s)" message rather than a value-shape one.
      it('treats null as absent, and — being required — that still throws', () => {
        expect(() => normalize({ ...base, [field]: null })).toThrow(InvalidUsageError);
      });
    } else {
      it('treats null as absent (not an error, not priced)', () => {
        const { usage, warnings } = normalize({ ...base, [field]: null });
        expect((usage as unknown as Record<string, unknown>)[resultField]).toBeUndefined();
        expect(warnings).toEqual([]);
      });
    }
  });
}

describe('normalizeAnthropicUsage — malformed known fields', () => {
  const base = { input_tokens: 700, output_tokens: 300 };

  testKnownField(
    'input_tokens (required)',
    normalizeAnthropicUsage,
    { output_tokens: 300 },
    'input_tokens',
    'inputTokens',
    { required: true },
  );
  testKnownField(
    'output_tokens (required)',
    normalizeAnthropicUsage,
    { input_tokens: 700 },
    'output_tokens',
    'outputTokens',
    { required: true },
  );
  testKnownField(
    'cache_read_input_tokens (optional)',
    normalizeAnthropicUsage,
    base,
    'cache_read_input_tokens',
    'cachedInputTokens',
  );
  testKnownField(
    'cache_creation_input_tokens (optional)',
    normalizeAnthropicUsage,
    base,
    'cache_creation_input_tokens',
    'cacheWriteTokens',
  );

  describe('cache_creation (optional, nested object)', () => {
    it('throws when cache_creation itself is present but not an object', () => {
      expect(() => normalizeAnthropicUsage({ ...base, cache_creation: 'not-an-object' })).toThrow(
        InvalidUsageError,
      );
    });

    it('treats a null cache_creation as absent', () => {
      const { usage, warnings } = normalizeAnthropicUsage({ ...base, cache_creation: null });
      expect(usage.cacheWriteTokens).toBeUndefined();
      expect(warnings).toEqual([]);
    });

    for (const field of ['ephemeral_5m_input_tokens', 'ephemeral_1h_input_tokens']) {
      for (const [label, value] of MALFORMED_VALUES) {
        it(`rejects ${label} for cache_creation.${field}`, () => {
          expect(() =>
            normalizeAnthropicUsage({ ...base, cache_creation: { [field]: value } }),
          ).toThrow(InvalidUsageError);
        });
      }

      it(`treats a null cache_creation.${field} as absent`, () => {
        const { usage } = normalizeAnthropicUsage({ ...base, cache_creation: { [field]: null } });
        expect(usage.cacheWriteTokens).toBeUndefined();
      });
    }
  });
});

describe('normalizeOpenAIUsage — malformed known fields', () => {
  const base = { prompt_tokens: 1000, completion_tokens: 500 };

  testKnownField(
    'prompt_tokens (required, Chat Completions)',
    normalizeOpenAIUsage,
    { completion_tokens: 500 },
    'prompt_tokens',
    'inputTokens',
    { required: true },
  );
  testKnownField(
    'completion_tokens (required, Chat Completions)',
    normalizeOpenAIUsage,
    { prompt_tokens: 1000 },
    'completion_tokens',
    'outputTokens',
    { required: true },
  );
  testKnownField(
    'input_tokens (required, Responses API)',
    normalizeOpenAIUsage,
    { output_tokens: 500 },
    'input_tokens',
    'inputTokens',
    { required: true },
  );
  testKnownField(
    'output_tokens (required, Responses API)',
    normalizeOpenAIUsage,
    { input_tokens: 1000 },
    'output_tokens',
    'outputTokens',
    { required: true },
  );

  describe('prompt_tokens_details (optional, nested object)', () => {
    it('throws when the parent is present but not an object', () => {
      expect(() =>
        normalizeOpenAIUsage({ ...base, prompt_tokens_details: 'not-an-object' }),
      ).toThrow(InvalidUsageError);
    });

    for (const [label, value] of MALFORMED_VALUES) {
      it(`rejects ${label} for prompt_tokens_details.cached_tokens`, () => {
        expect(() =>
          normalizeOpenAIUsage({ ...base, prompt_tokens_details: { cached_tokens: value } }),
        ).toThrow(InvalidUsageError);
      });
    }

    it('treats a null cached_tokens as absent', () => {
      const { usage } = normalizeOpenAIUsage({
        ...base,
        prompt_tokens_details: { cached_tokens: null },
      });
      expect(usage.cachedInputTokens).toBeUndefined();
    });
  });

  describe('completion_tokens_details (optional, nested object)', () => {
    for (const [label, value] of MALFORMED_VALUES) {
      it(`rejects ${label} for completion_tokens_details.reasoning_tokens`, () => {
        expect(() =>
          normalizeOpenAIUsage({
            ...base,
            completion_tokens_details: { reasoning_tokens: value },
          }),
        ).toThrow(InvalidUsageError);
      });
    }
  });
});

describe('normalizeGoogleUsage — malformed known fields', () => {
  const base = { promptTokenCount: 1000, candidatesTokenCount: 400 };

  testKnownField(
    'promptTokenCount (required)',
    normalizeGoogleUsage,
    { candidatesTokenCount: 400 },
    'promptTokenCount',
    'inputTokens',
    { required: true },
  );
  testKnownField(
    'candidatesTokenCount (required)',
    normalizeGoogleUsage,
    { promptTokenCount: 1000 },
    'candidatesTokenCount',
    'outputTokens',
    { required: true },
  );
  testKnownField(
    'cachedContentTokenCount (optional)',
    normalizeGoogleUsage,
    base,
    'cachedContentTokenCount',
    'cachedInputTokens',
  );
  testKnownField(
    'thoughtsTokenCount (optional)',
    normalizeGoogleUsage,
    base,
    'thoughtsTokenCount',
    'reasoningTokens',
  );
});

describe('normalizeOpenAICompatibleUsage — malformed known fields', () => {
  const base = { prompt_tokens: 100, completion_tokens: 50 };

  testKnownField(
    'prompt_tokens (required)',
    normalizeOpenAICompatibleUsage,
    { completion_tokens: 50 },
    'prompt_tokens',
    'inputTokens',
    { required: true },
  );
  testKnownField(
    'completion_tokens (required)',
    normalizeOpenAICompatibleUsage,
    { prompt_tokens: 100 },
    'completion_tokens',
    'outputTokens',
    { required: true },
  );
  testKnownField(
    'cached_tokens (optional, flat)',
    normalizeOpenAICompatibleUsage,
    base,
    'cached_tokens',
    'cachedInputTokens',
  );
  testKnownField(
    'prompt_cache_hit_tokens (optional, DeepSeek-style)',
    normalizeOpenAICompatibleUsage,
    base,
    'prompt_cache_hit_tokens',
    'cachedInputTokens',
  );

  describe('prompt_tokens_details.cached_tokens (optional, nested, preferred over the flat field)', () => {
    for (const [label, value] of MALFORMED_VALUES) {
      it(`rejects ${label}`, () => {
        expect(() =>
          normalizeOpenAICompatibleUsage({
            ...base,
            prompt_tokens_details: { cached_tokens: value },
          }),
        ).toThrow(InvalidUsageError);
      });
    }
  });

  describe('completion_tokens_details.reasoning_tokens (optional, nested)', () => {
    for (const [label, value] of MALFORMED_VALUES) {
      it(`rejects ${label}`, () => {
        expect(() =>
          normalizeOpenAICompatibleUsage({
            ...base,
            completion_tokens_details: { reasoning_tokens: value },
          }),
        ).toThrow(InvalidUsageError);
      });
    }
  });
});

describe('normalizeRequestUsage (generic, internal) — malformed known fields', () => {
  const base = { inputTokens: 10, outputTokens: 5 };

  for (const field of ['inputTokens', 'outputTokens']) {
    describe(`${field} (required)`, () => {
      const wrongTypeValues: ReadonlyArray<[string, unknown]> = [
        ['a string', '10'],
        ['a boolean', true],
        ['an object', {}],
        ['an array', [1]],
        ['a bigint', 100n],
      ];
      for (const [label, value] of wrongTypeValues) {
        it(`rejects ${label}`, () => {
          expect(() => normalizeRequestUsage({ ...base, [field]: value })).toThrow(
            InvalidUsageError,
          );
        });
      }

      it('treats null as absent, and absence throws the missing-fields error', () => {
        expect(() => normalizeRequestUsage({ ...base, [field]: null })).toThrow(InvalidUsageError);
      });
    });
  }

  for (const field of ['cachedInputTokens', 'cacheWriteTokens', 'reasoningTokens']) {
    describe(`${field} (optional)`, () => {
      it('rejects a string', () => {
        expect(() => normalizeRequestUsage({ ...base, [field]: '5' })).toThrow(InvalidUsageError);
      });
      it('rejects a boolean', () => {
        expect(() => normalizeRequestUsage({ ...base, [field]: true })).toThrow(InvalidUsageError);
      });
      it('rejects an object', () => {
        expect(() => normalizeRequestUsage({ ...base, [field]: {} })).toThrow(InvalidUsageError);
      });
      it('rejects a bigint', () => {
        expect(() => normalizeRequestUsage({ ...base, [field]: 100n })).toThrow(InvalidUsageError);
      });
      it('treats null as absent', () => {
        const { usage } = normalizeRequestUsage({ ...base, [field]: null });
        expect(usage[field as keyof typeof usage]).toBeUndefined();
      });
    });
  }
});

describe('end to end: malformed cache/reasoning usage can never become an unwarned zero cost', () => {
  const perMillionCacheWriteRate = '2.00';
  const override = createPriceOverride({
    canonicalId: 'malformed-usage-override-model',
    provider: 'custom',
    input: '1.00',
    output: '1.00',
    cachedInput: '1.00',
    cacheWrite: perMillionCacheWriteRate,
    reasoning: '3.00',
  });

  it('a stringified cache_creation_input_tokens throws instead of pricing as zero', () => {
    expect(() =>
      normalizeAnthropicUsage({
        input_tokens: 700,
        output_tokens: 300,
        cache_creation_input_tokens: '1000000',
      }),
    ).toThrow(InvalidUsageError);
  });

  it('a bigint inputTokens on calculateCost itself throws INVALID_USAGE, not a raw TypeError', () => {
    let error: unknown;
    try {
      calculateCost(
        {
          model: 'malformed-usage-override-model',
          provider: 'custom',
          usage: { inputTokens: 100n, outputTokens: 10 },
        },
        { overrides: [override] },
      );
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(InvalidUsageError);
    expect((error as InvalidUsageError).code).toBe('INVALID_USAGE');
  });

  it('a bigint cache_creation_input_tokens on a raw Anthropic response throws INVALID_USAGE, not a raw TypeError', () => {
    let error: unknown;
    try {
      normalizeAnthropicUsage({
        input_tokens: 700,
        output_tokens: 300,
        cache_creation_input_tokens: 100n,
      });
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(InvalidUsageError);
    expect((error as InvalidUsageError).code).toBe('INVALID_USAGE');
  });

  it('a NaN cache_read_input_tokens never reaches calculateCost as a priced-at-zero line', () => {
    expect(() =>
      normalizeAnthropicUsage({
        input_tokens: 700,
        output_tokens: 300,
        cache_read_input_tokens: Number.NaN,
      }),
    ).toThrow(InvalidUsageError);
  });

  it('a negative reasoningTokens on OpenAI-shaped usage throws rather than under-billing', () => {
    expect(() =>
      normalizeOpenAIUsage({
        prompt_tokens: 1000,
        completion_tokens: 500,
        completion_tokens_details: { reasoning_tokens: -10 },
      }),
    ).toThrow(InvalidUsageError);
  });

  it('once past normalization, a genuinely valid cache-write is priced and never silently zero', () => {
    const { usage, warnings } = normalizeAnthropicUsage({
      input_tokens: 700,
      output_tokens: 300,
      cache_creation_input_tokens: 1_000_000,
    });
    expect(warnings).toEqual([]);
    const result = calculateCost(
      { model: 'malformed-usage-override-model', usage },
      {
        overrides: [override],
      },
    );
    // 1,000,000 tokens * $2.00 / 1e6 = $2.00 — never $0.00.
    expect(result.cacheWrite?.costUsdExact).toBe('2.00');
    expect(result.totalUsdExact).not.toBe('0.00');
  });
});
