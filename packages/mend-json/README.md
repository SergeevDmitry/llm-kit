# mend-json

Turn a truncated JSON stream into a valid partial value, on every chunk.

[![npm](https://img.shields.io/npm/v/mend-json.svg)](https://www.npmjs.com/package/mend-json)
[![CI](https://github.com/SergeevDmitry/llm-kit/actions/workflows/ci.yml/badge.svg)](https://github.com/SergeevDmitry/llm-kit/actions/workflows/ci.yml)
[![zero dependencies](https://img.shields.io/badge/dependencies-0-brightgreen)](https://www.npmjs.com/package/mend-json?activeTab=dependencies)

## The problem

Streaming LLM output delivers a JSON prefix that isn't parseable yet —
`JSON.parse('{"name":"Iv')` throws, every time, until the closing brace
arrives. Wrapping every render in `try { JSON.parse(...) } catch {}` gives
you nothing to show while streaming and no way to tell "still typing" apart
from "actually broken".

## Before / after

```ts
// Before: nothing renders until the whole object has arrived.
function renderBefore(chunk: string): void {
  try {
    const value = JSON.parse(chunk);
    console.log('rendered:', value);
  } catch {
    console.log('rendered: (nothing — still throws)');
  }
}

renderBefore('{"name":"Iv'); // rendered: (nothing — still throws)
```

```ts
import { createJsonMender } from 'mend-json';

// After: every chunk produces a valid partial value.
const mender = createJsonMender();

const first = mender.push('{"name":"Iv');
console.log(first.value, first.complete); // { name: 'Iv' } false

const second = mender.push('an","age":30}');
console.log(second.value, second.complete); // { name: 'Ivan', age: 30 } true
```

## Install

```text
npm install mend-json
```

## Minimal usage

```ts
import { mendJson } from 'mend-json';

const result = mendJson('{"city":"Paris","temp":18.');
console.log(result.value); // { city: 'Paris' }
console.log(result.repairedJson); // '{"city":"Paris"}'
console.log(result.complete); // false
```

## Guarantees

- **Headline invariant.** Every snapshot that exposes a `value` also exposes
  a `repairedJson` string that `JSON.parse` accepts. This holds regardless
  of where the input is cut — at any character boundary, at any UTF-8 byte
  boundary, mid multi-byte code point, mid escape sequence — checked by
  property tests over representative documents split at _every_ boundary
  (`test/split-point.test.ts`, `test/utf8-byte-split.test.ts`,
  `test/property.test.ts`).
- **Repair touches only the unfinished suffix.** A value that has already
  been committed to a snapshot is never rewritten or removed by a later
  chunk — later repair only ever extends or closes what's still open. This
  holds even once the document is fully complete and something else follows
  it in the stream (a model closing a markdown fence, or continuing to talk
  after the JSON): the mender freezes at the last valid prefix and keeps
  returning it — it never drops back to `value: undefined`. See
  [Trailing data after a complete document](#trailing-data-after-a-complete-document).
- **`finish()` never claims success for a genuinely invalid document.**
  Declaring "no more input is coming" can complete an in-progress _number_
  (end of stream is a legal number terminator in JSON's own grammar), but it
  never reinterprets a structurally invalid document — a real trailing
  comma, mismatched brackets, an unclosed string — as valid. See
  [Edge cases and limitations](#edge-cases-and-limitations).
- **Nothing is invented.** No object key, no string content, and — under the
  default policy — no digit or letter is ever added that the input didn't
  contain. See [Advanced options and adapters](#advanced-options-and-adapters)
  for the one opt-in exception (`incompleteScalarPolicy: 'best-effort'`) and
  exactly how conservative it stays.
- **Scanning is amortized O(n) across the whole stream.** The scanner
  advances once per character; there is no full-document rescan per chunk
  and no regular expression sweep over the buffer. See
  [Performance](#performance).
- **Zero runtime dependencies, browser-safe.** No `node:` imports; runs
  anywhere `TextDecoder`/`TextEncoder` or a JS string does.

## API

### `createJsonMender<T>(options?): JsonMender<T>`

The stateful API for a live stream.

```ts
import { createJsonMender } from 'mend-json';

interface WeatherArgs {
  city: string;
  unit: 'celsius' | 'fahrenheit';
}

const mender = createJsonMender<WeatherArgs>();
mender.push('{"city":"Berlin","unit":"cel');
const snapshot = mender.push('sius"}');

snapshot.value; // WeatherArgs | undefined
```

```ts no-check
// Reference shape — see "JsonMendResult<T>" below for the result type.
export interface JsonMender<T = unknown> {
  /** Feeds one more chunk (text, or raw UTF-8 bytes) and returns the resulting snapshot. */
  push(chunk: string | Uint8Array): JsonMendResult<T>;
  /** Returns the current snapshot without consuming more input. */
  snapshot(): JsonMendResult<T>;
  /** Declares that no more input will arrive and returns the final snapshot. */
  finish(): JsonMendResult<T>;
  /** Discards all state, as if the mender had just been created. */
  reset(): void;
}
```

### `mendJson<T>(input, options?): JsonMendResult<T>`

The one-shot API, for when you already have the whole (possibly truncated)
payload in hand rather than a live stream. Equivalent to `push(input)`
followed by `finish()`.

```ts
import { mendJson } from 'mend-json';

const result = mendJson('{"items":[1,2,3');
result.value; // { items: [1, 2, 3] }
result.complete; // false — the array and object are still open
```

### `mendStream<T>(source, options?): AsyncGenerator<JsonMendResult<T>, JsonMendResult<T>>`

The async-iteration adapter, for a `fetch` response body, a Node `Readable`,
or an SDK's streaming-delta iterator — anything `AsyncIterable<string |
Uint8Array>`. Equivalent to the `for await` loop around `createJsonMender`
you'd otherwise write by hand.

```ts
import { mendStream } from 'mend-json';

async function* fakeProviderStream() {
  yield '{"city":"Berlin",';
  yield '"temp":18.4}';
}

for await (const snapshot of mendStream(fakeProviderStream())) {
  console.log(snapshot.value, snapshot.complete);
}
// { city: 'Berlin' } false
// { city: 'Berlin' } false
// { city: 'Berlin', temp: 18.4 } true
// { city: 'Berlin', temp: 18.4 } true   <- finish(), yielded once more
```

The last item is always the `finish()` snapshot, yielded again even when it
is identical to the last chunk's — `for await...of` silently discards a
generator's *return* value, so a consumer that only reads yielded items
would otherwise never see the distinction `finish()` can make (a root number
that only becomes safely closable once no more input is coming, for
instance). Driving the generator manually gets the same value both ways:

```ts
import { mendStream } from 'mend-json';

async function* fakeProviderStream() {
  yield '{"city":"Berlin",';
  yield '"temp":18.4}';
}

const gen = mendStream(fakeProviderStream());
let last: Awaited<ReturnType<typeof gen.next>> | undefined;
for (let step = await gen.next(); !step.done; step = await gen.next()) {
  last = step;
}
// The generator's own return value is this same finish() snapshot.
```

Pass an `AbortSignal` to stop early:

```ts
import { mendStream } from 'mend-json';

async function* fakeProviderStream() {
  yield '{"city":"Berlin",';
  yield '"temp":18.4}';
}

const controller = new AbortController();
try {
  for await (const snapshot of mendStream(fakeProviderStream(), {
    signal: controller.signal,
  })) {
    if (snapshot.validPrefixLength > 1_000_000) controller.abort();
  }
} catch (error) {
  // The signal's own abort reason, unchanged when it's an Error — never a
  // mend-json-specific error type.
}
```

`signal` is checked before consuming `source` and again after every chunk it
yields — it does not interrupt a source that is already mid-wait for its
next chunk. If the source itself reacts to the same signal (a `fetch` body,
for instance), aborting it there interrupts that wait too.

### `JsonMendResult<T>`

```ts no-check
// Reference shape — see "Diagnostics" below for JsonMendDiagnostic.
export interface JsonMendResult<T = unknown> {
  /** The best-effort parsed value, or `undefined` if nothing parseable has arrived yet. */
  readonly value: T | undefined;
  /** A JSON string `JSON.parse` accepts, or `undefined` alongside `value: undefined`. */
  readonly repairedJson: string | undefined;
  /** `true` only when the raw input received so far is, as-is, a complete and valid JSON document. */
  readonly complete: boolean;
  /** Count of input characters that contributed to this snapshot's valid prefix. */
  readonly validPrefixLength: number;
  /** The literal closing text appended to make `repairedJson` parseable. */
  readonly appendedSuffix: string;
  /** Every repair action behind this snapshot, oldest first. Always JSON-serializable. */
  readonly diagnostics: readonly JsonMendDiagnostic[];
}
```

### `JsonMenderOptions`

```ts
export interface JsonMenderOptions {
  /** Maximum structural nesting depth. Default: 1000. */
  maxDepth?: number;
  /** Maximum cumulative input size, in UTF-8 bytes. Default: 10,000,000 (10 MB). */
  maxBufferBytes?: number;
  /** How to resolve a repeated object key. Default: `'last'`. */
  duplicateKeyPolicy?: 'last' | 'first' | 'error';
  /** How to treat a scalar still open at snapshot time. Default: `'omit'`. */
  incompleteScalarPolicy?: 'omit' | 'best-effort';
  /** Whether repair actions are recorded into `diagnostics`. Default: `true`. */
  includeDiagnostics?: boolean;
}
```

`maxDepth` and `maxBufferBytes` are the package's resource bounds against an
adversarial or merely broken stream, so they are validated eagerly, at
construction, before any input is accepted:

- Both must be a finite integer. `NaN`, `Infinity`, `-Infinity`, and
  fractional values (`1.5`) are all rejected — a cap that a config-parsing
  mistake can silently switch off is not a cap.
- `maxDepth: 0` is legal: it means "no object/array is ever allowed — root
  scalars only", which is a stricter, not weaker, bound.
- `maxBufferBytes: 0` is rejected: unlike `maxDepth: 0`, it could never
  accept a single byte of real content, so it's treated as a caller mistake
  rather than a usable (if extreme) cap.
- `duplicateKeyPolicy` and `incompleteScalarPolicy` are validated against
  their documented enum values the same way.
- `null` for any of these is treated the same as `undefined` — "not
  provided, use the default" — consistent with every other optional option
  in this package.

A value outside these rules throws `JsonMendOptionsError` (see
[Errors](#errors)) synchronously out of `createJsonMender()` or `mendJson()`,
before anything is pushed.

### Errors

```ts
import {
  JsonMendDuplicateKeyError,
  JsonMendLimitError,
  JsonMendOptionsError,
  mendJson,
} from 'mend-json';

try {
  mendJson('{"a":1,"a":2}', { duplicateKeyPolicy: 'error' });
} catch (error) {
  if (error instanceof JsonMendDuplicateKeyError) {
    error.code; // 'DUPLICATE_KEY'
    error.key; // 'a'
  }
  if (error instanceof JsonMendLimitError) {
    error.code; // 'MAX_DEPTH_EXCEEDED' | 'MAX_BUFFER_BYTES_EXCEEDED'
  }
  if (error instanceof JsonMendOptionsError) {
    error.code; // 'INVALID_OPTIONS'
  }
}
```

`JsonMendDuplicateKeyError` and `JsonMendLimitError` are thrown synchronously
out of `push()` (or `mendJson()`) — never returned as a result state, because
both represent a caller-set boundary being violated rather than an ordinary
"stream isn't done yet" condition. `JsonMendOptionsError` is thrown
synchronously out of `createJsonMender()`/`mendJson()` itself, at
construction, before any input is accepted — see `JsonMenderOptions` above.

**A `JsonMendDuplicateKeyError` or `JsonMendLimitError` thrown out of `push()`
permanently freezes that mender instance.** It does not roll back to before
the offending chunk, and it does not silently keep scanning either — every
`push()` after the throw is a no-op (no error, no further diagnostics,
`validPrefixLength` never moves again) until you call `reset()`. `snapshot()`
and `finish()` keep returning the last good prefix from before the throw
(never `undefined`, unless nothing had parsed yet), so a caller that only
reads results after the fact still gets something useful — but no chunk
pushed after the throw is ever reflected in it — a caller polling
`snapshot()` without ever seeing the `push()` throw still gets a usable
picture of the last good prefix:

```ts
import { createJsonMender } from 'mend-json';

const mender = createJsonMender({ maxDepth: 1 });
try {
  mender.push('{"a":{"too":"deep"}}');
} catch {
  // caller-set boundary violated — the mender is now frozen
}
mender.push('more input'); // silently ignored; not an error
mender.snapshot().value; // {} — the last prefix that was still valid

mender.reset(); // required to reuse this instance
mender.push('{"b":1}').value; // { b: 1 } — works normally again
```

Reach for `reset()` when you want to keep the same `JsonMender` instance
(e.g. it's stored in a map keyed by conversation ID); constructing a fresh
one via `createJsonMender()` works identically and is simpler when you don't.

**`push()`, `snapshot()`, and `finish()` never throw anything outside the
three types above.** A large enough duplicate-key stream could once escape
that taxonomy entirely, raising a raw `RangeError` out of `snapshot()` after
scanning had already advanced — a caller catching the three documented types
wouldn't catch it, and the mender was left permanently bricked with no
`reset()`-free way to recover its already-parsed value. That's fixed (see
[Diagnostics](#diagnostics) for the cap that prevents a recurrence of the
same shape of bug), and more generally: `snapshot()`/`finish()` never mutate
the scanner, so even an unrelated defect that made one of them throw again in
the future cannot corrupt the mender or lose its last valid prefix — the next
`snapshot()` call would still return it, without `reset()`.

### Duplicate keys

```ts
import { mendJson } from 'mend-json';

mendJson('{"a":1,"a":2}').value;
// { a: 2 } — matches JSON.parse: last value wins, default policy

mendJson('{"a":1,"a":2}', { duplicateKeyPolicy: 'first' }).value;
// { a: 1 } — first value wins; the later member is dropped from repairedJson too

mendJson('{"a":1,"a":2}', { duplicateKeyPolicy: 'error' });
// throws JsonMendDuplicateKeyError({ code: 'DUPLICATE_KEY', key: 'a' })
```

### Incomplete scalars — `'omit'` vs. `'best-effort'`

Under the default `'omit'`, a number or literal that hasn't been confirmed by
a following delimiter (or `finish()`, for numbers) is left out entirely —
the member/element it belongs to doesn't appear yet:

```ts
import { mendJson } from 'mend-json';

mendJson('{"count":4', { incompleteScalarPolicy: 'omit' }).value;
// {} — "4" might still become "42"; nothing is shown yet
```

`'best-effort'` shows it instead, never inventing a character that wasn't
typed — a number is trimmed back to its last syntactically complete state
(never padded with an invented digit), and a literal is completed only when
the partial text is an unambiguous prefix of exactly one of
`true`/`false`/`null`:

```ts
import { mendJson } from 'mend-json';

mendJson('{"count":4', { incompleteScalarPolicy: 'best-effort' }).value;
// { count: 4 }

mendJson('{"ready":tru', { incompleteScalarPolicy: 'best-effort' }).value;
// { ready: true } — "tru" has exactly one legal completion

mendJson('{"n":3.1e', { incompleteScalarPolicy: 'best-effort' }).value;
// { n: 3.1 } — the dangling "e" is dropped, not padded with a digit
```

These defaults follow one rule: never invent a character that wasn't
actually there. `'omit'` is the conservative choice for callers who'd rather
see nothing than something wrong; `'best-effort'` is for callers who want to
render partial content as it streams in and can tolerate a value that grows
in place.

### Diagnostics

```ts
import { mendJson } from 'mend-json';

const result = mendJson('{"name":"Iv');
result.diagnostics;
// [
//   { code: 'string-closed', offset: 11, message: '...' },
//   { code: 'closers-appended', offset: 11, message: '...' },
// ]
```

Every diagnostic has a stable `code` (`'string-closed'`, `'escape-truncated'`,
`'scalar-omitted'`, `'scalar-completed'`, `'number-truncated'`,
`'member-removed'`, `'closers-appended'`, `'duplicate-key-skipped'`,
`'trailing-data-ignored'`, `'diagnostics-truncated'`), a human-readable
`message` that never contains input content, and a numeric `offset`.
`'trailing-data-ignored'` is recorded the moment non-whitespace input follows
an already-complete document — see
[Trailing data after a complete document](#trailing-data-after-a-complete-document).
Diagnostics for a permanent repair (a dropped duplicate member)
keep appearing in every later snapshot, not just the one right after they
happened. Pass `includeDiagnostics: false` to skip the bookkeeping in a hot
loop that never inspects them.

**Permanent diagnostics (`'duplicate-key-skipped'`) are capped at 1,000
entries per mender.** Every later duplicate key is still dropped from the
parsed value and from `repairedJson` exactly as `duplicateKeyPolicy: 'first'`
promises — the cap only bounds how many of those repairs get an individual
diagnostic entry. Past the 1,000th, one `'diagnostics-truncated'` entry
appears in their place instead of one entry per further duplicate:

```ts
import { mendJson } from 'mend-json';

// A pathological stream: 2,000 repeats of the same key.
const doc = `{${Array.from({ length: 2000 }, (_, i) => `"k":${i}`).join(',')}}`;
const r = mendJson(doc, { duplicateKeyPolicy: 'first' });

r.value; // { k: 0 } — still correct; every duplicate was still dropped
r.diagnostics.filter((d) => d.code === 'duplicate-key-skipped').length; // 1000
r.diagnostics.filter((d) => d.code === 'diagnostics-truncated').length; // 1
```

This exists because `permanentDiagnostics` is retained for the lifetime of
the mender, not derived fresh per snapshot like every other diagnostic here —
uncapped, its size would track untrusted input size directly. It is not
configurable today; open an issue if you need the exhaustive list for a
pathological stream specifically (most callers want the repair, not a
record of every single duplicate).

## Edge cases and limitations

**This repairs truncation. It does not repair arbitrary malformed JSON** —
that is a deliberate boundary, not a missing feature. Concretely:

- No JSON5, no comments, no unquoted keys, no trailing-identifier tolerance.
- No schema validation, no JSONPath.
- A document that is genuinely invalid — not just cut off — freezes at the
  last safe boundary and is reported `complete: false` forever, even after
  `finish()`. A trailing comma immediately followed by its closer
  (`{"a":1,}`), mismatched brackets (`{"a":[1,2}`), an invalid literal
  (`tRue`), or a leading zero followed by another digit (`01`) all fall into
  this category — they are not truncation, and this package does not guess
  what a human meant to write.
- An object key is never completed or invented, under any policy — a key
  with no colon/value yet is dropped as a whole member, never guessed at.
- `duplicateKeyPolicy` and `incompleteScalarPolicy` only ever _omit_ or
  _trim to already-typed content_ — never fabricate new characters.

```ts
// What "genuinely invalid, not truncated" looks like.
import { mendJson } from 'mend-json';

const stillGoing = mendJson('{"a":1,'); // trailing comma, nothing after yet
stillGoing.complete; // false — ordinary in-flight truncation, may still recover

const broken = mendJson('{"a":1,}'); // trailing comma immediately closed
broken.complete; // false, permanently — this is invalid JSON, not a partial stream
```

### Trailing data after a complete document

Models routinely keep going after the JSON itself: closing a markdown code
fence, adding a sentence of commentary, or simply emitting a trailing
newline. The moment non-whitespace follows an already-complete document, that
document stops being "as-is complete and valid" — `complete` becomes `false`,
permanently, the same as any other genuinely invalid input (see above). What
it does **not** do is take the value with it:

````ts
import { createJsonMender } from 'mend-json';

const mender = createJsonMender();
mender.push('{"name":"Ivan","ok":true}');
const r = mender.push('\n```'); // the model keeps talking / closes a fence

r.value; // { name: 'Ivan', ok: true } — still there
r.complete; // false — trailing content followed a complete document
r.diagnostics.map((d) => d.code); // [ 'trailing-data-ignored' ]
````

Pushing further trailing chunks after this point doesn't move
`validPrefixLength` or touch the value again — the mender is frozen at the
last valid prefix and stays there, including through `finish()`. This is the
same guarantee as "repair touches only the unfinished suffix" above, applied
to the specific case where the "unfinished suffix" turns out to be nothing at
all.

**`complete` is a statement about the value, not a promise about the
future.** The example above freezes because _scanned content_ proved the
document wasn't standalone — that's why `complete` goes to `false` with a
`'trailing-data-ignored'` diagnostic explaining it. Hitting `maxBufferBytes`
(see [Errors](#errors)) is different: the cap rejects a chunk _before_
looking at it, so if the document was already complete at that point,
nothing was ever found to roll back — `complete` **stays `true`**, with no
diagnostic, because none is warranted:

```ts
import { createJsonMender } from 'mend-json';

const mender = createJsonMender({ maxBufferBytes: 10 });
mender.push('{"a":1}'); // complete: true
try {
  mender.push('xxxx'); // over the cap — throws, freezes the mender
} catch {
  /* JsonMendLimitError */
}

mender.snapshot().value; // { a: 1 } — still there
mender.snapshot().complete; // true — nothing was ever rolled back
mender.snapshot().diagnostics; // []
```

A `MAX_DEPTH_EXCEEDED` or duplicate-key (`duplicateKeyPolicy: 'error'`)
freeze can never land on an already-complete document — both are only ever
raised while a structure is still open — so they always report
`complete: false`, unaffected by this distinction. `snapshot()` and
`finish()` agree on `complete` for every freeze reason above; the one
pre-existing exception is a root **number** under the default `'omit'`
policy, where `finish()` alone can complete an in-progress number at
end-of-stream (see "Incomplete scalars" above) — that divergence is
`isFinishing`'s documented behavior and has nothing to do with freezing; it
is identical with or without a `maxBufferBytes` freeze in play.

### UTF-8 byte chunks

`push()` accepts raw `Uint8Array` chunks — useful when forwarding bytes
straight off a socket or a `ReadableStream<Uint8Array>` without decoding them
yourself first. A chunk boundary can land mid multi-byte character; the
partial sequence is buffered and completed by whatever bytes arrive next.

```ts
import { createJsonMender } from 'mend-json';

const mender = createJsonMender();
mender.push(new Uint8Array([0x22, 0x61, 0xe2])); // '"a' + a truncated 3-byte lead
const result = mender.finish();
result.value; // 'a�' — the incomplete trailing byte resolves to U+FFFD, matching
// a real TextDecoder's final (non-streaming) decode — it is never silently dropped.
```

Two rules govern the boundary cases:

- **`finish()` flushes.** If a `Uint8Array` chunk left a partial sequence
  buffered when the stream ends, `finish()` resolves it to `U+FFFD` (the
  Unicode replacement character) rather than dropping it, exactly matching
  what a real `TextDecoder` does on a final decode.
- **`string` and `Uint8Array` chunks may be freely mixed**, in any order.
  If a `string` chunk arrives while bytes are still pending from an earlier
  `Uint8Array` chunk, the pending bytes are flushed to `U+FFFD` _before_ the
  string's own text is scanned — preserving the order chunks actually
  arrived in, instead of letting a byte sequence complete "across" an
  intervening string chunk and silently reorder the stream.

### Comparison with `JSON.parse` and permissive JSON parsers

- **`JSON.parse`** throws on anything not both complete and valid. `mend-json`
  is the layer in front of it for the "not complete yet" case specifically —
  it does not change what counts as valid JSON.
- **Permissive/JSON5-style parsers** accept a _wider_ grammar (comments,
  trailing commas, unquoted keys) so that already-complete-but-nonstandard
  documents parse. `mend-json` does the opposite: it accepts the same strict
  JSON grammar `JSON.parse` does, but tolerates the document being
  _incomplete_. The two problems look similar but aren't — a permissive
  parser doesn't help with a JSON string that stops mid-token, and this
  package doesn't help with a complete document that uses relaxed syntax.

## Runtime compatibility

Node 20+, Bun, and browsers — ESM and CommonJS both build from one source
(only what CI proves is claimed here). No `node:` imports; the UTF-8
streaming decoder uses the platform `TextDecoder` where available and falls
back to a manual, deterministic decoder otherwise.

## Performance

- Scanning is amortized O(n) across the whole stream: the state machine
  advances once per character, with O(1) work per character and no regular
  expression over the buffer, and it never rescans anything already scanned.
- **That guarantee is about scanning, not about reading a result.**
  Materializing `value`/`repairedJson` for a snapshot costs O(current valid
  prefix length) — unavoidable, since that's the size of the output — and is
  computed lazily and memoized per snapshot, so pushing many small chunks
  without reading every intermediate snapshot pays for scanning only. But a
  caller that _does_ read `.value` after every `push()` in order to render
  partial output pays that O(buffer) materialization cost on every chunk,
  which sums to O(n²) over a whole stream — the scanner staying O(n) doesn't
  make that read pattern free. Read `.value`/`repairedJson` when you need to
  render (e.g. on a UI animation frame, or every _k_ chunks), not
  unconditionally on every push. There is no cheap "did the value change
  since I last read it?" flag today; the safe assumption is that it may have.
- **A `duplicateKeyPolicy: 'first'` stream with many repeated keys does not
  give you an exception to the above.** Dropping duplicates keeps
  `value`/`repairedJson` small, but the bookkeeping that excludes them from
  the output is itself proportional to how many duplicates have been seen so
  far, so per-push reads over such a stream are still O(n²) overall — never
  worse than an equivalent-sized stream with no duplicates under the same
  read pattern (measured), but not a way around the advice above either.
- Closing-suffix generation is O(depth), never O(buffer size).
- `benchmarks/mend-json.bench.ts` (`pnpm run bench`) covers many tiny
  chunks, one large chunk, deep nesting, and a long string — including a
  10,000-tiny-chunk scenario specifically so a full-buffer rescan
  regression shows up as a benchmark regression, not just a support ticket.

## Security and privacy

- No telemetry, no network calls, no `eval` or dynamic code generation.
- `maxDepth` (default 1000) and `maxBufferBytes` (default 10 MB, counted in
  UTF-8 bytes even for `Uint8Array` chunks) bound the resources an unbounded
  or adversarial stream can consume; both throw `JsonMendLimitError` rather
  than silently truncating data. **`maxBufferBytes` bounds total input, not
  every internal structure derived from it** — retained duplicate-key
  diagnostics are bounded separately (next bullet), because a stream well
  under the buffer cap can still contain enough repeated keys to matter.
- Retained duplicate-key diagnostics (`'duplicate-key-skipped'`) are capped
  at 1,000 per mender regardless of `maxBufferBytes` or `includeDiagnostics`
  — see [Diagnostics](#diagnostics). The repair itself (dropping the
  duplicate from the parsed value) is never capped or skipped; only how many
  of those repairs get an individually-reported diagnostic entry is.
- The internal bookkeeping needed to _apply_ that repair
  (`excludedRanges`, one entry per dropped duplicate) is **not** capped the
  same way — it can't be without putting dropped duplicates back into
  `repairedJson`, which would be a correctness bug, not a memory saving. It
  is bounded only transitively, by `maxBufferBytes`: measured on this
  package's own duplicate-key benchmark, a ~2.19 MB `duplicateKeyPolicy:
'first'` stream of nothing but repeated keys retained roughly 15 MB of
  heap, scaling to roughly 66 MB at a stream sized to the default 10 MB
  `maxBufferBytes` cap. Tighten `maxBufferBytes` if this retained-memory
  profile matters for your deployment; see `limits.ts`'s
  `MAX_PERMANENT_DIAGNOSTICS` doc comment for the full measurement and
  reasoning.
- Hitting `maxBufferBytes` freezes the mender (`JsonMendLimitError`,
  `'MAX_BUFFER_BYTES_EXCEEDED'`) at the last prefix that was actually
  scanned — it never discards a character that a prior `snapshot()`/`push()`
  already returned to you. Getting the freeze boundary wrong here is
  dangerous precisely because it's easy to get subtly wrong: hitting the cap
  can otherwise become indistinguishable from data loss, with a complete
  value coming back `undefined`, or a root number coming back one digit
  short, on the very next call after the throw. See [Errors](#errors) for
  the frozen-mender contract this cap shares with `maxDepth` and
  `duplicateKeyPolicy: 'error'`.
- Diagnostic messages never include input content — only structural
  descriptions ("an open string ... was closed") and numeric offsets — so
  logging `diagnostics` doesn't leak stream content.

## Contributing

Issues and pull requests: see the repository's top-level `CONTRIBUTING`
guidance. `pnpm --filter mend-json run test` runs the suite;
`pnpm --filter mend-json run bench` runs the benchmarks.

## License

MIT
