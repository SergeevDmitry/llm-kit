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

  it("selects claude-sonnet-5's introductory vs. standard rate across the real generated data", () => {
    const sonnet5 = MODEL_REGISTRY.find((m) => m.canonicalId === 'claude-sonnet-5');
    expect(sonnet5?.pricing).toBeDefined();

    const introPeriod = selectPricingPeriod(sonnet5!.pricing!, '2026-08-15');
    expect(introPeriod?.input).toBe('2.00');
    expect(introPeriod?.output).toBe('10.00');

    const standardPeriod = selectPricingPeriod(sonnet5!.pricing!, '2026-09-15');
    expect(standardPeriod?.input).toBe('3.00');
    expect(standardPeriod?.output).toBe('15.00');
  });
});
