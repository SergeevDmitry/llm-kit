/**
 * A provider qualifier can travel on either `request.provider` or
 * `options.provider` — `PriceOptions` (= `ResolveModelOptions`) publicly
 * declares the field and `createPriceCalculator` explicitly forwards it
 * (`calculator.ts`). `calculateCost` resolves with
 * `request.provider ?? options.provider`, so `request.provider` wins when
 * both are supplied.
 *
 * The invariant this suite locks down: the two channels are equivalent —
 * every `calculateCost` call made by qualifying the provider on `options`
 * must produce a result identical to the same call qualifying it on
 * `request`, across the match, miss, ambiguous-id, and
 * unknown-provider-qualifier cases. A qualifier that only takes effect on
 * one channel could silently fall through to a global, unqualified match
 * (wrong provider's price) on the other, so all four shapes are covered.
 */
import { describe, expect, it } from 'vitest';
import { assertErrorShape } from '@llm-kit/test-utils';
import { calculateCost } from '../src/calculate-cost.js';
import { createPriceCalculator } from '../src/calculator.js';
import { AmbiguousAliasError, UnknownModelError } from '../src/index.js';

const usage = { inputTokens: 1_000_000, outputTokens: 1_000_000 };

/** Runs `thunk` and returns either its value or the error it threw, tagged. */
function capture<T>(thunk: () => T): { ok: true; value: T } | { ok: false; error: unknown } {
  try {
    return { ok: true, value: thunk() };
  } catch (error) {
    return { ok: false, error };
  }
}

describe('provider qualifier: request.provider vs options.provider equivalence', () => {
  it('match: an id unique to one provider prices identically on either channel', () => {
    // claude-fable-5 exists only under anthropic in the committed registry.
    const viaRequest = calculateCost({ model: 'claude-fable-5', provider: 'anthropic', usage });
    const viaOptions = calculateCost({ model: 'claude-fable-5', usage }, { provider: 'anthropic' });
    expect(viaOptions).toEqual(viaRequest);
    expect(viaOptions.requestedProvider).toBe('anthropic');
    expect(viaOptions.provider).toBe('anthropic');
  });

  it('match: the Azure/OpenAI 5x case prices identically on either channel (README headline claim)', () => {
    // gpt-5.6-luna: $1.00/$6.00 on azure-openai vs $0.20/$1.20 on openai — a real 5x price difference for the identical model name.
    const viaRequest = calculateCost({ model: 'gpt-5.6-luna', provider: 'azure-openai', usage });
    const viaOptions = calculateCost(
      { model: 'gpt-5.6-luna', usage },
      { provider: 'azure-openai' },
    );
    expect(viaOptions).toEqual(viaRequest);
    expect(viaOptions.provider).toBe('azure-openai');

    const openaiRate = calculateCost({ model: 'gpt-5.6-luna', usage }, { provider: 'openai' });
    expect(openaiRate.totalUsdExact).not.toBe(viaOptions.totalUsdExact);
  });

  it('qualified miss: a provider-qualified id that exists under a different provider throws UNKNOWN_MODEL on either channel, never a silent global match', () => {
    // claude-fable-5 qualified against aws-bedrock, where it is not
    // registered (it exists only under anthropic). A qualified miss must
    // throw rather than falling through to the globally-unambiguous alias
    // step and returning anthropic's price instead.
    const viaRequest = capture(() =>
      calculateCost({ model: 'claude-fable-5', provider: 'aws-bedrock', usage }),
    );
    const viaOptions = capture(() =>
      calculateCost({ model: 'claude-fable-5', usage }, { provider: 'aws-bedrock' }),
    );
    expect(viaRequest.ok).toBe(false);
    expect(viaOptions.ok).toBe(false);
    if (viaRequest.ok || viaOptions.ok) throw new Error('unreachable');
    assertErrorShape(viaRequest.error, { name: 'UnknownModelError', code: 'UNKNOWN_MODEL' });
    assertErrorShape(viaOptions.error, { name: 'UnknownModelError', code: 'UNKNOWN_MODEL' });
    expect(viaOptions.error).toBeInstanceOf(UnknownModelError);
    expect((viaOptions.error as UnknownModelError).message).toBe(
      (viaRequest.error as UnknownModelError).message,
    );
    expect((viaOptions.error as UnknownModelError).otherProviders).toEqual(['anthropic']);
  });

  it('ambiguous id: qualifying via either channel resolves identically to the same disambiguated model', () => {
    // gpt-oss-120b is hosted by both groq and together at different rates —
    // unqualified it is AMBIGUOUS_ALIAS; qualified it must resolve the same
    // way regardless of which channel carried the qualifier.
    const viaRequest = calculateCost({ model: 'gpt-oss-120b', provider: 'groq', usage });
    const viaOptions = calculateCost({ model: 'gpt-oss-120b', usage }, { provider: 'groq' });
    expect(viaOptions).toEqual(viaRequest);
    expect(viaOptions.provider).toBe('groq');
  });

  it('unknown provider qualifier: a string that is not a registered provider throws UNKNOWN_MODEL identically on either channel', () => {
    const viaRequest = capture(() =>
      calculateCost({ model: 'claude-fable-5', provider: 'not-a-provider', usage }),
    );
    const viaOptions = capture(() =>
      calculateCost({ model: 'claude-fable-5', usage }, { provider: 'not-a-provider' }),
    );
    expect(viaRequest.ok).toBe(false);
    expect(viaOptions.ok).toBe(false);
    if (viaRequest.ok || viaOptions.ok) throw new Error('unreachable');
    assertErrorShape(viaOptions.error, { name: 'UnknownModelError', code: 'UNKNOWN_MODEL' });
    expect((viaOptions.error as UnknownModelError).message).toBe(
      (viaRequest.error as UnknownModelError).message,
    );
  });

  it('precedence: request.provider wins when both channels are supplied and disagree', () => {
    const result = calculateCost(
      { model: 'claude-fable-5', provider: 'anthropic', usage },
      { provider: 'aws-bedrock' },
    );
    expect(result.provider).toBe('anthropic');
    expect(result.requestedProvider).toBe('anthropic');
  });

  it('an explicit request.provider: undefined falls through to options.provider (indistinguishable from omitted, per repository tsconfig)', () => {
    const result = calculateCost(
      { model: 'claude-fable-5', provider: undefined, usage },
      { provider: 'anthropic' },
    );
    expect(result.provider).toBe('anthropic');
    expect(result.requestedProvider).toBe('anthropic');
  });

  it('createPriceCalculator forwards options.provider all the way through to calculateCost', () => {
    const calculator = createPriceCalculator();
    const viaCalculator = calculator.calculateCost(
      { model: 'gpt-5.6-luna', usage },
      { provider: 'azure-openai' },
    );
    const direct = calculateCost({ model: 'gpt-5.6-luna', provider: 'azure-openai', usage });
    expect(viaCalculator).toEqual(direct);
  });

  it('ambiguous alias still throws when neither channel qualifies the provider', () => {
    expect(() => calculateCost({ model: 'gpt-oss-120b', usage })).toThrow(AmbiguousAliasError);
  });
});
