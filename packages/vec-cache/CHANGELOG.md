# vec-cache

## 1.2.0

### Minor Changes

- 376af3e: Add `findMissing(texts, options)`, which returns the texts that still need embedding without reading any vectors.

  Answering "which of these documents do I still need to embed?" used to mean calling `getMany`, which copies and decodes a full vector for every hit only for the caller to discard it. `findMissing` runs the same lookup over each row's key and dimensions only. It returns exactly the list `getOrCreate` would pass to `embed` for the same batch: each missing text once, in first-occurrence order, with expired entries and wrong-width hits counted as missing. It takes the same options as `getMany`.

### Patch Changes

- 0965774: `getOrCreate` now returns every vector, hit or miss, as a typed array in the instance's `vectorEncoding`.

  A miss used to come back as whatever `embed` returned, usually a full-precision `number[]`, while a hit came back as a decoded `Float32Array`. One result could mix both, `JSON.stringify` rendered one as an array and the other as an object, and a text's first call returned different numbers from its later hits. A miss is now converted to the value the cache stored: `Float32Array` by default, `Float64Array` under `vectorEncoding: 'float64'`. Set `vectorEncoding: 'float64'` to keep the full precision `embed` returned. `getMany` also converts a row written under another `vectorEncoding` to the instance's.

- 719a52f: Rewriting a cache entry now resets its creation time.

  Re-embedding a TTL-expired entry, or calling `setMany` over an existing key, used to keep the old `created_at_ms`. `prune({ olderThanMs })` could then delete a row that had just been paid for, forcing another embed on the next request, and `stats().newestEntryMs` did not reflect the rewrite. An entry's age now counts from its latest write, as its `expires_at_ms` already did.

## 1.1.0

### Minor Changes

- cf49574: `getOrCreate` now checks an explicit `dimensions` request against what `embed`
  actually returns, and passes the requested width to the callback as
  `request.dimensions`. A callback that ignores it and returns another width
  throws `EMBED_DIMENSION_MISMATCH` before anything is written, instead of
  storing a row keyed as the requested width and stored at another — which made
  every later identical call demote the row and pay for the same embedding
  again.
- a1b0c2f: Add `getOrCreate`'s `maxEmbedBatchSize` option: a cap on how many texts go to
  `embed` in one call, so a cold cache over a large corpus no longer hands the
  callback more inputs than the provider accepts. Sub-batches run in order and
  each is cached as it succeeds — a later failure leaves the completed ones
  cached and throws — and `report.embedCallCount` is the number of calls
  actually made. Omitting it keeps the previous behavior: one call for every
  unique miss.

### Patch Changes

- 09f228c: Honor `busyTimeoutMs` while the database is being opened. It was applied only
  after the header probe, the migration reads and the WAL switch, so until then
  the driver's own 5 s default was in force and a larger configured timeout was
  silently capped — losing the race against another process checkpointing its
  WAL on `close()`.
