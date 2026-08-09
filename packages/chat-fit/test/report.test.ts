import { assertJsonSerializable } from '@llm-kit/test-utils';
import type { MessageTokenCounter } from '@llm-kit/tokenizer';
import { describe, expect, it } from 'vitest';
import { fitChat } from '../src/fit-chat.js';
import type { ChatMessage, MessageGroup } from '../src/types.js';
import { assistant, system, toolExchange, user } from './fixtures/messages.js';

describe('FitChatReport', () => {
  it('is JSON-serializable end to end', () => {
    const messages = [
      system('rules'),
      ...Array.from({ length: 20 }, (_, i) => user(`filler ${String(i)}`)),
      ...toolExchange('c1', 'search', { q: 1 }, { ok: true }),
      assistant('final reply'),
    ];
    const result = fitChat(messages, { maxTokens: 300 });
    assertJsonSerializable(result.report, 'FitChatReport');
    assertJsonSerializable(result, 'FitChatResult');
  });

  it('reports toolCallGroups with kept status matching the actual output', () => {
    const messages = [
      ...Array.from({ length: 20 }, (_, i) => user(`old filler ${String(i)}`)),
      ...toolExchange('kept-call', 'search', { q: 1 }, { ok: true }),
    ];
    const result = fitChat(messages, { maxTokens: 5000 });
    const group = result.report.toolCallGroups.find((g) => g.toolCallIds.includes('kept-call'));
    expect(group?.kept).toBe(true);
  });

  it('reports counterId and approximateTokenization for the default tokenizer', () => {
    const result = fitChat([user('hi')], { maxTokens: 100 });
    expect(result.report.counterId).toContain('approx');
    expect(result.report.approximateTokenization).toBe(true);
  });

  it('includes a warning naming the approximate tokenizer', () => {
    const result = fitChat([user('hi')], { maxTokens: 100 });
    expect(result.report.warnings.some((w) => w.includes('approximate tokenizer'))).toBe(true);
  });

  it('reports removedIndexes for messages dropped under a tight budget', () => {
    const messages = Array.from({ length: 30 }, (_, i) => user(`message ${String(i)}`.repeat(3)));
    const result = fitChat(messages, { maxTokens: 150 });
    expect(result.report.removedIndexes.length).toBeGreaterThan(0);
    expect(result.report.removedIndexes.length + result.report.keptIndexes.length).toBe(
      messages.length,
    );
  });

  it('initialTokenCount reflects the whole input, independent of the final budget', () => {
    const messages = Array.from({ length: 10 }, (_, i) => user(`message ${String(i)}`));
    const full = fitChat(messages, { maxTokens: 100000 });
    const trimmed = fitChat(messages, { maxTokens: 50 });
    expect(trimmed.report.initialTokenCount).toBe(full.report.initialTokenCount);
    expect(trimmed.report.finalTokenCount).toBeLessThan(trimmed.report.initialTokenCount);
  });

  // A caller-supplied `messageTokenCounter` overrides counting entirely, but
  // `MessageTokenCounter` (from `@llm-kit/tokenizer`) declares nothing about
  // whether it is exact — so a custom counter, even one that genuinely
  // counts exactly, must be reported as `'unknown'`, not mislabeled as
  // chat-fit's own bundled approximate tokenizer.
  describe('a custom messageTokenCounter, supplied without a tokenizer option', () => {
    const exactCounter: MessageTokenCounter<ChatMessage> = {
      id: 'custom-exact',
      countMessage: (message) => (typeof message.content === 'string' ? message.content.length : 1),
      countMessages: (messages) =>
        messages.reduce(
          (total, message) =>
            total + (typeof message.content === 'string' ? message.content.length : 1),
          0,
        ),
    };

    it('reports its own id as counterId, never the bundled approximate tokenizer', () => {
      const result = fitChat([user('hi')], {
        maxTokens: 100,
        messageTokenCounter: exactCounter,
      });
      expect(result.report.counterId).toBe('custom-exact');
    });

    it('reports approximateTokenization as "unknown" — neither true nor false', () => {
      const result = fitChat([user('hi')], {
        maxTokens: 100,
        messageTokenCounter: exactCounter,
      });
      expect(result.report.approximateTokenization).toBe('unknown');
      expect(result.report.approximateTokenization).not.toBe(true);
      expect(result.report.approximateTokenization).not.toBe(false);
    });

    it('warns about unverifiable exactness, naming the custom counter, never calling it "the approximate tokenizer"', () => {
      const result = fitChat([user('hi')], {
        maxTokens: 100,
        messageTokenCounter: exactCounter,
      });
      const warning = result.report.warnings.find((w) => w.includes('custom-exact'));
      expect(warning).toBeDefined();
      expect(warning).toMatch(/cannot verify/);
      expect(warning).not.toMatch(/the approximate tokenizer \("custom-exact"\)/);
    });

    it('stays JSON-serializable with the "unknown" provenance state', () => {
      const result = fitChat([user('hi')], {
        maxTokens: 100,
        messageTokenCounter: exactCounter,
      });
      assertJsonSerializable(result.report, 'FitChatReport');
    });
  });

  // `buildReport` must not build `keptIndexes`/`removedIndexes` via
  // `push(...group.indexes)`: a single atomic group whose `indexes` array
  // grows past the engine's call-argument limit (~125k) would throw
  // `RangeError: Maximum call stack size exceeded` — reachable whenever one
  // tool-call group (or a caller's own `groupMessages`) grows large enough,
  // which the default union-find grouping can also reach.
  it('does not throw when a single group spans 200,000 messages', () => {
    const size = 200_000;
    const messages: ChatMessage[] = Array.from({ length: size }, (_, i) => user(`m${String(i)}`));

    // A trivial O(1)-per-message counter keeps this test fast; the
    // regression under test is in `buildReport`'s index bookkeeping, not
    // token counting.
    const cheapCounter: MessageTokenCounter<ChatMessage> = {
      id: 'cheap-v1',
      countMessage: () => 1,
      countMessages: (msgs) => msgs.length,
    };
    const oneGroup = (msgs: readonly ChatMessage[]): readonly MessageGroup<ChatMessage>[] => [
      { indexes: msgs.map((_, i) => i), messages: msgs, toolCallIds: [] },
    ];

    const result = fitChat(messages, {
      maxTokens: size + 10,
      maxMessages: size,
      messageTokenCounter: cheapCounter,
      groupMessages: oneGroup,
    });

    expect(result.messages).toHaveLength(size);
    expect(result.report.keptIndexes).toHaveLength(size);
    expect(result.report.removedIndexes).toHaveLength(0);
  });

  it('a default counter over an injected non-approximate Tokenizer reports approximateTokenization: false, not "unknown"', () => {
    const exactTokenizer = {
      id: 'exact-test-tokenizer-v1',
      count: (text: string) => text.length,
    };
    const result = fitChat([user('hi')], { maxTokens: 100, tokenizer: exactTokenizer });
    expect(result.report.approximateTokenization).toBe(false);
    expect(result.report.warnings.some((w) => w.includes('cannot verify'))).toBe(false);
    expect(result.report.warnings.some((w) => w.includes('approximate tokenizer'))).toBe(false);
  });
});
