import { exportNames } from '@llm-kit/test-utils';
import { describe, expect, it } from 'vitest';
import * as api from '../src/index.js';
import { resolveModel } from '../src/resolve.js';
import { selectPricingPeriod } from '../src/pricing-period.js';
import { validateModelDescriptor } from '../src/schema.js';
import { MODEL_REGISTRY, REGISTRY_VERSION } from '../src/generated/registry.js';

describe('public surface', () => {
  it('exports the documented names', () => {
    expect(exportNames(api)).toEqual(
      [
        'AmbiguousAliasError',
        'AmbiguousPricingPeriodError',
        'InvalidLookupDateError',
        'MODEL_REGISTRY',
        'ModelRegistrySchemaError',
        'PROVIDER_IDS',
        'REGISTRY_VERSION',
        'UnknownModelError',
        'resolveModel',
        'selectPricingPeriod',
        'validateModelDescriptor',
        'validatePricingPeriod',
        'validateProviderSourceFile',
      ].sort(),
    );
  });
});

describe('generated/registry.ts (committed output)', () => {
  it('is non-empty and carries a stable content-derived version string', () => {
    expect(MODEL_REGISTRY.length).toBeGreaterThan(0);
    expect(REGISTRY_VERSION).toMatch(/^registry-[0-9a-f]{16}$/);
  });

  it('every entry independently satisfies the schema the source data was validated against', () => {
    for (const model of MODEL_REGISTRY) {
      const issues = validateModelDescriptor(model, model.canonicalId, model.provider);
      expect(issues).toEqual([]);
    }
  });

  it('is sorted deterministically by provider then canonicalId', () => {
    const ids = MODEL_REGISTRY.map((m) => `${m.provider}:${m.canonicalId}`);
    expect(ids).toEqual([...ids].sort());
  });

  it('resolves the haiku short alias to its full dated canonical id (real alias/canonical-ID case)', () => {
    const result = resolveModel('claude-haiku-4-5', MODEL_REGISTRY, { provider: 'anthropic' });
    expect(result.matchedBy).toBe('alias-scoped');
    expect(result.descriptor.canonicalId).toBe('claude-haiku-4-5-20251001');
  });

  it('resolves the full haiku canonical id directly', () => {
    const result = resolveModel('claude-haiku-4-5-20251001', MODEL_REGISTRY, {
      provider: 'anthropic',
    });
    expect(result.matchedBy).toBe('canonical-qualified');
  });

  it("selects gemini-3.6-flash's historical, promotional and post-promotional rates across the real generated data", () => {
    // The multi-period fixture over real data. Google publishes both boundary
    // dates for the promotion, so this model carries three periods: the rate
    // observed 2026-08-05, the promotional rate running through 2026-12-31,
    // and the standard rate resuming 2027-01-01.
    const flash = MODEL_REGISTRY.find(
      (m) => m.canonicalId === 'gemini-3.6-flash' && m.provider === 'google',
    );
    expect(flash?.pricing).toBeDefined();

    const before = selectPricingPeriod(flash!.pricing!, '2026-08-15');
    expect(before?.input).toBe('1.50');
    expect(before?.output).toBe('7.50');

    const promotional = selectPricingPeriod(flash!.pricing!, '2026-11-01');
    expect(promotional?.input).toBe('0.75');
    expect(promotional?.output).toBe('3.75');

    // effectiveTo is exclusive, so the resumption date already belongs to the
    // standard period.
    const resumed = selectPricingPeriod(flash!.pricing!, '2027-01-01');
    expect(resumed?.input).toBe('1.50');
    expect(resumed?.output).toBe('7.50');
  });

  it("selects gpt-5.6-sol's rate either side of OpenAI's price cut", () => {
    const sol = MODEL_REGISTRY.find(
      (m) => m.canonicalId === 'gpt-5.6-sol' && m.provider === 'openai',
    );
    expect(sol?.pricing).toBeDefined();

    const beforeCut = selectPricingPeriod(sol!.pricing!, '2026-08-15');
    expect(beforeCut?.input).toBe('5.00');
    expect(beforeCut?.output).toBe('30.00');

    const afterCut = selectPricingPeriod(sol!.pricing!, '2026-09-15');
    expect(afterCut?.input).toBe('4.00');
    expect(afterCut?.output).toBe('20.00');
  });

  it('prices claude-sonnet-5 at one continuing rate: the scheduled increase was cancelled', () => {
    // This model used to be the multi-period fixture, with a $3.00/$15.00
    // period from 2026-09-01. Anthropic cancelled that increase, so both
    // dates must now select the same rate - a regression here means the
    // cancelled period came back.
    const sonnet5 = MODEL_REGISTRY.find(
      (m) => m.canonicalId === 'claude-sonnet-5' && m.provider === 'anthropic',
    );
    expect(sonnet5?.pricing).toHaveLength(1);

    for (const at of ['2026-08-15', '2026-09-15', '2027-06-01']) {
      const period = selectPricingPeriod(sonnet5!.pricing!, at);
      expect(period?.input).toBe('2.00');
      expect(period?.output).toBe('10.00');
    }
  });
});
