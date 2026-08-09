import { describe, expect, it } from 'vitest';
import { assertErrorShape } from '@llm-kit/test-utils';
import { fromEncoder, type EncoderLike } from '../src/adapters/generic-encoder.js';
import {
  fromTiktokenLikeEncoder,
  type TiktokenLikeEncoder,
} from '../src/adapters/tiktoken-like.js';
import {
  fromAnthropicLikeCounter,
  type AnthropicLikeCounter,
} from '../src/adapters/anthropic-like.js';

/**
 * Encoder shape #1: a faithful, round-tripping word-id encoder. Every token
 * id maps back to exactly the word it came from.
 */
function createRoundTrippingEncoder(): EncoderLike {
  const vocabulary = new Map<string, number>();
  const reverse = new Map<number, string>();
  const idFor = (word: string): number => {
    let id = vocabulary.get(word);
    if (id === undefined) {
      id = vocabulary.size;
      vocabulary.set(word, id);
      reverse.set(id, word);
    }
    return id;
  };
  return {
    id: 'round-trip-word-encoder',
    encode: (text: string) =>
      text
        .split(' ')
        .filter((w) => w.length > 0)
        .map(idFor),
    decode: (tokens: readonly number[]) => tokens.map((t) => reverse.get(t) ?? '').join(' '),
  };
}

/**
 * Encoder shape #2: a lossy fixed-width byte-bucket encoder, modeling a
 * real BPE tokenizer's lossy behaviour (case and exact whitespace are not
 * preserved on decode). `decode(encode(x)) !== x` for many inputs — exactly
 * the case `token-chunk` needs to detect so it never assumes round-tripping
 * is safe just because `decode` exists.
 */
function createLossyEncoder(): EncoderLike {
  return {
    id: 'lossy-lowercase-encoder',
    encode: (text: string) =>
      Array.from(text.toLowerCase()).map((char) => char.codePointAt(0) ?? 0),
    decode: (tokens: readonly number[]) =>
      tokens.map((code) => String.fromCodePoint(code)).join(''),
  };
}

describe('fromEncoder — contract', () => {
  it('derives count() as encode(text).length', () => {
    const tokenizer = fromEncoder(createRoundTrippingEncoder());
    expect(tokenizer.count('the quick brown fox')).toBe(4);
  });

  it('carries the supplied id through unchanged', () => {
    const tokenizer = fromEncoder(createRoundTrippingEncoder());
    expect(tokenizer.id).toBe('round-trip-word-encoder');
  });

  it('exposes encode() when the underlying encoder does', () => {
    const tokenizer = fromEncoder(createRoundTrippingEncoder());
    expect(tokenizer.encode?.('a b')).toEqual([0, 1]);
  });

  it('omits decode() entirely when the encoder does not supply one', () => {
    const tokenizer = fromEncoder({
      id: 'encode-only',
      encode: (text) => Array.from(text, (c) => c.codePointAt(0) ?? 0),
    });
    expect(tokenizer.decode).toBeUndefined();
    expect('decode' in tokenizer).toBe(false);
  });

  it('throws TokenizerError(INVALID_ENCODER_ID) for a missing id', () => {
    try {
      fromEncoder({ id: '', encode: () => [] });
      expect.unreachable();
    } catch (error) {
      assertErrorShape(error, { name: 'TokenizerError', code: 'INVALID_ENCODER_ID' });
    }
  });

  it('throws TokenizerError(INVALID_ENCODER_SHAPE) when encode is not a function', () => {
    try {
      fromEncoder({ id: 'bad', encode: undefined as unknown as EncoderLike['encode'] });
      expect.unreachable();
    } catch (error) {
      assertErrorShape(error, { name: 'TokenizerError', code: 'INVALID_ENCODER_SHAPE' });
    }
  });

  it('throws TokenizerError(INVALID_ENCODER_SHAPE) when decode is present but not a function', () => {
    try {
      fromEncoder({
        id: 'bad',
        encode: () => [],
        decode: 'nope' as unknown as EncoderLike['decode'],
      });
      expect.unreachable();
    } catch (error) {
      assertErrorShape(error, { name: 'TokenizerError', code: 'INVALID_ENCODER_SHAPE' });
    }
  });
});

