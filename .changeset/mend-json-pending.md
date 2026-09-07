---
'mend-json': minor
---

Add `JsonMendResult.pending`: which part of the document is still incomplete, as `{ path, kind }`. `path` is object keys and array indexes from the root down, so it indexes straight into `value`; `kind` distinguishes a scalar still arriving (`'string'`, `'number'`, `'literal'`) from an object key still being read (`'key'`) or a key whose value has not started (`'member'`). It is `undefined` when nothing is incomplete - the snapshot is `complete`, no value has started, the scanner sits between values, or it froze on invalid input. Costs one O(depth) walk of the existing scanner stack, no extra scanning.
