import { assertJsonSerializable } from '@llm-kit/test-utils';
import { describe, expect, it, vi } from 'vitest';
import { fitChatAsync } from '../src/fit-chat-async.js';
import { ChatFitError } from '../src/errors.js';
import type { ChatMessage, SummaryRequest } from '../src/types.js';
import {
  assistant,
  assistantWithToolCalls,
  system,
  toolExchange,
  toolResult,
  user,
} from './fixtures/messages.js';

function longConversation(turns: number): ChatMessage[] {
  const messages: ChatMessage[] = [];
  for (let i = 0; i < turns; i += 1) {
    messages.push(user(`user turn ${String(i)} with some padding text to spend tokens`));
    messages.push(assistant(`assistant reply ${String(i)} with some padding text to spend tokens`));
  }
  return messages;
}

describe('fitChatAsync: summarize-middle', () => {
  it('replaces the dropped middle range with a summary message inserted at its boundary', async () => {
    const messages = longConversation(30);
    const summarizer = vi.fn(async (request: SummaryRequest<ChatMessage>) =>
      system(`summary of ${String(request.messages.length)} messages`),
    );

    const result = await fitChatAsync(messages, {
      maxTokens: 400,
      strategy: 'summarize-middle',
      summary: { summarizer },
    });

    expect(summarizer).toHaveBeenCalledTimes(1);
    expect(result.report.summarizedRange).toBeDefined();
    expect(result.report.summaryAttempts).toBe(1);
    // The summary message itself is present, and appears before the kept suffix.
    const summaryContent = `summary of ${String(result.report.summarizedRange?.messageCount)} messages`;
    const summaryMessage = result.messages.find(
      (m) => typeof m === 'object' && m !== null && (m as ChatMessage).content === summaryContent,
    );
    expect(summaryMessage).toBeDefined();
    expect(result.messages.indexOf(summaryMessage as ChatMessage)).toBeLessThan(
      result.messages.length - 1,
    );
  });

  it('never partially summarizes a tool-call group: a group inside the range is entirely removed', async () => {
    const messages = [
      ...longConversation(10),
      ...toolExchange('mid-call', 'lookup', { q: 1 }, { ok: true }),
      ...longConversation(10),
    ];
    const summarizer = vi.fn(async () => system('summary'));

    const result = await fitChatAsync(messages, {
      maxTokens: 350,
      strategy: 'summarize-middle',
      summary: { summarizer },
    });

    const call = messages.find(
      (m) => (m as ChatMessage).toolCalls?.some((c) => c.id === 'mid-call') === true,
    ) as ChatMessage;
    const toolMsg = messages.find(
      (m) => (m as ChatMessage).toolCallId === 'mid-call',
    ) as ChatMessage;
    const hasCall = result.messages.includes(call);
    const hasResult = result.messages.includes(toolMsg);
    expect(hasCall).toBe(hasResult);
  });

  it('retries a summary that exceeds its requested budget, then falls back to dropping the range', async () => {
    let calls = 0;
    const summarizer = vi.fn(async (request: SummaryRequest<ChatMessage>) => {
      calls += 1;
      return system('way '.repeat(2000) + `too long ${String(request.maxSummaryTokens)}`);
    });

    const messages = longConversation(30);
    const result = await fitChatAsync(messages, {
      maxTokens: 400,
      strategy: 'summarize-middle',
      summary: { summarizer, maxAttempts: 3 },
    });

    expect(calls).toBe(3);
    expect(result.report.summaryAttempts).toBe(3);
    expect(result.report.summarizedRange).toBeUndefined();
    expect(result.report.warnings.join('\n')).toMatch(/attempts exhausted/);
    expect(result.report.finalTokenCount).toBeLessThanOrEqual(result.report.availableBudget);
  });

  it('preserves cause when the summarizer throws', async () => {
    const originalError = new Error('boom from the summarizer');
    const summarizer = vi.fn(async () => {
      throw originalError;
    });

    const messages = longConversation(30);
    let caught: unknown;
    try {
      await fitChatAsync(messages, {
        maxTokens: 400,
        strategy: 'summarize-middle',
        summary: { summarizer },
      });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(ChatFitError);
    expect((caught as ChatFitError).code).toBe('SUMMARY_FAILED');
    expect((caught as ChatFitError).cause).toBe(originalError);
  });

  it('propagates an abort raised during summarization, unwrapped', async () => {
    const controller = new AbortController();
    const summarizer = vi.fn(async (request: SummaryRequest<ChatMessage>) => {
      await Promise.resolve();
      request.signal?.throwIfAborted();
      return system('unreachable');
    });

    const messages = longConversation(30);
    const promise = fitChatAsync(messages, {
      maxTokens: 400,
      strategy: 'summarize-middle',
      summary: { summarizer },
      signal: controller.signal,
    });
    controller.abort(new Error('cancelled by test'));

    await expect(promise).rejects.toThrow('cancelled by test');
  });

  it('propagates an abort that is already set before the call starts', async () => {
    const controller = new AbortController();
    controller.abort(new Error('already aborted'));
    const summarizer = vi.fn(async () => system('unreachable'));

    await expect(
      fitChatAsync(longConversation(10), {
        maxTokens: 200,
        strategy: 'summarize-middle',
        summary: { summarizer },
        signal: controller.signal,
      }),
    ).rejects.toThrow('already aborted');
    expect(summarizer).not.toHaveBeenCalled();
  });

  // Cross-package consistency: `llm-backoff` and `vec-cache` both normalize
  // a non-Error abort reason into a real `Error` via `toAbortError`.
  // `chat-fit` does the same, rather than propagating whatever value
  // `AbortController.abort()` was called with (a string, a plain object,
  // `undefined`, ...) raw.
  it('normalizes a non-Error abort reason set before the call starts', async () => {
    const controller = new AbortController();
    controller.abort('not an Error');
    const summarizer = vi.fn(async () => system('unreachable'));

    let caught: unknown;
    try {
      await fitChatAsync(longConversation(10), {
        maxTokens: 200,
        strategy: 'summarize-middle',
        summary: { summarizer },
        signal: controller.signal,
      });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).name).toBe('AbortError');
    expect(summarizer).not.toHaveBeenCalled();
  });

  it('normalizes a non-Error abort reason set mid-summarization', async () => {
    const controller = new AbortController();
    // Does not check `request.signal` itself — chat-fit's own post-callback
    // check (`summarizeMiddle`) is what must catch and normalize this.
    const summarizer = vi.fn(async () => {
      await Promise.resolve();
      return system('reply');
    });

    const messages = longConversation(30);
    const promise = fitChatAsync(messages, {
      maxTokens: 400,
      strategy: 'summarize-middle',
      summary: { summarizer },
      signal: controller.signal,
    });
    controller.abort({ code: 'CANCELLED' });

    let caught: unknown;
    try {
      await promise;
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).name).toBe('AbortError');
  });

  it('drops the range without calling the summarizer when no budget remains for one', async () => {
    const summarizer = vi.fn(async () => system('unreachable'));
    const messages = longConversation(30);

    const result = await fitChatAsync(messages, {
      maxTokens: 0,
      strategy: 'summarize-middle',
      summary: { summarizer },
    });

    expect(summarizer).not.toHaveBeenCalled();
    expect(result.report.summaryAttempts).toBe(0);
    expect(result.report.warnings.join('\n')).toMatch(/no token budget remained/);
  });

  it('falls back to strategy drop-oldest semantics when there is no middle range to summarize', async () => {
    const summarizer = vi.fn(async () => system('unreachable'));
    const messages = [user('hi'), assistant('hello')];

    const result = await fitChatAsync(messages, {
      maxTokens: 5000,
      strategy: 'summarize-middle',
      summary: { summarizer },
    });

    expect(summarizer).not.toHaveBeenCalled();
    expect(result.messages).toEqual(messages);
  });

  it('requires a summarizer when strategy is summarize-middle', async () => {
    await expect(
      fitChatAsync(longConversation(3), { maxTokens: 100, strategy: 'summarize-middle' }),
    ).rejects.toThrow(ChatFitError);
  });

  it('produces a JSON-serializable report end to end', async () => {
    const summarizer = vi.fn(async () => system('summary'));
    const result = await fitChatAsync(longConversation(30), {
      maxTokens: 400,
      strategy: 'summarize-middle',
      summary: { summarizer },
    });
    assertJsonSerializable(result.report, 'FitChatReport');
  });
});

