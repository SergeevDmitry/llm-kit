/**
 * The stateful public API: `createJsonMender`. Wires the scanner
 * (`state-machine.ts`), the UTF-8 streaming decoder (`utf8-decoder.ts`), the
 * resource limits (`limits.ts`) and the snapshot builder (`repair-suffix.ts`)
 * together behind `push` / `snapshot` / `finish` / `reset`.
 */
import { advanceChar, createScannerState, freezeAt, type ScannerState } from './state-machine.js';
import { buildSnapshot } from './repair-suffix.js';
import { createUtf8Decoder, type StreamingUtf8Decoder } from './utf8-decoder.js';
import { JsonMendOptionsError } from './errors.js';
import {
  checkBufferBytes,
  DEFAULT_MAX_BUFFER_BYTES,
  DEFAULT_MAX_DEPTH,
  utf8ByteLength,
} from './limits.js';
import type {
  DuplicateKeyPolicy,
  IncompleteScalarPolicy,
  JsonMender,
  JsonMenderOptions,
  JsonMendResult,
} from './types.js';

interface ResolvedOptions {
  readonly maxDepth: number;
  readonly maxBufferBytes: number;
  readonly duplicateKeyPolicy: 'last' | 'first' | 'error';
  readonly incompleteScalarPolicy: 'omit' | 'best-effort';
  readonly includeDiagnostics: boolean;
}

const VALID_DUPLICATE_KEY_POLICIES: ReadonlySet<DuplicateKeyPolicy> = new Set([
  'last',
  'first',
  'error',
]);
const VALID_INCOMPLETE_SCALAR_POLICIES: ReadonlySet<IncompleteScalarPolicy> = new Set([
  'omit',
  'best-effort',
]);

/**
 * Renders an invalid option value for an error message without risking a
 * crash on a weird input (a symbol, a huge bigint, etc). `NaN`/`Infinity`
 * are special-cased — `JSON.stringify` renders both as `null`, which would
 * make the exact failure mode this validation exists to catch invisible in
 * its own error message.
 */
function describeInvalidValue(value: unknown): string {
  if (typeof value === 'number') {
    if (Number.isNaN(value)) return 'NaN';
    if (!Number.isFinite(value)) return value > 0 ? 'Infinity' : '-Infinity';
    return JSON.stringify(value);
  }
  if (typeof value === 'string' || typeof value === 'boolean') {
    return JSON.stringify(value);
  }
  return `a value of type ${typeof value}`;
}

/**
 * Requires `value` to be a finite integer `>= min`, throwing
 * {@link JsonMendOptionsError} otherwise.
 *
 * `maxDepth` and `maxBufferBytes` are the package's only hard resource
 * bounds, and any unbounded input needs a documented, configurable cap,
 * so a config-parsing mistake that produces `NaN` (compares false against
 * everything — no cap at all), `Infinity` (can never be exceeded), a
 * negative number, or a fraction must be rejected eagerly rather than
 * silently accepted and misbehaving on the first adversarial stream.
 */
function assertFiniteIntegerAtLeast(
  value: unknown,
  name: string,
  min: number,
): asserts value is number {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    !Number.isInteger(value) ||
    value < min
  ) {
    throw new JsonMendOptionsError(
      `options.${name} must be an integer >= ${String(min)}, got ${describeInvalidValue(value)}`,
    );
  }
}

