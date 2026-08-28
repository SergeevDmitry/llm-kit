---
'vec-cache': minor
---

`getOrCreate` now checks an explicit `dimensions` request against what `embed`
actually returns, and passes the requested width to the callback as
`request.dimensions`. A callback that ignores it and returns another width
throws `EMBED_DIMENSION_MISMATCH` before anything is written, instead of
storing a row keyed as the requested width and stored at another — which made
every later identical call demote the row and pay for the same embedding
again.
