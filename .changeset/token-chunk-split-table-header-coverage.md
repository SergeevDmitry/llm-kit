---
'token-chunk': patch
---

Stop dropping a split table's header row. When the header fit the budget on its
own but not alongside the first body row, that row was split out on a path that
bypassed the only code emitting the header as text — so the header and
separator lines appeared in no chunk's `text` **and** in no chunk's `source`
range, leaving retrieved rows with no column names. The header is now emitted
once as its own source-backed chunk, and every fragment of that row repeats it
as a synthetic prefix, as documented.
