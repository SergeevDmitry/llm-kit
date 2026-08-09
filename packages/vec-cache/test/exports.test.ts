import { exportNames } from '@llm-kit/test-utils';
import { describe, expect, it } from 'vitest';
import * as api from '../src/index.js';

describe('vec-cache public surface', () => {
  it('exports exactly the documented public API', () => {
    // Snapshotted so an accidental addition or removal shows up as a
    // reviewable diff rather than a silent API change.
    expect(exportNames(api)).toEqual(['VectorCache', 'VectorCacheError', 'createVectorCache']);
  });

  it('VectorCache is constructible and createVectorCache is its factory alias', () => {
    expect(typeof api.VectorCache).toBe('function');
    expect(typeof api.createVectorCache).toBe('function');
  });

  it('VectorCacheError is an Error subclass with a stable code', () => {
    const error = new api.VectorCacheError('boom', 'INVALID_INPUT');
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('VectorCacheError');
    expect(error.code).toBe('INVALID_INPUT');
  });
});
