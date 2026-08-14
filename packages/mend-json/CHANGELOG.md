# mend-json

## 1.1.0

### Minor Changes

- d4fe18e: Add `mendStream`, an async-iteration adapter over `createJsonMender` for consuming a `fetch` response body, a Node `Readable`, or any other `AsyncIterable<string | Uint8Array>` chunk by chunk, with optional `AbortSignal` support.

### Patch Changes

- d4fe18e: Fix `incompleteScalarPolicy: 'best-effort'` completing a literal the input already contradicted (e.g. `tRue`, `tru5`) instead of omitting it like `'omit'` does — nothing is invented from input that disproved the completion.
- d4fe18e: Fix `push()` on a frozen mender not being the documented no-op: it could still grow the internal buffer, silently flip an already-reported `complete: true` to `false` with no diagnostic, or throw a second, unrelated `JsonMendLimitError`. `finish()`'s pending-byte flush got the same fix, for the same underlying reason.
