import { describe, expect, it } from 'vitest';
import { exportNames } from '@llm-kit/test-utils';
import * as api from '../src/index.js';

describe('mend-json public surface', () => {
  it('exports exactly the documented public API', () => {
    // Snapshotted so an accidental addition or removal shows up as a
    // reviewable diff rather than a silent API change. Type-only exports
    // (interfaces, type aliases) don't appear here — they leave no runtime
    // trace on the module namespace — only value exports do.
    expect(exportNames(api)).toEqual([
      'JsonMendDuplicateKeyError',
      'JsonMendLimitError',
      'JsonMendOptionsError',
      'createJsonMender',
      'mendJson',
    ]);
  });

  it('createJsonMender and mendJson are callable functions', () => {
    expect(typeof api.createJsonMender).toBe('function');
    expect(typeof api.mendJson).toBe('function');
  });

  it('createJsonMender() returns push/snapshot/finish/reset', () => {
    const mender = api.createJsonMender();
    expect(typeof mender.push).toBe('function');
    expect(typeof mender.snapshot).toBe('function');
    expect(typeof mender.finish).toBe('function');
    expect(typeof mender.reset).toBe('function');
  });
});
