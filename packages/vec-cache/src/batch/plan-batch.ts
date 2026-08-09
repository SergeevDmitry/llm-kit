/**
 * The batch planner — this is the package.
 *
 * `planBatch` does the read side once, up front: compute every position's
 * cache key, look up the distinct keys in one chunked round trip to the
 * store, and split the result into a hit map plus a deduplicated,
 * deterministically ordered miss list. `getOrCreate` uses the miss list to
 * drive `embed`; `getMany` stops here and never calls `embed` at all.
 *
 * Deterministic order — duplicate texts appear once each in the miss list:
 * `uniqueMissKeys` walks the *original* `texts` order and keeps only first
 * occurrences, so which duplicate "wins" the position in the `embed` call
 * is always the earliest one in the input, never insertion-order-of-a-Set
 * or hash-map iteration order.
 *
 * Defensive read check: a hit's `dimensions` disagreeing with what
 * this call expects is corrupted identity (a dimension change that
 * `computeCacheKey` didn't catch — e.g. because the caller never opted into
 * the explicit `dimensions` identity parameter), not a valid hit, so it is
 * demoted to a miss here rather than handed to a caller as a
 * confidently-wrong-width vector. `referenceDimensions` is either the
 * caller's explicit request (`expectedDimensions`) or, when absent, the
 * first hit encountered in original text order — deterministic for the same
 * reason `uniqueMissKeys`'s first-occurrence rule is.
 */
import { computeCacheKeys } from '../identity/cache-key.js';
import type { StoredEmbedding, VectorCacheStore } from '../storage/store.js';
import type { DimensionMismatchDiagnostic } from '../types.js';
import { dedupeInOrder } from './deduplicate.js';

export interface BatchPlan {
  /** One cache key per input position, same length and order as `texts`. */
  readonly keys: readonly string[];
  /** Cache-key -> stored row, for every key found (and not expired) in the store, minus any row demoted by a dimension mismatch. */
  readonly hitMap: ReadonlyMap<string, StoredEmbedding>;
  /** Distinct keys with no hit, in first-occurrence order. Includes any key demoted from a hit by a dimension mismatch. */
  readonly uniqueMissKeys: readonly string[];
  /** Cache-key -> its (first-occurrence) source text, for every entry in `uniqueMissKeys`. */
  readonly missTextByKey: ReadonlyMap<string, string>;
  /** Every hit demoted to a miss because its stored dimensions disagreed with what this batch expected. Empty in the common case. */
  readonly dimensionMismatches: readonly DimensionMismatchDiagnostic[];
}

export function planBatch(
  texts: readonly string[],
  namespace: string,
  modelId: string,
  store: VectorCacheStore,
  nowMs: number,
  expectedDimensions?: number,
): BatchPlan {
  const keys = computeCacheKeys(texts, namespace, modelId, expectedDimensions);
  const uniqueKeys = dedupeInOrder(keys);

  // One chunked round trip for every distinct key in the batch — never one
  // query per input position.
  const rows = store.getMany(uniqueKeys, nowMs);
  const hitMap = new Map<string, StoredEmbedding>(rows.map((row) => [row.cacheKey, row]));

  const dimensionMismatches: DimensionMismatchDiagnostic[] = [];
  let referenceDimensions = expectedDimensions;
  if (referenceDimensions === undefined) {
    // No explicit request: lock onto the first hit in original text order.
    for (let index = 0; index < keys.length; index += 1) {
      const row = hitMap.get(keys[index] as string);
      if (row !== undefined) {
        referenceDimensions = row.dimensions;
        break;
      }
    }
  }
  if (referenceDimensions !== undefined) {
    // One comparison per stored row (not per input position — a duplicate
    // text's key is checked once here, no matter how many positions share it).
    for (const row of rows) {
      if (row.dimensions !== referenceDimensions) {
        dimensionMismatches.push({
          cacheKey: row.cacheKey,
          expectedDimensions: referenceDimensions,
          actualDimensions: row.dimensions,
        });
        hitMap.delete(row.cacheKey);
      }
    }
  }

  const uniqueMissKeys: string[] = [];
  const missTextByKey = new Map<string, string>();
  for (let index = 0; index < keys.length; index += 1) {
    const key = keys[index] as string;
    if (!hitMap.has(key) && !missTextByKey.has(key)) {
      missTextByKey.set(key, texts[index] as string);
      uniqueMissKeys.push(key);
    }
  }

  return { keys, hitMap, uniqueMissKeys, missTextByKey, dimensionMismatches };
}
