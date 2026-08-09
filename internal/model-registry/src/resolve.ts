/**
 * Alias resolution.
 *
 * Implements the resolution order exactly:
 *
 *   1. exact custom override
 *   2. exact canonical ID with provider qualifier
 *   3. exact alias scoped to provider
 *   4. globally unambiguous alias
 *   5. explicit configured fallback
 *   6. `UNKNOWN_MODEL` error
 *
 * Ambiguity at any step is an error, never a guess: if a step would match
 * more than one model, `resolveModel` throws `AmbiguousAliasError`
 * immediately rather than falling through to a later step.
 */
import { AmbiguousAliasError, UnknownModelError, type ModelCandidate } from './errors.js';
import type { ModelDescriptor } from './types.js';

export type ModelMatchKind =
  'override' | 'canonical-qualified' | 'alias-scoped' | 'alias-global' | 'fallback';

export interface ResolveModelOptions {
  /** Restricts steps 2–3 to this provider and is echoed back on the result. */
  readonly provider?: string;
  /**
   * Custom or negotiated pricing entries that take precedence over the
   * registry when their `canonicalId` or an alias exactly matches the
   * requested id (step 1).
   */
  readonly overrides?: readonly ModelDescriptor[];
  /** Canonical id to fall back to (step 5) when nothing else matches. Looked up in `registry`, not in `overrides`. */
  readonly fallback?: string;
}

export interface ResolvedModel {
  readonly descriptor: ModelDescriptor;
  readonly matchedBy: ModelMatchKind;
  readonly requestedId: string;
  readonly requestedProvider?: string;
}

function toCandidate(descriptor: ModelDescriptor): ModelCandidate {
  return { provider: descriptor.provider, canonicalId: descriptor.canonicalId };
}

/**
 * Runs the provider-qualified-then-global match shape against an arbitrary
 * pool of descriptors. Shared by the override step (step 1, against
 * `options.overrides`) and the main registry steps (steps 2–4, against
 * `registry`) so both apply identical "exact before alias, scoped before
 * global" precedence.
 */
function matchExact(
  pool: readonly ModelDescriptor[],
  id: string,
  provider: string | undefined,
): { readonly unique?: ModelDescriptor; readonly ambiguous?: readonly ModelDescriptor[] } {
  if (provider !== undefined) {
    const canonical = pool.find((d) => d.provider === provider && d.canonicalId === id);
    if (canonical !== undefined) return { unique: canonical };

    const scoped = pool.filter((d) => d.provider === provider && d.aliases.includes(id));
    if (scoped.length === 1) return { unique: scoped[0] };
    if (scoped.length > 1) return { ambiguous: scoped };

    // A provider qualifier is a constraint, not a hint: an override pool that
    // has no match under the requested provider must not fall through to one
    // registered for a different provider — that is how a caller who did
    // everything right gets billed against the wrong model. Ambiguity within
    // the *requested* provider is still handled above; cross-provider
    // candidates are simply not a match here.
    return {};
  }

  const global = pool.filter((d) => d.canonicalId === id || d.aliases.includes(id));
  if (global.length === 1) return { unique: global[0] };
  if (global.length > 1) return { ambiguous: global };

  return {};
}

/**
 * Resolves a requested model id against a registry, following the six-step
 * order above. Throws `AmbiguousAliasError` (code `AMBIGUOUS_ALIAS`) if any
 * step matches more than one model, and `UnknownModelError` (code
 * `UNKNOWN_MODEL`) if no step matches at all.
 */
export function resolveModel(
  requestedId: string,
  registry: readonly ModelDescriptor[],
  options: ResolveModelOptions = {},
): ResolvedModel {
  const provider = options.provider;

  // Step 1: exact custom override.
  if (options.overrides !== undefined && options.overrides.length > 0) {
    const overrideMatch = matchExact(options.overrides, requestedId, provider);
    if (overrideMatch.ambiguous !== undefined) {
      throw new AmbiguousAliasError(requestedId, overrideMatch.ambiguous.map(toCandidate));
    }
    if (overrideMatch.unique !== undefined) {
      return {
        descriptor: overrideMatch.unique,
        matchedBy: 'override',
        requestedId,
        requestedProvider: provider,
      };
    }
  }

  // Steps 2–3: exact canonical id, then exact alias, both scoped to `provider`.
  if (provider !== undefined) {
    const canonical = registry.find(
      (d) => d.provider === provider && d.canonicalId === requestedId,
    );
    if (canonical !== undefined) {
      return {
        descriptor: canonical,
        matchedBy: 'canonical-qualified',
        requestedId,
        requestedProvider: provider,
      };
    }

    const scoped = registry.filter(
      (d) => d.provider === provider && d.aliases.includes(requestedId),
    );
    if (scoped.length === 1) {
      const descriptor = scoped[0];
      if (descriptor !== undefined) {
        return { descriptor, matchedBy: 'alias-scoped', requestedId, requestedProvider: provider };
      }
    }
    if (scoped.length > 1) {
      throw new AmbiguousAliasError(requestedId, scoped.map(toCandidate));
    }
  }

  // Step 4: globally unambiguous alias or canonical id, across every provider.
  // Only when the caller did NOT supply a provider. A provider qualifier is a
  // constraint, not a hint: once steps 2–3 have already looked for
  // `requestedId` under `provider` and found nothing, silently answering with
  // a different provider's descriptor is how a caller who did everything
  // right gets billed at whatever rate that other provider happens to
  // charge. A qualified miss falls through to step 5 (`fallback`) or step 6
  // (`UNKNOWN_MODEL`) instead.
  if (provider === undefined) {
    const global = registry.filter(
      (d) => d.canonicalId === requestedId || d.aliases.includes(requestedId),
    );
    if (global.length === 1) {
      const descriptor = global[0];
      if (descriptor !== undefined) {
        return { descriptor, matchedBy: 'alias-global', requestedId, requestedProvider: provider };
      }
    }
    if (global.length > 1) {
      throw new AmbiguousAliasError(requestedId, global.map(toCandidate));
    }
  }

  // Step 5: explicit configured fallback.
  if (options.fallback !== undefined) {
    const fallback = registry.find((d) => d.canonicalId === options.fallback);
    if (fallback !== undefined) {
      return {
        descriptor: fallback,
        matchedBy: 'fallback',
        requestedId,
        requestedProvider: provider,
      };
    }
  }

  // Step 6: nothing matched anywhere. When the miss was provider-qualified,
  // tell the caller if `requestedId` exists under a *different* provider —
  // the single most actionable fact for someone who hit this (they likely
  // typed the right id and the wrong provider) — without dumping the rest of
  // the registry. Sorted for a deterministic message.
  if (provider !== undefined) {
    const otherProviders = [
      ...new Set(
        registry
          .filter((d) => d.canonicalId === requestedId || d.aliases.includes(requestedId))
          .map((d) => d.provider),
      ),
    ].sort();
    if (otherProviders.length > 0) {
      throw new UnknownModelError(requestedId, provider, otherProviders);
    }
  }
  throw new UnknownModelError(requestedId, provider);
}
