# token-chunk

## 1.2.0

### Minor Changes

- 628c1b7: Add `TextChunk.syntheticPrefixLength: number`, how many leading characters of `chunk.text` were synthesized rather than sliced out of the input (a rendered heading breadcrumb, a repeated table header, or both) — so `chunk.text.slice(chunk.syntheticPrefixLength)` is exactly the documented source reconstruction, and a consumer can strip the non-source-backed part before hashing, deduplicating or mapping a position back to an input offset without re-deriving the prefix. It is `0` when nothing was prepended, including when a prefix was dropped to keep the chunk within budget.

### Patch Changes

- 0c727b4: Keep a table row's trailing newline when the row itself has to be split. The
  row unit was built from the bare line, one character short of the extent
  `bodySpans` records, so that newline landed in no chunk's `text` and in no
  chunk's `source` range: the chunk stopped reconstructing its own source slice,
  and the row ran straight into whatever unit packed after it.
- eba51b9: Stop dropping a split table's header row. When the header fit the budget on its
  own but not alongside the first body row, that row was split out on a path that
  bypassed the only code emitting the header as text — so the header and
  separator lines appeared in no chunk's `text` **and** in no chunk's `source`
  range, leaving retrieved rows with no column names. The header is now emitted
  once as its own source-backed chunk, and every fragment of that row repeats it
  as a synthetic prefix, as documented.

## 1.1.0

### Minor Changes

- 21ed388: Add `TextChunk.kinds: readonly BlockKind[]`, the structural block kinds (`'heading' | 'paragraph' | 'code-fence' | 'list-item' | 'table' | 'blockquote'`) packed into each chunk, deduplicated and in document order — lets a consumer route or filter chunks by content type (e.g. skip embedding code fences) without re-sniffing `chunk.text`.

### Patch Changes

- 4f4aabf: Fix `splitTable` fabricating a trailing newline that doesn't exist in the source whenever an oversized Markdown table sits at the end of the input (no trailing `\n`), which pushed `chunk.source.charEnd` one character past `input.length` and broke the documented `chunk.text === normalizeLineEndings(input.slice(charStart, charEnd))` reconstruction guarantee. Piece text is now a literal slice of the source between row offsets instead of a re-join of row texts, which also recovers trailing blank lines folded into the table unit that were previously dropped from every piece.
- 84e3c55: Fix the bundled approximate tokenizer (`@llm-kit/tokenizer`) under-counting real BPE tokenization on several content shapes: unbroken non-word Latin runs over ~20 characters (minified identifiers, hashes, base64 blobs), most non-Latin/non-Cyrillic alphabetic scripts (Greek, Hebrew, Arabic, Georgian, Armenian, Thai, Devanagari, and others — previously charged Cyrillic's lighter rate without being individually verified), and multi-code-point CJK grapheme clusters (most commonly NFD-decomposed Hangul). Also fixes an isolated space being assumed to fold before any alphabetic letter, which was only ever verified against Latin script and does not hold reliably for Cyrillic or the other affected scripts. Token counts for content in these shapes are now higher (more conservative); ordinary Latin prose, code, Cyrillic text, and ordinarily-composed CJK text are unaffected.
