/**
 * Invariants 9/10/11: explicit encoding/dimensions, freshly allocated
 * decodes, and independent clones so a caller mutating a returned vector
 * cannot corrupt the cache.
 */
import { describe, expect, it } from 'vitest';
import { VectorCacheError } from '../src/errors.js';
import { cloneVector, decodeVector, encodeVector } from '../src/storage/vector-codec.js';

describe('encodeVector / decodeVector round trip', () => {
  it('round-trips a float32 vector exactly (within float32 precision)', () => {
    const original = new Float32Array([1.5, -2.25, 0, 3.75, -0.125]);
    const blob = encodeVector(original, 'float32');
    const decoded = decodeVector(blob, 'float32', original.length);
    expect(decoded).toBeInstanceOf(Float32Array);
    expect(Array.from(decoded)).toEqual(Array.from(original));
  });

  it('round-trips a float64 vector exactly', () => {
    const original = [1.123456789012345, -2.9999999999, 0, Math.PI];
    const blob = encodeVector(original, 'float64');
    const decoded = decodeVector(blob, 'float64', original.length);
    expect(decoded).toBeInstanceOf(Float64Array);
    expect(Array.from(decoded)).toEqual(original);
  });

  it('round-trips a plain number[] input through float32 encoding', () => {
    const original = [0.1, 0.2, 0.3];
    const blob = encodeVector(original, 'float32');
    const decoded = decodeVector(blob, 'float32', original.length);
    // float32 loses precision vs. the double literals — compare with tolerance.
    decoded.forEach((value, index) => {
      expect(value).toBeCloseTo(original[index] as number, 6);
    });
  });

  it('produces a blob of exactly dimensions * bytesPerElement bytes', () => {
    expect(encodeVector([1, 2, 3], 'float32').byteLength).toBe(12);
    expect(encodeVector([1, 2, 3], 'float64').byteLength).toBe(24);
  });

  it('decodeVector throws STORE_CORRUPT when the blob length does not match dimensions (malformed database)', () => {
    const blob = encodeVector([1, 2, 3], 'float32'); // 12 bytes
    let caught: unknown;
    try {
      decodeVector(blob, 'float32', 4); // claims 4 dims (16 bytes) but blob is 12
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(VectorCacheError);
    expect((caught as VectorCacheError).code).toBe('STORE_CORRUPT');
  });

  describe('float32 narrowing can turn a finite value into Infinity', () => {
    // The codec itself does no bounds checking — that is `validateVector`'s
    // job (see `test/get-or-create.test.ts` and `test/set-many-delete-many.test.ts`
    // for the guard that stops this before a row is ever built). This
    // pins the raw mechanism the guard exists to prevent: `encodeVector` /
    // `decodeVector` alone, given an out-of-range but perfectly finite
    // float64 input, round-trip it to `Infinity`.
    it('1e39 (finite) round-trips to Infinity through float32', () => {
      const blob = encodeVector([1e39], 'float32');
      const decoded = decodeVector(blob, 'float32', 1);
      expect(Number.isFinite(1e39)).toBe(true);
      expect(decoded[0]).toBe(Infinity);
    });

    it('the largest finite float32 value round-trips exactly; just past it becomes Infinity', () => {
      const maxFloat32 = 3.4028234663852886e38;
      expect(decodeVector(encodeVector([maxFloat32], 'float32'), 'float32', 1)[0]).toBe(maxFloat32);
      expect(decodeVector(encodeVector([3.4028236e38], 'float32'), 'float32', 1)[0]).toBe(Infinity);
    });

    it('the same value round-trips exactly (not Infinity) through float64', () => {
      const blob = encodeVector([1e39], 'float64');
      const decoded = decodeVector(blob, 'float64', 1);
      expect(decoded[0]).toBe(1e39);
    });
  });

  it('decoded vectors are freshly allocated, not a view over the source blob', () => {
    const source = new Uint8Array(encodeVector([1, 2, 3], 'float32'));
    const decoded = decodeVector(source, 'float32', 3);
    decoded[0] = 999;
    // Mutating the decode result must not alter the bytes it was decoded from.
    const redecoded = decodeVector(source, 'float32', 3);
    expect(redecoded[0]).toBe(1);
  });
});

describe('cloneVector', () => {
  it('clones a Float32Array into an independent Float32Array', () => {
    const original = new Float32Array([1, 2, 3]);
    const clone = cloneVector(original);
    expect(clone).toBeInstanceOf(Float32Array);
    expect(clone).not.toBe(original);
    (clone as Float32Array)[0] = 999;
    expect(original[0]).toBe(1);
  });

  it('clones a Float64Array into an independent Float64Array', () => {
    const original = new Float64Array([1, 2, 3]);
    const clone = cloneVector(original);
    expect(clone).toBeInstanceOf(Float64Array);
    expect(clone).not.toBe(original);
  });

  it('clones a plain number[] into an independent array', () => {
    const original = [1, 2, 3];
    const clone = cloneVector(original) as number[];
    expect(clone).not.toBe(original);
    clone[0] = 999;
    expect(original[0]).toBe(1);
  });
});
