# llm-backoff

Retries that read provider rate-limit headers instead of guessing an exponential delay.

[![npm](https://img.shields.io/npm/v/llm-backoff.svg)](https://www.npmjs.com/package/llm-backoff)
[![CI](https://github.com/SergeevDmitry/llm-kit/actions/workflows/ci.yml/badge.svg)](https://github.com/SergeevDmitry/llm-kit/actions/workflows/ci.yml)
[![zero dependencies](https://img.shields.io/badge/dependencies-0-brightgreen)](https://www.npmjs.com/package/llm-backoff?activeTab=dependencies)

## The problem

Generic retry libraries never look at the response: they guess a delay from
the attempt number and hope. That guess is wrong in both directions — too
short, and you hit the same rate limit again immediately; too long, and
you're idle for no reason — even though the server usually already told you,
in a header, exactly how long to wait.

## Before / after

```ts
// Before: blind exponential backoff never looks at the response. It guesses
// a delay from the attempt number alone — nothing here reads `status` or
// `headers`, even though the server already said exactly how long to wait.
async function blindBackoff<T>(operation: () => Promise<T>, maxAttempts = 5): Promise<T> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      if (attempt >= maxAttempts) throw error;
      const guessedDelayMs = 2 ** attempt * 40; // pure guesswork — the response is never consulted
      await new Promise((resolve) => setTimeout(resolve, guessedDelayMs));
    }
  }
}

let blindAttempts = 0;
await blindBackoff(async () => {
  blindAttempts += 1;
  if (blindAttempts < 3) {
    // The server said "wait exactly 50ms" — blindBackoff never reads this.
    throw Object.assign(new Error('rate limited'), {
      status: 429,
      headers: { 'retry-after': '0.05' },
    });
  }
  return 'ok';
});
console.log(`blind backoff needed ${String(blindAttempts)} attempts, guessing the whole time`);
```

```ts
import { withLlmBackoff } from 'llm-backoff';

// After: withLlmBackoff reads the same 429's retry-after header and sleeps
// exactly what it says — 50ms, not a guessed 40/80/160ms exponential curve.
let awareAttempts = 0;
const result = await withLlmBackoff(async () => {
  awareAttempts += 1;
  if (awareAttempts < 3) {
    throw Object.assign(new Error('rate limited'), {
      status: 429,
      headers: { 'retry-after': '0.05' },
    });
  }
  return 'ok';
});
console.log(`header-aware backoff: ${result} after ${String(awareAttempts)} attempts, no guessing`);
```

## Install

```text
npm install llm-backoff
```

## Minimal usage

```ts
import { withLlmBackoff } from 'llm-backoff';

declare function callProvider(): Promise<Response>;

const response = await withLlmBackoff(async () => {
  const res = await callProvider();
  if (!res.ok) throw res; // withLlmBackoff reads res.status / res.headers directly
  return res;
});
```

Or wrap `fetch` itself and skip the manual `if (!res.ok) throw res`:

```ts
import { fetchWithLlmBackoff } from 'llm-backoff';

const response = await fetchWithLlmBackoff('https://api.example.com/v1/chat', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ prompt: 'hello' }),
});
```

## Guarantees

- **429 and 529 retry by default; 400 and 401 never do — and this pair is not
  configurable away.** Adding `400` to `retryableStatuses` or `429` to
  `nonRetryableStatuses` has no effect on those four statuses specifically.
  See the [classification table](#retry-classification) below for everything
  else.
- **An explicit server delay is honored exactly, with no jitter added.** If
  `Retry-After` says `3.2`, this package sleeps `3200`ms — not `3200` plus a
  "just in case" margin, and not rounded to the nearest whole second. Jitter
  is applied only to the fallback backoff (the tier used when no header is
  usable), never to a header-derived delay.
- **A header's unit is never guessed.** `x-ratelimit-reset-*`-style values
  show up as durations, epoch seconds, epoch milliseconds, or timestamps
  depending on the provider, and nothing in the raw string says which. Only a
  format a provider profile has explicitly confirmed for a specific header
  name is interpreted; everything else is recorded as unusable, with a
  reason, and delay selection falls through to the next tier. See
  [Supported headers and provider profiles](#supported-headers-and-provider-profiles).
- **Abort errors, authentication failures, and validation failures never
  retry.** An `AbortError` thrown by your operation propagates immediately,
  unwrapped — it is never retried and never wrapped in this package's own
  error type.
- **`maxElapsedMs` measures true wall-clock time, and is checked before
  sleeping, not after.** It includes time spent inside your `operation` on
  every prior attempt, not just time spent sleeping — a slow provider call
  counts against the budget exactly like a slow sleep would. If honoring the
  next delay would push elapsed time past your budget, the call fails
  immediately with a typed error instead of sleeping past it. See
  [Performance](#performance) for the one residual caveat this implies.
- **Time, randomness, and sleeping are all injectable**, and this package's
  own test suite never uses a real timer (`sleep`/`random`/`now` options; see
  [Advanced options and adapters](#advanced-options-and-adapters)).
- **No logging, no telemetry, ever.** The only observability this package has
  is the `onRetry` callback you supply. See
  [Security and privacy](#security-and-privacy).
- **⚠️ Idempotency is your responsibility, not this package's.** `withLlmBackoff`
  and `fetchWithLlmBackoff` cannot know whether calling your `operation` a
  second time is safe — only you know that. Read
  [Idempotency: this package cannot know what's safe to repeat](#idempotency-this-package-cannot-know-whats-safe-to-repeat)
  before wrapping anything that isn't naturally safe to retry.

### Idempotency: this package cannot know what's safe to repeat

**This is the most important limitation in this README.** `withLlmBackoff`
retries your `operation` by calling it again — the same function, another
time. For a `GET` request, or a provider chat-completion call with no side
effect beyond "produce text," that's harmless. For anything that charges a
card, sends an email, appends to a ledger, or otherwise has a side effect
that isn't safe to happen twice, retrying it blind is a bug this package
cannot detect for you, because it has no way to know what your `operation`
actually does.

Use one of these instead of trusting a bare retry:

- Pass an **idempotency key** your provider supports (most LLM and payment
  APIs do) so a duplicate request is deduplicated server-side regardless of
  how many times this package calls `operation`.
- Only wrap calls that are **naturally safe to repeat** — reads, or writes
  your own application already makes idempotent (e.g. an upsert keyed by a
  request ID you generate once, outside the retried closure).
- For `fetchWithLlmBackoff` specifically, see
  [non-replayable request bodies](#non-replayable-request-bodies) — a
  `ReadableStream` body is refused outright rather than silently resent
  empty, but a **replayable** body (a `string`/`Blob`/`ArrayBuffer`) _will_
  be resent as-is on every attempt, which is exactly the behavior above
  applies to.

## API

### `withLlmBackoff(operation, options?)`

```ts no-check
function withLlmBackoff<T>(
  operation: (context: RetryContext) => Promise<T>,
  options?: LlmBackoffOptions,
): Promise<T>;

interface RetryContext {
  readonly attempt: number; // 1-based
  readonly elapsedMs: number; // true wall-clock time since the call started, including operation time — see "Performance" below
  readonly signal?: AbortSignal;
}
```

Calls `operation` until it resolves, a non-retryable error is thrown, or
`maxAttempts`/`maxElapsedMs` is reached. Throws `LlmBackoffError` on any
terminal failure; an abort thrown by `operation` (or by `signal` firing)
propagates unwrapped instead.

### `fetchWithLlmBackoff(input, init?, options?)`

```ts no-check
function fetchWithLlmBackoff(
  input: FetchInput, // Request | string | URL — equivalent to RequestInfo | URL
  init?: RequestInit,
  options?: LlmBackoffOptions,
): Promise<Response>;
```

`fetch` wrapped in `withLlmBackoff`. A response whose status is **not**
classified retryable — including a success, and including `400`/`401` — is
returned exactly like plain `fetch` would return it (`response.ok`/`.status`
mean what they always mean). Only a retryable status (`429`/`529` always;
anything you add via `retryableStatuses`) drives a retry; the final response
after retries are exhausted surfaces as a thrown `LlmBackoffError` whose
`.cause` is a `FetchRetryableStatusError` carrying the last `Response`, not a
returned one. See [non-replayable request bodies](#non-replayable-request-bodies)
and [Response body lifetime](#response-body-lifetime), directly below.

#### Response body lifetime

**Only the response that reaches you — the return value on success, or
`LlmBackoffError.cause.response` when retries are exhausted — has a readable
body.** Every other response `fetchWithLlmBackoff` fetches along the way (a
429/529 that gets retried away) has its body cancelled before you can ever see
it, so you never need to drain or close it yourself:

```ts
import { fetchWithLlmBackoff, LlmBackoffError } from 'llm-backoff';

try {
  const response = await fetchWithLlmBackoff('https://api.example.com/v1/chat');
  await response.json(); // safe — this is the one response that survives
} catch (error) {
  if (error instanceof LlmBackoffError && error.cause instanceof Error) {
    const cause = error.cause as { response?: Response };
    // cause.response, if present, is also still fully readable — it's the
    // *last* attempt's response, the same one that would have reached you
    // had it succeeded.
  }
  throw error;
}
```

This exists because an unconsumed `fetch` response body is a real resource in
Node/undici: it pins the underlying connection out of the keep-alive pool and
holds its buffered chunks until the `Response` is garbage collected (Node's
own `fetch` documentation says as much). A 429 storm — `maxAttempts: 5`
against an endpoint that is currently rejecting every request — is exactly
the moment this runs hottest, and provider rate-limit responses typically
carry a JSON error body, not an empty one. `fetchWithLlmBackoff` calls
`response.body?.cancel()` (defensively — a `null` body or an already-locked
one is a no-op, never a thrown error) on every response it determines can
never reach you, including ones discarded for a reason other than a normal
retry: `onRetry` throwing, or an abort firing between attempts. In both of
those cases _no_ response reaches you at all, so the one from that attempt is
released too, the same as any other retried-away response.

### `parseRateLimitHeaders(headers, options?)`

```ts no-check
function parseRateLimitHeaders(
  headers: HeadersLike,
  options?: ParseHeadersOptions,
): RateLimitAdvice;

type HeadersLike = Headers | Record<string, string | string[] | undefined>;

interface ParseHeadersOptions {
  provider?: ProviderId | 'auto' | string; // default: 'auto' (detect from the headers present)
  now?: () => number; // default: Date.now — inject a fake clock's nowFn in tests
}

interface RateLimitAdvice {
  readonly delayMs: number | undefined; // undefined: no header was usable — fall back
  readonly source: 'retry-after' | 'provider-reset-header' | 'generic-reset-header' | undefined;
  readonly headerName: string | undefined; // which header won, when more than one was in play
  readonly provider: ProviderId | undefined;
  readonly candidates: readonly RateLimitCandidate[]; // every header looked at, usable or not
  readonly warnings: readonly string[]; // why a candidate was unusable or clamped
}
```

The pure decision function `withLlmBackoff`/`fetchWithLlmBackoff` are built
on. Case-insensitive; accepts a real `Headers` instance or a plain object
with string or string-array values (`Record<string, string | string[] | undefined>`)
— the shape most SDK error objects actually carry. Fully JSON-serializable.

```ts
import { parseRateLimitHeaders } from 'llm-backoff';

const advice = parseRateLimitHeaders({ 'retry-after': '30' });
console.log(advice.delayMs, advice.source); // 30000 'retry-after'
```

### `classifyLlmError(error, options?)`

```ts no-check
function classifyLlmError(error: unknown, options?: ClassificationOptions): RetryClassification;

interface ClassificationOptions {
  retryableStatuses?: readonly number[];
  nonRetryableStatuses?: readonly number[];
}

interface RetryClassification {
  readonly retryable: boolean;
  readonly reason: string; // human-readable, stable enough to assert on
  readonly status: number | undefined;
  readonly isAbort: boolean;
  readonly headers: HeadersLike | undefined; // feed straight to parseRateLimitHeaders
}
```

Extracts a status/headers pair from a thrown `Response`, or from an SDK error
shaped `{ status, headers }` or `{ statusCode, response: { headers } }` (the
shape the OpenAI and Anthropic Node SDKs both use), and applies the
[classification matrix](#retry-classification) below.

```ts
import { classifyLlmError } from 'llm-backoff';

const classification = classifyLlmError({ status: 401, headers: {} });
console.log(classification.retryable, classification.reason);
// false 'HTTP 401 is never retried by default (authentication/validation failures are not transient)'
```

### `LlmBackoffOptions`

```ts no-check
interface LlmBackoffOptions {
  maxAttempts?: number; // default 5 — total attempts, including the first
  maxElapsedMs?: number; // default 60_000 — true wall-clock budget (includes operation time), checked before every sleep
  maxDelayMs?: number; // default 30_000 — caps the fallback backoff only, never an explicit header delay
  baseDelayMs?: number; // default 500 — fallback backoff base
  retryableStatuses?: readonly number[]; // added to the mandatory {429, 529}
  nonRetryableStatuses?: readonly number[]; // added to the mandatory {400, 401}
  provider?: ProviderId | 'auto' | string; // default 'auto'
  signal?: AbortSignal;
  onRetry?: (event: RetryEvent) => void | Promise<void>;
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>; // default: platform setTimeout
  random?: () => number; // default: Math.random — only ever used by the fallback backoff
  now?: () => number; // default: Date.now — measures RetryContext.elapsedMs/maxElapsedMs; inject a fake clock's nowFn in tests
}
```

### `RetryEvent`

```ts no-check
interface RetryEvent {
  readonly attempt: number;
  readonly attemptsRemaining: number;
  readonly elapsedMs: number;
  readonly status: number | undefined;
  readonly reason: string;
  readonly delayMs: number;
  readonly delaySource:
    'retry-after' | 'provider-reset-header' | 'generic-reset-header' | 'fallback-backoff';
  readonly winningHeader: string | undefined;
  readonly provider: ProviderId | undefined;
  readonly headerNames: readonly string[]; // sanitized names only — never Authorization/Cookie values or names
  readonly advice: RateLimitAdvice;
}
```

Passed to `onRetry` right before each sleep — never for a non-retryable
failure, since there's nothing to observe about a call that was never going
to retry. Every field is JSON-serializable; see
[Security and privacy](#security-and-privacy).

### Errors

```ts no-check
type LlmBackoffErrorCode =
  | 'INVALID_OPTIONS'
  | 'NON_RETRYABLE'
  | 'MAX_ATTEMPTS_EXCEEDED'
  | 'MAX_ELAPSED_EXCEEDED'
  | 'ON_RETRY_CALLBACK_FAILED'
  | 'REQUEST_BODY_NOT_REPLAYABLE';

class LlmBackoffError extends Error {
  readonly code: LlmBackoffErrorCode;
  readonly attempts: readonly AttemptRecord[]; // every attempt made, oldest first
  // .cause is always the original failure that ended the loop
}

class FetchRetryableStatusError extends Error {
  readonly status: number;
  readonly headers: Headers;
  readonly response: Response; // fetchWithLlmBackoff's cause on exhausted retries
}
```

`AttemptRecord` (`{ attempt, elapsedMs, retryable, status, reason, delayMs, delaySource }`),
`RateLimitCandidate`, `RetryContext`, and every other type above is also
exported directly from `llm-backoff` for your own type annotations.

### Retry classification

| Status / condition                                                                              | Retried by default? | Configurable?                                                  |
| ----------------------------------------------------------------------------------------------- | ------------------- | -------------------------------------------------------------- |
| `429`                                                                                           | **Yes, always**     | No — mandatory                                                 |
| `529`                                                                                           | **Yes, always**     | No — mandatory                                                 |
| `400`                                                                                           | **No, never**       | No — mandatory                                                 |
| `401`                                                                                           | **No, never**       | No — mandatory                                                 |
| Any other status listed in `retryableStatuses`                                                  | Yes                 | Opt-in                                                         |
| Any other status listed in `nonRetryableStatuses`                                               | No                  | Opt-in (also the default for these)                            |
| Any other status, no option set                                                                 | No                  | Conservative default                                           |
| Recognized transient network code (`ECONNRESET`, `ETIMEDOUT`, `ECONNREFUSED`, `EAI_AGAIN`, ...) | Yes                 | Not configurable off                                           |
| `AbortError` (from `operation` or from `signal`)                                                | **Never**           | Not configurable — always propagates unwrapped                 |
| Unrecognized error shape (no status, no known network code)                                     | No                  | Normalize your error, or add its status to `retryableStatuses` |

## Advanced options and adapters

### Supported headers and provider profiles

| Header                                         | Provider profile           | Value format                                   | When it's used                                     |
| ---------------------------------------------- | -------------------------- | ---------------------------------------------- | -------------------------------------------------- |
| `Retry-After`                                  | any (universal)            | integer/decimal seconds, or an HTTP-date       | Always checked first, regardless of `provider`     |
| `x-ratelimit-reset-requests`                   | `openai`                   | Go-style duration (`"1s"`, `"6m0s"`, `"12ms"`) | `provider: 'auto'` or `'openai'`                   |
| `x-ratelimit-reset-tokens`                     | `openai`                   | Go-style duration                              | `provider: 'auto'` or `'openai'`                   |
| `anthropic-ratelimit-requests-reset`           | `anthropic`                | RFC 3339 / ISO 8601 timestamp                  | `provider: 'auto'` or `'anthropic'`                |
| `anthropic-ratelimit-tokens-reset`             | `anthropic`                | RFC 3339 / ISO 8601 timestamp                  | `provider: 'auto'` or `'anthropic'`                |
| `anthropic-ratelimit-input-tokens-reset`       | `anthropic`                | RFC 3339 / ISO 8601 timestamp                  | `provider: 'auto'` or `'anthropic'`                |
| `anthropic-ratelimit-output-tokens-reset`      | `anthropic`                | RFC 3339 / ISO 8601 timestamp                  | `provider: 'auto'` or `'anthropic'`                |
| `RateLimit-Reset` (IETF draft)                 | generic                    | delta-seconds                                  | Always, below any matched provider profile         |
| `x-ratelimit-reset` (no `-requests`/`-tokens`) | _none — never interpreted_ | —                                              | Recorded as unusable, with a reason; never guessed |

`provider: 'auto'` (the default) detects which profile applies from which of
these header names are actually present — never from the shape of a raw
value. `google` exists as a `ProviderId` for forward compatibility but ships
no header rules yet: Google/Gemini has no publicly confirmed reset-header
format at the time of writing, so only `Retry-After` applies to it, the same
as any unrecognized provider. **A format is only ever applied where a
specific header name is confirmed to use it** — that's also why epoch-seconds
and epoch-milliseconds parsing exists internally but isn't bound to any header
yet: no shipped provider profile has confirmed one uses it.

When several of a matched provider's reset headers are present at once (e.g.
both a requests-reset and a tokens-reset), the **maximum** usable delay wins,
and `RateLimitAdvice.headerName`/`RetryEvent.winningHeader` say which one:

```ts
import { parseRateLimitHeaders } from 'llm-backoff';

const advice = parseRateLimitHeaders(
  { 'x-ratelimit-reset-requests': '1s', 'x-ratelimit-reset-tokens': '6m0s' },
  { provider: 'openai' },
);
console.log(advice.delayMs, advice.headerName);
// 360000 'x-ratelimit-reset-tokens' — the longer of the two exhausted resources
console.log(advice.warnings[0]);
// 'multiple exhausted resources reported reset headers; chose "x-ratelimit-reset-tokens" (360000ms), the maximum, over: x-ratelimit-reset-requests (1000ms)'
```

### Fallback behavior (no header was usable)

When no header produces a usable delay, `withLlmBackoff` uses a bounded
exponential backoff with full jitter: a delay drawn uniformly from
`[0, min(maxDelayMs, baseDelayMs * 2 ** (attempt - 1))]`. This is the _only_
place `random` is ever consulted — never on a header-derived delay. A
`baseDelayMs: 0`/`maxDelayMs: 0` configuration still waits at least 1ms
between attempts rather than busy-looping in the same tick.

### Observability: `onRetry`

```ts
import { withLlmBackoff } from 'llm-backoff';

declare function callProvider(): Promise<Response>;

await withLlmBackoff(
  async () => {
    const res = await callProvider();
    if (!res.ok) throw res;
    return res;
  },
  {
    onRetry(event) {
      // No logging happens unless you write it yourself — this callback is
      // the only observability this package has.
      console.warn(
        `attempt ${String(event.attempt)} failed (status ${String(event.status)}); ` +
          `sleeping ${String(event.delayMs)}ms via ${event.delaySource}` +
          (event.winningHeader !== undefined ? ` (${event.winningHeader})` : ''),
      );
    },
  },
);
```

### Cancellation

```ts
import { withLlmBackoff } from 'llm-backoff';

declare function callProvider(): Promise<Response>;

const controller = new AbortController();
setTimeout(() => controller.abort(new Error('user navigated away')), 5000);

try {
  await withLlmBackoff(
    async () => {
      const res = await callProvider();
      if (!res.ok) throw res;
      return res;
    },
    { signal: controller.signal },
  );
} catch (error) {
  // Abort rejects immediately and unwrapped, at every phase: before the
  // first attempt, mid-operation (the signal fires while `callProvider()` is
  // still in flight — the common case, since that's the path native `fetch`
  // itself takes), right before a sleep, or mid-sleep. It is never retried
  // and never wrapped in LlmBackoffError, regardless of which phase it lands
  // in or what `operation()` itself rejected with at the same moment.
  //
  // The exact reason you passed to `abort()` is what you get back — this
  // works even though `callProvider()` never sees `controller.signal` here,
  // because `withLlmBackoff` checks the signal itself, not the shape of
  // whatever the operation rejected with.
  if (error === controller.signal.reason) {
    console.warn('cancelled:', error);
  }
}
```

The identity contract (`error === controller.signal.reason`) holds only when
the reason is an `Error` (including a `DOMException`, so
`AbortSignal.timeout()`'s `TimeoutError` also comes through unwrapped, by
name and by reference). A non-`Error` reason — a string, `undefined`, a plain
object — is normalized to a `DOMException` named `AbortError` instead, the
same normalization `throwIfAborted` and the default `sleep` already apply;
check `error instanceof DOMException && error.name === 'AbortError'` for
that case rather than an identity comparison.

`fetchWithLlmBackoff` combines every signal that reaches it into one signal
per call (`AbortSignal.any` where available): `options.signal`, a
caller-supplied `init.signal`, and — when you pass a `Request` — the signal
that `Request` carries. All three cancel the whole retry loop, not just the
attempt in flight. It detaches any listeners it attached for that once the
call settles — whether it succeeds, fails, or is aborted — so reusing one
long-lived `AbortSignal` (an app-lifetime shutdown signal, say) across many
`fetchWithLlmBackoff` calls does not accumulate listeners on it over time.
The reason surfaced to the caller is always the _original_ signal's reason —
whichever fired first — never a synthetic reason from the combinator itself.

```ts
import { fetchWithLlmBackoff } from 'llm-backoff';

const controller = new AbortController();
const request = new Request('https://api.example.com/v1/messages', {
  method: 'POST',
  body: JSON.stringify({ model: 'claude-sonnet-5' }),
  signal: controller.signal,
});

// Aborting the Request's own controller cancels the retry loop, exactly as it
// would cancel a plain `fetch(request)` — including during the sleep between
// attempts, and with the reason propagated unwrapped.
const response = await fetchWithLlmBackoff(request);
```

### Non-replayable request bodies

Some request bodies can only be read once. If yours is one of them and more
than one attempt is possible, `fetchWithLlmBackoff` throws `LlmBackoffError`
(`REQUEST_BODY_NOT_REPLAYABLE`) **before making any request**, rather than
risk a retry that sends an empty body because the first attempt already
drained the source:

```ts
import { fetchWithLlmBackoff } from 'llm-backoff';

declare const streamingBody: ReadableStream<Uint8Array>;

try {
  await fetchWithLlmBackoff('https://api.example.com/upload', {
    method: 'POST',
    body: streamingBody,
    duplex: 'half', // required by the fetch spec whenever the body is a stream
  });
} catch (error) {
  // Safe paths: buffer the body first (string/Blob/ArrayBuffer/Uint8Array —
  // fetch reads any of those fresh on every call, so they *are* replayable),
  // or accept no retries with { maxAttempts: 1 }.
  console.warn(error);
}
```

Node's `fetch` accepts more than a `ReadableStream` here, and the ones that
are equally single-shot are refused the same way:

| Body                                                                        | Retried?                           |
| --------------------------------------------------------------------------- | ---------------------------------- |
| `string`, `Blob`, `ArrayBuffer`, `Uint8Array`                               | Yes — read fresh on every attempt  |
| `FormData`, `URLSearchParams`, an array or `Set` of chunks                  | Yes — a fresh iterator per attempt |
| `ReadableStream`                                                            | No — `REQUEST_BODY_NOT_REPLAYABLE` |
| An async iterable, including a `node:stream` `Readable` (Node's fetch only) | No — `REQUEST_BODY_NOT_REPLAYABLE` |
| A generator object, sync or async                                           | No — `REQUEST_BODY_NOT_REPLAYABLE` |

### Forcing a provider profile

```ts
import { parseRateLimitHeaders } from 'llm-backoff';

// Skip auto-detection — useful if you're behind a gateway that renames
// headers but preserves an upstream provider's value format.
const advice = parseRateLimitHeaders(
  { 'anthropic-ratelimit-tokens-reset': '2026-01-01T00:00:00Z' },
  {
    provider: 'anthropic',
  },
);
```

## Edge cases and limitations

| Case                                                                                    | Behavior                                                                                                                                                                                                                                                                                               |
| --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Conflicting reset headers (several exhausted resources)                                 | The maximum usable delay wins; `headerName`/`winningHeader` report which one, with a warning listing the rest.                                                                                                                                                                                         |
| Malformed `Retry-After`                                                                 | Recorded unusable with a reason; falls through to the next tier instead of failing the whole call.                                                                                                                                                                                                     |
| A reset time already in the past                                                        | Clamped to `0`ms and reported — not treated as unusable, and never a negative sleep.                                                                                                                                                                                                                   |
| Uppercase / mixed-case headers                                                          | Read identically to lowercase — parsing is fully case-insensitive.                                                                                                                                                                                                                                     |
| An SDK error carrying plain-object headers (not a `Headers`)                            | Handled identically to a real `Headers` instance.                                                                                                                                                                                                                                                      |
| A streamed / non-replayable `fetchWithLlmBackoff` body                                  | Refused upfront (`REQUEST_BODY_NOT_REPLAYABLE`) if more than one attempt is possible — see above.                                                                                                                                                                                                      |
| `onRetry` throws                                                                        | The loop stops; the thrown error surfaces as `LlmBackoffError` (`ON_RETRY_CALLBACK_FAILED`), your error as `.cause`.                                                                                                                                                                                   |
| `maxElapsedMs` would be exceeded by the next delay                                      | Fails immediately (`MAX_ELAPSED_EXCEEDED`) without sleeping — checked before every sleep, using true wall-clock elapsed time (see [Performance](#performance)).                                                                                                                                        |
| A single `operation` call runs long enough on its own to exceed `maxElapsedMs`          | Not interrupted mid-flight — the budget is checked before the _next_ sleep, not by cancelling an attempt already in progress. See [Performance](#performance) for how to add a hard per-attempt ceiling with `AbortSignal`.                                                                            |
| A `400` arrives right after a retryable `429`                                           | Stops immediately on the `400`; the earlier retryable attempt does not "commit" the loop to retrying forever.                                                                                                                                                                                          |
| `x-ratelimit-reset` with no `-requests`/`-tokens` qualifier                             | Never interpreted — different providers use this exact name for different units. Recorded unusable, with why.                                                                                                                                                                                          |
| A response gets retried away (`fetchWithLlmBackoff`)                                    | Its body is cancelled before you can see it — see [Response body lifetime](#response-body-lifetime). Only the response that reaches you (return value, or `LlmBackoffError.cause.response`) has a readable body.                                                                                       |
| A header-derived delay exceeds ~24.8 days (`2^31 - 1`ms)                                | Honored in full — `defaultSleep` chains `setTimeout` calls internally rather than passing an oversized value straight through, which Node/browsers would otherwise clamp to `1`ms and fire immediately.                                                                                                |
| A numeric header value dense enough to overflow to `Infinity` (e.g. hundreds of digits) | Recorded unusable, the same as any other malformed value — never a usable `Infinity` delay. No real server sends a wait even remotely close to this magnitude, so rejecting it doesn't shorten a genuine one; a merely huge, realistic value (e.g. years) is still honored exactly, per the row above. |

What this package deliberately does not do: proactive token-bucket
enforcement, distributed/cross-process rate limiting, installing or importing
any provider SDK, guaranteeing every undocumented provider header is
recognized, or determining on your behalf whether retrying `operation` is
safe (see [Idempotency](#idempotency-this-package-cannot-know-whats-safe-to-repeat) above).

## Runtime compatibility

Universal (browser-safe): `src/` contains no `node:` import, enforced by
`scripts/validate-package-boundaries.ts` and a dedicated in-package test.
Published as ESM and CommonJS from one build (`dist/index.js`/`dist/index.cjs`),
both proven by installing the packed tarball into a clean project and
importing it both ways. Node 20+ is the tested baseline (`engines.node: ">=20"`);
Bun and browser bundling (`esbuild`, `platform: 'browser'`) are proven by the
repository's smoke scripts, not just claimed here.

## Performance

Header parsing is O(number of headers examined) with no regular-expression
sweep over anything but the individual header value being parsed, and no
allocation beyond the `RateLimitAdvice` result itself. Measured with
`pnpm run bench` (`benchmarks/llm-backoff.bench.ts`) on the CI reference
machine:

| Scenario                                                       | Approx. throughput |
| -------------------------------------------------------------- | ------------------ |
| `Retry-After` only, plain object                               | ~1.2M ops/sec      |
| No usable rate-limit header present (falls through every tier) | ~1.2M ops/sec      |
| OpenAI-shaped headers, plain object, `provider: 'auto'`        | ~480k ops/sec      |
| OpenAI-shaped headers, real `Headers` instance                 | ~440k ops/sec      |
| Anthropic-shaped headers, plain object                         | ~330k ops/sec      |
| `classifyLlmError` end to end on a `Response`                  | ~310k ops/sec      |

A second benchmark group exercises the retry loop itself with `sleep` faked
(`createSleepRecorder`), so it measures this package's own per-iteration
overhead rather than real wait time — including the "zero-delay retry loop"
pathological case (`baseDelayMs: 0`, `maxDelayMs: 0`, 100 forced retries) that
guards the `MIN_FALLBACK_DELAY_MS` floor described in
[Fallback behavior](#fallback-behavior-no-header-was-usable) against a
regression that would turn it back into a same-tick busy loop:

| Scenario                                                         | Approx. throughput (100-retry loops/sec) |
| ---------------------------------------------------------------- | ---------------------------------------- |
| `baseDelayMs: 0`/`maxDelayMs: 0` (the zero-delay safeguard case) | ~4,300/sec (~0.23ms per 100 retries)     |
| Normal exponential fallback (`baseDelayMs: 500`)                 | ~4,400/sec (~0.23ms per 100 retries)     |
| Honoring an explicit `Retry-After` header on every retry         | ~4,000/sec (~0.25ms per 100 retries)     |

Run `pnpm run bench` for numbers on your own hardware.

**`elapsedMs`/`maxElapsedMs` measure true wall-clock time**, including time
spent inside your `operation` on every prior attempt, not just time spent
sleeping — a slow provider call counts against the budget exactly like a slow
sleep would (`LlmBackoffOptions.now`, default `Date.now`). This package's own
test suite stays fully deterministic under a fake clock by injecting `now`
from `createFakeClock` (`@llm-kit/test-utils`) and advancing it explicitly
inside a recorded `sleep` and inside a stub `operation` — no real timer is
used anywhere in it.

**One residual caveat, worth being explicit about:** `maxElapsedMs` is
checked _before_ each sleep, not by interrupting an `operation` call that is
already in flight. A single unusually slow attempt can therefore still push
real elapsed time past your budget before this package gets a chance to
check it again — the guard prevents _starting a new wait_ that would blow the
budget, it does not preemptively cancel a call already underway. If you need
a hard ceiling on an individual attempt's own duration as well, compose your
own `AbortSignal.timeout(ms)` (or a per-call timeout inside `operation`
itself) and pass it as `options.signal` (see [Cancellation](#cancellation)
above) — this package fully respects it at every phase, including mid-attempt
if `operation` honors it too.

## Security and privacy

**No logging and no telemetry, by default or otherwise.** This package never
calls `console.*`, never makes a network call of its own (`fetchWithLlmBackoff`
calls exactly the `fetch` you asked it to; `withLlmBackoff` never calls
anything but your `operation`), and never does anything observable beyond
calling your own `onRetry` callback if you supply one — a dedicated test
(`test/no-telemetry.test.ts`) greps `src/` for `console.*` calls as a
regression guard, on top of what `onRetry`'s design already guarantees.

`RetryEvent.headerNames` and `LlmBackoffError.attempts` are sanitized: header
_names_ only, never values, and never `Authorization`/`Cookie`/`Set-Cookie`/
API-key-shaped header names even as names. Header **values** that do appear
(in `RateLimitAdvice.candidates[].rawValue`, also reachable via
`RetryEvent.advice`) are only ever rate-limit metadata this package itself
looked for (`Retry-After`, `x-ratelimit-reset-*`, etc.) — never an arbitrary
response header, and never anything from a request's `Authorization` header.
This is enforced, not just observed: `parseRateLimitHeaders` drops any
candidate whose header name matches the sensitive list above _before_ it is
added to `RateLimitAdvice.candidates`, at the single point every candidate is
built — so even a future provider profile that reads an authenticated header
could not leak its value through `rawValue`. Every value handed to `onRetry`
is plain, JSON-serializable data — safe to log or store yourself if you
choose to.

No `eval`, no dynamic code generation, no unbounded retry loop: `maxAttempts`
and `maxElapsedMs` both default to finite values, and the fallback backoff's
`MIN_FALLBACK_DELAY_MS` floor (see [Performance](#performance)) prevents even
a `baseDelayMs: 0` misconfiguration from spinning without yielding.

Read [Idempotency](#idempotency-this-package-cannot-know-whats-safe-to-repeat)
above — the one thing this package cannot verify on your behalf.

## Contributing and license

Part of the [llm-kit](../../README.md) monorepo. MIT licensed — see
[`LICENSE`](./LICENSE).
