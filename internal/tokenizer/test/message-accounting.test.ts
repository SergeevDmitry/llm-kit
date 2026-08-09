import { describe, expect, it } from 'vitest';
import { assertJsonSerializable } from '@llm-kit/test-utils';
import { createApproximateTokenizer } from '../src/approximate-tokenizer.js';
import {
  CONVERSATION_PRIMING_TOKENS,
  MESSAGE_OVERHEAD_TOKENS,
  NAME_OVERHEAD_TOKENS,
  TOOL_CALL_OVERHEAD_TOKENS,
  UNKNOWN_CONTENT_FALLBACK_TOKENS,
  UNKNOWN_CONTENT_SAFETY_MULTIPLIER,
  createMessageTokenCounter,
  describeMessage,
  describeMessageContent,
  type ChatMessageLike,
} from '../src/message-accounting.js';
import type { Tokenizer } from '../src/types.js';

const tokenizer = createApproximateTokenizer();

describe('describeMessageContent — string content', () => {
  it('counts a plain string directly, with no fallback', () => {
    const result = describeMessageContent('hello world', tokenizer);
    expect(result.tokens).toBe(tokenizer.count('hello world'));
    expect(result.usedFallback).toBe(false);
    expect(result.reason).toBeUndefined();
  });

  it('counts an empty string as 0 tokens', () => {
    expect(describeMessageContent('', tokenizer).tokens).toBe(0);
  });
});

describe('describeMessageContent — array-of-parts content', () => {
  it('sums recognized text parts without a fallback', () => {
    const content = [
      { type: 'text', text: 'first part' },
      { type: 'text', text: 'second part' },
    ];
    const result = describeMessageContent(content, tokenizer);
    expect(result.tokens).toBe(tokenizer.count('first part') + tokenizer.count('second part'));
    expect(result.usedFallback).toBe(false);
  });

  it('counts bare string elements inside an array like a text part', () => {
    const result = describeMessageContent(['plain string element'], tokenizer);
    expect(result.tokens).toBe(tokenizer.count('plain string element'));
    expect(result.usedFallback).toBe(false);
  });

  it('falls back per-element for an unrecognized part type, without failing the whole array', () => {
    const content = [
      { type: 'text', text: 'known part' },
      { type: 'image', url: 'https://example.com/image.png' },
    ];
    const result = describeMessageContent(content, tokenizer);
    expect(result.usedFallback).toBe(true);
    expect(result.reason).toContain('image');
    // The known part still contributes its exact count; the unknown part
    // contributes a nonzero, serialization-based estimate.
    expect(result.tokens).toBeGreaterThan(tokenizer.count('known part'));
  });

  it('falls back for a nested array element and labels it by JS type, not a string `type` field', () => {
    const result = describeMessageContent([['nested', 'array']], tokenizer);
    expect(result.usedFallback).toBe(true);
    expect(result.reason).toContain('array');
  });

  it('falls back for a part with an empty-string `type` using the JS-type label instead', () => {
    const result = describeMessageContent([{ type: '', text: 'ignored' }], tokenizer);
    expect(result.usedFallback).toBe(true);
    expect(result.reason).toContain('object');
  });

  it('handles an empty array as 0 tokens with no fallback', () => {
    const result = describeMessageContent([], tokenizer);
    expect(result.tokens).toBe(0);
    expect(result.usedFallback).toBe(false);
  });
});

describe('describeMessageContent — unknown-shape content', () => {
  it('falls back for a plain object and reports why', () => {
    const result = describeMessageContent({ foo: 'bar' }, tokenizer);
    expect(result.usedFallback).toBe(true);
    expect(result.reason).toContain('object');
    expect(result.tokens).toBeGreaterThan(0);
  });

  it('applies the documented safety multiplier to the serialized-content estimate', () => {
    const value = { text: 'a moderately long piece of structured content for counting' };
    const serialized = JSON.stringify(value);
    const expected = Math.ceil(tokenizer.count(serialized) * UNKNOWN_CONTENT_SAFETY_MULTIPLIER);
    expect(describeMessageContent(value, tokenizer).tokens).toBe(expected);
  });

  it('falls back to the flat constant for content that cannot be serialized (circular reference)', () => {
    const circular: Record<string, unknown> = { self: null };
    circular.self = circular;
    const result = describeMessageContent(circular, tokenizer);
    expect(result.usedFallback).toBe(true);
    expect(result.tokens).toBe(UNKNOWN_CONTENT_FALLBACK_TOKENS);
    expect(result.reason).toContain('not JSON-serializable');
  });

  it('never throws for null, undefined, numbers, booleans, or functions', () => {
    const values: unknown[] = [null, undefined, 42, true, () => {}, Symbol('x')];
    for (const value of values) {
      expect(() => describeMessageContent(value, tokenizer)).not.toThrow();
      const result = describeMessageContent(value, tokenizer);
      expect(result.usedFallback).toBe(true);
      expect(result.tokens).toBeGreaterThan(0);
    }
  });

  it('produces a JSON-serializable diagnostic', () => {
    const result = describeMessageContent({ nested: { deeply: [1, 2, 3] } }, tokenizer);
    assertJsonSerializable(result, 'MessageContentAccounting');
  });
});

