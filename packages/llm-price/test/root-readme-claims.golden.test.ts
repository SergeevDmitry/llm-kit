/**
 * Golden test for the numbers the root `README.md` prints.
 *
 * `validate:readme` compiles every README snippet, which proves the API
 * exists and is used correctly. It does not execute anything, so a
 * `// → "1.40"` comment on its own is never actually checked against the
 * real output. A price restatement in `docs/provider-data/` can regenerate
 * the registry, pass `verify:registry`, and still leave the repository's
 * headline claim silently wrong on the page every reader sees first.
 *
 * These three assertions are that page's claim, executed. If one fails,
 * either the registry changed and the root README needs updating, or
 * something is wrong with provider-qualified resolution — check which
 * before editing either.
 */
import { describe, expect, it } from 'vitest';
import { calculateCost } from '../src/index.js';

const usage = { inputTokens: 1_000_000, outputTokens: 1_000_000 };

describe('root README pricing example', () => {
  it('prices gpt-5.6-luna at "1.40" on openai', () => {
    expect(calculateCost({ model: 'gpt-5.6-luna', provider: 'openai', usage }).totalUsdExact).toBe(
      '1.40',
    );
  });

  it('prices the same model at "7.00" on azure-openai — the 5x claim', () => {
    expect(
      calculateCost({ model: 'gpt-5.6-luna', provider: 'azure-openai', usage }).totalUsdExact,
    ).toBe('7.00');
  });

  it('refuses to guess when the provider is omitted', () => {
    expect(() => calculateCost({ model: 'gpt-5.6-luna', usage })).toThrowError(
      expect.objectContaining({ code: 'AMBIGUOUS_ALIAS' }),
    );
  });
});
