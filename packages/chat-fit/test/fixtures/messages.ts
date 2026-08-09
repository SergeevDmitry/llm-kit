import type { ChatMessage } from '../../src/types.js';

export function system(content: string): ChatMessage {
  return { role: 'system', content };
}

export function developer(content: string): ChatMessage {
  return { role: 'developer', content };
}

export function user(content: string): ChatMessage {
  return { role: 'user', content };
}

export function assistant(content: string): ChatMessage {
  return { role: 'assistant', content };
}

export interface ToolCallSpec {
  readonly id: string;
  readonly name: string;
  readonly arguments?: unknown;
}

export function assistantWithToolCalls(
  content: string,
  calls: readonly ToolCallSpec[],
): ChatMessage {
  return { role: 'assistant', content, toolCalls: calls };
}

export function toolResult(toolCallId: string, content: unknown): ChatMessage {
  return { role: 'tool', toolCallId, content };
}

/** A one-call, one-result tool exchange as three messages: [assistant-call, tool-result]. */
export function toolExchange(
  callId: string,
  toolName: string,
  args: unknown,
  resultContent: unknown,
): readonly ChatMessage[] {
  return [
    assistantWithToolCalls(`calling ${toolName}`, [
      { id: callId, name: toolName, arguments: args },
    ]),
    toolResult(callId, resultContent),
  ];
}

/** OpenAI-shaped equivalent of `assistantWithToolCalls`, no `@llm-kit`/SDK types involved — plain object literals. */
export function openAiAssistantWithToolCalls(
  content: string,
  calls: readonly ToolCallSpec[],
): Record<string, unknown> {
  return {
    role: 'assistant',
    content,
    tool_calls: calls.map((call) => ({
      id: call.id,
      type: 'function',
      function: { name: call.name, arguments: JSON.stringify(call.arguments ?? {}) },
    })),
  };
}

export function openAiToolResult(toolCallId: string, content: string): Record<string, unknown> {
  return { role: 'tool', tool_call_id: toolCallId, content };
}

/** Anthropic-shaped equivalent: tool_use/tool_result content blocks. */
export function anthropicAssistantWithToolUse(
  text: string,
  calls: readonly ToolCallSpec[],
): Record<string, unknown> {
  return {
    role: 'assistant',
    content: [
      { type: 'text', text },
      ...calls.map((call) => ({
        type: 'tool_use',
        id: call.id,
        name: call.name,
        input: call.arguments ?? {},
      })),
    ],
  };
}

export function anthropicToolResult(
  results: readonly { readonly toolUseId: string; readonly content: string }[],
): Record<string, unknown> {
  return {
    role: 'user',
    content: results.map((r) => ({
      type: 'tool_result',
      tool_use_id: r.toolUseId,
      content: r.content,
    })),
  };
}
