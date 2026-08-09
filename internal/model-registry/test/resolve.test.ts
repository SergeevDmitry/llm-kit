import { assertErrorShape } from '@llm-kit/test-utils';
import { describe, expect, it } from 'vitest';
import { resolveModel } from '../src/resolve.js';
import type { ModelDescriptor } from '../src/types.js';

function model(
  overrides: Partial<ModelDescriptor> & Pick<ModelDescriptor, 'canonicalId' | 'provider'>,
): ModelDescriptor {
  return { aliases: [], ...overrides };
}

// A registry deliberately shaped to exercise every resolution step:
// - "gpt-4o" is offered, under the same alias, by two different providers —
//   the classic "alias reused by multiple providers" edge case — so it is
//   unambiguous only once a provider is supplied.
// - "gpt-4o-legacy" is a globally unique alias, resolvable with no provider.
const REGISTRY: readonly ModelDescriptor[] = [
  model({ canonicalId: 'gpt-4o-2024-08-06', provider: 'openai', aliases: ['gpt-4o'] }),
  model({ canonicalId: 'gpt-4o', provider: 'azure-openai', aliases: [] }),
  model({
    canonicalId: 'claude-haiku-4-5-20251001',
    provider: 'anthropic',
    aliases: ['claude-haiku-4-5', 'gpt-4o-legacy'],
  }),
  model({ canonicalId: 'llama-70b', provider: 'groq', aliases: [] }),
];

