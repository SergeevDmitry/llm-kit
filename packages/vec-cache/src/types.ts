/**
 * Public type surface for `vec-cache`.
 *
 * A few shapes are worth calling out beyond the obvious ones — `now` on
 * {@link VectorCacheOptions} (needed so tests can inject `createFakeClock`
 * instead of real time, matching `llm-backoff`'s `LlmBackoffOptions.now`
 * precedent), the {@link EmbeddingVector} union covering both
 * `vectorEncoding: 'float32'` and `'float64'`'s decoded shapes, and
 * `PruneOptions.olderThanMs` (an age-based prune in addition to TTL expiry).
 * Every addition is called out at its declaration.
 */

/**
 * One embedding vector, in or out of the cache. Includes `Float64Array`
 * alongside `readonly number[] | Float32Array` because
 * `VectorCacheOptions.vectorEncoding: 'float64'` means a decoded float64 row
 * must be representable by this type too.
 */
export type EmbeddingVector = readonly number[] | Float32Array | Float64Array;

/** How a vector's bytes are stored on disk. Explicit and stored per row. */
export type VectorEncoding = 'float32' | 'float64';

export interface EmbedBatchRequest {
  /** Unique texts only, deterministic order — never the raw input batch. */
  readonly texts: readonly string[];
  readonly model: string;
  /**
   * Always `undefined`. A fetch this package starts
   * may be joined by other concurrent `getOrCreate` calls after it has
   * already begun, so no single caller's `signal` is forwarded here — doing
   * so would let that caller's abort cancel work another, non-aborted joiner
   * is depending on. `getOrCreate`'s own `signal` option still cancels *that
   * call's* wait on the result promptly; it just never reaches `embed`. Kept
   * on this type (rather than removed) so callers may still read it
   * defensively, and because a future ref-counted single-flight design could
   * populate it once every joiner has gone away. See the README's "An
   * aborted call can still write to the cache" section.
   */
  readonly signal?: AbortSignal;
}

/**
 * A caller-supplied embedding function. Contract: all-or-error for the whole
 * call — either every text in `request.texts` gets exactly one vector back,
 * in the same order, or the call throws/rejects. No partial results, no
 * guessed mapping.
 */
export type EmbedBatch = (request: EmbedBatchRequest) => Promise<readonly EmbeddingVector[]>;

export interface VectorCacheOptions {
  /** Path to the SQLite database file. Created if it does not exist. */
  readonly path: string;
  /**
   * Logical partition folded into every cache key. Defaults
   * to `"default"`. Two `VectorCache` instances pointed at the same file but
   * different namespaces never share entries, even for identical text and
   * model.
   */
  readonly namespace?: string;
  /** SQLite `busy_timeout`, in milliseconds. Default `5000`. */
  readonly busyTimeoutMs?: number;
  /** Default time-to-live for newly written entries. `undefined` (default): entries never expire on their own. */
  readonly ttlMs?: number;
  /**
   * Store the exact input text alongside its hash and vector. Default
   * `false` — the database holds a hash and a vector only.
   */
  readonly storeText?: boolean;
  /** Vector storage width. Default `'float32'`. */
  readonly vectorEncoding?: VectorEncoding;
  /**
   * Clock used for TTL expiry, the `created_at_ms` stamp, and report timing.
   * Defaults to `Date.now`. Tests inject `createFakeClock().nowFn` from
   * `@llm-kit/test-utils` — see the repo convention "time and randomness are
   * injectable".
   */
  readonly now?: () => number;
}

export interface CacheIdentityOptions {
  readonly model: string;
  /** Overrides the instance's namespace for this call only. */
  readonly namespace?: string;
}

/**
 * Options for a read-only lookup (`getMany`). Adds `dimensions` beyond
 * `CacheIdentityOptions` — `deleteMany` deliberately does not get
 * this field; see the README's identity section for why.
 */
export interface CacheLookupOptions extends CacheIdentityOptions {
  /**
   * The output width you expect this batch's vectors to be. Optional and
   * off by default (matches every key computed before this option existed).
   * When set: (1) it becomes part of cache identity, so the same text/model
   * embedded at a different `dimensions` is a distinct entry, same as a
   * different `model` value would be; (2) any hit whose stored dimensions
   * disagree with it is treated as a miss and reported in
   * `report.dimensionMismatches`, rather than silently handed back at the
   * wrong width. See the README's "Dimensionality is part of identity"
   * section.
   */
  readonly dimensions?: number;
}

export interface GetOrCreateOptions extends CacheIdentityOptions {
  readonly embed: EmbedBatch;
  /**
   * Cancels *this call's own wait* on the result promptly.
   * Never reaches `embed` — see {@link EmbedBatchRequest.signal}
   * — so aborting does not stop the underlying fetch, which may still be
   * relied on by another concurrent call coalesced onto the same missing
   * key. See the README's "An aborted call can still write to the cache"
   * section.
   */
  readonly signal?: AbortSignal;
  /** Overrides the instance's default `ttlMs` for entries newly written by this call. */
  readonly ttlMs?: number;
  /** Same meaning and defensive behavior as {@link CacheLookupOptions.dimensions}. */
  readonly dimensions?: number;
}

/**
 * One demoted-hit-to-miss event: a stored row's `dimensions`
 * disagreed with what a batch expected — either an explicit `dimensions`
 * option or, absent that, the first hit encountered elsewhere in the same
 * batch — so it was treated as a miss instead of a silently wrong-width hit.
 * JSON-serializable, surfaced verbatim on `VectorCacheBatchReport`/
 * `VectorCacheLookupReport`.
 */
