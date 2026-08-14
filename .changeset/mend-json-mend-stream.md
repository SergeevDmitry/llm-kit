---
'mend-json': minor
---

Add `mendStream`, an async-iteration adapter over `createJsonMender` for consuming a `fetch` response body, a Node `Readable`, or any other `AsyncIterable<string | Uint8Array>` chunk by chunk, with optional `AbortSignal` support.
