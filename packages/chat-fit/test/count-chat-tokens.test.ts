/**
 * `countChatTokens`: the conversation's token count on its own, without
 * running a fit.
 *
 * Equivalence with `fitChat` is what these tests are for. If the two ever
 * drift, a caller who sizes a budget with one and trims with the other gets a
 * result that does not fit.
 */
import { assertJsonSerializable } from '@llm-kit/test-utils';
import { describe, expect, it } from 'vitest';
import { countChatTokens } from '../src/count-chat-tokens.js';
import { fitChat } from '../src/fit-chat.js';
import { ChatFitError } from '../src/errors.js';
import { APPROX_TOKENIZER_ID, approximateTokenizer } from '@llm-kit/tokenizer';
import type { ChatMessage, Tokenizer } from '../src/types.js';
import { assistantWithToolCalls, system, toolResult, user } from './fixtures/messages.js';

/** The shapes the default counter reads: plain content, parallel tool calls, their results. */
function mixedConversation(): ChatMessage[] {
  return [
    system('you are a careful assistant'),
    user('what is the weather in Lisbon and in Porto?'),
    assistantWithToolCalls('checking both', [
      { id: 'a', name: 'weather', arguments: { city: 'Lisbon' } },
      { id: 'b', name: 'weather', arguments: { city: 'Porto' } },
    ]),
    toolResult('a', { tempC: 19 }),
    toolResult('b', { tempC: 17 }),
    { role: 'assistant', content: 'Lisbon 19C, Porto 17C' },
  ];
}

/** Exact-looking tokenizer: a different id, so `approximate` must come back false. */
const exactTokenizer: Tokenizer = {
  id: 'test-exact-tokenizer',
  count: (text) => text.length,
};

describe('countChatTokens', () => {
  it('matches the initialTokenCount fitChat reports for the same input', () => {
    for (const messages of [mixedConversation(), [], [user('hi')]]) {
      const counted = countChatTokens(messages);
      const fitted = fitChat(messages, { maxTokens: 1_000_000 });
      expect(counted.tokens).toBe(fitted.report.initialTokenCount);
      expect(counted.counterId).toBe(fitted.report.counterId);
    }
  });

  it('matches fitChat under an injected tokenizer too', () => {
    const messages = mixedConversation();
    const counted = countChatTokens(messages, { tokenizer: exactTokenizer });
    const fitted = fitChat(messages, { maxTokens: 1_000_000, tokenizer: exactTokenizer });
    expect(counted.tokens).toBe(fitted.report.initialTokenCount);
    expect(counted.counterId).toBe(fitted.report.counterId);
  });

  it('counts an empty conversation as zero, with no conversation overhead', () => {
    expect(countChatTokens([]).tokens).toBe(0);
  });

  it('flags the bundled approximate tokenizer, and says so in warnings', () => {
    const result = countChatTokens([user('hello')]);
    expect(result.approximate).toBe(true);
    expect(result.counterId).toContain(APPROX_TOKENIZER_ID);
    expect(result.warnings.some((w) => w.includes('upper bound'))).toBe(true);
  });

  it('does not flag an injected tokenizer as approximate', () => {
    const result = countChatTokens([user('hello')], { tokenizer: exactTokenizer });
    expect(result.approximate).toBe(false);
    expect(result.counterId).toContain('test-exact-tokenizer');
    expect(result.warnings).toEqual([]);
  });

  it('passing the bundled tokenizer explicitly is the same as passing nothing', () => {
    const messages = mixedConversation();
    expect(countChatTokens(messages, { tokenizer: approximateTokenizer })).toEqual(
      countChatTokens(messages),
    );
  });

  it('names a message whose shape it had to guess at, with the index the caller passed', () => {
    const messages = [
      user('fine'),
      { role: 'assistant', content: 'ok', function_call: { name: 'legacy', arguments: '{}' } },
    ] as ChatMessage[];

    const result = countChatTokens(messages);
    const flagged = result.warnings.filter((w) => w.startsWith('message '));
    expect(flagged).toHaveLength(1);
    expect(flagged[0]).toContain('message 1:');
    // The unrecognized field is charged, not counted as free.
    expect(result.tokens).toBeGreaterThan(countChatTokens([user('fine'), user('ok')]).tokens);
  });

  it('rejects more messages than maxMessages allows, before counting anything', () => {
    let counted = 0;
    const countingTokenizer: Tokenizer = {
      id: 'counting',
      count: (text) => {
        counted += 1;
        return text.length;
      },
    };

    expect(() =>
      countChatTokens([user('a'), user('b'), user('c')], {
        maxMessages: 2,
        tokenizer: countingTokenizer,
      }),
    ).toThrow(ChatFitError);
    expect(counted).toBe(0);

    expect(() =>
      countChatTokens([user('a'), user('b')], { maxMessages: 2, tokenizer: countingTokenizer }),
    ).not.toThrow();
  });

  it('surfaces a throwing tokenizer as TOKEN_COUNTING_FAILED, keeping the cause', () => {
    const boom = new Error('tokenizer exploded');
    const throwingTokenizer: Tokenizer = {
      id: 'throwing',
      count: () => {
        throw boom;
      },
    };

    let caught: unknown;
    try {
      countChatTokens([user('hi')], { tokenizer: throwingTokenizer });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(ChatFitError);
    expect((caught as ChatFitError).code).toBe('TOKEN_COUNTING_FAILED');
    expect((caught as ChatFitError).cause).toBe(boom);
  });

  it('returns a JSON-serializable result', () => {
    assertJsonSerializable(countChatTokens(mixedConversation()), 'ChatTokenCount');
  });
});
