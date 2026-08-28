/**
 * `VectorCache` — the public lifecycle class. Wires the batch planner
 * (`batch/`), identity (`identity/`), storage
 * (`storage/better-sqlite-store.ts`) and single-flight registry
 * (`single-flight.ts`) together behind the six read/write methods plus
 * `stats`/`prune`/`clear`/`close`.
 *
 * `getOrCreate` and single-flight interact in a way worth being explicit
 * about: coalescing means at most one `embed` call happens per missing key,
 * so if two concurrent `getOrCreate` calls race on the *same* missing text
 * with *different* `embed` implementations, whichever call registers first
 * "wins" — every joiner receives that call's result, including its output
 * width, and the loser's own `embed` is never invoked. That is the whole
 * point of single-flight, and it's not something `assertConsistentDimensions`
 * changes. What that check does add: if a joiner's *own* cache hits (for
 * other texts in its batch) disagree in width with whatever it ends up
 * receiving — whether from its own fetch or a joined one — that joiner
 * throws `DIMENSION_IDENTITY_CONFLICT` deterministically, rather than
 * silently returning a mixed-width array. See
 * `batch/assert-dimension-consistency.ts`.
 *
 * A related but distinct question: whose *signal*
 * can cancel a shared fetch, as opposed to whose `embed` runs. Those are
 * independent — coalescing (above) decides which call's `embed` executes;
 * cancellation propagation decides who can stop it once it has started.
 * `fetchMisses` is called with no `AbortSignal` at all, deliberately: the
 * fetch it starts may be joined by other concurrent calls that haven't
 * arrived yet, so no single caller's signal is allowed to cancel work every
 * other joiner is depending on. Each call's own `getOrCreate` promise is
 * still cancelled promptly by its own `signal` via `awaitWithAbort` — only
 * the *wait*, never the underlying fetch. See `abort-utils.ts`'s module doc
 * and the README's "An aborted call can still write to the cache" section.
 */
import { throwIfAborted, awaitWithAbort } from './abort-utils.js';
import { assertConsistentDimensions } from './batch/assert-dimension-consistency.js';
import { fetchMisses } from './batch/fetch-misses.js';
import { planBatch } from './batch/plan-batch.js';
import { restoreOrder } from './batch/restore-order.js';
import { dedupeInOrder } from './batch/deduplicate.js';
import { VectorCacheError } from './errors.js';
import { computeCacheKey } from './identity/cache-key.js';
import { hashText } from './identity/hash-text.js';
import {
  DEFAULT_NAMESPACE,
  resolveDestructiveNamespaceScope,
  resolveNamespace,
} from './identity/namespace.js';
import { createSingleFlightRegistry, type SingleFlightRegistry } from './single-flight.js';
import { createBetterSqliteStore } from './storage/better-sqlite-store.js';
import type { StoredEmbedding, VectorCacheStore } from './storage/store.js';
import { decodeVector, encodeVector } from './storage/vector-codec.js';
import type {
  CacheIdentityOptions,
  CacheLookupOptions,
  CacheLookupResult,
  CacheWriteEntry,
  CachedEmbeddingBatch,
  ClearOptions,
  EmbeddingVector,
  GetOrCreateOptions,
  PruneOptions,
  PruneReport,
  VectorCacheOptions,
  VectorCacheStats,
  VectorEncoding,
} from './types.js';
import {
  validateModel,
  validateNamespaceOption,
  validateOptionalDurationMs,
  validateOptionalPositiveInteger,
  validateTexts,
  validateText,
  validateVector,
} from './validate.js';

const DEFAULT_VECTOR_ENCODING: VectorEncoding = 'float32';
const VALID_VECTOR_ENCODINGS: readonly VectorEncoding[] = ['float32', 'float64'];

export class VectorCache {
  private readonly store: VectorCacheStore;
  private readonly namespace: string;
  private readonly defaultTtlMs: number | undefined;
  private readonly storeText: boolean;
  private readonly vectorEncoding: VectorEncoding;
  private readonly now: () => number;
  private readonly singleFlight: SingleFlightRegistry<EmbeddingVector> =
    createSingleFlightRegistry();
  private closed = false;

