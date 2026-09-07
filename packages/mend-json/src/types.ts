/**
 * Public types for `mend-json`.
 *
 * These shapes are the package's entire contract: `JsonMender` is the
 * stateful, chunk-at-a-time API; `mendJson` (in `index.ts`) is the one-shot
 * convenience wrapper built on top of it.
 */

/** How to resolve an object key that repeats within the same object frame. */
export type DuplicateKeyPolicy = 'last' | 'first' | 'error';

/**
 * What to do with a number or literal (`true`/`false`/`null`) that is still
 * open when a snapshot is requested.
 *
 * - `'omit'` (default): drop the whole member/element the scalar belongs to.
 *   Conservative — nothing is guessed.
 * - `'best-effort'`: keep as much as can be stated without inventing
 *   anything — a literal is completed only when the partial text is an
 *   unambiguous prefix of exactly one literal (`"tru"` -> `true`), and a
 *   number is truncated back to its last syntactically complete sub-state
 *   (`"3.1e"` -> `3.1`), never padded with invented digits.
 */
export type IncompleteScalarPolicy = 'omit' | 'best-effort';

export interface JsonMenderOptions {
  /**
   * Maximum structural nesting depth (object/array frames). Exceeding it
   * throws {@link JsonMendLimitError} with code `MAX_DEPTH_EXCEEDED`.
   * Default: 1000.
   *
   * Validated eagerly, at construction, before any input is accepted: must
   * be a finite integer `>= 0`. `0` is legal and means "no object/array is
   * ever allowed — root scalars only". Anything else non-conforming
   * (`NaN`, `Infinity`, a negative number, a fraction, or a non-number)
   * throws {@link JsonMendOptionsError} with code `INVALID_OPTIONS` — a cap
   * that can silently be switched off (which `NaN`/`Infinity` would do) is
   * not a cap.
   */
  maxDepth?: number;
  /**
   * Maximum cumulative input size, in UTF-8 bytes, across the lifetime of a
   * mender (until `reset()`). Exceeding it throws
   * {@link JsonMendLimitError} with code `MAX_BUFFER_BYTES_EXCEEDED`.
   * Default: 10,000,000 (10 MB).
   *
   * Validated eagerly, at construction, before any input is accepted: must
   * be a finite integer `>= 1` (`0` is rejected — it could never accept a
   * single byte of real content, so it's treated as a caller mistake rather
   * than a usable, if extreme, cap). Anything else non-conforming (`NaN`,
   * `Infinity`, a negative number, a fraction, or a non-number) throws
   * {@link JsonMendOptionsError} with code `INVALID_OPTIONS`.
   */
  maxBufferBytes?: number;
  /**
   * How to resolve a repeated object key. Default: `'last'`. A value outside
   * `'last' | 'first' | 'error'` throws {@link JsonMendOptionsError} with
   * code `INVALID_OPTIONS` at construction.
   */
  duplicateKeyPolicy?: DuplicateKeyPolicy;
  /**
   * How to treat a scalar still open at snapshot time. Default: `'omit'`. A
   * value outside `'omit' | 'best-effort'` throws
   * {@link JsonMendOptionsError} with code `INVALID_OPTIONS` at
   * construction.
   */
  incompleteScalarPolicy?: IncompleteScalarPolicy;
  /**
   * Whether repair actions are recorded into `diagnostics`. Disable in hot
   * loops that never inspect diagnostics to skip the (small) bookkeeping
   * cost. Default: `true`.
   */
  includeDiagnostics?: boolean;
}

/** One repair action taken while building a snapshot's `repairedJson`. */
export interface JsonMendDiagnostic {
  /** Stable, documented code — see the "Diagnostics" section of the README. */
  readonly code:
    | 'string-closed'
    | 'escape-truncated'
    | 'scalar-omitted'
    | 'scalar-completed'
    | 'number-truncated'
    | 'member-removed'
    | 'closers-appended'
    | 'duplicate-key-skipped'
    | 'trailing-data-ignored'
    | 'diagnostics-truncated';
  /** Human-readable explanation, safe to log — never contains input content. */
  readonly message: string;
  /** Offset (UTF-16 code units) into the accumulated input the action relates to. */
  readonly offset: number;
}

/**
 * What kind of thing the scanner is part-way through at snapshot time.
 *
 * - `'string'` / `'number'` / `'literal'`: a scalar value whose text is
 *   still arriving, so the value at `path` may still grow or change.
 * - `'key'`: an object key still being read; `path` locates the object it
 *   belongs to, since the key itself is not known yet.
 * - `'member'`: a key was read but its value has not started arriving.
 */
export type JsonMendPendingKind = 'string' | 'number' | 'literal' | 'key' | 'member';

/** Where in the document the scanner currently is. See {@link JsonMendResult.pending}. */
export interface JsonMendPending {
  /**
   * Object keys and array indexes from the root down to the pending thing,
   * usable as-is for a lookup into `value` (empty at the root).
   */
  readonly path: readonly (string | number)[];
  readonly kind: JsonMendPendingKind;
}

