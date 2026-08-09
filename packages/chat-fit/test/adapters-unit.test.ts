import { describe, expect, it } from 'vitest';
import {
  extractAnthropicToolCalls,
  extractAnthropicToolResultIds,
} from '../src/adapters/anthropic.js';
import { readMessageStructure } from '../src/adapters/generic.js';
import { extractOpenAiToolCalls, extractOpenAiToolResultId } from '../src/adapters/openai.js';

describe('adapters: structural readers degrade gracefully on malformed input', () => {
  it('openai: ignores non-object messages and non-array tool_calls', () => {
    expect(extractOpenAiToolCalls(null)).toEqual([]);
    expect(extractOpenAiToolCalls('a string')).toEqual([]);
    expect(extractOpenAiToolCalls({ tool_calls: 'not-an-array' })).toEqual([]);
    expect(extractOpenAiToolCalls({ tool_calls: [null, 42, { id: 'ok' }] })).toEqual([
      { id: 'ok', name: undefined },
    ]);
    expect(extractOpenAiToolResultId(null)).toBeUndefined();
    expect(extractOpenAiToolResultId({ tool_call_id: 5 })).toBeUndefined();
  });

  it('anthropic: ignores non-array content and non-tool-use/tool-result blocks', () => {
    expect(extractAnthropicToolCalls({ content: 'plain string' })).toEqual([]);
    expect(extractAnthropicToolCalls({ content: [{ type: 'text', text: 'hi' }] })).toEqual([]);
    expect(extractAnthropicToolCalls({ content: [null, { type: 'tool_use', id: 't1' }] })).toEqual([
      { id: 't1', name: undefined },
    ]);
    expect(extractAnthropicToolResultIds({ content: [{ type: 'tool_result' }] })).toEqual([]);
  });

  it('generic: readMessageStructure never throws on arbitrary junk', () => {
    for (const junk of [null, undefined, 42, 'str', [], {}, () => 1, Symbol('x')]) {
      expect(() => readMessageStructure(junk)).not.toThrow();
    }
    const structure = readMessageStructure({ role: 'tool' });
    expect(structure.looksLikeUnlinkedToolResult).toBe(true);
  });

  it('generic: merges ChatMessageLike, OpenAI-like, and Anthropic-like tool calls when a message matches more than one', () => {
    const hybrid = {
      role: 'assistant',
      toolCalls: [{ id: 'a', name: 'from-camel' }],
      tool_calls: [{ id: 'b', type: 'function', function: { name: 'from-snake' } }],
      content: [{ type: 'tool_use', id: 'c', name: 'from-anthropic' }],
    };
    const structure = readMessageStructure(hybrid);
    expect(structure.toolCalls.map((c) => c.id).sort()).toEqual(['a', 'b', 'c']);
  });

  it('generic: extracts message-level name when present', () => {
    expect(readMessageStructure({ role: 'user', name: 'alice' }).name).toBe('alice');
    expect(readMessageStructure({ role: 'user' }).name).toBeUndefined();
  });
});
