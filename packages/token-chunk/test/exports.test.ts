import { describe, expect, it } from 'vitest';
import { exportNames } from '@llm-kit/test-utils';
import * as api from '../src/index.js';

describe('token-chunk public surface', () => {
  it('exports exactly the documented API', () => {
    expect(exportNames(api)).toEqual([
      'APPROX_TOKENIZER_ID',
      'TokenChunkError',
      'chunkMarkdown',
      'chunkText',
      'createChunker',
    ]);
  });

  it('chunkText, chunkMarkdown and createChunker are functions', () => {
    expect(typeof api.chunkText).toBe('function');
    expect(typeof api.chunkMarkdown).toBe('function');
    expect(typeof api.createChunker).toBe('function');
  });

  it('TokenChunkError extends Error and carries a stable code', () => {
    const error = new api.TokenChunkError('bad option', 'INVALID_MAX_TOKENS');
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('TokenChunkError');
    expect(error.code).toBe('INVALID_MAX_TOKENS');
  });

  it('APPROX_TOKENIZER_ID is the stable default tokenizer id', () => {
    expect(api.APPROX_TOKENIZER_ID).toBe('approx-v1');
  });
});
