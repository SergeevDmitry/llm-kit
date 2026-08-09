import { describe, expect, it } from 'vitest';
import { fitChat } from '../src/fit-chat.js';
import { ChatFitError } from '../src/errors.js';
import { assistant, developer, system, toolExchange, user } from './fixtures/messages.js';

describe('fitChat: basic drop-oldest behavior', () => {
  it('returns everything unchanged when the conversation already fits', () => {
    const messages = [system('be terse'), user('hi'), assistant('hello')];
    const result = fitChat(messages, { maxTokens: 5000 });

    expect(result.messages).toEqual(messages);
    expect(result.report.keptIndexes).toEqual([0, 1, 2]);
    expect(result.report.removedIndexes).toEqual([]);
    expect(result.tokenCount).toBe(result.report.finalTokenCount);
    expect(result.report.finalTokenCount).toBeLessThanOrEqual(result.report.availableBudget);
  });

  it('drops the oldest ordinary turns first, keeping the most recent', () => {
    const messages = Array.from({ length: 20 }, (_, i) =>
      user(`message number ${String(i)} of substantial length`),
    );
    const result = fitChat(messages, { maxTokens: 200 });

    expect(result.messages.length).toBeGreaterThan(0);
    expect(result.messages.length).toBeLessThan(messages.length);
    // The kept slice is a suffix: the last kept message is the very last input message.
    expect(result.messages[result.messages.length - 1]).toBe(messages[messages.length - 1]);
    // Nothing kept has a lower original index than everything dropped.
    const keptIndexes = result.report.keptIndexes;
    const removedIndexes = result.report.removedIndexes;
    expect(Math.max(...removedIndexes)).toBeLessThan(Math.min(...keptIndexes));
  });

  it('preserves system and developer messages wherever they appear, not just leading ones', () => {
    const messages = [
      user('turn 1'),
      assistant('turn 1 reply'),
      system('a rule stated mid-conversation'),
      ...Array.from({ length: 30 }, (_, i) => user(`filler ${String(i)}`)),
      developer('a developer note near the end'),
      user('final turn'),
    ];
    const result = fitChat(messages, { maxTokens: 400 });

    const systemIndex = messages.indexOf(messages[2] as (typeof messages)[number]);
    const developerIndex = messages.length - 2;
    expect(result.messages).toContain(messages[systemIndex]);
    expect(result.messages).toContain(messages[developerIndex]);
    expect(result.report.keptIndexes).toContain(systemIndex);
    expect(result.report.keptIndexes).toContain(developerIndex);
  });

  it('keeps a tool exchange atomic even when trimming around it', () => {
    const messages = [
      ...Array.from({ length: 10 }, (_, i) => user(`old filler ${String(i)}`)),
      ...toolExchange('call-1', 'search', { q: 'weather' }, { temp: 72 }),
      ...Array.from({ length: 5 }, (_, i) => user(`recent filler ${String(i)}`)),
    ];
    const result = fitChat(messages, { maxTokens: 250 });

    const call = messages[10] as (typeof messages)[number];
    const toolMsg = messages[11] as (typeof messages)[number];
    const bothKept = result.messages.includes(call) && result.messages.includes(toolMsg);
    const bothDropped = !result.messages.includes(call) && !result.messages.includes(toolMsg);
    expect(bothKept || bothDropped).toBe(true);
  });

  it('supports a custom preserveRoles list', () => {
    const messages = [
      { role: 'pinned', content: 'always keep me' },
      ...Array.from({ length: 30 }, (_, i) => user(`filler ${String(i)}`)),
    ];
    const result = fitChat(messages, { maxTokens: 300, preserveRoles: ['pinned'] });
    expect(result.messages).toContain(messages[0]);
  });

  it('accepts a custom groupMessages override', () => {
    const messages = [user('a'), assistant('b'), user('c'), assistant('d')];
    // Pair every two messages into one group.
    const result = fitChat(messages, {
      maxTokens: 30,
      groupMessages: (msgs) => {
        const groups: {
          indexes: number[];
          messages: (typeof msgs)[number][];
          toolCallIds: string[];
        }[] = [];
        for (let i = 0; i < msgs.length; i += 2) {
          const first = msgs[i];
          const second = msgs[i + 1];
          if (first === undefined || second === undefined) continue;
          groups.push({ indexes: [i, i + 1], messages: [first, second], toolCallIds: [] });
        }
        return groups;
      },
    });
    // Pairs must survive or vanish together: [0,1] and [2,3].
    const has = (i: number) => result.report.keptIndexes.includes(i);
    expect(has(0)).toBe(has(1));
    expect(has(2)).toBe(has(3));
  });

  it('rejects a groupMessages that does not partition the input exactly once', () => {
    const messages = [user('a'), user('b')];
    expect(() =>
      fitChat(messages, {
        maxTokens: 100,
        groupMessages: () => [{ indexes: [0], messages: [messages[0]], toolCallIds: [] }],
      }),
    ).toThrowError(ChatFitError);
  });

  it('rejects a groupMessages that duplicates an index across groups', () => {
    const messages = [user('a'), user('b')];
    expect(() =>
      fitChat(messages, {
        maxTokens: 100,
        groupMessages: () => [
          { indexes: [0], messages: [messages[0]], toolCallIds: [] },
          { indexes: [0, 1], messages: [messages[0], messages[1]], toolCallIds: [] },
        ],
      }),
    ).toThrowError(ChatFitError);
  });

  it('rejects a groupMessages that reports an out-of-range index', () => {
    const messages = [user('a')];
    expect(() =>
      fitChat(messages, {
        maxTokens: 100,
        groupMessages: () => [{ indexes: [5], messages: [messages[0]], toolCallIds: [] }],
      }),
    ).toThrowError(ChatFitError);
  });

  it('rejects invalid options', () => {
    expect(() => fitChat([user('x')], { maxTokens: Number.NaN })).toThrow(ChatFitError);
    expect(() => fitChat([user('x')], { maxTokens: 100, reserveTokens: -1 })).toThrow(ChatFitError);
    expect(() => fitChat([user('x')], { maxTokens: 100, safetyMarginTokens: -1 })).toThrow(
      ChatFitError,
    );
  });

  it('handles an empty message array', () => {
    const result = fitChat([], { maxTokens: 100 });
    expect(result.messages).toEqual([]);
    expect(result.tokenCount).toBe(0);
    expect(result.report.keptIndexes).toEqual([]);
    expect(result.report.removedIndexes).toEqual([]);
  });
});
