---
'mend-json': patch
---

Fix string value completion, which skipped value counting and duplicate-key handling. This caused four issues:

- Trailing commas after strings (`["x",]`, `{"a":"x",}`) could be accepted as empty closes and reported `complete: true`, violating `finish()`'s validity guarantee.
- `duplicateKeyPolicy: 'first'` could keep a later string value or drop following members.
- Snapshots ending after a string value's comma (`"...",`) could return `value: undefined` instead of completed values.
- `pending.path` ignored completed strings when calculating array indexes.
