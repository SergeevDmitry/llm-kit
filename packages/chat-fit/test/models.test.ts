import {
  AmbiguousAliasError,
  UnknownModelError,
  type ModelDescriptor,
} from '@llm-kit/model-registry';
import { describe, expect, it } from 'vitest';
import {
  fitChatForModel,
  ModelContextWindowUnknownError,
  resolveModelBudget,
} from '../src/models.js';

describe('resolveModelBudget', () => {
  it('resolves a known model to its registry context window, reserveTokens defaulted to 0', () => {
    const budget = resolveModelBudget('claude-sonnet-5');
    expect(budget).toEqual({ maxTokens: 1_000_000, reserveTokens: 0 });
  });

  it('echoes an explicit reserveTokens through unchanged', () => {
    const budget = resolveModelBudget('claude-sonnet-5', { reserveTokens: 5_000 });
    expect(budget).toEqual({ maxTokens: 1_000_000, reserveTokens: 5_000 });
  });

  it('throws UnknownModelError (code UNKNOWN_MODEL), unchanged from @llm-kit/model-registry', () => {
    expect(() => resolveModelBudget('not-a-real-model')).toThrow(UnknownModelError);
    try {
      resolveModelBudget('not-a-real-model');
      expect.unreachable();
    } catch (error) {
      expect((error as UnknownModelError).code).toBe('UNKNOWN_MODEL');
    }
  });

  it('throws AmbiguousAliasError for an id registered under more than one provider with no provider qualifier', () => {
    expect(() => resolveModelBudget('gpt-4.1')).toThrow(AmbiguousAliasError);
  });

  it('a provider qualifier resolves an otherwise-ambiguous id', () => {
    // gpt-4.1 has no recorded contextWindow, so resolution itself must
    // succeed and the *next* check (ModelContextWindowUnknownError) must be
    // what fires — proves the provider qualifier reached resolveModel.
    expect(() => resolveModelBudget('gpt-4.1', { provider: 'openai' })).toThrow(
      ModelContextWindowUnknownError,
    );
  });

  it('throws ModelContextWindowUnknownError for a model with no recorded context window, naming it', () => {
    try {
      resolveModelBudget('gpt-4.1', { provider: 'openai' });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(ModelContextWindowUnknownError);
      const e = error as ModelContextWindowUnknownError;
      expect(e.code).toBe('MODEL_CONTEXT_WINDOW_UNKNOWN');
      expect(e.canonicalModel).toBe('gpt-4.1');
      expect(e.provider).toBe('openai');
    }
  });

  it('an override checked before the bundled registry can supply a context window the registry lacks', () => {
    const override: ModelDescriptor = {
      canonicalId: 'gpt-4.1',
      provider: 'openai',
      aliases: [],
      contextWindow: 128_000,
    };
    const budget = resolveModelBudget('gpt-4.1', { provider: 'openai', overrides: [override] });
    expect(budget).toEqual({ maxTokens: 128_000, reserveTokens: 0 });
  });

  it('falls back to a configured canonical id when nothing else matches', () => {
    const budget = resolveModelBudget('totally-unrecognized-id', { fallback: 'claude-sonnet-5' });
    expect(budget.maxTokens).toBe(1_000_000);
  });
});

describe('fitChatForModel', () => {
  it('resolves the model to maxTokens and fits messages within it', () => {
    const result = fitChatForModel([{ role: 'user', content: 'hi' }], {
      model: 'claude-sonnet-5',
    });
    expect(result.report.maxTokens).toBe(1_000_000);
    expect(result.report.reserveTokens).toBe(0);
    expect(result.messages).toHaveLength(1);
  });

  it('passes reserveTokens through to fitChat unchanged', () => {
    const result = fitChatForModel([{ role: 'user', content: 'hi' }], {
      model: 'claude-sonnet-5',
      reserveTokens: 12_345,
    });
    expect(result.report.reserveTokens).toBe(12_345);
  });

  it('an explicit maxTokens overrides the registry-resolved one and skips resolution entirely', () => {
    // `not-a-real-model` would otherwise throw UnknownModelError — proves the
    // override genuinely bypasses resolution rather than merely winning a
    // tie-break after a lookup that still happened.
    const result = fitChatForModel([{ role: 'user', content: 'hi' }], {
      model: 'not-a-real-model',
      maxTokens: 500,
    });
    expect(result.report.maxTokens).toBe(500);
  });

  it('propagates UnknownModelError when the model cannot be resolved and no maxTokens override is given', () => {
    expect(() =>
      fitChatForModel([{ role: 'user', content: 'hi' }], { model: 'not-a-real-model' }),
    ).toThrow(UnknownModelError);
  });

  it('provider and overrides flow through to resolution the same way resolveModelBudget uses them, with no maxTokens override', () => {
    const override: ModelDescriptor = {
      canonicalId: 'gpt-4.1',
      provider: 'openai',
      aliases: [],
      contextWindow: 128_000,
    };
    const result = fitChatForModel([{ role: 'user', content: 'hi' }], {
      model: 'gpt-4.1',
      provider: 'openai',
      overrides: [override],
    });
    expect(result.report.maxTokens).toBe(128_000);
  });
});
