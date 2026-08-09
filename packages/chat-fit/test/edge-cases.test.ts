import type { MessageTokenCounter, Tokenizer } from '@llm-kit/tokenizer';
import { describe, expect, it } from 'vitest';
import { fitChat } from '../src/fit-chat.js';
import { ChatFitError } from '../src/errors.js';
import type { ChatMessage } from '../src/types.js';
import { user } from './fixtures/messages.js';

describe('edge cases', () => {
  it('handles non-string multimodal content without throwing, and flags the fallback in warnings', () => {
    const imageMessage: ChatMessage = {
      role: 'user',
      content: [
        { type: 'text', text: 'look at this' },
        { type: 'image', url: 'data:image/png;base64,AAAA', width: 100, height: 100 },
      ],
    };
    const objectContentMessage: ChatMessage = { role: 'user', content: { weird: 'shape', n: 1 } };

    const result = fitChat([imageMessage, objectContentMessage, user('normal text')], {
      maxTokens: 5000,
    });

    expect(result.messages).toHaveLength(3);
    expect(result.report.warnings.some((w) => w.includes('message 0'))).toBe(true);
    expect(result.report.warnings.some((w) => w.includes('message 1'))).toBe(true);
  });

  it('never throws on content that cannot even be JSON-serialized (circular reference)', () => {
    const circular: Record<string, unknown> = { role: 'user' };
    circular.content = circular;
    const result = fitChat([circular], { maxTokens: 5000 });
    expect(result.messages).toHaveLength(1);
  });

  it('wraps a throwing tokenizer as TOKEN_COUNTING_FAILED and preserves cause', () => {
    const originalError = new Error('tokenizer exploded');
    const throwingTokenizer: Tokenizer = {
      id: 'throws-v1',
      count: () => {
        throw originalError;
      },
    };

    let caught: unknown;
    try {
      fitChat([user('hi')], { maxTokens: 100, tokenizer: throwingTokenizer });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(ChatFitError);
    expect((caught as ChatFitError).code).toBe('TOKEN_COUNTING_FAILED');
    expect((caught as ChatFitError).cause).toBe(originalError);
  });

  it('wraps a throwing custom messageTokenCounter as TOKEN_COUNTING_FAILED', () => {
    const originalError = new Error('counter exploded');
    const throwingCounter: MessageTokenCounter<ChatMessage> = {
      id: 'throws-counter-v1',
      countMessage: () => {
        throw originalError;
      },
      countMessages: () => {
        throw originalError;
      },
    };

    expect(() =>
      fitChat([user('hi')], { maxTokens: 100, messageTokenCounter: throwingCounter }),
    ).toThrow(ChatFitError);
  });

  it('reserveTokens exceeding maxTokens is reported via availableBudget, not silently clamped', () => {
    let caught: unknown;
    try {
      fitChat([user('hi')], { maxTokens: 10, reserveTokens: 100 });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(ChatFitError);
    expect((caught as ChatFitError).message).toMatch(/-90/);
  });

  it('defaults safetyMarginTokens to 0', () => {
    const result = fitChat([user('hi')], { maxTokens: 100 });
    expect(result.report.safetyMarginTokens).toBe(0);
    expect(result.report.availableBudget).toBe(100);
  });

  it('never mutates the input messages array or its contents', () => {
    const messages = [user('a'), user('b'), user('c')];
    const snapshot = JSON.parse(JSON.stringify(messages)) as unknown;
    fitChat(messages, { maxTokens: 15 });
    expect(JSON.parse(JSON.stringify(messages))).toEqual(snapshot);
  });

  // A legacy `function_call` message's real payload must not be invisible
  // to the default counter — if it were, a budget the conversation actually
  // exceeds by two orders of magnitude could be reported as fitting
  // comfortably. The regression this guards is not "the number changed" —
  // it is that an over-budget message must never be reported as kept.
  it('an unrecognized structural payload cannot make an over-budget message look like it fits', () => {
    const functionCallMessage = {
      role: 'assistant',
      content: null,
      function_call: {
        name: 'search_flights',
        arguments: JSON.stringify({ query: 'x'.repeat(4000) }),
      },
    };
    const messages = [functionCallMessage, user('go')];

    const result = fitChat(messages, { maxTokens: 200 });

    // The function_call message alone is far larger than the 200-token
    // budget once its payload is actually counted — it must be dropped,
    // not reported as kept.
    expect(result.report.keptIndexes).not.toContain(0);
    // Whatever chat-fit did keep must genuinely fit — no message that
    // "fits" on paper while actually exceeding the budget.
    expect(result.tokenCount).toBeLessThanOrEqual(200);
    expect(result.report.finalTokenCount).toBeLessThanOrEqual(200);
  });

  // `maxMessages` bounds `messages.length`, throwing a stable `ChatFitError`
  // before any grouping or counting begins.
  describe('maxMessages', () => {
    it('throws INPUT_TOO_LARGE when messages.length exceeds the configured cap', () => {
      const messages = [user('a'), user('b'), user('c')];
      let caught: unknown;
      try {
        fitChat(messages, { maxTokens: 100, maxMessages: 2 });
      } catch (error) {
        caught = error;
      }
      expect(caught).toBeInstanceOf(ChatFitError);
      expect((caught as ChatFitError).code).toBe('INPUT_TOO_LARGE');
    });

    it('accepts messages.length exactly at the cap', () => {
      const messages = [user('a'), user('b')];
      expect(() => fitChat(messages, { maxTokens: 5000, maxMessages: 2 })).not.toThrow();
    });

    it('is enforced before any token counting (the tokenizer is never invoked)', () => {
      let callCount = 0;
      const countingTokenizer: Tokenizer = {
        id: 'counting-v1',
        count: () => {
          callCount += 1;
          return 1;
        },
      };
      let caught: unknown;
      try {
        fitChat([user('a'), user('b'), user('c')], {
          maxTokens: 100,
          maxMessages: 2,
          tokenizer: countingTokenizer,
        });
      } catch (error) {
        caught = error;
      }
      expect((caught as ChatFitError).code).toBe('INPUT_TOO_LARGE');
      expect(callCount).toBe(0);
    });
  });
});
