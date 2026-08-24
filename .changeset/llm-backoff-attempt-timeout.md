---
'llm-backoff': minor
---

Add `attemptTimeoutMs`, a per-attempt ceiling whose timeout is retryable.

A hung call — connection established, tokens never arrive — is the failure this package could not recover from: `maxElapsedMs` is only checked between attempts, so one hung attempt quietly eats the entire budget. With `attemptTimeoutMs` set, an attempt that outlives it is cancelled and retried through the normal delay machinery, and surfaces as an `AttemptTimeoutError` on `LlmBackoffError.cause` if every attempt hangs.

Wiring this up yourself does not work, which is why it belongs in the package: an `AbortSignal.timeout()` inside your operation produces a `TimeoutError` with no status, so the classifier reads it as a non-retryable failure and gives up after one attempt. Only the retry loop can tell its own ceiling apart from a cancellation the caller asked for.

`options.signal` keeps absolute precedence — if both fire on the same attempt, your abort reason propagates unwrapped and unretried, exactly as before. The ceiling reaches your operation through `RetryContext.signal` (combined with `options.signal`), so forwarding that signal cancels the in-flight request rather than leaving it holding a connection; `fetchWithLlmBackoff` already forwards it. A failure that arrived before the ceiling is still classified as itself — a `400` under a 30 s ceiling is still non-retryable. Time spent on a timed-out attempt counts toward `maxElapsedMs`, and the timer is armed through the injectable `sleep`, so an injected clock still sees no real timer.

The option is off by default and nothing changes for callers who do not set it. `AttemptTimeoutError` is a new export.
