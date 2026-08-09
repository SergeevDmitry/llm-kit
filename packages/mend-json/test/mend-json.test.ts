import { describe, expect, it } from 'vitest';
import { assertErrorShape } from '@llm-kit/test-utils';
import { mendJson } from '../src/index.js';
import { JsonMendDuplicateKeyError, JsonMendLimitError } from '../src/errors.js';

describe('mendJson — one-shot API', () => {
  it('repairs a truncated string in one call', () => {
    const r = mendJson('{"name":"Iv');
    expect(r.value).toEqual({ name: 'Iv' });
    expect(r.complete).toBe(false);
  });

  it('reports complete for a fully valid document', () => {
    const r = mendJson('{"name":"Ivan","age":30}');
    expect(r.complete).toBe(true);
    expect(r.value).toEqual({ name: 'Ivan', age: 30 });
  });

  it('accepts a Uint8Array', () => {
    const r = mendJson(new TextEncoder().encode('{"a":1}'));
    expect(r.complete).toBe(true);
    expect(r.value).toEqual({ a: 1 });
  });

  it('is equivalent to push() then finish()', () => {
    const oneShot = mendJson('{"a":1,"b":2');
    // Should behave exactly like finish() on an equivalent stateful mender —
    // covered directly against createJsonMender in create-json-mender.test.ts.
    expect(oneShot.value).toEqual({ a: 1, b: 2 });
    expect(oneShot.complete).toBe(false);
  });

  it('applies options passed through to the underlying mender', () => {
    const r = mendJson('{"a":tru', { incompleteScalarPolicy: 'best-effort' });
    expect(r.value).toEqual({ a: true });
  });
});

describe('error shapes', () => {
  it('JsonMendLimitError has a stable shape', () => {
    try {
      mendJson('[[[1]]]', { maxDepth: 2 });
      throw new Error('expected a throw');
    } catch (error) {
      assertErrorShape(error, { name: 'JsonMendLimitError', code: 'MAX_DEPTH_EXCEEDED' });
      expect(error).toBeInstanceOf(JsonMendLimitError);
    }
  });

  it('JsonMendLimitError reports MAX_BUFFER_BYTES_EXCEEDED', () => {
    try {
      mendJson('{"a":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}', { maxBufferBytes: 8 });
      throw new Error('expected a throw');
    } catch (error) {
      assertErrorShape(error, { name: 'JsonMendLimitError', code: 'MAX_BUFFER_BYTES_EXCEEDED' });
    }
  });

  it('JsonMendDuplicateKeyError has a stable shape and carries the key', () => {
    try {
      mendJson('{"a":1,"a":2}', { duplicateKeyPolicy: 'error' });
      throw new Error('expected a throw');
    } catch (error) {
      assertErrorShape(error, { name: 'JsonMendDuplicateKeyError', code: 'DUPLICATE_KEY' });
      expect(error).toBeInstanceOf(JsonMendDuplicateKeyError);
      expect((error as JsonMendDuplicateKeyError).key).toBe('a');
    }
  });
});