describe('resolveModel — resolution order', () => {
  it('step 2: exact canonical id with a provider qualifier', () => {
    const result = resolveModel('gpt-4o-2024-08-06', REGISTRY, { provider: 'openai' });
    expect(result.matchedBy).toBe('canonical-qualified');
    expect(result.descriptor.provider).toBe('openai');
  });

  it('step 3: exact alias scoped to the provider disambiguates a reused alias', () => {
    // "gpt-4o" is openai's alias (its canonicalId is "gpt-4o-2024-08-06") but
    // azure-openai's exact canonicalId. The same requested string resolves to
    // two different models depending purely on the provider qualifier.
    const openai = resolveModel('gpt-4o', REGISTRY, { provider: 'openai' });
    expect(openai.matchedBy).toBe('alias-scoped');
    expect(openai.descriptor.canonicalId).toBe('gpt-4o-2024-08-06');

    const azure = resolveModel('gpt-4o', REGISTRY, { provider: 'azure-openai' });
    expect(azure.matchedBy).toBe('canonical-qualified');
    expect(azure.descriptor.provider).toBe('azure-openai');
  });

  it('step 3 in isolation: an alias with no matching canonical id for that provider', () => {
    const result = resolveModel('claude-haiku-4-5', REGISTRY, { provider: 'anthropic' });
    expect(result.matchedBy).toBe('alias-scoped');
    expect(result.descriptor.canonicalId).toBe('claude-haiku-4-5-20251001');
  });

  it('step 4: a globally unambiguous alias resolves with no provider supplied', () => {
    const result = resolveModel('gpt-4o-legacy', REGISTRY);
    expect(result.matchedBy).toBe('alias-global');
    expect(result.descriptor.canonicalId).toBe('claude-haiku-4-5-20251001');
  });

  it('step 4 also works when the id is a canonical id looked up with no provider', () => {
    const result = resolveModel('llama-70b', REGISTRY);
    expect(result.matchedBy).toBe('alias-global');
    expect(result.descriptor.provider).toBe('groq');
  });

  it('rejects ambiguity when two models of the same provider share a scoped alias (defensive — validateProviderSourceFile should already prevent this in real data)', () => {
    const brokenRegistry: readonly ModelDescriptor[] = [
      model({ canonicalId: 'model-a', provider: 'groq', aliases: ['shared'] }),
      model({ canonicalId: 'model-b', provider: 'groq', aliases: ['shared'] }),
    ];
    let error: unknown;
    try {
      resolveModel('shared', brokenRegistry, { provider: 'groq' });
    } catch (e) {
      error = e;
    }
    assertErrorShape(error, { name: 'AmbiguousAliasError', code: 'AMBIGUOUS_ALIAS' });
  });

  it('rejects ambiguity instead of guessing when no provider is given for a cross-provider alias', () => {
    let error: unknown;
    try {
      resolveModel('gpt-4o', REGISTRY);
    } catch (e) {
      error = e;
    }
    assertErrorShape(error, { name: 'AmbiguousAliasError', code: 'AMBIGUOUS_ALIAS' });
    const candidates = (error as { candidates: { provider: string; canonicalId: string }[] })
      .candidates;
    expect(candidates.map((c) => c.provider).sort()).toEqual(['azure-openai', 'openai']);
  });

  it('step 1: ambiguous overrides are rejected, never guessed', () => {
    const overrides = [
      model({ canonicalId: 'custom-model', provider: 'openai', aliases: [] }),
      model({ canonicalId: 'custom-model', provider: 'azure-openai', aliases: [] }),
    ];
    let error: unknown;
    try {
      resolveModel('custom-model', REGISTRY, { overrides });
    } catch (e) {
      error = e;
    }
    assertErrorShape(error, { name: 'AmbiguousAliasError', code: 'AMBIGUOUS_ALIAS' });
  });

  it('step 1: an exact custom override wins even over an exact provider-qualified canonical id', () => {
    const override = model({ canonicalId: 'gpt-4o-2024-08-06', provider: 'openai', aliases: [] });
    const result = resolveModel('gpt-4o-2024-08-06', REGISTRY, {
      provider: 'openai',
      overrides: [override],
    });
    expect(result.matchedBy).toBe('override');
    expect(result.descriptor).toBe(override);
  });

  it('step 1: an override also matches via a scoped alias, not just an exact canonical id', () => {
    const override = model({
      canonicalId: 'custom-canonical',
      provider: 'openai',
      aliases: ['custom-alias'],
    });
    const result = resolveModel('custom-alias', REGISTRY, {
      provider: 'openai',
      overrides: [override],
    });
    expect(result.matchedBy).toBe('override');
    expect(result.descriptor).toBe(override);
  });

  it('step 1: an override matches globally when no provider is supplied', () => {
    const override = model({ canonicalId: 'custom-canonical', provider: 'openai', aliases: [] });
    const result = resolveModel('custom-canonical', REGISTRY, { overrides: [override] });
    expect(result.matchedBy).toBe('override');
    expect(result.descriptor).toBe(override);
  });

  it('step 1 falls through to the registry, unqualified, when no override matches at all (no provider given)', () => {
    const override = model({ canonicalId: 'unrelated-model', provider: 'openai', aliases: [] });
    const result = resolveModel('llama-70b', REGISTRY, { overrides: [override] });
    expect(result.matchedBy).toBe('alias-global');
    expect(result.descriptor.canonicalId).toBe('llama-70b');
  });

  it('step 1 falls through to the registry when no override matches', () => {
    const override = model({ canonicalId: 'unrelated-model', provider: 'openai', aliases: [] });
    const result = resolveModel('gpt-4o-2024-08-06', REGISTRY, {
      provider: 'openai',
      overrides: [override],
    });
    expect(result.matchedBy).toBe('canonical-qualified');
  });

  it('step 5: an explicit fallback resolves an id nothing else matches', () => {
    const result = resolveModel('totally-unknown-id', REGISTRY, { fallback: 'llama-70b' });
    expect(result.matchedBy).toBe('fallback');
    expect(result.descriptor.canonicalId).toBe('llama-70b');
  });

  it('step 5 fallback is ignored once an earlier step already matched', () => {
    const result = resolveModel('llama-70b', REGISTRY, { fallback: 'gpt-4o-2024-08-06' });
    expect(result.matchedBy).toBe('alias-global');
    expect(result.descriptor.canonicalId).toBe('llama-70b');
  });

  it('step 6: raises UNKNOWN_MODEL when nothing matches and there is no fallback', () => {
    let error: unknown;
    try {
      resolveModel('nonexistent', REGISTRY);
    } catch (e) {
      error = e;
    }
    assertErrorShape(error, { name: 'UnknownModelError', code: 'UNKNOWN_MODEL' });
  });

  it('reports the requested provider and id on both success and error results', () => {
    const result = resolveModel('llama-70b', REGISTRY, { provider: 'groq' });
    expect(result.requestedId).toBe('llama-70b');
    expect(result.requestedProvider).toBe('groq');

    let error: unknown;
    try {
      resolveModel('nonexistent', REGISTRY, { provider: 'groq' });
    } catch (e) {
      error = e;
    }
    expect((error as { requestedId: string }).requestedId).toBe('nonexistent');
    expect((error as { provider?: string }).provider).toBe('groq');
  });
});

