import { describe, expect, it } from 'vitest';
import { assertErrorShape } from '@llm-kit/test-utils';
import {
  APPROX_TOKENIZER_ID,
  TokenizerError,
  type MessageTokenCounter,
  type Tokenizer,
} from '../src/types.js';

describe('Tokenizer contract', () => {
  it('accepts a minimal implementation with only `id` and `count`', () => {
    const tokenizer: Tokenizer = {
      id: 'minimal',
      count: (text) => text.length,
    };
    expect(tokenizer.count('abc')).toBe(3);
    expect(tokenizer.encode).toBeUndefined();
    expect(tokenizer.decode).toBeUndefined();
  });

  it('allows optional `encode`/`decode` alongside `count`', () => {
    const tokenizer: Tokenizer = {
      id: 'full',
      count: (text) => text.length,
      encode: (text) => Array.from(text, (char) => char.charCodeAt(0)),
      decode: (tokens) => tokens.map((code) => String.fromCharCode(code)).join(''),
    };
    const encoded = tokenizer.encode?.('ab');
    expect(encoded).toEqual([97, 98]);
    expect(tokenizer.decode?.(encoded ?? [])).toBe('ab');
  });
});

describe('MessageTokenCounter contract', () => {
  it('is generic over any Message shape', () => {
    interface Msg {
      readonly role: string;
      readonly text: string;
    }
    const countMessage = (message: Msg): number => message.text.length;
    const counter: MessageTokenCounter<Msg> = {
      id: 'msg-counter',
      countMessage,
      countMessages: (messages) => messages.reduce((sum, m) => sum + countMessage(m), 0),
    };
    expect(counter.countMessage({ role: 'user', text: 'hi' })).toBe(2);
    expect(
      counter.countMessages([
        { role: 'user', text: 'hi' },
        { role: 'assistant', text: 'yo' },
      ]),
    ).toBe(4);
  });
});

describe('APPROX_TOKENIZER_ID', () => {
  it('is the stable, versioned id documented in the package brief', () => {
    expect(APPROX_TOKENIZER_ID).toBe('approx-v1');
  });
});

describe('TokenizerError', () => {
  it('extends Error and carries a stable code', () => {
    const error = new TokenizerError('boom', 'INVALID_ENCODER_ID');
    assertErrorShape(error, { name: 'TokenizerError', code: 'INVALID_ENCODER_ID' });
  });

  it('preserves an optional cause', () => {
    const cause = new Error('root cause');
    const error = new TokenizerError('boom', 'INVALID_ENCODER_SHAPE', { cause });
    expect(error.cause).toBe(cause);
  });
});
