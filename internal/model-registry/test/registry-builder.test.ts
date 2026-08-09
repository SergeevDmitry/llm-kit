import { assertJsonSerializable } from '@llm-kit/test-utils';
import { describe, expect, it } from 'vitest';
import {
  buildRegistry,
  canonicalizeRegistry,
  renderRegistryModule,
} from '../src/registry-builder.js';
import { validateProviderSourceFile } from '../src/schema.js';
import type { ModelDescriptor } from '../src/types.js';

const PERIOD = {
  effectiveFrom: '2026-01-01',
  currency: 'USD' as const,
  unit: 'per-million-tokens' as const,
  input: '3.00',
  output: '15.00',
  sourceUrl: 'https://example.com/pricing',
  observedAt: '2026-08-05',
};

function sourceFile(provider: 'anthropic' | 'openai', models: Record<string, unknown>[]) {
  return { provider, models };
}

describe('buildRegistry', () => {
  it('sorts lexicographically by provider, then canonicalId, then aliases, regardless of source order', () => {
    const results = [
      validateProviderSourceFile(
        sourceFile('anthropic', [
          { canonicalId: 'z-model', provider: 'anthropic', aliases: ['b', 'a'], pricing: [PERIOD] },
          { canonicalId: 'a-model', provider: 'anthropic', aliases: [] },
        ]),
        'anthropic',
        'anthropic.json',
      ),
      validateProviderSourceFile(
        sourceFile('openai', [{ canonicalId: 'gpt', provider: 'openai', aliases: [] }]),
        'openai',
        'openai.json',
      ),
    ];

    const { models, issues } = buildRegistry(results);
    expect(issues).toEqual([]);
    // Lexicographic on provider: "anthropic" sorts before "openai", whatever
    // order PROVIDER_IDS happens to declare them in.
    expect(models.map((m) => `${m.provider}:${m.canonicalId}`)).toEqual([
      'anthropic:a-model',
      'anthropic:z-model',
      'openai:gpt',
    ]);
    expect(models[1]?.aliases).toEqual(['a', 'b']);
  });

  it("sorts one model's pricing periods by effectiveFrom regardless of source order", () => {
    const results = [
      validateProviderSourceFile(
        sourceFile('anthropic', [
          {
            canonicalId: 'demo',
            provider: 'anthropic',
            aliases: [],
            pricing: [
              { ...PERIOD, effectiveFrom: '2026-09-01', input: '3.00' },
              { ...PERIOD, effectiveFrom: '2026-01-01', effectiveTo: '2026-09-01', input: '2.00' },
            ],
          },
        ]),
        'anthropic',
        'anthropic.json',
      ),
    ];
    const { models, issues } = buildRegistry(results);
    expect(issues).toEqual([]);
    expect(models[0]?.pricing?.map((p) => p.effectiveFrom)).toEqual(['2026-01-01', '2026-09-01']);
  });

  it('aggregates issues across every provider instead of building a partial registry', () => {
    const results = [
      validateProviderSourceFile(
        sourceFile('anthropic', [{ canonicalId: '', provider: 'anthropic', aliases: [] }]),
        'anthropic',
        'anthropic.json',
      ),
      validateProviderSourceFile(
        sourceFile('openai', [{ canonicalId: '', provider: 'openai', aliases: [] }]),
        'openai',
        'openai.json',
      ),
    ];
    const { models, issues } = buildRegistry(results);
    expect(models).toEqual([]);
    expect(issues.some((i) => i.startsWith('anthropic:'))).toBe(true);
    expect(issues.some((i) => i.startsWith('openai:'))).toBe(true);
  });
});

describe('renderRegistryModule — determinism', () => {
  const MODELS: readonly ModelDescriptor[] = [
    {
      canonicalId: 'demo',
      provider: 'anthropic',
      aliases: ['demo-alias'],
      contextWindow: 200000,
      pricing: [PERIOD],
    },
    {
      // Every optional field populated, to exercise renderModel/renderPricingPeriod's
      // "field present" branches alongside the sparse model above's "field absent" branches.
      canonicalId: 'demo-full',
      provider: 'anthropic',
      aliases: [],
      family: 'demo-family',
      tokenizerFamily: 'demo-tokenizer',
      contextWindow: 100000,
      capabilities: ['chat', 'vision'],
      pricing: [
        {
          ...PERIOD,
          effectiveTo: '2026-12-31',
          cachedInput: '0.30',
          cacheWrite: '3.75',
          reasoning: '15.00',
          batchMultiplier: '0.5',
          notes: ['an example note'],
        },
      ],
      source: { url: 'https://example.com/pricing', observedAt: '2026-08-05', notes: ['reviewed'] },
    },
  ];

  it('regenerating from unchanged input produces a byte-identical module', () => {
    const first = renderRegistryModule(MODELS, 'registry-abc123');
    const second = renderRegistryModule(MODELS, 'registry-abc123');
    expect(second).toBe(first);
  });

  it('changes only with its inputs, not with call order or object identity', () => {
    const copy: readonly ModelDescriptor[] = JSON.parse(
      JSON.stringify(MODELS),
    ) as ModelDescriptor[];
    expect(renderRegistryModule(copy, 'registry-abc123')).toBe(
      renderRegistryModule(MODELS, 'registry-abc123'),
    );
  });

  it('embeds the given version and every model, and is syntactically plausible TypeScript', () => {
    const rendered = renderRegistryModule(MODELS, 'registry-abc123');
    expect(rendered).toContain('export const REGISTRY_VERSION = "registry-abc123";');
    expect(rendered).toContain('export const MODEL_REGISTRY: readonly ModelDescriptor[] = [');
    expect(rendered).toContain('"demo"');
    expect(rendered).toMatch(/^\/\*\*\n \* GENERATED FILE/);
  });

  it('canonicalizeRegistry is deterministic and JSON-serializable', () => {
    const canonical = canonicalizeRegistry(MODELS);
    assertJsonSerializable(JSON.parse(canonical), 'canonical registry');
    expect(canonicalizeRegistry(MODELS)).toBe(canonical);
  });
});
