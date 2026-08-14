---
'token-chunk': minor
---

Add `TextChunk.kinds: readonly BlockKind[]`, the structural block kinds (`'heading' | 'paragraph' | 'code-fence' | 'list-item' | 'table' | 'blockquote'`) packed into each chunk, deduplicated and in document order — lets a consumer route or filter chunks by content type (e.g. skip embedding code fences) without re-sniffing `chunk.text`.