  constructor(options: VectorCacheOptions) {
    if (typeof options?.path !== 'string' || options.path.length === 0) {
      throw new VectorCacheError(
        'VectorCacheOptions.path must be a non-empty string',
        'INVALID_INPUT',
      );
    }
    validateNamespaceOption(options.namespace);
    validateOptionalDurationMs(options.busyTimeoutMs, 'VectorCacheOptions.busyTimeoutMs');
    validateOptionalDurationMs(options.ttlMs, 'VectorCacheOptions.ttlMs');
    if (
      options.vectorEncoding !== undefined &&
      !VALID_VECTOR_ENCODINGS.includes(options.vectorEncoding)
    ) {
      throw new VectorCacheError(
        `VectorCacheOptions.vectorEncoding must be 'float32' or 'float64' when provided (got ${JSON.stringify(options.vectorEncoding)})`,
        'INVALID_INPUT',
      );
    }

    this.namespace = options.namespace ?? DEFAULT_NAMESPACE;
    this.defaultTtlMs = options.ttlMs;
    this.storeText = options.storeText ?? false;
    this.vectorEncoding = options.vectorEncoding ?? DEFAULT_VECTOR_ENCODING;
    this.now = options.now ?? Date.now;
    this.store = createBetterSqliteStore({
      path: options.path,
      busyTimeoutMs: options.busyTimeoutMs,
    });
  }

  private assertOpen(): void {
    if (this.closed) {
      throw new VectorCacheError('VectorCache is closed', 'STORE_CLOSED');
    }
  }

  async getOrCreate(
    texts: readonly string[],
    options: GetOrCreateOptions,
  ): Promise<CachedEmbeddingBatch> {
    this.assertOpen();
    throwIfAborted(options.signal);
    validateModel(options.model);
    validateTexts(texts);
    validateNamespaceOption(options.namespace);
    validateOptionalDurationMs(options.ttlMs, 'GetOrCreateOptions.ttlMs');
    validateOptionalPositiveInteger(
      options.maxEmbedBatchSize,
      'GetOrCreateOptions.maxEmbedBatchSize',
    );

    const startedAtMs = this.now();
    if (texts.length === 0) {
      return {
        embeddings: [],
        report: {
          totalCount: 0,
          hitCount: 0,
          missCount: 0,
          uniqueMissCount: 0,
          embedCallCount: 0,
          elapsedMs: this.now() - startedAtMs,
          dimensionMismatches: [],
        },
      };
    }

    const namespace = resolveNamespace(this.namespace, options.namespace);
    const plan = planBatch(
      texts,
      namespace,
      options.model,
      this.store,
      this.now(),
      options.dimensions,
    );

    const hitVectors = new Map<string, EmbeddingVector>();
    for (const [key, row] of plan.hitMap) {
      hitVectors.set(key, decodeVector(row.vectorBlob, row.vectorEncoding, row.dimensions));
    }

    const missVectors = new Map<string, EmbeddingVector>();
    let embedCallCount = 0;

    if (plan.uniqueMissKeys.length > 0) {
      const ttlMs = options.ttlMs ?? this.defaultTtlMs;
      const perKeyPromises = new Map<string, Promise<EmbeddingVector>>();
      const ownKeys: string[] = [];
      const ownTexts: string[] = [];

      for (const key of plan.uniqueMissKeys) {
        const joined = this.singleFlight.get(key);
        if (joined !== undefined) {
          perKeyPromises.set(key, joined);
        } else {
          ownKeys.push(key);
          ownTexts.push(plan.missTextByKey.get(key) as string);
        }
      }

      if (ownKeys.length > 0) {
        embedCallCount = Math.ceil(ownKeys.length / (options.maxEmbedBatchSize ?? ownKeys.length));
        const writeAtMs = this.now();
        const embedded: EmbeddingVector[] = [];
        const shared = fetchMisses({
          keys: ownKeys,
          texts: ownTexts,
          model: options.model,
          namespace,
          embed: options.embed,
          // No `signal` passed through: this fetch
          // may end up shared with joiners this call cannot see yet, so it
          // must not be cancellable by this call's signal alone. This call's
          // own wait on the outcome is still cancelled promptly below, via
          // `awaitWithAbort(..., options.signal)`.
          vectorEncoding: this.vectorEncoding,
          storeText: this.storeText,
          nowMs: writeAtMs,
          ttlMs,
          requestedDimensions: options.dimensions,
          maxEmbedBatchSize: options.maxEmbedBatchSize,
          // Runs once per `embed` call, before the next one starts, so a
          // failure part-way through a split miss set leaves the sub-batches
          // that did succeed cached rather than paid for and thrown away.
          onBatch: (batch) => {
            // Re-checked here, not just at entry: `close()` may run while
            // this call's `embed` promise is still pending.
            if (this.closed) {
              throw new VectorCacheError(
                'VectorCache was closed while a getOrCreate() call was in flight',
                'STORE_CLOSED',
              );
            }
            for (const vector of batch.vectors.values()) embedded.push(vector);
            // Gate the write itself: this call's own cache
            // hits and its own freshly embedded vectors must agree on width
            // *before* anything is persisted — otherwise a hit at one width
            // and a fresh miss at another would both land in the result (and
            // the fresh one on disk) with no diagnostic at all. Narrower than
            // the final check below (it only sees this call's own hits and
            // its own embed result, not anything joined from elsewhere), but
            // it is the one that can still stop a bad write before it
            // happens. `embedded` spans every sub-batch so far, so two
            // sub-batches disagreeing with each other is caught here too.
            const seen: EmbeddingVector[] = [];
            for (const vector of hitVectors.values()) seen.push(vector);
            for (const vector of embedded) seen.push(vector);
            assertConsistentDimensions(seen, { modelId: options.model, namespace });
            this.store.putMany(batch.storedEntries);
          },
        }).then((result) => result.vectors);

        for (const key of ownKeys) {
          const perKey = this.singleFlight.register(
            key,
            shared.then((vectors) => {
              const vector = vectors.get(key);
              if (vector === undefined) {
                throw new VectorCacheError(
                  `internal error: embed result missing for cache key ${key}`,
                  'INTERNAL',
                );
              }
              return vector;
            }),
          );
          perKeyPromises.set(key, perKey);
        }
      }

      await awaitWithAbort(
        Promise.all(
          Array.from(perKeyPromises.entries()).map(async ([key, promise]) => {
            missVectors.set(key, await promise);
          }),
        ),
        options.signal,
      );
    }

    // Final gate: covers what the pre-write check above
    // cannot see — a miss this call only *joined* (single-flight, someone
    // else's in-flight `embed` call) can still disagree with this call's
    // own hits, even though this call wrote nothing itself. Cheap (small
    // arrays) and a strict superset of the pre-write check's inputs, so it
    // is not skipped even when this call owned and already gated its own
    // write above.
    assertConsistentDimensions([...hitVectors.values(), ...missVectors.values()], {
      modelId: options.model,
      namespace,
    });

    const embeddings = restoreOrder(plan.keys, hitVectors, missVectors);
    let hitCount = 0;
    for (const key of plan.keys) {
      if (hitVectors.has(key)) hitCount += 1;
    }

    return {
      embeddings,
      report: {
        totalCount: texts.length,
        hitCount,
        missCount: texts.length - hitCount,
        uniqueMissCount: plan.uniqueMissKeys.length,
        embedCallCount,
        elapsedMs: this.now() - startedAtMs,
        dimensionMismatches: plan.dimensionMismatches,
      },
    };
  }