describe('fitChatAsync: the order the summarizer reads the range in', () => {
  // Groups are ordered by their first index, but a tool-call group's indexes
  // need not be contiguous: parallel calls can have their results interleaved
  // with other turns, and two assistant turns' calls can come back in reverse
  // order. Flattening the dropped groups one at a time reorders the
  // transcript, so a summarizer reading it sees replies before the messages
  // they answer.

  const pad = 'padding '.repeat(12);

  /** 0 user, 1 assistant calling a and b, 2 result a, 3 user interjection, 4 result b. */
  function interleavedResults(): ChatMessage[] {
    return withTail([
      user(`idx0 ${pad}`),
      assistantWithToolCalls(`idx1 ${pad}`, [
        { id: 'a', name: 'lookup', arguments: {} },
        { id: 'b', name: 'search', arguments: {} },
      ]),
      toolResult('a', `idx2 ${pad}`),
      user(`idx3 ${pad}`),
      toolResult('b', `idx4 ${pad}`),
    ]);
  }

  /** Two assistant turns whose results come back in reverse order: groups {1,4} and {2,3}. */
  function reversedResults(): ChatMessage[] {
    return withTail([
      user(`idx0 ${pad}`),
      assistantWithToolCalls(`idx1 ${pad}`, [{ id: 'a', name: 'lookup', arguments: {} }]),
      assistantWithToolCalls(`idx2 ${pad}`, [{ id: 'b', name: 'search', arguments: {} }]),
      toolResult('b', `idx3 ${pad}`),
      toolResult('a', `idx4 ${pad}`),
    ]);
  }

  /** Enough recent filler that the five interesting messages all land in the dropped range. */
  function withTail(head: readonly ChatMessage[]): ChatMessage[] {
    const messages = [...head];
    for (let i = 0; i < 8; i += 1) messages.push(user(`tail ${String(i)}`));
    return messages;
  }

  async function rangeSeenBySummarizer(messages: readonly ChatMessage[]) {
    let seen: readonly ChatMessage[] = [];
    await fitChatAsync(messages, {
      maxTokens: 90,
      strategy: 'summarize-middle',
      summary: {
        summarizer: async (request: SummaryRequest<ChatMessage>) => {
          seen = request.messages;
          return user('sum');
        },
        maxSummaryTokens: 20,
      },
    });
    return seen;
  }

  it.each([
    ['results interleaved with another turn', interleavedResults],
    ['two turns whose results come back reversed', reversedResults],
  ])('reads a non-contiguous tool group in original order (%s)', async (_label, build) => {
    const seen = await rangeSeenBySummarizer(build());
    expect(seen.map((m) => String(m.content).slice(0, 4))).toEqual([
      'idx0',
      'idx1',
      'idx2',
      'idx3',
      'idx4',
    ]);
  });

  it('reads strictly ascending original indexes, with no message twice', async () => {
    for (const build of [interleavedResults, reversedResults]) {
      const messages = build();
      const indexOf = new Map(messages.map((message, index) => [message, index]));
      const indexes = (await rangeSeenBySummarizer(messages)).map(
        (message) => indexOf.get(message) as number,
      );

      expect(indexes.length).toBeGreaterThan(0);
      expect(indexes).toEqual([...indexes].sort((a, b) => a - b));
      expect(new Set(indexes).size).toBe(indexes.length);
    }
  });
});