export interface JsonMendResult<T = unknown> {
  /** The best-effort parsed value, or `undefined` if nothing parseable has arrived yet. */
  readonly value: T | undefined;
  /**
   * A JSON string that `JSON.parse` accepts, or `undefined` alongside
   * `value: undefined`. This is the headline invariant: whenever `value` is
   * defined, `repairedJson` is defined and `JSON.parse(repairedJson)`
   * succeeds.
   */
  readonly repairedJson: string | undefined;
  /**
   * `true` only when the raw input received so far is, as-is, a complete and
   * valid JSON document — no repair was applied. `finish()` is the only call
   * that can turn a merely-open number into a complete one (end of input is
   * itself a valid number terminator); it never reinterprets a genuinely
   * invalid completed document as valid.
   */
  readonly complete: boolean;
  /** Count of input characters (UTF-16 code units) that contributed to this snapshot's valid prefix. */
  readonly validPrefixLength: number;
  /**
   * The literal closing text appended after `validPrefixLength` to make
   * `repairedJson` parseable. Together with {@link removedRanges} this
   * states an identity a caller slicing the raw buffer themselves can rely
   * on: `input.slice(0, validPrefixLength)`, with every range in
   * `removedRanges` cut out, followed by `appendedSuffix`, is exactly
   * `repairedJson`.
   */
  readonly appendedSuffix: string;
  /**
   * Half-open `[start, end)` ranges of the input that `repairedJson` leaves
   * out from *inside* `validPrefixLength`, sorted and non-overlapping.
   *
   * Only `duplicateKeyPolicy: 'first'` produces any: a repeated member is
   * scanned normally, to keep nesting correct, and then cut. Empty for every
   * other repair, where truncating at `validPrefixLength` is the whole
   * story. A caller rendering incrementally from its own buffer slice needs
   * these, or it will show a member this package reports as dropped.
   */
  readonly removedRanges: readonly (readonly [number, number])[];
  /** Every repair action that produced this snapshot, oldest first. Always JSON-serializable. */
  readonly diagnostics: readonly JsonMendDiagnostic[];
  /**
   * Which part of the document is still incomplete, or `undefined` when
   * nothing is: the snapshot is `complete`, the scanner froze on invalid
   * input (nothing more will ever arrive), or no value has started yet.
   *
   * `complete` answers "is it done?"; this answers "which part isn't?", so
   * a UI can put the cursor on the field still streaming, and a caller can
   * hold off on that one field without waiting for the whole document. The
   * value at `path` is present in `value` whenever the policy kept it, but
   * is not final.
   */
  readonly pending?: JsonMendPending;
}

/** Options for {@link mendStream}: every {@link JsonMenderOptions}, plus cancellation. */
export interface MendStreamOptions extends JsonMenderOptions {
  /**
   * Checked before consuming the source and again after each chunk it
   * yields. An already-aborted signal (or one that fires between chunks)
   * makes `mendStream` throw the signal's abort reason, unchanged when it is
   * an `Error`, or a `DOMException` named `"AbortError"` otherwise (the same
   * normalization `llm-backoff` uses, for a consistent abort shape across
   * this repo's packages) — never a `mend-json`-specific error type.
   *
   * This does not interrupt a source that is already mid-wait for its next
   * chunk (e.g. blocked on a slow network read with nothing arriving) —
   * only the two checkpoints above run. If the source itself reacts to
   * `signal` (a `fetch` response body given the same `AbortSignal`, for
   * instance), aborting it there interrupts that wait too; `mendStream`'s
   * own check is what still catches a source that never reacts to the
   * signal at all.
   */
  readonly signal?: AbortSignal;
}

export interface JsonMender<T = unknown> {
  /**
   * Feeds one more chunk of input (text, or raw UTF-8 bytes) and returns the
   * resulting snapshot. `string` and `Uint8Array` chunks may be freely
   * mixed within the same stream. A `Uint8Array` chunk may end mid-multi-byte
   * character; that partial sequence is buffered and completed by a later
   * chunk. If the *next* chunk is a `string` instead of more bytes, the
   * partial sequence is resolved first (to `U+FFFD` if it never completes)
   * so it lands in the output *before* that string's own text, preserving
   * the order bytes actually arrived in — see the README's "UTF-8 byte
   * chunks" section.
   */
  push(chunk: string | Uint8Array): JsonMendResult<T>;
  /** Returns the current snapshot without consuming more input. */
  snapshot(): JsonMendResult<T>;
  /**
   * Declares that no more input will arrive and returns the final snapshot.
   * If a `Uint8Array` chunk left a partial multi-byte sequence buffered,
   * `finish()` resolves it to `U+FFFD` first (matching a non-streaming/final
   * `TextDecoder.decode()`) rather than silently dropping it.
   */
  finish(): JsonMendResult<T>;
  /** Discards all state, as if the mender had just been created. */
  reset(): void;
}
