# vec-cache

SQLite-backed embedding cache with partial batch hits, in-batch deduplication and model-scoped keys.

[![npm](https://img.shields.io/npm/v/vec-cache.svg)](https://www.npmjs.com/package/vec-cache)
[![CI](https://github.com/SergeevDmitry/llm-kit/actions/workflows/ci.yml/badge.svg)](https://github.com/SergeevDmitry/llm-kit/actions/workflows/ci.yml)
[![dependencies](https://img.shields.io/badge/dependencies-1-blue)](https://www.npmjs.com/package/vec-cache?activeTab=dependencies)

## The problem

Embedding batches are almost always mostly cache hits — a document set gets
re-embedded because 60 chunks changed, not because all 1,000 did. Most
caching approaches are all-or-nothing: one miss anywhere in the batch and the
whole thing goes back to the API, or the cache key ignores the model and
silently hands back a `text-embedding-3-small` vector to code that thinks
it's `text-embedding-3-large`.

## Before / after

```ts no-check
// Before: one miss sends the whole 1,000-text batch back to the API —
// including the 940 that were already embedded yesterday.
async function embedBefore(texts: string[]): Promise<number[][]> {
  const cached = await readFromSomewhere(texts); // all-or-nothing: any miss -> undefined
  if (cached) return cached;
  return callEmbeddingProvider(texts); // pays for and waits on all 1,000, every time
}
```

```ts
import { VectorCache } from 'vec-cache';

// After: only the 60 genuinely new texts are sent, and every position —
// hit or miss — comes back in exact original order.
const cache = new VectorCache({ path: './cache.sqlite' });

const texts: string[] = [/* 1,000 texts, 940 already embedded, 60 new */];
const result = await cache.getOrCreate(texts, {
  model: 'text-embedding-3-small',
  embed: (request) => callEmbeddingProvider(request.texts), // called with 60 unique texts, once
});

console.log(result.report);
// { totalCount: 1000, hitCount: 940, missCount: 60, uniqueMissCount: 60, embedCallCount: 1, elapsedMs: ... }

declare function callEmbeddingProvider(texts: readonly string[]): Promise<Float32Array[]>;
```

## Install

```text
npm install vec-cache
```

**Native dependency.** `vec-cache` depends on
[`better-sqlite3`](https://www.npmjs.com/package/better-sqlite3) — the _only_
runtime dependency permitted anywhere in this monorepo. It ships prebuilt binaries for common
platform/Node combinations; if `npm install` tries to compile from source, see
[Native install troubleshooting](#native-install-troubleshooting) below.
`vec-cache` is **Node-only** — no browser build is promised.

## Minimal usage

```ts
import { VectorCache } from 'vec-cache';

const cache = new VectorCache({ path: './cache.sqlite' });

const result = await cache.getOrCreate(['hello world', 'goodbye world'], {
  model: 'text-embedding-3-small',
  embed: (request) => callEmbeddingProvider(request.texts),
});

result.embeddings; // one vector per input text, same order
cache.close();

declare function callEmbeddingProvider(texts: readonly string[]): Promise<Float32Array[]>;
```

## Key guarantees

- **Output index `i` always corresponds to input index `i`.** Hits, misses,
  duplicates, and any mix of the three — position is preserved exactly.
  Property-tested with seeded `fast-check` runs over random batches with
  deliberate duplicates and a random pre-seeded hit ratio
  (`test/property.test.ts`).
- **Cache identity is `schema-version + namespace + model-id + exact text
bytes`**, SHA-256 via `node:crypto`, optionally scoped by a requested
  **`dimensions`** value too (see
  [Dimensionality is part of identity](#dimensionality-is-part-of-identity)).
  The same text under two different `model` values, or two different
  `namespace` values, is two independent entries — never mixed
  (`test/get-or-create.test.ts`, "isolates identical text across
  models/namespaces").
- **Text is never normalized.** No trimming, no Unicode normalization, no
  line-ending changes — any of those can change what a real embedding model
  produces. `"a"`, `"a "` and `"a\n"` are three distinct cache entries.
- **Plaintext storage is off by default.** The database holds a hash and a
  vector unless `storeText: true` is set.
- **A full-hit batch never calls `embed`.** If every text is already cached,
  `embed` is not invoked — not even with an empty array.
- **Duplicate texts inside one batch are embedded once.** `embed` receives
  each unique miss exactly once, in deterministic (first-occurrence) order.
- **A wrong callback result count or a dimension mismatch each throw a
  stable, distinct, documented error code** — never a guessed mapping on
  partial failure.
- **Decoded vectors are freshly allocated.** Mutating a vector `getOrCreate`
  or `getMany` returned to you cannot corrupt what a later read decodes from
  the cache, even for a duplicate text that appears at two positions in the
  same result.
- **In-process concurrent requests for the same key are coalesced.** Ten
  concurrent `getOrCreate` calls asking for the same missing text result in
  exactly one `embed` call, not ten. See
  [Concurrency](#concurrency) for what this does _not_ cover.
- **No telemetry, no hidden network calls.**

## API

### `new VectorCache(options: VectorCacheOptions)`

```ts no-check
interface VectorCacheOptions {
  path: string; // SQLite file path, created if missing
  namespace?: string; // default: "default"
  busyTimeoutMs?: number; // default: 5000
  ttlMs?: number; // default: entries never expire
  storeText?: boolean; // default: false
  vectorEncoding?: 'float32' | 'float64'; // default: 'float32'
}
```

`busyTimeoutMs` and `ttlMs` — here and anywhere else they can be set
(`GetOrCreateOptions.ttlMs`, `CacheWriteEntry.ttlMs`, `PruneOptions.olderThanMs`
below) — must be a finite, non-negative safe integer when provided; anything
else (negative, `NaN`, `Infinity`, fractional, or a non-number) throws
`INVALID_INPUT` before the value reaches SQL or arithmetic, rather than
silently misbehaving (an unvalidated negative `olderThanMs` would compute a
_future_ prune cutoff and delete every row; `better-sqlite3` binds a `NaN`
duration as SQL `NULL`, which would otherwise silently mean "never expires").
An
invalid `vectorEncoding` is rejected the same way, with a stable
`INVALID_INPUT` instead of a raw internal error.

### `getOrCreate(texts, options): Promise<CachedEmbeddingBatch>`

The main entry point — look up, embed only the misses, store, and return
everything in original order.

```ts
import { VectorCache } from 'vec-cache';

const cache = new VectorCache({ path: './cache.sqlite' });
const result = await cache.getOrCreate(['a', 'b', 'a'], {
  model: 'text-embedding-3-small',
  namespace: 'my-app', // optional override of the instance default
  embed: (request) => callEmbeddingProvider(request.texts), // called once, with ["a", "b"]
  ttlMs: 30 * 24 * 60 * 60 * 1000, // optional per-call TTL override
  signal: undefined, // optional AbortSignal
});
cache.close();

declare function callEmbeddingProvider(texts: readonly string[]): Promise<Float32Array[]>;
```

**An aborted call can still write to the cache — and it can even still write
when the call that started the fetch is the one that aborted.** `signal`
cancels _your_ wait on `getOrCreate` promptly, but `vec-cache` never passes
any caller's `signal` into the underlying `embed` call it starts (see
`src/abort-utils.ts` and `src/batch/fetch-misses.ts`). That fetch keeps
running and its result is still persisted when it resolves, regardless of who
aborts and in what order:

- **The shared fetch is nobody's to cancel.** The call that happens to
  register first "owns" a missing key and starts the `embed` call, but at
  that moment it cannot know whether another concurrent `getOrCreate` call
  will join the same key a moment later. If that owner's own `signal` were
  forwarded into `embed`, the owner aborting would cancel the fetch out from
  under every other joiner too — including a joiner that supplied no `signal`
  at all and never asked to be cancelled. So no signal is ever forwarded:
  aborting only ever cancels _your own wait_ on the result, never the fetch
  itself.
- **Concretely:** if caller A starts the fetch with its own `signal` and
  caller B joins the same in-flight key with no `signal` at all, A aborting
  rejects only A's `getOrCreate` call. B still resolves normally, and the row
  A's fetch produced is still written — even though A is the one who
  triggered the fetch and A is the one who aborted.
- **Even if every caller waiting on a key aborts**, the fetch that key's
  owner started keeps running to completion and its result is still written.
  `vec-cache` does not track how many callers are still waiting, so there is
  no "last one out, turn off the lights" behavior in v1 — the work (and its
  cost, if `embed` calls a paid API) is simply spent regardless. If you need
  "never write after abort", check the abort state yourself before relying on
  a subsequent read, or wrap `embed` so it checks a signal you control before
  returning.

This is a deliberate contract choice, not an
oversight: the alternative — reference-counting joiners and cancelling the
shared fetch only once every caller has gone away — would stop the
"work continues after everyone gave up" cost above, at the price of real
state-tracking in the single-flight registry and a race between a joiner
arriving and the last one leaving in the same tick. `vec-cache` v1 takes the
simpler contract.

```ts no-check
// Reference shape.
type EmbeddingVector = readonly number[] | Float32Array | Float64Array;

interface EmbedBatchRequest {
  texts: readonly string[]; // unique misses only, deterministic order
  model: string;
  signal?: AbortSignal;
}
type EmbedBatch = (request: EmbedBatchRequest) => Promise<readonly EmbeddingVector[]>;

interface CachedEmbeddingBatch {
  embeddings: readonly EmbeddingVector[]; // same length/order as the input texts
  report: VectorCacheBatchReport;
}

interface VectorCacheBatchReport {
  totalCount: number;
  hitCount: number;
  missCount: number; // duplicates counted once per position
  uniqueMissCount: number; // distinct texts actually sent to embed
  embedCallCount: number; // 0 (full hit or fully coalesced) or 1 — never more
  elapsedMs: number;
}
```

### The callback contract

`embed` receives **only the unique misses**, in deterministic order, and must
return exactly one vector per text, in the same order. There is no partial
success: if the count is wrong, or the returned vectors don't share one
dimension, `vec-cache` throws rather than guess which result belongs to which
text.

```ts
import { VectorCache, VectorCacheError } from 'vec-cache';

const cache = new VectorCache({ path: './cache.sqlite' });
try {
  await cache.getOrCreate(['a', 'b', 'c'], {
    model: 'm',
    embed: async () => [new Float32Array([1, 2])], // wrong: 1 vector for 3 texts
  });
} catch (error) {
  if (error instanceof VectorCacheError) {
    error.code; // 'EMBED_RESULT_COUNT_MISMATCH'
  }
}
cache.close();
```

Error codes: `INVALID_INPUT`, `EMBED_RESULT_COUNT_MISMATCH`,
`EMBED_DIMENSION_MISMATCH`, `EMBED_RESULT_INVALID`,
`DIMENSION_IDENTITY_CONFLICT`, `STORE_CLOSED`, `STORE_OPEN_FAILED`,
`STORE_CORRUPT`, `SCHEMA_TOO_NEW`. Every `VectorCacheError` extends `Error`,
carries a stable `code`, and preserves the original `cause` when wrapping a
lower-level failure (a native SQLite error, for example).

`EMBED_RESULT_INVALID` is thrown when `embed` returns a vector containing a
`NaN`, `Infinity`, or non-numeric element — the same check `setMany` applies
to a caller-supplied vector (`INVALID_INPUT`), run here against the
callback's result instead, because a poisoned value would otherwise be
written to disk and served as a cache hit forever:

```ts
import { VectorCache, VectorCacheError } from 'vec-cache';

const cache = new VectorCache({ path: './cache.sqlite' });
try {
  await cache.getOrCreate(['a'], {
    model: 'm',
    embed: async () => [[1, Number.NaN, 3]], // a partially-failed provider batch, for example
  });
} catch (error) {
  if (error instanceof VectorCacheError) {
    error.code; // 'EMBED_RESULT_INVALID' — nothing was written
  }
}
cache.close();
```

`DIMENSION_IDENTITY_CONFLICT` is thrown when a cached hit and a freshly
embedded vector (or a vector received from a concurrently in-flight
single-flight-joined fetch) disagree on width within the same batch — see
[Dimensionality is part of identity](#dimensionality-is-part-of-identity)
for the full scenario and why this throws instead of silently re-embedding.

### `getMany(texts, options): CacheLookupResult`

A synchronous, read-only lookup — no `embed` callback exists on this method,
so it is structurally impossible for it to call one.

```ts
import { VectorCache } from 'vec-cache';

const cache = new VectorCache({ path: './cache.sqlite' });
const lookup = cache.getMany(['a', 'never-embedded'], { model: 'm' });
lookup.embeddings; // [Float32Array | undefined, Float32Array | undefined] — undefined at a miss
lookup.report; // { totalCount, hitCount, missCount, elapsedMs }
cache.close();
```

### `setMany(entries): void`

Write pre-computed embeddings directly — migrating from another cache, or
backfilling from a batch export.

```ts
import { VectorCache } from 'vec-cache';

const cache = new VectorCache({ path: './cache.sqlite' });
cache.setMany([
  { text: 'hello', model: 'text-embedding-3-small', embedding: new Float32Array(1536) },
]);
cache.close();
```

### `deleteMany(texts, options): number`

Removes specific entries by exact (namespace, model, text) identity. Returns
the number of rows actually deleted.

```ts
import { VectorCache } from 'vec-cache';

const cache = new VectorCache({ path: './cache.sqlite' });
const deleted = cache.deleteMany(['stale document'], { model: 'text-embedding-3-small' });
cache.close();
void deleted;
```

### `prune(options?): PruneReport` and TTL

```ts
import { VectorCache } from 'vec-cache';

const cache = new VectorCache({ path: './cache.sqlite', ttlMs: 90 * 24 * 60 * 60 * 1000 });
const report = cache.prune(); // removes every TTL-expired entry in this instance's own namespace
report.deletedCount;

// Also remove entries older than 30 days regardless of TTL, in one namespace:
cache.prune({ namespace: 'my-app', olderThanMs: 30 * 24 * 60 * 60 * 1000 });
cache.close();
```

A TTL-expired entry is treated as a miss by `getMany`/`getOrCreate` even
before `prune()` physically removes the row — `prune()` reclaims disk space,
it does not change lookup correctness.

`olderThanMs` must be a finite, non-negative safe integer when provided —
`prune()` throws `INVALID_INPUT` and deletes nothing otherwise. This is a
deliberately strict check: `prune()` is destructive, and
`createdBeforeMs = now() - olderThanMs` turns a negative `olderThanMs` into a
cutoff in the _future_ — every row in scope looks "older" than that and the
call deletes everything it can see. Validate any externally-sourced duration
(config, CLI args, environment variables) before passing it here.

**`prune()`'s namespace scope — see
[Namespace scoping for destructive operations](#namespace-scoping-for-destructive-operations)
below.**

### `stats(): VectorCacheStats`

```ts
import { VectorCache } from 'vec-cache';

const cache = new VectorCache({ path: './cache.sqlite', namespace: 'tenant-a' });
const stats = cache.stats();
stats.totalEntries; // counts every namespace in the file, not just 'tenant-a'
stats.totalBytes; // approximate — stored vector blobs only, whole file
stats.namespaces; // [{ namespace, modelId, count, bytes }, ...] — every namespace present
cache.close();
```

**`stats()` deliberately reports the whole database file, every namespace —
it does not scope to the instance's own namespace, unlike every other
method** (see
[Namespace scoping for destructive operations](#namespace-scoping-for-destructive-operations)
below, which names this exception explicitly). `stats()` takes no
`namespace` option at all. This is on purpose, not an oversight: the whole
point of `VectorCacheStats.namespaces` is the per-namespace breakdown, which
requires seeing every namespace to answer questions like "how big is this
file, and how is it split across tenants?" — exactly the operational
visibility a caller needs from the one instance it already has open, even
when that instance is scoped to one tenant. `stats()` is also read-only, so
it carries none of the "silently touches the wrong tenant's data" risk that
motivated scoping `prune()`/`clear()` to the instance namespace by default —
there is no equivalent safety argument for narrowing it.

### `clear(options?): number` and `close(): void`

```ts
import { VectorCache } from 'vec-cache';

const cache = new VectorCache({ path: './cache.sqlite' });
cache.clear({ namespace: 'stale-tenant' }); // clears just that namespace
cache.clear(); // clears this instance's own namespace ("default" here)
cache.clear({ allNamespaces: true }); // explicit escape hatch: wipes every namespace in the file
cache.close(); // always call this — see "Database lifecycle" below
```

**`clear()`'s namespace scope — see
[Namespace scoping for destructive operations](#namespace-scoping-for-destructive-operations)
below.**

## Advanced options and adapters

### Model-isolated and namespace-isolated keys

```ts
import { VectorCache } from 'vec-cache';

const cache = new VectorCache({ path: './cache.sqlite' });
await cache.getOrCreate(['same text'], { model: 'model-a', embed: fakeEmbed });
const result = await cache.getOrCreate(['same text'], { model: 'model-b', embed: fakeEmbed });
result.report.hitCount; // 0 — model-b has never embedded this text, even though model-a has

declare function fakeEmbed(request: { texts: readonly string[] }): Promise<Float32Array[]>;
```

Namespaces work the same way, either at construction (`new VectorCache({ ...,
namespace: 'tenant-a' })`) or per call (`getOrCreate(texts, { ..., namespace:
'tenant-a' })`), which overrides the instance default for that call only.
Use namespaces to isolate tenants, environments, or prompt-template versions
that should never share a cache entry even under the identical model and
text.

### Dimensionality is part of identity

Several current embedding providers accept a requested output width that the
`model` id alone does not capture — OpenAI's `dimensions` on
`text-embedding-3-*`, Gemini's `outputDimensionality`, Matryoshka-truncated
open models. Without a way to name that, indexing a corpus at 1536 dimensions
on Monday and switching to a 512-dimension truncation on Tuesday — same
`model` string both times — would silently mix widths in the cache.

Pass `dimensions` on `getOrCreate`/`getMany`/`setMany` to fold it into cache
identity, exactly like a different `model` value would:

```ts
import { VectorCache } from 'vec-cache';

const cache = new VectorCache({ path: './cache.sqlite' });
await cache.getOrCreate(['same text'], {
  model: 'text-embedding-3-small',
  dimensions: 1536,
  embed: (request) => callEmbeddingProvider(request.texts, 1536),
});
const result = await cache.getOrCreate(['same text'], {
  model: 'text-embedding-3-small',
  dimensions: 512,
  embed: (request) => callEmbeddingProvider(request.texts, 512),
});
result.report.hitCount; // 0 — 512 has never been requested for this text before

declare function callEmbeddingProvider(
  texts: readonly string[],
  dimensions: number,
): Promise<Float32Array[]>;
cache.close();
```

`dimensions` is optional and off by default — omitting it reproduces exactly
the cache key this package computed before this option existed, so existing
databases and call sites are unaffected.

The requested width is passed to your callback as `request.dimensions`, and
what the callback returns is checked against it: a batch of vectors at any
other width throws `EMBED_DIMENSION_MISMATCH` and writes nothing, rather than
storing a row keyed as one width and stored as another.

Independently of whether you pass `dimensions`, every lookup is defensive: if
a would-be hit's stored width disagrees with what the current call expects
(an explicit `dimensions` value, or — absent that — another hit already found
earlier in the same batch), it is treated as a miss and re-embedded rather
than returned at the wrong width, and the demotion is recorded in
`report.dimensionMismatches` (an array of
`{ cacheKey, expectedDimensions, actualDimensions }`, empty in the common
case). This is what protects databases that mixed widths before this option
existed, or callers who never opt into `dimensions` at all — it is a second,
independent layer under the identity change, not a replacement for it.

**A cached hit vs. a freshly embedded vector is a different case, and throws
instead.** The check above only compares hits against each other (or against
an explicit `dimensions` request) — it says nothing about what `embed` itself
returns. Without a further check, a batch could still mix a cached hit at one
width with a brand-new vector at another, silently, with no diagnostic:

```ts
import { VectorCache } from 'vec-cache';

const cache = new VectorCache({ path: './cache.sqlite' });
// Cached at width 4 (no `dimensions` option — today's default for every
// existing caller):
await cache.getOrCreate(['a', 'b'], {
  model: 'text-embedding-3-small',
  embed: async () => [
    [1, 2, 3, 4],
    [1, 2, 3, 4],
  ],
});

// Later, the same model/namespace but `embed` now returns width 2 for a
// new text in the same batch as the old, still-cached width-4 hits:
try {
  await cache.getOrCreate(['a', 'b', 'c'], {
    model: 'text-embedding-3-small',
    embed: async () => [[9, 9]], // width 2, for the sole miss "c"
  });
} catch (error) {
  error; // VectorCacheError, code 'DIMENSION_IDENTITY_CONFLICT' — nothing was written for "c"
}
cache.close();
```

`vec-cache` throws `DIMENSION_IDENTITY_CONFLICT` rather than demoting the
disagreeing side to a miss and silently re-embedding it: a hit/fresh-vector
width conflict means the corpus already has mixed widths under one cache key
(or `embed`'s output shape changed) — a configuration mistake, not a
stale-cache condition a silent re-embed would fix. The error names the
model, namespace, and both widths, and tells you how to resolve it: pass an
explicit `dimensions` option so each width gets its own cache key, use a
different `namespace`, or clear the stale entries
(`prune()`/`clear()`/`deleteMany()`) before retrying. This check runs twice —
once before anything is written (so a call that owns the conflicting
`embed` result never persists it), and once more after every single-flight-
joined vector resolves (so a concurrent caller whose own hits conflict with
a vector it only _joined_ from someone else's in-flight fetch also throws,
deterministically, even though it wrote nothing itself).

Single-flight coalescing means at most one `embed` call happens per missing
key: if two concurrent `getOrCreate` calls race on the _same_ missing text
with _different_ `embed` implementations, whichever call registers first
wins, and every joiner — including the loser, whose own `embed` is never
invoked — receives that call's result, output width included. This is
inherent to coalescing (see [Concurrency](#concurrency)) and is not something
`DIMENSION_IDENTITY_CONFLICT` changes; that error only fires when a joiner's
_own_ cache hits disagree with whatever it ends up receiving.

`deleteMany` does not accept `dimensions` — an entry written under an
explicit `dimensions` value has a key `deleteMany` cannot reconstruct from
`(namespace, model, text)` alone, so it will not be found there. Use a
dedicated `namespace` for anything you write with an explicit `dimensions`
and need to delete individually, or `clear({ namespace })` to remove an
entire namespace regardless of how its entries were keyed.

### Namespace scoping for destructive operations

Every method that touches data — `getOrCreate`, `getMany`, `setMany`,
`deleteMany`, `prune()` and `clear()` — resolves its `namespace` against the
instance's own default: the constructor's `namespace` option, or `"default"`.
A destructive call therefore stays inside the namespace the instance was
opened for, and reaching past it is something you ask for explicitly with
`allNamespaces: true`:

```ts
import { VectorCache } from 'vec-cache';

const cache = new VectorCache({ path: './cache.sqlite', namespace: 'tenant-a' });

cache.clear(); // clears only 'tenant-a'
cache.clear({ allNamespaces: true }); // explicit: clears every namespace in the file
cache.clear({ namespace: 'tenant-b' }); // clears a different namespace than the instance default

cache.prune(); // prunes only 'tenant-a'
cache.prune({ allNamespaces: true, olderThanMs: 30 * 24 * 60 * 60 * 1000 }); // every namespace, 30+ days old

cache.close();
```

Passing both `namespace` and `allNamespaces: true` on the same call throws
`INVALID_INPUT` — "restrict to this namespace" and "ignore namespace
entirely" cannot both be what you meant. `deleteMany` has no implicit
"everywhere" mode at all: it requires an explicit `(namespace, model, text)`
identity per entry.

**One deliberate, named exception: `stats()`.** It takes no `namespace`
option at all and always reports across the whole database file, every
namespace, because the per-namespace breakdown it
returns (`VectorCacheStats.namespaces`) is the entire point of the method —
scoping it to one namespace would make it unable to answer "how big is this
file, and how is it split across tenants?" from the one instance a caller
already has open. `stats()` is also read-only, so it carries none of the
"silently touches the wrong tenant's data" risk that motivated scoping
`prune()`/`clear()`. See the `stats()` section above for the full reasoning.

### Database lifecycle and `close()`

One `VectorCache` per SQLite file per process is the common pattern. Always
call `close()` when done — it checkpoints the WAL file back into the main
database (so a closed cache doesn't leave a stale, oversized `-wal` sidecar
behind) and releases the native file handle. Every method throws
`STORE_CLOSED` after `close()`, including a `getOrCreate` call that was
already awaiting `embed` when `close()` was called elsewhere in the process.

```ts
import { VectorCache } from 'vec-cache';

const cache = new VectorCache({ path: './cache.sqlite' });
try {
  await cache.getOrCreate(['a'], { model: 'm', embed: fakeEmbed });
} finally {
  cache.close();
}

declare function fakeEmbed(request: { texts: readonly string[] }): Promise<Float32Array[]>;
```

### `float64` vectors

```ts
import { VectorCache } from 'vec-cache';

const cache = new VectorCache({ path: './cache.sqlite', vectorEncoding: 'float64' });
cache.close();
```

`float32` (the default) halves storage size versus `float64` and matches the
precision most embedding providers actually return. Encoding, dimensions, and
byte layout (little-endian) are explicit and stored per row — never guessed
from context on read. **With the default `float32` encoding, a caller who
hands `getOrCreate`/`setMany` a `Float64Array` (or plain `number[]` double
values) gets back a `Float32Array` on the next read — a different concrete
type, narrowed to ~7 significant decimal digits (about 24 bits of mantissa,
versus 53 for `float64`).** Set `vectorEncoding: 'float64'` if you need the
returned type and precision to match what you stored.

**This is more than a precision loss at the extreme end of the range.** A
finite element whose magnitude exceeds float32's range (roughly `±3.4e38`)
does not just lose precision — it would silently become `Infinity` on write
and decode as `Infinity` forever after. `vec-cache` rejects it instead:
`getOrCreate`/`setMany` throw `INVALID_INPUT` (or `EMBED_RESULT_INVALID` for
an `embed` callback result) naming the offending index and telling you to
switch to `vectorEncoding: 'float64'`, rather than silently manufacturing a
non-finite value from a finite input. In practice this should never fire —
real embedding vectors are normalized to roughly `[-1, 1]` — but the package
already refuses a directly-supplied `NaN`/`Infinity`, so it refuses to
_create_ one on your behalf too.

## Concurrency

- One `VectorCache` instance serializes its own writes and coalesces
  in-process concurrent `getOrCreate` calls for the same missing key
  (single-flight, `src/single-flight.ts`) — ten concurrent calls asking for
  the same new text produce exactly one `embed` call.
- Single-flight coalescing is **per cache key, not per call**: two
  overlapping-but-different batches each own the keys nobody else has
  claimed yet, and share the fetch for whatever key they have in common.
- Coalescing means **at most one `embed` call per missing key.** If two
  concurrent calls race on the same missing text with _different_ `embed`
  implementations, whichever call registers first wins — every joiner
  receives that call's result (including its output width), and the loser's
  own `embed` is never invoked. If a joiner's own cache hits for other texts
  in its batch disagree in width with what it ends up receiving, it throws
  `DIMENSION_IDENTITY_CONFLICT` — see
  [Dimensionality is part of identity](#dimensionality-is-part-of-identity).
- SQLite handles cross-process locking (a `busy_timeout` pragma waits out a
  lock instead of failing immediately) and the `cache_key` primary key's
  upsert semantics prevent duplicate rows.
- **What this does _not_ cover:** two separate _processes_ pointed at the
  same database file are not coordinated by the single-flight registry above
  — that registry is in-memory, per process. If both processes are missing
  the same key at the same moment, **both may independently call their own
  `embed` and pay for it**; the database itself stays correct (no duplicate
  row — whichever write lands last wins, via upsert), but the redundant
  provider call is not prevented. Cross-process lease/dogpile prevention is
  explicitly out of scope for v1. If your workload has many processes
  racing on a cold cache, consider warming it from one process first, or
  fronting `embed` with your own distributed lock.
- `getMany`, `setMany`, and `deleteMany` are synchronous, single-round-trip
  SQLite calls — there is nothing to coalesce.

## Edge cases and limitations

- **Not a vector database.** No nearest-neighbour search, no similarity
  scoring, no indexing beyond exact-key lookup. `vec-cache` answers "have I
  embedded this exact text with this exact model before?", nothing else.
- An **empty input array** to `getOrCreate`/`getMany` returns immediately
  with an empty result — `embed` is never called.
- A **database created by a newer schema version** than the installed
  `vec-cache` refuses to open, throwing `SCHEMA_TOO_NEW`, rather than
  guessing how to read a layout it doesn't recognize. If the recorded
  `schema_version` isn't in canonical form — an unsigned decimal integer,
  optionally padded with whitespace, and nothing else — the error is
  `STORE_CORRUPT` instead: a different, more accurate refusal for "this
  isn't a version at all" than for "this is a version, but from the future".
  This is deliberately stricter than `Number()` coercion: an empty or
  blank value, hex (`"0x2"`), exponential notation (`"2e0"`), and negative
  numbers (`"-5"`) are all rejected rather than silently accepted as `0`,
  `2`, `2`, or a `fromVersion < 1` no-op respectively. No `vec-cache` release
  has ever written a `schema_version` value outside that canonical form, so
  this only refuses a file that is corrupt or was hand-edited.
- A **malformed or non-SQLite file** at `path` throws `STORE_OPEN_FAILED`
  with the original driver error as `cause`.
- **Pointing `path` at a file that isn't a `vec-cache` database is refused,
  not adopted.** Before writing anything, `vec-cache` checks whether the file
  is empty (safe to initialize) or already looks like one of its own
  databases (a `metadata` table it can read). A file that has other tables,
  or a `metadata` table it can't make sense of, throws `STORE_OPEN_FAILED`
  and is left byte-for-byte as it was found — a typo'd `path` cannot silently
  create a table in, or corrupt the read path of, some other application's
  database. This check only recognizes vec-cache's own schema shape; a
  coincidental foreign `metadata` table with matching `key`/`value` columns
  is not distinguishable from one of ours and will be treated as such.
- Batches far larger than SQLite's `IN (...)` parameter limit are handled
  transparently — lookups and deletes are chunked internally
  (`MAX_IN_CLAUSE_PARAMS`, currently 500 per statement) so a 100,000-entry
  batch still works, just as more round trips rather than one giant query.
- **`vec-cache` does not validate that the vectors you hand it (via
  `getOrCreate`'s `embed` or `setMany`) actually came from the `model` you
  named.** It trusts the caller's `model` string as the identity key; if you
  pass the wrong model name, you get confidently wrong isolation, not an
  error.
- A SHA-256 collision between two different `(namespace, model, text)`
  triples is treated as practically negligible, matching the standard
  cryptographic-hash-as-key assumption used throughout this monorepo.

## Runtime compatibility

**Node 20+ only** — no browser build is promised (`better-sqlite3` is a
native addon, and browser persistence is a non-goal for this package). ESM
and CommonJS both build from one source and are verified by
`scripts/validate-published-artifacts.ts`.

**Bun: not currently working.** Importing this package under Bun succeeds —
nothing opens a database until you construct a `VectorCache` — so an
import-only check would report a false pass. The repository's smoke test
therefore constructs a cache and runs a real `getOrCreate`, and under Bun 1.3.5
that fails:

```text
$ bun run scripts/bun-smoke.ts --include-native
  FAIL  vec-cache: imported under Bun but failed when exercised:
        VectorCacheError: failed to open vec-cache database
```

The underlying error from `better-sqlite3` is:

```text
error: 'better-sqlite3' is not yet supported in Bun.
Track the status in https://github.com/oven-sh/bun/issues/4290
In the meantime, you could try bun:sqlite which has a similar API.
 code: "ERR_DLOPEN_FAILED"
```

So, plainly: **`vec-cache` does not currently work under Bun.** Node 20+ is the
only runtime this package supports today. If Bun's native-module loading for `better-sqlite3` improves
(tracked upstream at the issue linked above), or a `bun:sqlite`-backed
`VectorCacheStore` implementation lands in this package, this section will be
updated to match — not before.

## Performance

- `getMany`/`getOrCreate`'s lookup issues a small, bounded number of chunked
  `IN (...)` queries — never one query per key — and prepared statements are
  cached and reused by chunk size across calls.
- `benchmarks/vec-cache.bench.ts` (`pnpm run bench`) covers cold miss, full
  hit, the headline 94%-hit scenario, a duplicate-heavy batch, and lookups
  against a 100,000-row database. Representative numbers from one local run
  (Node 24, synthetic in-process `embed`, so these measure `vec-cache`'s own
  overhead — key computation, planning, encode/decode, SQLite I/O — not a
  real provider's network latency):

  | scenario                                                  |    mean | ops/sec |
  | --------------------------------------------------------- | ------: | ------: |
  | cold miss (100 never-before-seen texts)                   | 32.6 ms |    30.7 |
  | full hit (100 already-cached texts, `embed` never called) |  1.6 ms |   636.9 |
  | **94% hit (1,000 texts, 940 cached, 60 fresh)**           | 63.8 ms |    15.7 |
  | duplicate-heavy (1,000 positions, 50 unique texts)        |  9.5 ms |   105.5 |
  | `getMany`, 1,000 keys against 100,000 rows                |  7.5 ms |   133.0 |
  | `stats()` over 100,000 rows                               | 60.9 ms |    16.4 |

  Run `pnpm --filter vec-cache run bench` yourself for numbers on your
  hardware — these are a baseline, not a guarantee.

- `setMany` writing an extreme number of rows in one call runs inside a
  single synchronous SQLite transaction and blocks the Node event loop for
  its duration — an accepted cost of the synchronous `better-sqlite3` API —
  so for very large one-shot backfills, consider calling `setMany` in
  chunks (the 100k-row benchmark seeds in 5,000-row chunks for this reason).

## Security and privacy

- **Hashed keys.** The cache key (`cache_key`, what `vec-cache` actually looks
  rows up by) is a SHA-256 digest of `schema-version + namespace + model-id +
exact text bytes`, plus the requested `dimensions` when the caller names
  one — the raw text is never used as the on-disk key, and the digest is
  bound to a specific namespace/model(/dimensions), not to the text alone.
- **Plaintext off by default.** Set `storeText: true` only if you have a
  reason to keep the original text alongside its vector; until then, the
  database holds hashes and a vector, nothing else.
- **`text_hash` is not a privacy boundary for short or predictable text.**
  Each row also stores `text_hash`, a separate, plain `SHA-256(text)` with no
  namespace, model, or salt folded in (kept for diagnostics/dedup tooling,
  distinct from `cache_key` above). For long or high-entropy text this is a
  one-way digest in practice. For a short or low-entropy input — a search
  query, a person's name, an enum value, a postcode — it is not: an attacker
  with read access to the database can dictionary-attack `text_hash` by
  hashing candidate strings and looking for a match, recovering the original
  text without ever breaking SHA-256. This is inherent to any unsalted hash
  of low-entropy input, not a defect in this package, and it is deliberately
  _not_ salted — cache identity must stay reproducible across processes and
  runs, which a per-row or per-install salt would break. If `text_hash`'s
  input could be sensitive and low-entropy, treat the database file itself as
  confidential (same file-permissions and backup discipline as the embeddings
  bullet below), rather than relying on the hash to protect it.
- **Treat embeddings as potentially sensitive.** A vector can, in principle,
  leak information about the text that produced it (inversion attacks
  against embedding models are an active research area). Apply the same file
  permissions and backup discipline to the SQLite file that you would to any
  other data-at-rest containing derived user content.
- **File permissions and backups are your responsibility.** `vec-cache`
  creates the SQLite file with the process's default `umask`; it does not
  change permissions or encrypt the file. Back up `path` (and, if present,
  its `-wal`/`-shm` sidecars) the same way you would any other SQLite
  database.
- **SQLite/WAL secure-deletion limits.** `deleteMany`/`clear`/`prune` remove
  rows logically; SQLite does not guarantee the underlying bytes are
  overwritten on disk (ordinary `DELETE` marks pages free for reuse, and WAL
  mode in particular can leave old versions of a page in the `-wal` file or
  in freed space in the main file until a checkpoint and, even then, without
  `PRAGMA secure_delete`). If you need cryptographic erasure guarantees
  (e.g. regulatory "right to be forgotten" compliance), do not rely on
  `deleteMany` alone — consider `PRAGMA secure_delete = ON` (a
  `better-sqlite3` `db.pragma()` call against your own file, at a write-speed
  cost) or destroying and recreating the database file entirely.
- **No telemetry, no hidden network calls.** `vec-cache` never calls out to
  anything on its own — the only network activity in your process is
  whatever your own `embed` callback does.

## Contributing

Issues and pull requests: see the repository's top-level `CONTRIBUTING`
guidance. `pnpm --filter vec-cache run test` runs the suite;
`pnpm --filter vec-cache run bench` runs the benchmarks.

## License

MIT
