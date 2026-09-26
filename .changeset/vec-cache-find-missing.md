---
'vec-cache': minor
---

Add `findMissing(texts, options)`, which returns the texts that still need embedding without reading any vectors.

Answering "which of these documents do I still need to embed?" used to mean calling `getMany`, which copies and decodes a full vector for every hit only for the caller to discard it. `findMissing` runs the same lookup over each row's key and dimensions only. It returns exactly the list `getOrCreate` would pass to `embed` for the same batch: each missing text once, in first-occurrence order, with expired entries and wrong-width hits counted as missing. It takes the same options as `getMany`.
