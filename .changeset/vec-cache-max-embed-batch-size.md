---
'vec-cache': minor
---

Add `getOrCreate`'s `maxEmbedBatchSize` option: a cap on how many texts go to
`embed` in one call, so a cold cache over a large corpus no longer hands the
callback more inputs than the provider accepts. Sub-batches run in order and
each is cached as it succeeds — a later failure leaves the completed ones
cached and throws — and `report.embedCallCount` is the number of calls
actually made. Omitting it keeps the previous behavior: one call for every
unique miss.