describe('createMessageTokenCounter', () => {
  it('composes the content tokenizer id with the accounting model version', () => {
    const counter = createMessageTokenCounter(tokenizer);
    expect(counter.id).toBe(`${tokenizer.id}+message-accounting-v1`);
  });

  it('charges the per-message overhead on top of content tokens', () => {
    const counter = createMessageTokenCounter(tokenizer);
    const message: ChatMessageLike = { role: 'user', content: 'hi' };
    expect(counter.countMessage(message)).toBe(MESSAGE_OVERHEAD_TOKENS + tokenizer.count('hi'));
  });

  it('charges extra when a message has a `name`', () => {
    const counter = createMessageTokenCounter(tokenizer);
    const withoutName = counter.countMessage({ role: 'user', content: 'hi' });
    const withName = counter.countMessage({ role: 'user', content: 'hi', name: 'alice' });
    expect(withName).toBe(withoutName + NAME_OVERHEAD_TOKENS);
  });

  it('charges per tool call, including its name and arguments', () => {
    const counter = createMessageTokenCounter(tokenizer);
    const base = counter.countMessage({ role: 'assistant', content: '' });
    const withToolCall = counter.countMessage({
      role: 'assistant',
      content: '',
      toolCalls: [{ name: 'search', arguments: { query: 'llm-kit' } }],
    });
    expect(withToolCall).toBeGreaterThan(base + TOOL_CALL_OVERHEAD_TOKENS);
  });

  it('counts a string tool-call arguments payload directly, without the unknown-shape multiplier', () => {
    const counter = createMessageTokenCounter(tokenizer);
    const raw = counter.countMessage({
      role: 'assistant',
      content: '',
      toolCalls: [{ name: 'search', arguments: '{"query":"llm-kit"}' }],
    });
    const expected =
      MESSAGE_OVERHEAD_TOKENS +
      tokenizer.count('') +
      TOOL_CALL_OVERHEAD_TOKENS +
      tokenizer.count('search') +
      tokenizer.count('{"query":"llm-kit"}');
    expect(raw).toBe(expected);
  });

  it('adds the conversation priming overhead exactly once per countMessages call', () => {
    const counter = createMessageTokenCounter(tokenizer);
    const messages: ChatMessageLike[] = [
      { role: 'system', content: 'be helpful' },
      { role: 'user', content: 'hi' },
    ];
    const total = counter.countMessages(messages);
    const sumOfIndividual = messages.reduce((sum, m) => sum + counter.countMessage(m), 0);
    expect(total).toBe(sumOfIndividual + CONVERSATION_PRIMING_TOKENS);
  });

  it('returns 0 for an empty conversation (no priming overhead on nothing)', () => {
    const counter = createMessageTokenCounter(tokenizer);
    expect(counter.countMessages([])).toBe(0);
  });

  it('accepts array-of-parts content in a full message', () => {
    const counter = createMessageTokenCounter(tokenizer);
    const message: ChatMessageLike = {
      role: 'user',
      content: [
        { type: 'text', text: 'look at this' },
        { type: 'image', url: 'https://example.com/x.png' },
      ],
    };
    expect(() => counter.countMessage(message)).not.toThrow();
    expect(counter.countMessage(message)).toBeGreaterThan(MESSAGE_OVERHEAD_TOKENS);
  });

  it('accepts an arbitrary unknown-shape content object in a full message without throwing', () => {
    const counter = createMessageTokenCounter(tokenizer);
    const message = {
      role: 'tool',
      content: { rows: [1, 2, 3], truncated: false },
    } as ChatMessageLike;
    expect(() => counter.countMessage(message)).not.toThrow();
  });

  it('respects overridden overhead constants', () => {
    const counter = createMessageTokenCounter(tokenizer, {
      tokensPerMessage: 10,
      tokensPerName: 5,
      tokensPerToolCall: 20,
      conversationPrimingTokens: 1,
    });
    const message: ChatMessageLike = { role: 'user', content: 'hi', name: 'bob' };
    expect(counter.countMessage(message)).toBe(10 + tokenizer.count('hi') + 5);
    expect(counter.countMessages([message])).toBe(counter.countMessage(message) + 1);
  });

  it('works with an injected exact tokenizer, not just the approximate one', () => {
    const exact: Tokenizer = {
      id: 'test-exact',
      count: (text) => text.split(/\s+/u).filter(Boolean).length,
    };
    const counter = createMessageTokenCounter(exact);
    expect(counter.id).toBe('test-exact+message-accounting-v1');
    expect(counter.countMessage({ role: 'user', content: 'four little words here' })).toBe(
      MESSAGE_OVERHEAD_TOKENS + 4,
    );
  });
});

