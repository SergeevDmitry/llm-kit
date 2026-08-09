import { describe, expect, it } from 'vitest';
import { fitChat } from '../src/fit-chat.js';
import {
  anthropicAssistantWithToolUse,
  anthropicToolResult,
  openAiAssistantWithToolCalls,
  openAiToolResult,
} from './fixtures/messages.js';

describe('provider-shaped message adapters (structural, no SDK types)', () => {
  it('recognizes OpenAI-like tool_calls/tool_call_id and keeps the exchange atomic', () => {
    const call = openAiAssistantWithToolCalls('checking the weather', [
      { id: 'call_abc', name: 'get_weather', arguments: { city: 'Boston' } },
    ]);
    const result = openAiToolResult('call_abc', JSON.stringify({ tempF: 61 }));
    const filler = Array.from({ length: 15 }, (_, i) => ({
      role: 'user',
      content: `filler ${String(i)}`,
    }));

    const messages = [...filler, { role: 'user', content: 'what is the weather?' }, call, result];
    const fit = fitChat(messages, { maxTokens: 150 });

    const hasCall = fit.messages.includes(call);
    const hasResult = fit.messages.includes(result);
    expect(hasCall).toBe(hasResult);
    expect(hasCall).toBe(true); // most recent group, should survive trimming of the filler
  });

  it('recognizes Anthropic-like tool_use/tool_result content blocks and keeps the exchange atomic', () => {
    const call = anthropicAssistantWithToolUse('let me check', [
      { id: 'toolu_1', name: 'get_weather', arguments: { city: 'Boston' } },
    ]);
    const result = anthropicToolResult([{ toolUseId: 'toolu_1', content: '61F and sunny' }]);
    const filler = Array.from({ length: 15 }, (_, i) => ({
      role: 'user',
      content: `filler ${String(i)}`,
    }));

    const messages = [...filler, { role: 'user', content: 'what is the weather?' }, call, result];
    const fit = fitChat(messages, { maxTokens: 220 });

    const hasCall = fit.messages.includes(call);
    const hasResult = fit.messages.includes(result);
    expect(hasCall).toBe(hasResult);
    expect(hasCall).toBe(true);
  });

  it('keeps a single Anthropic message batching tool_result blocks for two different assistant calls atomic with both', () => {
    const firstCall = anthropicAssistantWithToolUse('first', [{ id: 't1', name: 'a' }]);
    const secondCall = anthropicAssistantWithToolUse('second', [{ id: 't2', name: 'b' }]);
    const batchedResult = anthropicToolResult([
      { toolUseId: 't1', content: 'result a' },
      { toolUseId: 't2', content: 'result b' },
    ]);
    const messages = [firstCall, secondCall, batchedResult];

    const fit = fitChat(messages, { maxTokens: 5000 });
    expect(fit.messages).toEqual(messages);

    // A tight budget must drop all three together, never just one.
    const tight = fitChat(messages, { maxTokens: 20 });
    const present = messages.filter((m) => tight.messages.includes(m)).length;
    expect(present === 0 || present === messages.length).toBe(true);
  });

  it('counts OpenAI-shaped tool call arguments toward the budget (does not silently undercount)', () => {
    const bigArgs = { payload: 'q'.repeat(3000) };
    const call = openAiAssistantWithToolCalls('big call', [
      { id: 'c1', name: 'x', arguments: bigArgs },
    ]);
    const result = openAiToolResult('c1', 'ok');
    const messages = [call, result];

    const fit = fitChat(messages, { maxTokens: 5000 });
    // A message with ~3000 characters of arguments must count meaningfully
    // more than a handful of tokens — this would be near-zero if the
    // default counter only read `.toolCalls` (camelCase) and silently
    // ignored `.tool_calls[].function.arguments`.
    expect(fit.report.finalTokenCount).toBeGreaterThan(500);
  });
});