  getMany(texts: readonly string[], options: CacheLookupOptions): CacheLookupResult {
    this.assertOpen();
    validateModel(options.model);
    validateTexts(texts);
    validateNamespaceOption(options.namespace);

    const startedAtMs = this.now();
    if (texts.length === 0) {
      return {
        embeddings: [],
        report: {
          totalCount: 0,
          hitCount: 0,
          missCount: 0,
          elapsedMs: this.now() - startedAtMs,
          dimensionMismatches: [],
        },
      };
    }

    const namespace = resolveNamespace(this.namespace, options.namespace);
    const plan = planBatch(
      texts,
      namespace,
      options.model,
      this.store,
      this.now(),
      options.dimensions,
    );

    let hitCount = 0;
    const embeddings: (EmbeddingVector | undefined)[] = plan.keys.map((key) => {
      const row = plan.hitMap.get(key);
      if (row === undefined) return undefined;
      hitCount += 1;
      return decodeVector(row.vectorBlob, row.vectorEncoding, row.dimensions);
    });

    return {
      embeddings,
      report: {
        totalCount: texts.length,
        hitCount,
        missCount: texts.length - hitCount,
        elapsedMs: this.now() - startedAtMs,
        dimensionMismatches: plan.dimensionMismatches,
      },
    };
  }

