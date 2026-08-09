import { describe, expect, it } from 'vitest';
import { assertErrorShape } from '@llm-kit/test-utils';
import { chunkMarkdown, chunkText, TokenChunkError } from '../src/index.js';

describe('option validation', () => {
  it('rejects a non-positive maxTokens', () => {
    expect(() => chunkText('hello', { maxTokens: 0 })).toThrow(TokenChunkError);
    try {
      chunkText('hello', { maxTokens: -5 });
      expect.unreachable();
    } catch (error) {
      assertErrorShape(error, { name: 'TokenChunkError', code: 'INVALID_MAX_TOKENS' });
    }
  });

  it('rejects a non-integer maxTokens', () => {
    try {
      chunkText('hello', { maxTokens: 10.5 });
      expect.unreachable();
    } catch (error) {
      assertErrorShape(error, { name: 'TokenChunkError', code: 'INVALID_MAX_TOKENS' });
    }
  });

  it('rejects a negative overlapTokens', () => {
    try {
      chunkText('hello', { maxTokens: 10, overlapTokens: -1 });
      expect.unreachable();
    } catch (error) {
      assertErrorShape(error, { name: 'TokenChunkError', code: 'INVALID_OVERLAP_TOKENS' });
    }
  });

  it('rejects a negative safetyMarginTokens', () => {
    try {
      chunkText('hello', { maxTokens: 10, safetyMarginTokens: -1 });
      expect.unreachable();
    } catch (error) {
      assertErrorShape(error, { name: 'TokenChunkError', code: 'INVALID_SAFETY_MARGIN' });
    }
  });

  it('rejects a safetyMarginTokens that leaves no budget', () => {
    try {
      chunkText('hello', { maxTokens: 10, safetyMarginTokens: 10 });
      expect.unreachable();
    } catch (error) {
      assertErrorShape(error, { name: 'TokenChunkError', code: 'BUDGET_NOT_POSITIVE' });
    }
    try {
      chunkText('hello', { maxTokens: 10, safetyMarginTokens: 15 });
      expect.unreachable();
    } catch (error) {
      assertErrorShape(error, { name: 'TokenChunkError', code: 'BUDGET_NOT_POSITIVE' });
    }
  });

  it('accepts a safetyMarginTokens of 0 by default (documented: not a large default margin)', () => {
    const chunks = chunkText('hello world', { maxTokens: 100 });
    expect(chunks[0]?.tokenCount).toBeLessThanOrEqual(100);
  });

  it('createChunker validates eagerly, at construction time', async () => {
    const { createChunker } = await import('../src/index.js');
    expect(() => createChunker({ maxTokens: -1 })).toThrow(TokenChunkError);
  });

  it('returns no chunks for empty input', () => {
    expect(chunkText('', { maxTokens: 10 })).toEqual([]);
  });

  it('rejects a non-positive maxInputChars', () => {
    try {
      chunkText('hello', { maxTokens: 10, maxInputChars: 0 });
      expect.unreachable();
    } catch (error) {
      assertErrorShape(error, { name: 'TokenChunkError', code: 'INVALID_MAX_INPUT_CHARS' });
    }
    try {
      chunkText('hello', { maxTokens: 10, maxInputChars: -1 });
      expect.unreachable();
    } catch (error) {
      assertErrorShape(error, { name: 'TokenChunkError', code: 'INVALID_MAX_INPUT_CHARS' });
    }
  });

  it('rejects a non-integer maxInputChars', () => {
    try {
      chunkText('hello', { maxTokens: 10, maxInputChars: 10.5 });
      expect.unreachable();
    } catch (error) {
      assertErrorShape(error, { name: 'TokenChunkError', code: 'INVALID_MAX_INPUT_CHARS' });
    }
  });

  it('rejects input longer than maxInputChars, from both chunkText and chunkMarkdown', () => {
    const input = 'x'.repeat(11);
    try {
      chunkText(input, { maxTokens: 10, maxInputChars: 10 });
      expect.unreachable();
    } catch (error) {
      assertErrorShape(error, { name: 'TokenChunkError', code: 'INPUT_TOO_LARGE' });
    }
    try {
      chunkMarkdown(input, { maxTokens: 10, maxInputChars: 10 });
      expect.unreachable();
    } catch (error) {
      assertErrorShape(error, { name: 'TokenChunkError', code: 'INPUT_TOO_LARGE' });
    }
  });

  it('accepts input exactly at maxInputChars', () => {
    const input = 'x'.repeat(10);
    expect(() => chunkText(input, { maxTokens: 10, maxInputChars: 10 })).not.toThrow();
  });

  it('accepts input under the default maxInputChars with no option supplied', () => {
    const chunks = chunkText('hello world', { maxTokens: 100 });
    expect(chunks.length).toBeGreaterThan(0);
  });

  it('createChunker validates maxInputChars eagerly, at construction time', async () => {
    const { createChunker } = await import('../src/index.js');
    expect(() => createChunker({ maxTokens: 10, maxInputChars: -1 })).toThrow(TokenChunkError);
  });
});
