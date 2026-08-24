---
'llm-backoff': patch
---

Detect every single-shot request body, not just `ReadableStream`. Node's `fetch` also accepts an async iterable — an async generator, or a `node:stream` `Readable`, which is one — and a generator object, and turns each into a stream internally. All of them are drained by the first attempt, but `fetchWithLlmBackoff`'s guard only recognized a `ReadableStream`, so the exact situation this package promises to detect and refuse happened silently instead: attempt 1 sent the payload, the retry sent zero bytes, and the server answered 200 with nothing to signal that the body had vanished.

Any of those bodies now throws `LlmBackoffError` (`REQUEST_BODY_NOT_REPLAYABLE`) before the first request is made, with the same remediation — buffer into a `string`/`Blob`/`ArrayBuffer`/`Uint8Array`, or pass `maxAttempts: 1`.

The test is single-shot-ness, not iterability: `FormData`, `URLSearchParams` and an array or `Set` of chunks are all iterable and all still retry normally, because `fetch` asks each of them for a fresh iterator on every attempt.
