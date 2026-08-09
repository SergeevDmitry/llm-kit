/**
 * Error types thrown by `mend-json`.
 *
 * Both extend `Error`, carry a stable `code`, and are documented and tested.
 * They represent policy violations and hard resource limits, not "incomplete
 * stream", which is a normal result state (`complete: false`), never an
 * exception.
 */

export type JsonMendLimitCode = 'MAX_DEPTH_EXCEEDED' | 'MAX_BUFFER_BYTES_EXCEEDED';

/** Thrown when a configured hard limit (`maxDepth` or `maxBufferBytes`) is exceeded. */
export class JsonMendLimitError extends Error {
  override readonly name = 'JsonMendLimitError';
  readonly code: JsonMendLimitCode;

  constructor(code: JsonMendLimitCode, message: string) {
    super(message);
    this.code = code;
  }
}

/** Thrown when `duplicateKeyPolicy: 'error'` and a repeated object key is scanned. */
export class JsonMendDuplicateKeyError extends Error {
  override readonly name = 'JsonMendDuplicateKeyError';
  readonly code = 'DUPLICATE_KEY';
  /** The repeated key. Object content, not secret material, so safe to include. */
  readonly key: string;

  constructor(key: string) {
    super(`duplicate object key ${JSON.stringify(key)} (duplicateKeyPolicy: "error")`);
    this.key = key;
  }
}

export type JsonMendOptionsErrorCode = 'INVALID_OPTIONS';

/**
 * Thrown synchronously, eagerly, out of `createJsonMender()` (or `mendJson()`)
 * when `JsonMenderOptions` fails validation — before any input is accepted.
 *
 * `maxDepth` and `maxBufferBytes` exist to bound resource consumption on an
 * adversarial or merely broken stream: any unbounded input needs a
 * documented, configurable cap. A non-finite, negative, or
 * fractional value for either one is not a smaller/larger cap — it silently
 * *removes* the cap (`NaN` and `-Infinity` compare false against everything;
 * `Infinity` can never be exceeded), so it is rejected here rather than
 * accepted and misbehaving later. `duplicateKeyPolicy` and
 * `incompleteScalarPolicy` are validated the same way: a value outside the
 * documented enum is a caller error, not a silent fallback to a default.
 */
export class JsonMendOptionsError extends Error {
  override readonly name = 'JsonMendOptionsError';
  readonly code: JsonMendOptionsErrorCode = 'INVALID_OPTIONS';

  constructor(message: string) {
    super(message);
  }
}
