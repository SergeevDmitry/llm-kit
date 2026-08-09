/**
 * Structural recognition of Anthropic-like chat messages: `content` blocks of
 * type `tool_use` (a call) and `tool_result` (a result), keyed by
 * `id`/`tool_use_id`.
 *
 * Duck-typing only — no `@anthropic-ai/*` type or value is imported. No
 * provider SDK is a required runtime dependency of this package.
 */
import type { ToolCallRef } from './structure.js';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function contentBlocks(message: unknown): readonly unknown[] {
  if (!isRecord(message) || !Array.isArray(message.content)) {
    return [];
  }
  return message.content as readonly unknown[];
}

/** Extracts `{id, name, input}` from every `{ type: 'tool_use' }` content block. */
export function extractAnthropicToolCalls(message: unknown): readonly ToolCallRef[] {
  const refs: ToolCallRef[] = [];
  for (const block of contentBlocks(message)) {
    if (!isRecord(block) || block.type !== 'tool_use') continue;
    refs.push({
      id: typeof block.id === 'string' ? block.id : undefined,
      name: typeof block.name === 'string' ? block.name : undefined,
      ...(block.input !== undefined ? { arguments: block.input } : {}),
    });
  }
  return refs;
}

/** Extracts `tool_use_id` from every `{ type: 'tool_result' }` content block. */
export function extractAnthropicToolResultIds(message: unknown): readonly string[] {
  const ids: string[] = [];
  for (const block of contentBlocks(message)) {
    if (!isRecord(block) || block.type !== 'tool_result') continue;
    if (typeof block.tool_use_id === 'string') {
      ids.push(block.tool_use_id);
    }
  }
  return ids;
}
