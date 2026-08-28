# vec-cache

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
