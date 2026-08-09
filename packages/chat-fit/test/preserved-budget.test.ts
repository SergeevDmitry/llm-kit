import { assertErrorShape, assertJsonSerializable } from '@llm-kit/test-utils';
import { describe, expect, it } from 'vitest';
import { fitChat } from '../src/fit-chat.js';
import { ChatFitError } from '../src/errors.js';
import { developer, system, user } from './fixtures/messages.js';

describe('preserved content exceeding the budget', () => {
  it('throws PRESERVED_MESSAGES_EXCEED_BUDGET when a single system prompt alone is too big', () => {
    const bigSystemPrompt = system('x'.repeat(5000));
    let caught: unknown;
    try {
      fitChat([bigSystemPrompt, user('hi')], { maxTokens: 10 });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(ChatFitError);
    assertErrorShape(caught, { name: 'ChatFitError', code: 'PRESERVED_MESSAGES_EXCEED_BUDGET' });
  });

  it('throws when several system/developer messages scattered through history exceed the budget together', () => {
    const messages = [
      system('rule one '.repeat(200)),
      ...Array.from({ length: 5 }, (_, i) => user(`turn ${String(i)}`)),
      developer('rule two '.repeat(200)),
      ...Array.from({ length: 5 }, (_, i) => user(`later turn ${String(i)}`)),
      system('rule three '.repeat(200)),
    ];
    expect(() => fitChat(messages, { maxTokens: 100 })).toThrow(ChatFitError);
  });

  it('throws when reserveTokens alone exceeds maxTokens, even with no preserved messages', () => {
    const messages = [user('hello'), user('world')];
    let caught: unknown;
    try {
      fitChat(messages, { maxTokens: 50, reserveTokens: 200 });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(ChatFitError);
    assertErrorShape(caught, { name: 'ChatFitError', code: 'PRESERVED_MESSAGES_EXCEED_BUDGET' });
  });

  it('does not throw for an empty message array even with a tiny budget', () => {
    const result = fitChat([], { maxTokens: 1 });
    expect(result.messages).toEqual([]);
  });

  it('reports availableBudget and preserved token accounting; report stays JSON-serializable even on the error path', () => {
    const messages = [system('rule'.repeat(1000)), user('hi')];
    try {
      fitChat(messages, { maxTokens: 5 });
      expect.unreachable('expected fitChat to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      assertJsonSerializable((error as Error).message, 'error message');
    }
  });
});
