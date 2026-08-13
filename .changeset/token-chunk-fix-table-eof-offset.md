---
"token-chunk": patch
---

Fix `splitTable` fabricating a trailing newline that doesn't exist in the source whenever an oversized Markdown table sits at the end of the input (no trailing `\n`), which pushed `chunk.source.charEnd` one character past `input.length` and broke the documented `chunk.text === normalizeLineEndings(input.slice(charStart, charEnd))` reconstruction guarantee. Piece text is now a literal slice of the source between row offsets instead of a re-join of row texts, which also recovers trailing blank lines folded into the table unit that were previously dropped from every piece.
