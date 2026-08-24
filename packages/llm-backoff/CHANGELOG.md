# llm-backoff

## 1.1.0

### Minor Changes

- f88aef3: Add `attemptTimeoutMs`, a per-attempt ceiling whose timeout is retryable.

  A hung call — connection established, tokens never arrive — is the failure this package could not recover from: `maxElapsedMs` is only checked between attempts, so one hung attempt quietly eats the entire budget. With `attemptTimeoutMs` set, an attempt that outlives it is cancelled and retried through the normal delay machinery, and surfaces as an `AttemptTimeoutError` on `LlmBackoffError.cause` if every attempt hangs.

  Wiring this up yourself does not work, which is why it belongs in the package: an `AbortSignal.timeout()` inside your operation produces a `TimeoutError` with no status, so the classifier reads it as a non-retryable failure and gives up after one attempt. Only the retry loop can tell its own ceiling apart from a cancellation the caller asked for.

  `options.signal` keeps absolute precedence — if both fire on the same attempt, your abort reason propagates unwrapped and unretried, exactly as before. The ceiling reaches your operation through `RetryContext.signal` (combined with `options.signal`), so forwarding that signal cancels the in-flight request rather than leaving it holding a connection; `fetchWithLlmBackoff` already forwards it. A failure that arrived before the ceiling is still classified as itself — a `400` under a 30 s ceiling is still non-retryable. Time spent on a timed-out attempt counts toward `maxElapsedMs`, and the timer is armed through the injectable `sleep`, so an injected clock still sees no real timer.

  The option is off by default and nothing changes for callers who do not set it. `AttemptTimeoutError` is a new export.

### Patch Changes

- 1bee72f: Honor the `AbortSignal` a `Request` input carries. `fetchWithLlmBackoff` combined `options.signal` and `init.signal` but not the signal every `Request` has, and it passes the combined signal on to `fetch` in the init bag — which, per the fetch spec, _replaces_ the Request's own signal. So `fetchWithLlmBackoff(request, undefined, { signal })` stopped honoring `request`'s controller entirely: aborting it no longer cancelled even the in-flight network call, something plain `fetch(request)` does for free.

  With no other signal supplied, the failure was quieter but worse. The retry loop's signal was `undefined`, so an abort during a `Retry-After` sleep did nothing until the sleep elapsed — up to the full server-advised delay — and the eventual rejection was then classified as a non-retryable failure and wrapped in `LlmBackoffError`, breaking the documented contract that an abort propagates immediately and unwrapped with the exact reason object you passed to `abort()`.

  All three channels are now combined, so an abort through any of them cancels the whole retry operation at every phase — before the first attempt, mid-fetch, and mid-sleep — and surfaces unwrapped.

- 2427b57: Detect every single-shot request body, not just `ReadableStream`. Node's `fetch` also accepts an async iterable — an async generator, or a `node:stream` `Readable`, which is one — and a generator object, and turns each into a stream internally. All of them are drained by the first attempt, but `fetchWithLlmBackoff`'s guard only recognized a `ReadableStream`, so the exact situation this package promises to detect and refuse happened silently instead: attempt 1 sent the payload, the retry sent zero bytes, and the server answered 200 with nothing to signal that the body had vanished.

  Any of those bodies now throws `LlmBackoffError` (`REQUEST_BODY_NOT_REPLAYABLE`) before the first request is made, with the same remediation — buffer into a `string`/`Blob`/`ArrayBuffer`/`Uint8Array`, or pass `maxAttempts: 1`.

  The test is single-shot-ness, not iterability: `FormData`, `URLSearchParams` and an array or `Set` of chunks are all iterable and all still retry normally, because `fetch` asks each of them for a fresh iterator on every attempt.
