import { assertJsonSerializable } from '@llm-kit/test-utils';
import { describe, expect, it, vi } from 'vitest';
import { fitChatAsync } from '../src/fit-chat-async.js';
import { ChatFitError } from '../src/errors.js';
import type { ChatMessage, SummaryRequest } from '../src/types.js';
import { assistant, system, toolExchange, user } from './fixtures/messages.js';

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
