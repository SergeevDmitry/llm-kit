/** Pure resolution of prune criteria — kept separate from SQL so it is independently testable. */
import type { StorePruneOptions } from '../storage/store.js';

export interface ResolvedPruneCriteria {
  /** Rows with a non-null `expires_at_ms` at or before this are removed. */
  readonly expiresAtOrBeforeMs: number;
  /** When set, rows with `created_at_ms` before this are removed too, regardless of TTL. */
  readonly createdBeforeMs: number | undefined;
  readonly namespace: string | undefined;
}

export function resolvePruneCriteria(options: StorePruneOptions): ResolvedPruneCriteria {
  return {
    expiresAtOrBeforeMs: options.nowMs,
    createdBeforeMs:
      options.olderThanMs !== undefined ? options.nowMs - options.olderThanMs : undefined,
    namespace: options.namespace,
  };
}
