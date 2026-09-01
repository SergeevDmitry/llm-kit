---
'token-chunk': minor
---

Add `TextChunk.syntheticPrefixLength: number`, how many leading characters of `chunk.text` were synthesized rather than sliced out of the input (a rendered heading breadcrumb, a repeated table header, or both) — so `chunk.text.slice(chunk.syntheticPrefixLength)` is exactly the documented source reconstruction, and a consumer can strip the non-source-backed part before hashing, deduplicating or mapping a position back to an input offset without re-deriving the prefix. It is `0` when nothing was prepended, including when a prefix was dropped to keep the chunk within budget.
