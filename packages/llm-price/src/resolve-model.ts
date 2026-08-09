/**
 * Model resolution — a thin, defaulting wrapper over
 * `@llm-kit/model-registry`'s `resolveModel`. All the
 * resolution-order and ambiguity logic lives there; this module only
 * supplies the bundled registry as a default and re-shapes the options type
 * for this package's public surface.
 */
import { MODEL_REGISTRY, resolveModel as resolveAgainstRegistry } from '@llm-kit/model-registry';
import type { ResolveModelOptions, ResolvedModel } from './types.js';

export function resolveModel(model: string, options: ResolveModelOptions = {}): ResolvedModel {
  const registry = options.registry ?? MODEL_REGISTRY;
  return resolveAgainstRegistry(model, registry, {
    provider: options.provider,
    overrides: options.overrides,
    fallback: options.fallback,
  });
}
