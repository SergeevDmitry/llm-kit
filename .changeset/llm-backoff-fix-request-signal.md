---
'llm-backoff': patch
---

Honor the `AbortSignal` a `Request` input carries. `fetchWithLlmBackoff` combined `options.signal` and `init.signal` but not the signal every `Request` has, and it passes the combined signal on to `fetch` in the init bag — which, per the fetch spec, _replaces_ the Request's own signal. So `fetchWithLlmBackoff(request, undefined, { signal })` stopped honoring `request`'s controller entirely: aborting it no longer cancelled even the in-flight network call, something plain `fetch(request)` does for free.

With no other signal supplied, the failure was quieter but worse. The retry loop's signal was `undefined`, so an abort during a `Retry-After` sleep did nothing until the sleep elapsed — up to the full server-advised delay — and the eventual rejection was then classified as a non-retryable failure and wrapped in `LlmBackoffError`, breaking the documented contract that an abort propagates immediately and unwrapped with the exact reason object you passed to `abort()`.

All three channels are now combined, so an abort through any of them cancels the whole retry operation at every phase — before the first attempt, mid-fetch, and mid-sleep — and surfaces unwrapped.
