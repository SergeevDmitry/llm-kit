/**
 * Golden test for the numbers the root `README.md` prints.
 *
 * `validate:readme` compiles every README snippet, which proves the API
 * exists and is used correctly. It does not execute anything, so a
 * `// → "0.54"` comment on its own is never actually checked against the
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
  it('prices gemma-4-31b at "0.54" on aws-bedrock', () => {
    expect(
      calculateCost({ model: 'gemma-4-31b', provider: 'aws-bedrock', usage }).totalUsdExact,
    ).toBe('0.54');
  });

  it('prices the same model at "1.36" on together - the 2.5x claim', () => {
    expect(calculateCost({ model: 'gemma-4-31b', provider: 'together', usage }).totalUsdExact).toBe(
      '1.36',
    );
  });

  it('refuses to guess when the provider is omitted', () => {
    expect(() => calculateCost({ model: 'gemma-4-31b', usage })).toThrowError(
      expect.objectContaining({ code: 'AMBIGUOUS_ALIAS' }),
    );
  });
});