export interface DimensionMismatchDiagnostic {
  /** The cache key whose stored row disagreed with `expectedDimensions` and was treated as a miss instead of a hit. */
  readonly cacheKey: string;
  /** The dimensions this batch expected — either the caller's explicit request or the first hit's own dimensions. */
  readonly expectedDimensions: number;
  /** The dimensions actually stored for `cacheKey`. */
  readonly actualDimensions: number;
}

/** Metrics for one `getOrCreate` call — the headline "940 hits, 60 misses" numbers. */
export interface VectorCacheBatchReport {
  /** `texts.length` — every position accounted for. */
  readonly totalCount: number;
  /** Positions served from the cache. */
  readonly hitCount: number;
  /** Positions that required embedding (duplicates counted once each). Includes any hit demoted by a dimension mismatch. */
  readonly missCount: number;
  /** Distinct texts actually sent to `embed` — `<= missCount`, equal only when a batch has no in-batch duplicate misses. */
  readonly uniqueMissCount: number;
  /** `0` when this call never invoked `embed` (full hit, or every miss was coalesced into another in-flight call); otherwise `1` — `embed` is called at most once per `getOrCreate` call. */
  readonly embedCallCount: number;
  readonly elapsedMs: number;
  /** Hits demoted to misses because their stored dimensions disagreed with what this batch expected. Empty in the common case. */
  readonly dimensionMismatches: readonly DimensionMismatchDiagnostic[];
}

export interface CachedEmbeddingBatch {
  /** Same length and order as the input `texts`. Every entry is a freshly allocated array, never a view a caller could mutate through. */
  readonly embeddings: readonly EmbeddingVector[];
  readonly report: VectorCacheBatchReport;
}

/** Metrics for a read-only `getMany` lookup. */
export interface VectorCacheLookupReport {
  readonly totalCount: number;
  readonly hitCount: number;
  readonly missCount: number;
  readonly elapsedMs: number;
  /** Same meaning as {@link VectorCacheBatchReport.dimensionMismatches}. Empty in the common case. */
  readonly dimensionMismatches: readonly DimensionMismatchDiagnostic[];
}

export interface CacheLookupResult {
  /** Same length and order as the input `texts`. `undefined` at a position means a miss — `getMany` never calls `embed`. */
  readonly embeddings: readonly (EmbeddingVector | undefined)[];
  readonly report: VectorCacheLookupReport;
}

export interface CacheWriteEntry {
  readonly text: string;
  readonly model: string;
  readonly namespace?: string;
  readonly embedding: EmbeddingVector;
  /** Overrides the instance's default `ttlMs` for this entry only. */
  readonly ttlMs?: number;
  /**
   * Same identity meaning as {@link CacheLookupOptions.dimensions}.
   * Optional; when set, must equal `embedding.length` — `setMany` rejects a
   * mismatch with `INVALID_INPUT` rather than write a row whose declared
   * identity disagrees with the vector actually stored under it.
   */
  readonly dimensions?: number;
}

export interface PruneOptions {
  /**
   * Restrict pruning to one namespace. Default: the `VectorCache` instance's
   * own namespace (its constructor `namespace`, or `"default"`) — the same
   * default every other method resolves via `resolveNamespace`. To sweep
   * every namespace in the database regardless of the instance's own
   * namespace, pass `allNamespaces: true` instead of (or as well as) this
   * field; combining the two throws `INVALID_INPUT`, since "restrict to this
   * one namespace" and "ignore namespace entirely" cannot both be what you
   * meant.
   */
  readonly namespace?: string;
  /**
   * Prune across every namespace in the database, ignoring both this
   * instance's own namespace and `namespace` above. The explicit escape
   * hatch for a genuine all-tenant sweep — `prune()` with no options at all
   * scopes to the instance's own namespace, not the whole database; see the
   * README's "Namespace scoping for destructive operations" section.
   */
  readonly allNamespaces?: boolean;
  /**
   * Also remove entries whose `created_at_ms` is older than `now() - olderThanMs`,
   * regardless of `ttlMs`/`expires_at_ms`. TTL alone cannot express "prune
   * anything older than 30 days" for entries written without a TTL.
   */
  readonly olderThanMs?: number;
}

export interface PruneReport {
  readonly deletedCount: number;
}

export interface NamespaceStats {
  readonly namespace: string;
  readonly modelId: string;
  readonly count: number;
  /** Approximate on-disk size of stored vector blobs, in bytes (`text_value` and indexes not included). */
  readonly bytes: number;
}

export interface VectorCacheStats {
  readonly totalEntries: number;
  /** Approximate total size of stored vector blobs, in bytes. */
  readonly totalBytes: number;
  readonly oldestEntryMs: number | undefined;
  readonly newestEntryMs: number | undefined;
  readonly namespaces: readonly NamespaceStats[];
}

export interface ClearOptions {
  /**
   * Restrict clearing to one namespace. Default: the `VectorCache` instance's
   * own namespace (its constructor `namespace`, or `"default"`) — same
   * default every other method resolves via `resolveNamespace`. To wipe every
   * namespace in the database regardless of the instance's own namespace,
   * pass `allNamespaces: true` instead of (or as well as) this field;
   * combining the two throws `INVALID_INPUT`.
   */
  readonly namespace?: string;
  /**
   * Clear every namespace in the database, ignoring both this instance's own
   * namespace and `namespace` above. The explicit escape hatch for a genuine
   * all-tenant wipe — `clear()` with no options at all scopes to the
   * instance's own namespace, not the whole database; see the README's
   * "Namespace scoping for destructive operations" section.
   */
  readonly allNamespaces?: boolean;
}
