/**
 * @llm-kit/model-registry — private workspace foundation.
 *
 * Normalized model identity, aliases, and pricing periods, used by
 * `llm-price` and optionally by `chat-fit`'s context-window helpers.
 * Private and source-only: never published, bundled into consumers at build
 * time.
 */

export type { ProviderId, ModelDescriptor, PricingPeriod, RegistrySource } from './types.js';
export { PROVIDER_IDS } from './types.js';

export {
  ModelRegistrySchemaError,
  UnknownModelError,
  AmbiguousAliasError,
  AmbiguousPricingPeriodError,
  InvalidLookupDateError,
  type ModelCandidate,
  type AmbiguousPricingPeriodIdentity,
} from './errors.js';

export {
  validateModelDescriptor,
  validatePricingPeriod,
  validateProviderSourceFile,
  type SourceValidationIssue,
  type ProviderSourceValidationResult,
} from './schema.js';

export {
  resolveModel,
  type ResolveModelOptions,
  type ResolvedModel,
  type ModelMatchKind,
} from './resolve.js';

export { selectPricingPeriod } from './pricing-period.js';

export { MODEL_REGISTRY, REGISTRY_VERSION } from './generated/registry.js';
