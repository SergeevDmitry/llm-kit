/**
 * Throughput baseline for `fitChat` (`vitest bench`), not a correctness
 * check — `test/atomicity.property.test.ts` and friends own that. Tracks
 * how selection scales with conversation size, across thousands of
 * messages, and separately how a conversation dense with multi-tool-call
 * exchanges compares to one that is mostly plain turns, since grouping does
 * real per-message linking work `drop-oldest` selection does not need for
 * an all-ordinary conversation.
 */
import { bench, describe } from 'vitest';
import { fitChat } from '../src/fit-chat.js';
import type { ChatMessage } from '../src/types.js';

function ordinaryConversation(messageCount: number): ChatMessage[] {
  const messages: ChatMessage[] = [];
  for (let i = 0; i < messageCount; i += 1) {
    messages.push({
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: `message ${String(i)}: some representative sentence-length content to count tokens against.`,
    });
  }
  return messages;
}

/** Every third turn is a multi-tool-call exchange (2-3 calls, results deliberately out of order). */
function toolGroupHeavyConversation(turnCount: number): ChatMessage[] {
  const messages: ChatMessage[] = [];
  let callCounter = 0;
  for (let turn = 0; turn < turnCount; turn += 1) {
    messages.push({ role: 'user', content: `user turn ${String(turn)}` });
    if (turn % 3 === 0) {
      const callCount = 2 + (turn % 2);
      const calls = Array.from({ length: callCount }, () => {
        callCounter += 1;
        return { id: `call-${String(callCounter)}`, name: 'lookup', arguments: { n: callCounter } };
      });
      messages.push({
        role: 'assistant',
        content: `calling ${String(callCount)} tools`,
        toolCalls: calls,
      });
      // Results reversed: exercises id-based linking, not positional adjacency.
      for (const call of [...calls].reverse()) {
        messages.push({ role: 'tool', toolCallId: call.id, content: { ok: true, for: call.id } });
      }
    } else {
      messages.push({ role: 'assistant', content: `assistant reply ${String(turn)}` });
    }
  }
  return messages;
}

const conversations = {
  ordinary100: ordinaryConversation(100),
  ordinary1k: ordinaryConversation(1_000),
  ordinary10k: ordinaryConversation(10_000),
  toolHeavy1k: toolGroupHeavyConversation(1_000),
};

describe('fitChat — drop-oldest throughput by conversation size', () => {
  bench('100 messages, generous budget (no trimming)', () => {
    fitChat(conversations.ordinary100, { maxTokens: 100_000 });
  });

  bench('100 messages, tight budget (heavy trimming)', () => {
    fitChat(conversations.ordinary100, { maxTokens: 500 });
  });

  bench('1,000 messages, generous budget (no trimming)', () => {
    fitChat(conversations.ordinary1k, { maxTokens: 1_000_000 });
  });

  bench('1,000 messages, tight budget (heavy trimming)', () => {
    fitChat(conversations.ordinary1k, { maxTokens: 2_000 });
  });

  bench('10,000 messages, generous budget (no trimming)', () => {
    fitChat(conversations.ordinary10k, { maxTokens: 10_000_000 });
  });

  bench('10,000 messages, tight budget (heavy trimming)', () => {
    fitChat(conversations.ordinary10k, { maxTokens: 5_000 });
  });
});

describe('fitChat — tool-group-heavy conversation (1,000 turns, ~2,700 messages)', () => {
  bench('generous budget (no trimming)', () => {
    fitChat(conversations.toolHeavy1k, { maxTokens: 1_000_000 });
  });

  bench('tight budget (drops most tool groups as units)', () => {
    fitChat(conversations.toolHeavy1k, { maxTokens: 3_000 });
  });
});

/**
 * `finalizeResult` must not re-walk every *input* message a second time
 * (`describeContentFallbacks`) to build content-fallback warnings — that
 * pattern cost ~20-25% of total `fitChat` time at 50,000 messages, worse
 * with unrecognized structural fields present (more work per message on
 * both the first, real pass and the redundant second one). Instead, the
 * default counter records fallback reasons as a byproduct of the counting
 * it already does (`createDefaultMessageTokenCounter`'s `fallbackReasons`)
 * instead of recomputing them — see `src/finalize.ts` and
 * `src/token-accounting.ts`. This is the permanent throughput baseline for
 * that: a regression that reintroduces a second full pass would show up
 * here as roughly a 4-5x slowdown on the "with unrecognized fields" cases
 * relative to the "plain" ones at the same size, not just a fixed offset.
 */
function unrecognizedFieldConversation(messageCount: number): ChatMessage[] {
  const messages: ChatMessage[] = [];
  for (let i = 0; i < messageCount; i += 1) {
    const message = {
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: `message ${String(i)}: some representative sentence-length content to count tokens against.`,
      // A legacy field no adapter recognizes -- forces the default counter's
      // conservative structural-fallback path on every message.
      reasoning: {
        blocks: [{ type: 'text', text: 'hidden reasoning content, repeated. '.repeat(5) }],
      },
    };
    messages.push(message as unknown as ChatMessage);
  }
  return messages;
}

// A handful of samples is enough to compare "plain" vs. "unrecognized
// fields" at 10,000/50,000 messages -- tinybench's defaults (10 iterations,
// 5 warmup) would otherwise re-run a multi-second call dozens of times.
const fewSamples = { time: 0, iterations: 3, warmupIterations: 1 };

describe('fitChat — content-accounting cost, plain vs. unrecognized structural fields', () => {
  const plain1k = ordinaryConversation(1_000);
  const withFields1k = unrecognizedFieldConversation(1_000);
  const plain10k = ordinaryConversation(10_000);
  const withFields10k = unrecognizedFieldConversation(10_000);
  const plain50k = ordinaryConversation(50_000);
  const withFields50k = unrecognizedFieldConversation(50_000);

  bench('1,000 messages, plain, generous budget', () => {
    fitChat(plain1k, { maxTokens: 50_000_000 });
  });
  bench('1,000 messages, unrecognized fields, generous budget', () => {
    fitChat(withFields1k, { maxTokens: 50_000_000 });
  });

  bench(
    '10,000 messages, plain, generous budget',
    () => {
      fitChat(plain10k, { maxTokens: 50_000_000 });
    },
    fewSamples,
  );
  bench(
    '10,000 messages, unrecognized fields, generous budget',
    () => {
      fitChat(withFields10k, { maxTokens: 50_000_000 });
    },
    fewSamples,
  );

  bench(
    '50,000 messages, plain, generous budget',
    () => {
      fitChat(plain50k, { maxTokens: 50_000_000, maxMessages: 50_000 });
    },
    fewSamples,
  );
  bench(
    '50,000 messages, unrecognized fields, generous budget',
    () => {
      fitChat(withFields50k, { maxTokens: 50_000_000, maxMessages: 50_000 });
    },
    fewSamples,
  );
});
