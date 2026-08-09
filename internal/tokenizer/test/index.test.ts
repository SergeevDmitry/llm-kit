import { describe, expect, it } from 'vitest';
import { exportNames } from '@llm-kit/test-utils';
import * as tokenizerModule from '../src/index.js';

/**
 * Snapshot of the public export surface: an accidental addition or removal
 * shows up as a reviewable diff here, not silently in a consumer's build.
 * `Tokenizer` and `MessageTokenCounter` are type-only and do not appear at
 * runtime — this list is every VALUE export.
 */
const EXPECTED_EXPORT_NAMES = [
  'APPROX_TOKENIZER_ID',
  'CONVERSATION_PRIMING_TOKENS',
  'MESSAGE_OVERHEAD_TOKENS',
  'NAME_OVERHEAD_TOKENS',
  'TOOL_CALL_OVERHEAD_TOKENS',
  'TokenizerError',
  'UNKNOWN_CONTENT_FALLBACK_TOKENS',
  'UNKNOWN_CONTENT_SAFETY_MULTIPLIER',
  'approximateTokenizer',
  'classifyGrapheme',
  'createApproximateTokenizer',
  'createMessageTokenCounter',
  'describeMessage',
  'describeMessageContent',
  'estimateTokenCount',
  'fromAnthropicLikeCounter',
  'fromEncoder',
  'fromTiktokenLikeEncoder',
  'graphemeClusters',
  'usesIntlSegmenter',
  'utf8ByteLength',
].sort();

describe('public export surface', () => {
  it('matches the reviewed export list exactly', () => {
    expect(exportNames(tokenizerModule)).toEqual(EXPECTED_EXPORT_NAMES);
  });

  it('every exported symbol is usable end-to-end (smoke test)', () => {
    const tokenizer = tokenizerModule.createApproximateTokenizer();
    expect(tokenizer.id).toBe(tokenizerModule.APPROX_TOKENIZER_ID);
    expect(tokenizerModule.approximateTokenizer.count('hello')).toBe(
      tokenizerModule.estimateTokenCount('hello'),
    );

    const messageCounter = tokenizerModule.createMessageTokenCounter(tokenizer);
    expect(messageCounter.countMessage({ role: 'user', content: 'hi' })).toBeGreaterThan(0);

    const content = tokenizerModule.describeMessageContent('hi', tokenizer);
    expect(content.usedFallback).toBe(false);

    const messageAccounting = tokenizerModule.describeMessage(
      { role: 'user', content: 'hi' },
      tokenizer,
    );
    expect(messageAccounting.tokens).toBe(
      messageCounter.countMessage({ role: 'user', content: 'hi' }),
    );

    const encoderTokenizer = tokenizerModule.fromEncoder({
      id: 'smoke-encoder',
      encode: (text: string) => Array.from(text, (c) => c.codePointAt(0) ?? 0),
    });
    expect(encoderTokenizer.count('ab')).toBe(2);

    const tiktokenLike = tokenizerModule.fromTiktokenLikeEncoder('smoke-tiktoken', {
      encode: (text: string) => Array.from(text, (c) => c.codePointAt(0) ?? 0),
      decode: (tokens: readonly number[]) => tokens.map((t) => String.fromCodePoint(t)).join(''),
    });
    expect(tiktokenLike.count('ab')).toBe(2);

    const anthropicLike = tokenizerModule.fromAnthropicLikeCounter({
      countTokens: (text: string) => text.length,
    });
    expect(anthropicLike.count('abc')).toBe(3);

    expect(tokenizerModule.graphemeClusters('ab')).toEqual(['a', 'b']);
    expect(tokenizerModule.classifyGrapheme('大')).toBe('cjk');
    expect(tokenizerModule.utf8ByteLength('大')).toBe(3);
    expect(typeof tokenizerModule.usesIntlSegmenter()).toBe('boolean');

    expect(() => new tokenizerModule.TokenizerError('x', 'INVALID_ENCODER_ID')).not.toThrow();
    expect(tokenizerModule.MESSAGE_OVERHEAD_TOKENS).toBeGreaterThan(0);
    expect(tokenizerModule.NAME_OVERHEAD_TOKENS).toBeGreaterThan(0);
    expect(tokenizerModule.TOOL_CALL_OVERHEAD_TOKENS).toBeGreaterThan(0);
    expect(tokenizerModule.CONVERSATION_PRIMING_TOKENS).toBeGreaterThan(0);
    expect(tokenizerModule.UNKNOWN_CONTENT_FALLBACK_TOKENS).toBeGreaterThan(0);
    expect(tokenizerModule.UNKNOWN_CONTENT_SAFETY_MULTIPLIER).toBeGreaterThan(1);
  });
});
