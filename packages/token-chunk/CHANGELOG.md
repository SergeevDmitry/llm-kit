# token-chunk

## 1.1.0

### Minor Changes

- 21ed388: Add `TextChunk.kinds: readonly BlockKind[]`, the structural block kinds (`'heading' | 'paragraph' | 'code-fence' | 'list-item' | 'table' | 'blockquote'`) packed into each chunk, deduplicated and in document order — lets a consumer route or filter chunks by content type (e.g. skip embedding code fences) without re-sniffing `chunk.text`.

### Patch Changes

- 4f4aabf: Fix `splitTable` fabricating a trailing newline that doesn't exist in the source whenever an oversized Markdown table sits at the end of the input (no trailing `\n`), which pushed `chunk.source.charEnd` one character past `input.length` and broke the documented `chunk.text === normalizeLineEndings(input.slice(charStart, charEnd))` reconstruction guarantee. Piece text is now a literal slice of the source between row offsets instead of a re-join of row texts, which also recovers trailing blank lines folded into the table unit that were previously dropped from every piece.
- 84e3c55: Fix the bundled approximate tokenizer (`@llm-kit/tokenizer`) under-counting real BPE tokenization on several content shapes: unbroken non-word Latin runs over ~20 characters (minified identifiers, hashes, base64 blobs), most non-Latin/non-Cyrillic alphabetic scripts (Greek, Hebrew, Arabic, Georgian, Armenian, Thai, Devanagari, and others — previously charged Cyrillic's lighter rate without being individually verified), and multi-code-point CJK grapheme clusters (most commonly NFD-decomposed Hangul). Also fixes an isolated space being assumed to fold before any alphabetic letter, which was only ever verified against Latin script and does not hold reliably for Cyrillic or the other affected scripts. Token counts for content in these shapes are now higher (more conservative); ordinary Latin prose, code, Cyrillic text, and ordinarily-composed CJK text are unaffected.