describe('fitChatAsync: messages given up to make room for the summary', () => {
  // The summarizer is only handed the dropped middle range. When the summary
  // it returns still does not fit, `verifyAndTrim` trims the newest kept
  // groups next, and no summary replaces those. `summarizedRange` counts the
  // range alone, so `trimmedForSummaryIndexes` is what accounts for the rest
  // of `removedIndexes`.

  /** Big old turns, then short recent ones, so the greedy pass can stop with slack to spare. */
  function unevenConversation(): ChatMessage[] {
    const messages: ChatMessage[] = [];
    for (let i = 0; i < 10; i += 1) {
      messages.push(user(`old turn ${String(i)} ${'padding '.repeat(30)}`));
    }
    for (let i = 0; i < 6; i += 1) messages.push(user(`hi ${String(i)}`));
    return messages;
  }

  it.each([200, 300, 400, 500])(
    'names them and reconciles the report against removedIndexes (maxTokens %i)',
    async (maxTokens) => {
      const result = await fitChatAsync(longConversation(30), {
        maxTokens,
        strategy: 'summarize-middle',
        summary: { summarizer: async () => system('summary of the earlier conversation') },
      });

      const range = result.report.summarizedRange;
      const trimmed = result.report.trimmedForSummaryIndexes;
      expect(range).toBeDefined();
      expect(trimmed).toBeDefined();
      // The defect: the greedy pass has already spent the budget, so a
      // summary of any size costs at least one kept group.
      expect(trimmed?.length).toBeGreaterThan(0);

      // The whole point of the field - the report now adds up.
      expect((range?.messageCount ?? 0) + (trimmed?.length ?? 0)).toBe(
        result.report.removedIndexes.length,
      );
      // Every named index really is gone from the output, and really is
      // reported as removed.
      for (const index of trimmed ?? []) {
        expect(result.report.removedIndexes).toContain(index);
        expect(result.report.keptIndexes).not.toContain(index);
      }
      expect([...(trimmed ?? [])].sort((a, b) => a - b)).toEqual(trimmed);

      // summarizedRange is not widened to swallow them: the summarizer never
      // saw these messages, so claiming the range covered them would trade a
      // silent loss for a false one.
      expect(range?.messageCount).toBeLessThan(result.report.removedIndexes.length);

      const warning = result.report.warnings.find((w) => w.includes('trimmed to fit the summary'));
      expect(warning).toBeDefined();
      expect(warning).toContain(`${String(trimmed?.length)} message(s)`);
      assertJsonSerializable(result.report, 'FitChatReport');
    },
  );

  it('is present but empty when the summary fit without giving anything up', async () => {
    const result = await fitChatAsync(unevenConversation(), {
      maxTokens: 50,
      strategy: 'summarize-middle',
      summary: { summarizer: async () => user('sum'), maxSummaryTokens: 30 },
    });

    expect(result.report.summarizedRange).toBeDefined();
    expect(result.report.trimmedForSummaryIndexes).toEqual([]);
    expect(result.report.summarizedRange?.messageCount).toBe(result.report.removedIndexes.length);
    expect(result.report.warnings.some((w) => w.includes('trimmed to fit the summary'))).toBe(
      false,
    );
  });

  it('is absent whenever summarizedRange is: no summary means nothing to reconcile', async () => {
    const dropOldest = await fitChatAsync(longConversation(30), { maxTokens: 400 });
    expect(dropOldest.report.summarizedRange).toBeUndefined();
    expect(dropOldest.report.trimmedForSummaryIndexes).toBeUndefined();

    // Summarizer never runs: everything already fits.
    const nothingDropped = await fitChatAsync(longConversation(2), {
      maxTokens: 5_000,
      strategy: 'summarize-middle',
      summary: { summarizer: async () => system('summary') },
    });
    expect(nothingDropped.report.summarizedRange).toBeUndefined();
    expect(nothingDropped.report.trimmedForSummaryIndexes).toBeUndefined();
  });
});
