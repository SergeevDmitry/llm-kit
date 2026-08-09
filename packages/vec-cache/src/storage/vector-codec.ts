/**
 * Vector <-> BLOB codec.
 *
 * Encoding is explicit and stored per row (`vector_encoding`, `dimensions`).
 * Endianness is fixed at little-endian for both widths — not stored per row
 * because this package only ever writes it, but documented here as the one
 * fact a future codec version must preserve or bump `CACHE_SCHEMA_VERSION`
 * over.
 *
 * `decodeVector` always allocates a new `ArrayBuffer` and copies into it: the
 * `Buffer` `better-sqlite3` returns for a BLOB column may be a view over a
 * shared/pooled allocation, and even when it isn't, an
 * un-copied view would let a caller mutate a "returned" vector and silently
 * corrupt what a later read decodes from the same bytes. Callers should not
 * see the same effect from `restore-order.ts`'s duplicate-index cloning
 * either — see that module.
 */
import type { EmbeddingVector, VectorEncoding } from '../types.js';
import { VectorCacheError } from '../errors.js';

const BYTES_PER_ELEMENT: Readonly<Record<VectorEncoding, number>> = {
  float32: 4,
  float64: 8,
};

export function bytesPerElement(encoding: VectorEncoding): number {
  return BYTES_PER_ELEMENT[encoding];
}

export function encodeVector(vector: EmbeddingVector, encoding: VectorEncoding): Buffer {
  const length = vector.length;
  const stride = BYTES_PER_ELEMENT[encoding];
  const buffer = Buffer.allocUnsafe(length * stride);
  for (let index = 0; index < length; index += 1) {
    const value = vector[index] as number;
    if (encoding === 'float32') {
      buffer.writeFloatLE(value, index * stride);
    } else {
      buffer.writeDoubleLE(value, index * stride);
    }
  }
  return buffer;
}

export function decodeVector(
  blob: Uint8Array,
  encoding: VectorEncoding,
  dimensions: number,
): Float32Array | Float64Array {
  const stride = BYTES_PER_ELEMENT[encoding];
  const expectedBytes = dimensions * stride;
  if (blob.byteLength !== expectedBytes) {
    throw new VectorCacheError(
      `stored vector blob is ${String(blob.byteLength)} byte(s), expected ${String(expectedBytes)} for ${String(dimensions)} ${encoding} dimensions — the database may be corrupt`,
      'STORE_CORRUPT',
    );
  }
  // Fresh, independent ArrayBuffer — never a view over the source `blob`.
  const copy = new ArrayBuffer(expectedBytes);
  new Uint8Array(copy).set(blob);
  return encoding === 'float32' ? new Float32Array(copy) : new Float64Array(copy);
}

/** Returns an independently-allocated copy of `vector`, same concrete type. */
export function cloneVector(vector: EmbeddingVector): EmbeddingVector {
  if (vector instanceof Float32Array || vector instanceof Float64Array) {
    return vector.slice();
  }
  return vector.slice();
}