describe('provider-shaped messages — structural fields outside the canonical shape', () => {
  // `ChatMessageLike` is the canonical shape (see its doc comment): a
  // provider SDK's own message type is not parsed here, but it must never
  // be silently dropped either, since that produces an undercount — the one
  // direction this package must never go. These simulate what actually
  // happens when a provider payload flows through untouched: `as
  // ChatMessageLike` bypasses the excess-property check a literal assignment
  // would trigger, matching how a real, more-widely-typed object reaches
  // this function at runtime.

  it('does not silently drop an OpenAI-shaped top-level `tool_calls` field', () => {
    const counter = createMessageTokenCounter(tokenizer);
    const base = counter.countMessage({ role: 'assistant', content: '' } as ChatMessageLike);
    const openAiShaped = {
      role: 'assistant',
      content: '',
      tool_calls: [
        {
          id: 'call_abc123',
          type: 'function',
          function: { name: 'search', arguments: '{"query":"llm-kit tokenizer"}' },
        },
      ],
    } as ChatMessageLike;

    const counted = counter.countMessage(openAiShaped);
    // The bug: reading only `message.toolCalls` (camelCase) leaves
    // `tool_calls` (snake_case) completely invisible, so `counted` would
    // equal `base`. It must not.
    expect(counted).toBeGreaterThan(base);

    const described = describeMessage(openAiShaped, tokenizer);
    expect(described.tokens).toBe(counted);
    expect(described.usedFallback).toBe(true);
    expect(described.reason).toContain('tool_calls');
    expect(described.reason).toContain('canonical ChatMessageLike shape');
  });

  it('does not silently drop Anthropic-shaped `tool_use` blocks nested in content', () => {
    const counter = createMessageTokenCounter(tokenizer);
    const base = counter.countMessage({ role: 'assistant', content: '' } as ChatMessageLike);
    const anthropicShaped: ChatMessageLike = {
      role: 'assistant',
      content: [
        { type: 'text', text: 'Let me look that up.' },
        {
          type: 'tool_use',
          id: 'toolu_01abc',
          name: 'search',
          input: { query: 'llm-kit tokenizer' },
        },
      ],
    };

    const counted = counter.countMessage(anthropicShaped);
    expect(counted).toBeGreaterThan(base);

    // Unlike the OpenAI case, this already goes through the array-content
    // path (`tool_use` is just a content part `describeMessageContent`
    // doesn't recognize as text) — this test locks that behavior in as a
    // regression guard rather than exercising new code.
    const described = describeMessage(anthropicShaped, tokenizer);
    expect(described.tokens).toBe(counted);
    expect(described.usedFallback).toBe(true);
    expect(described.reason).toContain('tool_use');
  });

  it('does not generate fallback noise for ordinary scalar provider metadata', () => {
    const withMetadata = {
      role: 'assistant',
      content: 'hello',
      id: 'msg_01xyz',
      created: 1_700_000_000,
      finish_reason: 'stop',
    } as ChatMessageLike;

    const described = describeMessage(withMetadata, tokenizer);
    expect(described.usedFallback).toBe(false);
    expect(described.reason).toBeUndefined();
    expect(described.tokens).toBe(
      describeMessage({ role: 'assistant', content: 'hello' }, tokenizer).tokens,
    );
  });

  it('reports every unrecognized structural field when a message has more than one', () => {
    const message = {
      role: 'assistant',
      content: '',
      tool_calls: [{ function: { name: 'a' } }],
      extra_blocks: [{ type: 'thinking', text: '...' }],
    } as ChatMessageLike;

    const described = describeMessage(message, tokenizer);
    expect(described.usedFallback).toBe(true);
    expect(described.reason).toContain('tool_calls');
    expect(described.reason).toContain('extra_blocks');
  });

  it('countMessage and describeMessage agree exactly on the token total', () => {
    const counter = createMessageTokenCounter(tokenizer);
    const message = {
      role: 'assistant',
      content: 'partial answer',
      tool_calls: [{ function: { name: 'lookup', arguments: '{}' } }],
    } as ChatMessageLike;
    expect(counter.countMessage(message)).toBe(describeMessage(message, tokenizer).tokens);
  });
});

