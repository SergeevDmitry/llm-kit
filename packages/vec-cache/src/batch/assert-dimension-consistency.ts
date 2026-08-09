/**
 * `plan-batch.ts`'s demotion compares cached hits against each other (or an
 * explicit `dimensions` request) — it says nothing about what a fresh `embed`
 * call, or a concurrently in-flight single-flight fetch for the same key,
 * actually returns. Without this check, `getOrCreate` could silently
 * assemble a result mixing a cached hit at one width with a freshly embedded
 * vector at another for a different text in the same batch, and nothing
 * would error.
 *
 * This throws rather than demoting the disagreeing side to a miss and
 * re-embedding it. A hit/fresh-vector width conflict means the corpus
 * already holds mixed widths under one cache key (or `embed`'s output shape
 * changed) — a configuration mistake, not a stale-cache condition a silent
 * re-embed would fix. Silently re-embedding would keep re-paying to paper
 * over the same mistake on every call that touches both widths, and
 * wouldn't reliably converge: which width "wins" would depend on which
 * caller's `embed` happens to run next. Throwing the whole call forces the
 * caller to resolve the conflict explicitly.
 *
 * Distinct error code from `EMBED_DIMENSION_MISMATCH` on purpose:
 * `EMBED_DIMENSION_MISMATCH` means "the vectors your `embed` callback
 * returned in this one call don't even agree with each other" — a bug in
 * that callback. `DIMENSION_IDENTITY_CONFLICT` means "what you are about to
 * write or return disagrees with what this cache already holds — or is
 * concurrently writing — for other texts in the same request": an identity
 * problem, not a malformed response, and not necessarily this call's own
 * `embed` result at all (see the single-flight case in the module doc for
 * `vector-cache.ts`). The remediation differs (fix your callback vs. pass
 * `dimensions`/use a different `namespace`/clear stale entries), so the
 * codes stay different.
 */
import { VectorCacheError } from '../errors.js';
import type { EmbeddingVector } from '../types.js';

export interface DimensionConsistencyContext {
  readonly modelId: string;
  readonly namespace: string;
}

/**
 * Throws `DIMENSION_IDENTITY_CONFLICT` the moment two vectors drawn from
 * `vectors` disagree on length. Safe (no-op) for zero or one vector. Order
 * only affects which two widths land in the message — the check itself is
 * order-independent, so callers may pass hits and misses (own-fetched or
 * single-flight-joined) in any combination or order.
 */
export function assertConsistentDimensions(
  vectors: Iterable<EmbeddingVector>,
  context: DimensionConsistencyContext,
): void {
  let referenceDimensions: number | undefined;
  for (const vector of vectors) {
    if (referenceDimensions === undefined) {
      referenceDimensions = vector.length;
    } else if (vector.length !== referenceDimensions) {
      throw new VectorCacheError(
        `vec-cache: model "${context.modelId}" (namespace "${context.namespace}") produced vectors of two different widths within one batch — ${String(referenceDimensions)} and ${String(vector.length)}. This happens when the cache already holds hits at one width and a fresh "embed" call (or a concurrently in-flight request for the same text) returns another; a batch cannot mix vector widths. To resolve: pass an explicit "dimensions" option so each width gets its own cache key, use a different "namespace" for the new width, or clear the stale entries (prune()/clear()/deleteMany()) before retrying.`,
        'DIMENSION_IDENTITY_CONFLICT',
      );
    }
  }
}