// A provider qualifier is a constraint, not a hint. Step 4 ("globally
// unambiguous alias") must never run once a provider was supplied — a
// qualified miss falls through to step 5 (fallback) or step 6
// (UNKNOWN_MODEL), never silently to another provider's descriptor.
describe('a provider qualifier is a constraint, not a hint', () => {
  it('a qualified lookup that only exists under a different provider throws UNKNOWN_MODEL, never falls through to it', () => {
    // "gpt-4o-legacy" is globally unique (anthropic only, via
    // claude-haiku-4-5-20251001's alias list) — exactly the shape that would
    // otherwise satisfy step 4 regardless of the requested provider.
    let error: unknown;
    try {
      resolveModel('gpt-4o-legacy', REGISTRY, { provider: 'openai' });
    } catch (e) {
      error = e;
    }
    assertErrorShape(error, { name: 'UnknownModelError', code: 'UNKNOWN_MODEL' });
  });

  it('the same lookup with no provider still resolves via step 4', () => {
    const result = resolveModel('gpt-4o-legacy', REGISTRY);
    expect(result.matchedBy).toBe('alias-global');
    expect(result.descriptor.canonicalId).toBe('claude-haiku-4-5-20251001');
  });

  it('a qualified miss falls through to an explicit fallback instead of throwing', () => {
    const result = resolveModel('gpt-4o-legacy', REGISTRY, {
      provider: 'openai',
      fallback: 'llama-70b',
    });
    expect(result.matchedBy).toBe('fallback');
    expect(result.descriptor.canonicalId).toBe('llama-70b');
  });

  it('UNKNOWN_MODEL names the provider(s) that actually carry the id, sorted and deduplicated', () => {
    let error: unknown;
    try {
      resolveModel('gpt-4o-legacy', REGISTRY, { provider: 'openai' });
    } catch (e) {
      error = e;
    }
    const unknown = error as { otherProviders?: readonly string[]; message: string };
    expect(unknown.otherProviders).toEqual(['anthropic']);
    expect(unknown.message).toContain('anthropic');
  });

  it('UNKNOWN_MODEL omits otherProviders when the id truly does not exist anywhere', () => {
    let error: unknown;
    try {
      resolveModel('nonexistent-id', REGISTRY, { provider: 'openai' });
    } catch (e) {
      error = e;
    }
    expect((error as { otherProviders?: readonly string[] }).otherProviders).toBeUndefined();
  });

  it('an override registered for one provider does not satisfy a request qualified to a different one', () => {
    // Same rule applied to matchExact's override pool (resolve.ts step 1):
    // an override for "azure-openai" must not silently answer a request
    // explicitly qualified to "openai".
    const override = model({
      canonicalId: 'custom-shared-id',
      provider: 'azure-openai',
      aliases: [],
    });
    let error: unknown;
    try {
      resolveModel('custom-shared-id', REGISTRY, { provider: 'openai', overrides: [override] });
    } catch (e) {
      error = e;
    }
    assertErrorShape(error, { name: 'UnknownModelError', code: 'UNKNOWN_MODEL' });
  });

  it('the override still matches globally when no provider is supplied', () => {
    const override = model({
      canonicalId: 'custom-shared-id',
      provider: 'azure-openai',
      aliases: [],
    });
    const result = resolveModel('custom-shared-id', REGISTRY, { overrides: [override] });
    expect(result.matchedBy).toBe('override');
    expect(result.descriptor).toBe(override);
  });

  it('unqualified behaviour is otherwise unchanged: cross-provider ambiguity still throws when no provider is given', () => {
    let error: unknown;
    try {
      resolveModel('gpt-4o', REGISTRY);
    } catch (e) {
      error = e;
    }
    assertErrorShape(error, { name: 'AmbiguousAliasError', code: 'AMBIGUOUS_ALIAS' });
  });

  it('ambiguity within the requested provider still throws (step 3)', () => {
    const brokenRegistry: readonly ModelDescriptor[] = [
      model({ canonicalId: 'model-a', provider: 'groq', aliases: ['shared'] }),
      model({ canonicalId: 'model-b', provider: 'groq', aliases: ['shared'] }),
    ];
    let error: unknown;
    try {
      resolveModel('shared', brokenRegistry, { provider: 'groq' });
    } catch (e) {
      error = e;
    }
    assertErrorShape(error, { name: 'AmbiguousAliasError', code: 'AMBIGUOUS_ALIAS' });
    const candidates = (error as { candidates: { provider: string; canonicalId: string }[] })
      .candidates;
    expect(candidates.every((c) => c.provider === 'groq')).toBe(true);
  });
});
