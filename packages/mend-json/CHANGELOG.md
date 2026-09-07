# mend-json

## 1.2.0

### Minor Changes

- 566adce: Add `JsonMendResult.pending`: which part of the document is still incomplete, as `{ path, kind }`. `path` is object keys and array indexes from the root down, so it indexes straight into `value`; `kind` distinguishes a scalar still arriving (`'string'`, `'number'`, `'literal'`) from an object key still being read (`'key'`) or a key whose value has not started (`'member'`). It is `undefined` when nothing is incomplete - the snapshot is `complete`, no value has started, the scanner sits between values, or it froze on invalid input. Costs one O(depth) walk of the existing scanner stack, no extra scanning.
- 24d3151: Add `JsonMendResult.removedRanges`: the half-open `[start, end)` ranges cut out from inside the valid prefix, sorted and non-overlapping. This completes the identity `appendedSuffix` documents - `input.slice(0, validPrefixLength)`, minus `removedRanges`, plus `appendedSuffix`, is exactly `repairedJson` - which previously had a silent exception under `duplicateKeyPolicy: 'first'`, where a caller slicing the raw buffer itself would render a member the package reports as dropped. Empty under every other policy and repair.

  Also fixes an aliasing bug this exposed: merging exclusion ranges widened a tuple the scanner still owned, mutating scanner state from a call documented as read-only.

### Patch Changes

- 1460e14: `incompleteScalarPolicy: 'best-effort'` no longer turns a contradicted number into a valid one. Inputs like `{"a":01}`, `{"a":1.x}` and `{"a":1e+x}` are syntax errors rather than truncations, so they are now omitted under `'best-effort'` exactly as under `'omit'` - matching the behaviour already in place for contradicted literals such as `tru5`. Genuine truncation (`1.`, `1e+`) still trims back to the typed digits with a `number-truncated` diagnostic.

## 1.1.0

### Minor Changes

- d4fe18e: Add `mendStream`, an async-iteration adapter over `createJsonMender` for consuming a `fetch` response body, a Node `Readable`, or any other `AsyncIterable<string | Uint8Array>` chunk by chunk, with optional `AbortSignal` support.

### Patch Changes

- d4fe18e: Fix `incompleteScalarPolicy: 'best-effort'` completing a literal the input already contradicted (e.g. `tRue`, `tru5`) instead of omitting it like `'omit'` does — nothing is invented from input that disproved the completion.
- d4fe18e: Fix `push()` on a frozen mender not being the documented no-op: it could still grow the internal buffer, silently flip an already-reported `complete: true` to `false` with no diagnostic, or throw a second, unrelated `JsonMendLimitError`. `finish()`'s pending-byte flush got the same fix, for the same underlying reason.
