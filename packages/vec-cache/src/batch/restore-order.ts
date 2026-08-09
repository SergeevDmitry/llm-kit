/**
 * Restores original order — output index `i` always corresponds to input
 * index `i`, regardless of hits, misses, or duplicates. Every position in
 * `keys` resolves from exactly one of the two maps; a position present in
 * neither is an internal bug, not a normal miss, because `plan-batch.ts`
 * guarantees every key is either a hit or a member of `uniqueMissKeys`.
 *
 * Every returned value is cloned (`cloneVector`), even for a key that maps
 * to several output positions (a duplicate text): each position gets its
 * own array, so a caller mutating `embeddings[3]` can never affect
 * `embeddings[7]` in the same result, let alone a later cache read.
 */
import { cloneVector } from '../storage/vector-codec.js';
import { VectorCacheError } from '../errors.js';
import type { EmbeddingVector } from '../types.js';

export function restoreOrder(
  keys: readonly string[],
  hitVectors: ReadonlyMap<string, EmbeddingVector>,
  missVectors: ReadonlyMap<string, EmbeddingVector>,
): EmbeddingVector[] {
  return keys.map((key) => {
    const hit = hitVectors.get(key);
    if (hit !== undefined) return cloneVector(hit);
    const miss = missVectors.get(key);
    if (miss !== undefined) return cloneVector(miss);
    throw new VectorCacheError(
      `internal error: cache key ${key} resolved to neither a hit nor a fetched miss`,
      'INTERNAL',
    );
  });
}