function resolveOptions(options: JsonMenderOptions | undefined): ResolvedOptions {
  const maxDepth = options?.maxDepth ?? DEFAULT_MAX_DEPTH;
  // 0 is legal: it means "no object/array is ever allowed — root scalars
  // only", a stricter (never weaker) cap than any positive depth, so there
  // is no safety reason to forbid it.
  assertFiniteIntegerAtLeast(maxDepth, 'maxDepth', 0);

  const maxBufferBytes = options?.maxBufferBytes ?? DEFAULT_MAX_BUFFER_BYTES;
  // 0 is *not* legal: unlike `maxDepth: 0`, a zero-byte budget can never
  // accept a single byte of real content (see `checkBufferBytes`), so it
  // isn't a stricter-but-usable cap — it's a mender that can never do
  // anything, indistinguishable from a caller mistake, and rejecting it
  // catches that mistake at construction instead of on the first push.
  assertFiniteIntegerAtLeast(maxBufferBytes, 'maxBufferBytes', 1);

  const duplicateKeyPolicy = options?.duplicateKeyPolicy ?? 'last';
  if (!VALID_DUPLICATE_KEY_POLICIES.has(duplicateKeyPolicy)) {
    throw new JsonMendOptionsError(
      `options.duplicateKeyPolicy must be one of "last" | "first" | "error", got ${describeInvalidValue(duplicateKeyPolicy)}`,
    );
  }

  const incompleteScalarPolicy = options?.incompleteScalarPolicy ?? 'omit';
  if (!VALID_INCOMPLETE_SCALAR_POLICIES.has(incompleteScalarPolicy)) {
    throw new JsonMendOptionsError(
      `options.incompleteScalarPolicy must be one of "omit" | "best-effort", got ${describeInvalidValue(incompleteScalarPolicy)}`,
    );
  }

  return {
    maxDepth,
    maxBufferBytes,
    duplicateKeyPolicy,
    incompleteScalarPolicy,
    includeDiagnostics: options?.includeDiagnostics ?? true,
  };
}