  setMany(entries: readonly CacheWriteEntry[]): void {
    this.assertOpen();
    if (!Array.isArray(entries)) {
      throw new VectorCacheError('entries must be an array', 'INVALID_INPUT');
    }
    if (entries.length === 0) return;

    const nowMs = this.now();
    const storedEntries: StoredEmbedding[] = entries.map((entry) => {
      validateModel(entry.model);
      validateText(entry.text);
      validateNamespaceOption(entry.namespace);
      validateOptionalDurationMs(entry.ttlMs, 'entry.ttlMs');
      validateVector(entry.embedding, 'embedding', this.vectorEncoding);
      if (entry.dimensions !== undefined && entry.dimensions !== entry.embedding.length) {
        throw new VectorCacheError(
          `entry.dimensions (${String(entry.dimensions)}) does not match entry.embedding.length (${String(entry.embedding.length)}) — the declared identity would disagree with what is actually stored`,
          'INVALID_INPUT',
        );
      }

      const namespace = resolveNamespace(this.namespace, entry.namespace);
      const ttlMs = entry.ttlMs ?? this.defaultTtlMs;
      return {
        cacheKey: computeCacheKey(namespace, entry.model, entry.text, entry.dimensions),
        namespace,
        modelId: entry.model,
        textHash: hashText(entry.text),
        textValue: this.storeText ? entry.text : undefined,
        dimensions: entry.embedding.length,
        vectorEncoding: this.vectorEncoding,
        vectorBlob: encodeVector(entry.embedding, this.vectorEncoding),
        createdAtMs: nowMs,
        expiresAtMs: ttlMs !== undefined ? nowMs + ttlMs : undefined,
      };
    });

    this.store.putMany(storedEntries);
  }

  /**
   * `options` does not accept `dimensions` (only
   * `GetOrCreateOptions`/`CacheLookupOptions`/`CacheWriteEntry` do): an
   * entry written under an explicit `dimensions` value has a key this method
   * cannot reconstruct, so it will not be found and deleted here. Use
   * `namespace` to isolate anything written with an explicit `dimensions`
   * that you need to delete by (namespace, model, text) alone, or `clear()`
   * to remove an entire namespace regardless of how its entries were keyed.
   */
  deleteMany(texts: readonly string[], options: CacheIdentityOptions): number {
    this.assertOpen();
    validateModel(options.model);
    validateTexts(texts);
    validateNamespaceOption(options.namespace);
    if (texts.length === 0) return 0;

    const namespace = resolveNamespace(this.namespace, options.namespace);
    const keys = dedupeInOrder(
      texts.map((text) => computeCacheKey(namespace, options.model, text)),
    );
    return this.store.deleteMany(keys);
  }

  prune(options?: PruneOptions): PruneReport {
    this.assertOpen();
    validateNamespaceOption(options?.namespace);
    validateOptionalDurationMs(options?.olderThanMs, 'PruneOptions.olderThanMs');
    const namespace = resolveDestructiveNamespaceScope(this.namespace, options);
    return this.store.prune({
      nowMs: this.now(),
      namespace,
      olderThanMs: options?.olderThanMs,
    });
  }

  /**
   * Reports across **the whole database file, every namespace**, regardless
   * of this instance's own namespace — deliberately, and unlike every other
   * method. `getOrCreate`/`getMany`/`setMany`/`deleteMany` resolve
   * `namespace` against the instance default via `resolveNamespace`, and
   * `prune()`/`clear()` do the same via `resolveDestructiveNamespaceScope`.
   * `stats()` takes no `namespace` option at all and never scopes: its
   * entire value is the per-namespace breakdown in
   * `VectorCacheStats.namespaces`, which requires seeing every namespace to
   * be useful — an instance scoped to `tenant-a` still needs to answer "how
   * big is this whole file, and how is it split across tenants?" for
   * operational visibility (disk usage, which namespaces are worth pruning).
   * Scoping it to the instance's own namespace would make that impossible
   * from the one object a caller already has open. Unlike `prune()`/
   * `clear()`, `stats()` is read-only — it carries none of the "silently
   * destroys the wrong tenant's data" risk that motivated scoping those two,
   * so there is no equivalent safety argument for narrowing it. See the
   * README's "Namespace scoping for destructive operations" section.
   */
  stats(): VectorCacheStats {
    this.assertOpen();
    return this.store.stats();
  }

  clear(options?: ClearOptions): number {
    this.assertOpen();
    validateNamespaceOption(options?.namespace);
    const namespace = resolveDestructiveNamespaceScope(this.namespace, options);
    return this.store.clear(namespace);
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.store.close();
  }
}

/** Factory for callers who prefer functions over `new`. `VectorCache` remains the canonical lifecycle abstraction. */
export function createVectorCache(options: VectorCacheOptions): VectorCache {
  return new VectorCache(options);
}
