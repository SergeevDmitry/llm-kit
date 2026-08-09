/**
 * Calls the user's `embed` callback for the unique misses this call owns,
 * validates the all-or-error contract and every returned vector, and builds
 * the rows ready to persist. Does not write to the store itself — the
 * caller (`vector-cache.ts`) decides when persistence happens relative to
 * single-flight bookkeeping.
 *
 * Deliberately does not accept an `AbortSignal`: the
 * fetch this function starts is registered into the single-flight registry
 * before any other concurrent `getOrCreate` call can join it, so at the
 * moment it starts there is no way to know whether it is "solo" or about to
 * be shared. Any signal passed into `params.embed` here would belong to
 * whichever caller happened to register first — every later joiner, including
 * ones that supplied no signal of their own, would then be cancelled by a
 * stranger's abort. The shared fetch is nobody's to cancel; each caller's own
 * wait on the *result* is still cancelled promptly via `awaitWithAbort` in
 * `vector-cache.ts`. See `abort-utils.ts`'s module doc and the README's
 * "An aborted call can still write to the cache" section.
 */
import { hashText } from '../identity/hash-text.js';
import { encodeVector } from '../storage/vector-codec.js';
import type { StoredEmbedding } from '../storage/store.js';
import type { EmbedBatch, EmbeddingVector, VectorEncoding } from '../types.js';
import { validateVector } from '../validate.js';
import { VectorCacheError } from '../errors.js';

export interface FetchMissesParams {
  /** Unique miss keys, deterministic (first-occurrence) order. */
  readonly keys: readonly string[];
  /** Source text for each key, same order and length as `keys`. */
  readonly texts: readonly string[];
  readonly model: string;
  readonly namespace: string;
  readonly embed: EmbedBatch;
  readonly vectorEncoding: VectorEncoding;
  readonly storeText: boolean;
  readonly nowMs: number;
  readonly ttlMs: number | undefined;
}

export interface FetchMissesResult {
  /** Cache-key -> vector, exactly as `embed` returned it (not yet cloned for output). */
  readonly vectors: ReadonlyMap<string, EmbeddingVector>;
  readonly storedEntries: readonly StoredEmbedding[];
}

/**
 * Validates that `embed` honored its all-or-error contract: the result count
 * must match the request count exactly (`EMBED_RESULT_COUNT_MISMATCH`),
 * every returned vector must share one non-zero dimension
 * (`EMBED_DIMENSION_MISMATCH`), and every element of every vector must be a
 * finite number (`EMBED_RESULT_INVALID`), and — when this call's
 * `vectorEncoding` is `'float32'` — that every element's magnitude fits in
 * float32 range (see `validateVector`'s `FLOAT32_MAX_ABS`
 * check). All failures throw before any row is built or written — no guessed
 * mapping on partial failure.
 *
 * `setMany` runs `validateVector` (throws `INVALID_INPUT`) because that path
 * trusts the caller directly. This path wraps a third-party network call —
 * a partially-failed batch, a `null` entry in a JSON payload, or a provider
 * ignoring a malformed input all produce a `NaN`/`Infinity`/non-number
 * element that `encodeVector`'s `Buffer.writeFloatLE` would otherwise coerce
 * silently and write to disk forever, served as a cache hit in every future
 * process. Re-using `validateVector`'s element check (rather than
 * duplicating it) but re-throwing under `EMBED_RESULT_INVALID` keeps the two
 * "your input was bad" vs. "the provider's result was bad" cases
 * programmatically distinguishable.
 */
function validateEmbedResult(
  vectors: readonly EmbeddingVector[],
  expectedCount: number,
  vectorEncoding: VectorEncoding,
): void {
  if (vectors.length !== expectedCount) {
    throw new VectorCacheError(
      `embed callback returned ${String(vectors.length)} vector(s) for ${String(expectedCount)} unique miss(es)`,
      'EMBED_RESULT_COUNT_MISMATCH',
    );
  }

  let dimensions: number | undefined;
  for (let index = 0; index < vectors.length; index += 1) {
    const length = vectors[index]?.length ?? 0;
    if (length === 0) {
      throw new VectorCacheError(
        `embed callback returned an empty vector at position ${String(index)}`,
        'EMBED_DIMENSION_MISMATCH',
      );
    }
    if (dimensions === undefined) {
      dimensions = length;
    } else if (length !== dimensions) {
      throw new VectorCacheError(
        `embed callback returned inconsistent vector dimensions within one batch (${String(dimensions)} vs ${String(length)} at position ${String(index)})`,
        'EMBED_DIMENSION_MISMATCH',
      );
    }
  }

  for (let index = 0; index < vectors.length; index += 1) {
    try {
      validateVector(
        vectors[index] as EmbeddingVector,
        `embed result[${String(index)}]`,
        vectorEncoding,
      );
    } catch (error) {
      throw new VectorCacheError((error as Error).message, 'EMBED_RESULT_INVALID', {
        cause: error,
      });
    }
  }
}

export async function fetchMisses(params: FetchMissesParams): Promise<FetchMissesResult> {
  // No `signal` here on purpose — see the module doc above.
  const vectors = await params.embed({
    texts: params.texts,
    model: params.model,
    signal: undefined,
  });
  validateEmbedResult(vectors, params.keys.length, params.vectorEncoding);

  const vectorMap = new Map<string, EmbeddingVector>();
  const storedEntries: StoredEmbedding[] = [];

  for (let index = 0; index < params.keys.length; index += 1) {
    const key = params.keys[index] as string;
    const text = params.texts[index] as string;
    const vector = vectors[index] as EmbeddingVector;
    vectorMap.set(key, vector);
    storedEntries.push({
      cacheKey: key,
      namespace: params.namespace,
      modelId: params.model,
      textHash: hashText(text),
      textValue: params.storeText ? text : undefined,
      dimensions: vector.length,
      vectorEncoding: params.vectorEncoding,
      vectorBlob: encodeVector(vector, params.vectorEncoding),
      createdAtMs: params.nowMs,
      expiresAtMs: params.ttlMs !== undefined ? params.nowMs + params.ttlMs : undefined,
    });
  }

  return { vectors: vectorMap, storedEntries };
}
