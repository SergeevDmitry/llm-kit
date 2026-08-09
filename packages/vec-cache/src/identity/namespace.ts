import { VectorCacheError } from '../errors.js';

/** Namespace normalization shared by every entry point that accepts an override. */
export const DEFAULT_NAMESPACE = 'default';

/** Resolves a per-call namespace override against the instance default. Validation already ran in `validate.ts`. */
export function resolveNamespace(instanceNamespace: string, override: string | undefined): string {
  return override ?? instanceNamespace;
}

/**
 * Resolves the namespace scope for `prune()`/`clear()`. Both default to the
 * instance's own namespace, exactly like every other method (via
 * {@link resolveNamespace}) — `new VectorCache({ namespace: 'tenant-a'
 * }).clear()` only ever touches `'tenant-a'`. A caller who wants to wipe the
 * whole database must ask for it explicitly via `allNamespaces: true`.
 *
 * Returns `undefined` to mean "every namespace" (what the store layer's
 * `clear(namespace?: string)` / `prune({ namespace?: string })` already treat
 * as unscoped), or a concrete namespace string otherwise.
 */
export function resolveDestructiveNamespaceScope(
  instanceNamespace: string,
  options: { readonly namespace?: string; readonly allNamespaces?: boolean } | undefined,
): string | undefined {
  const namespace = options?.namespace;
  const allNamespaces = options?.allNamespaces ?? false;
  if (allNamespaces && namespace !== undefined) {
    throw new VectorCacheError(
      'options.namespace and options.allNamespaces: true are mutually exclusive — ' +
        '"restrict to this namespace" and "ignore namespace entirely" cannot both be what you meant',
      'INVALID_INPUT',
    );
  }
  if (allNamespaces) return undefined;
  return resolveNamespace(instanceNamespace, namespace);
}