export function createJsonMender<T = unknown>(options?: JsonMenderOptions): JsonMender<T> {
  const resolved = resolveOptions(options);

  let buffer = '';
  let state: ScannerState = createScannerState();
  let totalBytes = 0;
  let utf8Decoder: StreamingUtf8Decoder = createUtf8Decoder();
  // `true` only when the most recent chunk was `Uint8Array` and might have
  // left a partial multi-byte sequence buffered inside `utf8Decoder`. Read
  // by `flushPendingBytes` so the common all-string and all-bytes streaming
  // paths never pay for a `finish()` call that can only ever return `''`.
  let lastChunkWasBytes = false;

  function scanText(text: string): void {
    // `advanceChar` can throw synchronously mid-chunk: `JsonMendLimitError`
    // from `beginValue` the instant `maxDepth` would be exceeded, or
    // `JsonMendDuplicateKeyError` from deep inside `advanceWaiting` when
    // `duplicateKeyPolicy: 'error'` sees a repeat. Neither sets
    // `state.errored` on its own — unlike `fail()`, which freezes the
    // scanner and stops the loop on its very next character. Left
    // unfrozen, the mender stays "live": a later `push()` would resume
    // advancing `state.pos` from wherever the throw stopped it, while
    // `buffer` already contains the rest of *this* chunk (appended below,
    // unconditionally, so it stays in sync with however far `state.pos`
    // actually got) — from then on every snapshot slices `buffer` at a
    // stale offset.
    //
    // The fix is to freeze on *any* thrown error the same way `fail()`
    // freezes on an ordinary syntax error: this reuses the exact same
    // `errorPos` bookkeeping, passed explicitly as `state.pos - 1` (not via
    // `fail()`'s default — see `freezeAt`'s doc comment for why this file
    // never relies on that default) because `state.pos` is already one past
    // the character being processed when the throw happened, `advanceChar`
    // having incremented it before dispatching. Then rethrow so the caller
    // still observes the original error. Once frozen, the trailing
    // characters appended to `buffer` below — whether from this chunk or
    // any later one — provably sit past every offset a frozen scanner will
    // ever reference (see `repair-suffix.ts`'s `errorPos` clamp), so
    // appending the whole chunk unconditionally is safe and keeps this
    // function simple.
    try {
      for (let i = 0; i < text.length; i += 1) {
        if (state.errored) break; // frozen: no further structural progress possible or useful
        advanceChar(state, text[i] as string, resolved.maxDepth, resolved.duplicateKeyPolicy);
      }
    } catch (error) {
      freezeAt(state, (error as Error).message, state.pos - 1);
      throw error;
    } finally {
      buffer += text;
    }
  }

  /**
   * Resolves whatever partial UTF-8 sequence is currently buffered inside
   * `utf8Decoder` into the stream, before it is safe to switch away from
   * decoding bytes — either because a string chunk arrived next, or because
   * the caller declared the stream done. Without this, either transition
   * would lose the pending bytes: `finish()` calling `buildSnapshot`
   * directly never asked the decoder about them, and a string chunk
   * arriving next was scanned as-is with the decoder never consulted, so
   * the pending bytes' `U+FFFD` would surface *after* the string chunk's
   * own text instead of before it — reordering the logical stream.
   *
   * Flushing — not rejecting mixed `push(string)` / `push(Uint8Array)` input
   * — is the fix: `push`'s type is documented to accept either form (README),
   * so turning a mix into a thrown error would break a documented API to fix
   * a bug. Flushing keeps logical stream order intact instead: the pending
   * bytes are resolved (to `U+FFFD` if incomplete) *before* whatever arrives
   * next, exactly where they belong.
   */
  function flushPendingBytes(): void {
    if (!lastChunkWasBytes) return;
    lastChunkWasBytes = false;
    const flushed = utf8Decoder.finish();
    if (flushed.length > 0) {
      scanText(flushed);
    }
  }

  function push(chunk: string | Uint8Array): JsonMendResult<T> {
    const chunkBytes = typeof chunk === 'string' ? utf8ByteLength(chunk) : chunk.byteLength;
    try {
      checkBufferBytes(totalBytes + chunkBytes, resolved.maxBufferBytes);
    } catch (error) {
      // `MAX_BUFFER_BYTES_EXCEEDED` is checked before any decoding or
      // scanning happens, so it can never desynchronize `buffer` from
      // `state.pos` the way a mid-scan throw could — but freezing here
      // anyway (rather than leaving this one `JsonMendLimitError` code
      // silently resumable) keeps the contract uniform and simple to state
      // and test: *every* `JsonMendLimitError` and `JsonMendDuplicateKeyError`
      // thrown out of `push()` freezes the mender; see the README's
      // "Errors" section and `reset()`.
      //
      // The boundary passed here is `state.pos`, deliberately *not*
      // `fail()`'s `state.pos - 1` default: this catch runs before any
      // character of the rejected chunk has been decoded or scanned, so
      // `state.pos` already *is* the end of the last well-formed prefix —
      // nothing "offending" was consumed to subtract past. The default
      // would silently discard the last already-committed character of the
      // previous snapshot (an object/array/root value could even lose its
      // entire value, since `repair-suffix.ts`'s `'after-value'` branch
      // reports `sliceEnd: state.pos` and the wrong boundary lands one
      // short of it). See `freezeAt`'s doc comment in `state-machine.ts`
      // for the full invariant.
      freezeAt(state, (error as Error).message, state.pos);
      throw error;
    }
    totalBytes += chunkBytes;

    if (typeof chunk === 'string') {
      flushPendingBytes();
      if (chunk.length > 0) {
        scanText(chunk);
      }
    } else {
      const text = utf8Decoder.decode(chunk);
      lastChunkWasBytes = true;
      if (text.length > 0) {
        scanText(text);
      }
    }
    return snapshot();
  }

  function snapshot(): JsonMendResult<T> {
    return buildSnapshot<T>(
      buffer,
      state,
      resolved.incompleteScalarPolicy,
      resolved.includeDiagnostics,
      false,
    );
  }

  function finish(): JsonMendResult<T> {
    // Flush before building the final snapshot: a truncated byte stream's
    // trailing partial sequence must resolve to `U+FFFD` here (matching a
    // non-streaming/final `TextDecoder.decode()`) rather than vanish.
    // `push()` can still be called again after `finish()` (nothing in this
    // API forbids it, and the scanner state isn't otherwise mutated); the
    // decoder is left freshly reset by `flushPendingBytes`, so a subsequent
    // byte chunk starts a clean new sequence instead of resuming a
    // half-flushed one.
    flushPendingBytes();
    return buildSnapshot<T>(
      buffer,
      state,
      resolved.incompleteScalarPolicy,
      resolved.includeDiagnostics,
      true,
    );
  }

  function reset(): void {
    buffer = '';
    state = createScannerState();
    totalBytes = 0;
    utf8Decoder = createUtf8Decoder();
    lastChunkWasBytes = false;
  }

  return { push, snapshot, finish, reset };
}
