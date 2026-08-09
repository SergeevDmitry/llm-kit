/**
 * Structural recognition of OpenAI-like chat messages: an assistant message
 * carrying `tool_calls`, and a tool-result message carrying `tool_call_id`.
 *
 * This is duck-typing only — no `openai` package type or value is imported,
 * here or anywhere in this package. No provider SDK is a required runtime
 * dependency. A message that merely happens to have these fields is treated
 * as OpenAI-shaped; nothing about this file requires the real SDK.
 */
import type { ToolCallRef } from './structure.js';

interface OpenAiLikeToolCall {
  readonly id?: unknown;
  readonly function?: { readonly name?: unknown; readonly arguments?: unknown };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** Extracts `tool_calls[].{id, function.name, function.arguments}` from an OpenAI-shaped assistant message, if present. */
export function extractOpenAiToolCalls(message: unknown): readonly ToolCallRef[] {
  if (!isRecord(message) || !Array.isArray(message.tool_calls)) {
    return [];
  }
  const refs: ToolCallRef[] = [];
  for (const raw of message.tool_calls as readonly unknown[]) {
    if (!isRecord(raw)) continue;
    const call = raw as OpenAiLikeToolCall;
    const hasArguments = isRecord(call.function) && call.function.arguments !== undefined;
    refs.push({
      id: typeof call.id === 'string' ? call.id : undefined,
      name:
        isRecord(call.function) && typeof call.function.name === 'string'
          ? call.function.name
          : undefined,
      ...(hasArguments ? { arguments: (call.function as { arguments: unknown }).arguments } : {}),
    });
  }
  return refs;
}

/** Extracts `tool_call_id` from an OpenAI-shaped tool-result message, if present. */
export function extractOpenAiToolResultId(message: unknown): string | undefined {
  if (!isRecord(message)) return undefined;
  return typeof message.tool_call_id === 'string' ? message.tool_call_id : undefined;
}