describe('describeUnrecognizedFields — Date/RegExp are scalar metadata, not content', () => {
  // `describeUnrecognizedFields`'s doc comment says scalar metadata — an id,
  // a timestamp, a finish reason — is not content and is not counted.
  // `typeof value !== 'object'` alone does not implement that: `Date` (the
  // natural JS representation of a timestamp) and `RegExp` are both `typeof
  // 'object'`, so without the extra check they'd be routed through the
  // unrecognized-content fallback like real structural content, charging
  // ~6x the tokens of the field they represent and reporting
  // `usedFallback: true` for an entirely routine provider payload.

  it('does not count a Date-valued extra field, and reports no fallback', () => {
    const withDateTimestamp = {
      role: 'user',
      content: 'hi',
      timestamp: new Date(0),
    } as ChatMessageLike;
    const withNumericTimestamp = {
      role: 'user',
      content: 'hi',
      timestamp: 0,
    } as ChatMessageLike;

    const dateResult = describeMessage(withDateTimestamp, tokenizer);
    const numberResult = describeMessage(withNumericTimestamp, tokenizer);

    expect(dateResult.usedFallback).toBe(false);
    expect(dateResult.reason).toBeUndefined();
    expect(dateResult.tokens).toBe(numberResult.tokens);
    expect(dateResult.tokens).toBe(MESSAGE_OVERHEAD_TOKENS + tokenizer.count('hi'));
  });

  it('does not count a RegExp-valued extra field either', () => {
    const message = { role: 'user', content: 'hi', pattern: /abc/u } as ChatMessageLike;
    const result = describeMessage(message, tokenizer);
    expect(result.usedFallback).toBe(false);
    expect(result.tokens).toBe(MESSAGE_OVERHEAD_TOKENS + tokenizer.count('hi'));
  });

  it('still counts a genuinely structural extra field (plain object) via the fallback', () => {
    const message = {
      role: 'assistant',
      content: '',
      extra_blocks: [{ type: 'thinking', text: 'reasoning content that should be counted' }],
    } as ChatMessageLike;
    const result = describeMessage(message, tokenizer);
    expect(result.usedFallback).toBe(true);
    expect(result.reason).toContain('extra_blocks');
    expect(result.tokens).toBeGreaterThan(MESSAGE_OVERHEAD_TOKENS);
  });

  it('still counts a null-prototype object as structural content', () => {
    const nullProtoBlock = Object.assign(Object.create(null), { note: 'from a Map-like source' });
    const message = { role: 'assistant', content: '', meta: nullProtoBlock } as ChatMessageLike;
    const result = describeMessage(message, tokenizer);
    expect(result.usedFallback).toBe(true);
    expect(result.reason).toContain('meta');
  });
});

describe('describeMessage — unbounded structural-field count', () => {
  // `reasons.push(...unrecognized.reasons)` would spread a caller-input-sized
  // array into a call, which blows the engine's call-argument stack (~125k on
  // Node 24) once a message carries enough extra structural fields. A
  // message shape is entirely caller-controlled (chat-fit passes provider
  // payloads straight through), so this size is not under this package's
  // control.
  it('does not throw for a message with far more extra structural fields than the engine argument limit', () => {
    const STRESS_COUNT = 150_000;
    const message: Record<string, unknown> = { role: 'user', content: 'hi' };
    for (let i = 0; i < STRESS_COUNT; i += 1) {
      message[`extra_${String(i)}`] = [1];
    }
    let result: ReturnType<typeof describeMessage> | undefined;
    expect(() => {
      result = describeMessage(message as unknown as ChatMessageLike, tokenizer);
    }).not.toThrow();
    expect(result?.usedFallback).toBe(true);
    expect(result?.tokens).toBeGreaterThan(STRESS_COUNT);
  });
});

describe('describeMessage', () => {
  it('matches countMessage for an ordinary canonical-shape message, with no fallback', () => {
    const counter = createMessageTokenCounter(tokenizer);
    const message: ChatMessageLike = {
      role: 'user',
      content: 'hi',
      toolCalls: [{ name: 'search', arguments: { query: 'x' } }],
    };
    const described = describeMessage(message, tokenizer);
    expect(described.tokens).toBe(counter.countMessage(message));
    expect(described.usedFallback).toBe(false);
  });

  it('respects overridden overhead options', () => {
    const message: ChatMessageLike = { role: 'user', content: 'hi', name: 'bob' };
    const described = describeMessage(message, tokenizer, {
      tokensPerMessage: 10,
      tokensPerName: 5,
    });
    expect(described.tokens).toBe(10 + tokenizer.count('hi') + 5);
  });

  it('produces a JSON-serializable diagnostic', () => {
    const message = { role: 'assistant', content: '', tool_calls: [{ x: 1 }] } as ChatMessageLike;
    assertJsonSerializable(describeMessage(message, tokenizer), 'MessageAccounting');
  });
});
