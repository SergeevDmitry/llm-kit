/**
 * `createPriceCalculator` — bundles a set of default overrides/fallback/
 * registry once, so a caller pricing many requests against the same
 * negotiated rates doesn't repeat `options` on every call.
 */
import { calculateCost } from './calculate-cost.js';
import { resolveModel } from './resolve-model.js';
import type {
  CostBreakdown,
  PriceCalculator,
  PriceCalculatorOptions,
  PriceOptions,
  PriceRequest,
  ResolvedModel,
  ResolveModelOptions,
} from './types.js';

export function createPriceCalculator(defaults: PriceCalculatorOptions = {}): PriceCalculator {
  return {
    calculateCost(request: PriceRequest, options: PriceOptions = {}): CostBreakdown {
      return calculateCost(request, {
        overrides: options.overrides ?? defaults.overrides,
        fallback: options.fallback ?? defaults.fallback,
        registry: options.registry ?? defaults.registry,
        provider: options.provider,
      });
    },
    resolveModel(model: string, options: ResolveModelOptions = {}): ResolvedModel {
      return resolveModel(model, {
        overrides: options.overrides ?? defaults.overrides,
        fallback: options.fallback ?? defaults.fallback,
        registry: options.registry ?? defaults.registry,
        provider: options.provider,
      });
    },
  };
}
