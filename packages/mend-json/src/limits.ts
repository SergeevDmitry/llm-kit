/**
 * Hard resource limits. `mend-json` buffers input for the lifetime of a
 * mender, so both nesting depth and total bytes need a cap or a
 * malicious/broken stream could exhaust memory or blow the closing-suffix
 * generation past O(depth).
 */
import { JsonMendLimitError } from './errors.js';

/** Default maximum structural nesting depth. Generous for real tool-call payloads, cheap to raise. */
export const DEFAULT_MAX_DEPTH = 1000;

/** Default maximum cumulative input size, in UTF-8 bytes, across a mender's lifetime. */
export const DEFAULT_MAX_BUFFER_BYTES = 10_000_000;

/**
 * Maximum number of "permanent" diagnostics (currently: `duplicate-key-skipped`
 * entries, `state-machine.ts`'s `permanentDiagnostics`) retained for a
 * mender's lifetime. Unlike per-snapshot diagnostics — which `repair-suffix.ts`
 * derives fresh from `state.role` on every call and cost nothing to discard —
 * `permanentDiagnostics` is appended to once per skipped duplicate key and
 * kept forever, so under `duplicateKeyPolicy: 'first'` a stream of nothing
 * but repeated keys grows it linearly with input size, up to a million
 * entries at the default 10 MB `maxBufferBytes`. This cap bounds that array
 * directly rather than relying on however it happens to be consumed later.
 *
 * 1000 is generous for any real duplicate-key mistake a model actually makes
 * (re-emitting the same handful of keys a handful of times), while bounding
 * `permanentDiagnostics`'s own retained memory to a small constant
 * regardless of stream size: each entry is a fixed-shape object with one
 * short, static message string, on the order of a few hundred bytes in V8,
 * so 1000 of them is on the order of a few hundred KB whether the stream is
 * 1 MB or 10 GB. Once the cap is hit, `pushPermanentDiagnostic`
 * (`state-machine.ts`) records one `'diagnostics-truncated'` entry in its
 * place and stops appending — the duplicate-key repair itself (dropping the
 * member from `repairedJson` via `excludedRanges`) is unaffected and keeps
 * happening for every duplicate, capped or not; only the diagnostic record
 * of it stops being individually reported past this point. This is a
 * documented behavior change for a pathological stream: `diagnostics` for
 * such a stream is no longer a complete list of every duplicate-key repair,
 * only the first `MAX_PERMANENT_DIAGNOSTICS` of them plus the truncation
 * marker.
 *
 * What this constant does not bound: `state.excludedRanges`. It grows on
 * exactly the same trigger, one `[start, end)` pair per skipped duplicate
 * member (`state-machine.ts`'s `completeValue`), and has no cap of its own.
 * That is deliberate: unlike a diagnostic, which is purely informational,
 * `excludedRanges` is read on every `snapshot()`/`finish()` by
 * `repair-suffix.ts`'s `sliceWithExclusions` to decide which bytes of
 * `buffer` belong in `repairedJson`/`value` — truncating it would silently
 * put a dropped duplicate's text back into the output, a correctness bug
 * worse than the memory it would save. So `excludedRanges` is bounded only
 * transitively, by `maxBufferBytes` (it can never hold more entries than
 * there are members in a buffer of that size).
 *
 * Measured: a `duplicateKeyPolicy: 'first'` stream of `{"k":0,"k":1,...}`
 * totaling ~2.19 MB (209,330 duplicate members) retained roughly 15 MB of
 * heap after `mendJson` returned, with `includeDiagnostics: false` so
 * `permanentDiagnostics`'s own (capped) cost was not a factor — that
 * retention is `excludedRanges` (and the buffered input string itself). The
 * same measurement at `maxBufferBytes`'s default (10 MB, 919,191 duplicate
 * members) retained roughly 66 MB, confirming the growth stays roughly
 * linear in stream size and stays bounded once `maxBufferBytes` stops the
 * stream growing further. `hasExclusions` (`repair-suffix.ts`)
 * short-circuits with `.some()` over the merged ranges, so snapshot cost
 * does not blow up even while `excludedRanges` itself is large. If a future
 * change ever makes `excludedRanges` lookups scale worse than that
 * short-circuit, revisit this trade-off; until then, tightening
 * `maxBufferBytes` is the caller's lever for this, the same as it is for
 * every other buffer-proportional cost in this package.
 */
export const MAX_PERMANENT_DIAGNOSTICS = 1000;

export function checkBufferBytes(totalBytes: number, maxBufferBytes: number): void {
  if (totalBytes > maxBufferBytes) {
    throw new JsonMendLimitError(
      'MAX_BUFFER_BYTES_EXCEEDED',
      `buffered input ${String(totalBytes)} bytes exceeds maxBufferBytes ${String(maxBufferBytes)}`,
    );
  }
}

/**
 * UTF-8 byte length of `text`, used to charge `maxBufferBytes` for string
 * chunks the same way it is charged for `Uint8Array` chunks (whose `.length`
 * already is a byte count).
 *
 * A counting loop, not `new TextEncoder().encode(text).length` — `push()`
 * calls this on every string chunk, and materializing a `Uint8Array` purely
 * to read its `.length` doubles transient allocation on that hot path for
 * no benefit `text.length`'s code-point walk doesn't already give for free.
 * Measured at roughly 8-20x fewer
 * nanoseconds per call than the `TextEncoder` path for the small chunk
 * sizes a real stream sends (single characters up to a few dozen), because
 * `encode()`'s allocation cost dominates at that size; see
 * `benchmarks/mend-json.bench.ts`'s "many tiny chunks" scenarios, which
 * exercise exactly this path once per push.
 *
 * `for...of` walks by Unicode code point, so a surrogate *pair* is counted
 * once as its combined astral code point (4 bytes) — matching how
 * `TextEncoder` counts a valid pair. A *lone* surrogate is walked as its own
 * 16-bit unit; `codePointAt` on it returns the raw surrogate value, which
 * falls in `0x800`-`0xffff` and is therefore counted as 3 bytes — matching
 * `TextEncoder`, which substitutes a lone surrogate with U+FFFD (3 bytes) in
 * its UTF-8 output. Both cases are covered by `test/limits.test.ts`'s
 * property test against `TextEncoder`.
 */
export function utf8ByteLength(text: string): number {
  let bytes = 0;
  for (const char of text) {
    const codePoint = char.codePointAt(0) ?? 0;
    if (codePoint <= 0x7f) bytes += 1;
    else if (codePoint <= 0x7ff) bytes += 2;
    else if (codePoint <= 0xffff) bytes += 3;
    else bytes += 4;
  }
  return bytes;
}
