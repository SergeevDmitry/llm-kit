/**
 * Cheap synchronous input validation shared by every `VectorCache` method.
 * Every check throws {@link VectorCacheError} with code `INVALID_INPUT`
 * *before* any store or `embed` call — a bad call never partially executes.
 */
import { VectorCacheError } from './errors.js';
import type { EmbeddingVector, VectorEncoding } from './types.js';

/**
 * Largest finite value representable in IEEE 754 binary32:
 * `(2 - 2**-23) * 2**127`. A finite `number` beyond this magnitude does not
 * throw when narrowed to `float32` — `Buffer.writeFloatLE` rounds it to
 * `Infinity` silently — and decoding that blob later hands the caller back
 * an infinite value from an input that was finite on write.
 * `validateVector` rejects it up front instead, for the same
 * reason it already rejects `NaN`/`Infinity`: this package does not create
 * non-finite values it did not receive.
 */
export const FLOAT32_MAX_ABS = 3.4028234663852886e38;

export function validateModel(model: string): void {
  if (typeof model !== 'string' || model.length === 0) {
    throw new VectorCacheError('model must be a non-empty string', 'INVALID_INPUT');
  }
}

export function validateTexts(texts: readonly string[]): void {
  if (!Array.isArray(texts)) {
    throw new VectorCacheError('texts must be an array of strings', 'INVALID_INPUT');
  }
  for (let index = 0; index < texts.length; index += 1) {
    if (typeof texts[index] !== 'string') {
      throw new VectorCacheError(`texts[${String(index)}] must be a string`, 'INVALID_INPUT');
    }
  }
}

export function validateText(text: string): void {
  if (typeof text !== 'string') {
    throw new VectorCacheError('text must be a string', 'INVALID_INPUT');
  }
}

export function validateNamespaceOption(namespace: string | undefined): void {
  if (namespace !== undefined && (typeof namespace !== 'string' || namespace.length === 0)) {
    throw new VectorCacheError(
      'namespace must be a non-empty string when provided',
      'INVALID_INPUT',
    );
  }
}

/**
 * Every millisecond-duration option in this package (`ttlMs`,
 * `busyTimeoutMs`, `PruneOptions.olderThanMs`) is arithmetic input
 * (`nowMs + ttlMs`, `nowMs - olderThanMs`) or flows into a raw SQL pragma
 * string (`busyTimeoutMs`), never a value the store or codec bounds-check on
 * its own. An unvalidated negative `olderThanMs` computes a *future* prune
 * cutoff and deletes every row; `NaN`/`Infinity` are just as
 * dangerous in the other direction (a silent no-op, or — because
 * `better-sqlite3` binds `NaN` as SQL `NULL` — a "TTL" that silently means
 * "never expires"). Reject anything that is not a finite, non-negative safe
 * integer *before* it reaches arithmetic or SQL, rather than validating
 * per-call-site.
 */
export function validateOptionalDurationMs(value: number | undefined, label: string): void {
  if (value === undefined) return;
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new VectorCacheError(
      `${label} must be a finite, non-negative safe integer when provided (got ${String(value)})`,
      'INVALID_INPUT',
    );
  }
}

/** A count, not a duration: zero would mean "send nothing" and loop forever. */
export function validateOptionalPositiveInteger(value: number | undefined, label: string): void {
  if (value === undefined) return;
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1) {
    throw new VectorCacheError(
      `${label} must be a positive safe integer when provided (got ${String(value)})`,
      'INVALID_INPUT',
    );
  }
}

/**
 * `encoding` is optional so callers who don't yet know the target encoding
 * (or genuinely don't care, e.g. a future codec-agnostic caller) still get
 * the finiteness check. Every call site in this package *does* know its
 * encoding and should pass it: `setMany` passes `this.vectorEncoding`,
 * `fetch-misses.ts` passes `params.vectorEncoding`, so the magnitude bound
 * below is enforced everywhere a vector is about to be persisted.
 */
export function validateVector(
  vector: EmbeddingVector,
  label: string,
  encoding?: VectorEncoding,
): void {
  if (vector == null || typeof vector.length !== 'number' || vector.length === 0) {
    throw new VectorCacheError(`${label} must be a non-empty numeric vector`, 'INVALID_INPUT');
  }
  for (let index = 0; index < vector.length; index += 1) {
    const value = vector[index];
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new VectorCacheError(
        `${label}[${String(index)}] must be a finite number`,
        'INVALID_INPUT',
      );
    }
    if (encoding === 'float32' && Math.abs(value) > FLOAT32_MAX_ABS) {
      throw new VectorCacheError(
        `${label}[${String(index)}] (${String(value)}) exceeds the largest finite float32 value (~3.4028235e38) — with the default 'float32' vectorEncoding it would silently become Infinity on write; use vectorEncoding: 'float64' to store values this large`,
        'INVALID_INPUT',
      );
    }
  }
}
