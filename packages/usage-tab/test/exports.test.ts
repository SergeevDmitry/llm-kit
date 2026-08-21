import { exportNames } from '@llm-kit/test-utils';
import { describe, expect, it } from 'vitest';
import * as api from '../src/index.js';

describe('usage-tab public surface', () => {
  it('exports the documented names', () => {
    expect(exportNames(api)).toEqual(
      [
        'AmbiguousAliasError',
        'InvalidLookupDateError',
        'InvalidRateError',
        'InvalidTokenCountError',
        'InvalidUsageError',
        'MODEL_REGISTRY',
        'NoPricingPeriodError',
        'REGISTRY_VERSION',
        'UnknownModelError',
        'calculateCost',
        'createCostAggregator',
        'createPriceCalculator',
        'createPriceOverride',
        'normalizeAnthropicUsage',
        'normalizeGoogleUsage',
        'normalizeOpenAICompatibleUsage',
        'normalizeOpenAIUsage',
        'resolveModel',
        'sumExactUsd',
      ].sort(),
    );
  });
});
