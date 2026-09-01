---
'token-chunk': patch
---

Keep a table row's trailing newline when the row itself has to be split. The
row unit was built from the bare line, one character short of the extent
`bodySpans` records, so that newline landed in no chunk's `text` and in no
chunk's `source` range: the chunk stopped reconstructing its own source slice,
and the row ran straight into whatever unit packed after it.