describe('fromEncoder — round-trip behaviour across two encoder shapes', () => {
  it('round-trips exactly through the faithful word encoder', () => {
    const tokenizer = fromEncoder(createRoundTrippingEncoder());
    const text = 'the quick brown fox';
    const decoded = tokenizer.decode?.(tokenizer.encode?.(text) ?? []);
    expect(decoded).toBe(text);
  });

  it('does NOT round-trip through the lossy encoder — decode(encode(x)) !== x', () => {
    const tokenizer = fromEncoder(createLossyEncoder());
    const text = 'Hello World';
    const decoded = tokenizer.decode?.(tokenizer.encode?.(text) ?? []);
    // Lowercased on the way through: this is the exact "round-tripping is
    // unsafe" signal token-chunk must be able to detect from the adapter
    // contract, not assume away.
    expect(decoded).not.toBe(text);
    expect(decoded).toBe('hello world');
  });

  it('both shapes still satisfy count() === encode(text).length regardless of round-trip fidelity', () => {
    for (const encoder of [createRoundTrippingEncoder(), createLossyEncoder()]) {
      const tokenizer = fromEncoder(encoder);
      const text = 'Round trip fidelity is independent of counting.';
      expect(tokenizer.count(text)).toBe(tokenizer.encode?.(text).length);
    }
  });
});

describe('fromTiktokenLikeEncoder', () => {
  it('wraps a string-returning decode() (js-tiktoken shape)', () => {
    const encoder: TiktokenLikeEncoder = {
      encode: (text) => Array.from(text, (c) => c.codePointAt(0) ?? 0),
      decode: (tokens) => tokens.map((t) => String.fromCodePoint(t)).join(''),
    };
    const tokenizer = fromTiktokenLikeEncoder('cl100k_base', encoder);
    expect(tokenizer.id).toBe('cl100k_base');
    expect(tokenizer.count('abc')).toBe(3);
    expect(tokenizer.decode?.(tokenizer.encode?.('abc') ?? [])).toBe('abc');
  });

  it('wraps a Uint8Array-returning decode() (official tiktoken binding shape)', () => {
    const encoder: TiktokenLikeEncoder = {
      encode: (text) => Array.from(text, (c) => c.codePointAt(0) ?? 0),
      decode: (tokens) =>
        new TextEncoder().encode(tokens.map((t) => String.fromCodePoint(t)).join('')),
    };
    const tokenizer = fromTiktokenLikeEncoder('o200k_base', encoder);
    expect(tokenizer.decode?.(tokenizer.encode?.('xyz') ?? [])).toBe('xyz');
  });
});

describe('fromAnthropicLikeCounter', () => {
  it('produces a count-only Tokenizer — no encode/decode, matching the real public surface', () => {
    const counter: AnthropicLikeCounter = { countTokens: (text) => Math.ceil(text.length / 4) };
    const tokenizer = fromAnthropicLikeCounter(counter);
    expect(tokenizer.count('twelve chars')).toBe(Math.ceil('twelve chars'.length / 4));
    expect(tokenizer.encode).toBeUndefined();
    expect(tokenizer.decode).toBeUndefined();
    expect('encode' in tokenizer).toBe(false);
    expect('decode' in tokenizer).toBe(false);
  });

  it('uses the supplied id when present, and a documented default otherwise', () => {
    const withId = fromAnthropicLikeCounter({ id: 'claude-counter', countTokens: () => 1 });
    expect(withId.id).toBe('claude-counter');
    const withoutId = fromAnthropicLikeCounter({ countTokens: () => 1 });
    expect(withoutId.id).toBe('anthropic-like');
  });

  it('throws TokenizerError(INVALID_COUNTER_SHAPE) when countTokens is not a function', () => {
    try {
      fromAnthropicLikeCounter({
        countTokens: undefined as unknown as AnthropicLikeCounter['countTokens'],
      });
      expect.unreachable();
    } catch (error) {
      assertErrorShape(error, { name: 'TokenizerError', code: 'INVALID_COUNTER_SHAPE' });
    }
  });
});
