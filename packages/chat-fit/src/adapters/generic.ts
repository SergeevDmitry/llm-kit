/**
 * Baseline structural reader plus the combinator that merges every shape
 * this package recognizes (`ChatMessage`-like, OpenAI-like, Anthropic-like)
 * into one `MessageStructure`. A message only needs to match one shape;
 * matching more than one (unusual, but not forbidden) simply unions the
 * results.
 */
import { extractAnthropicToolCalls, extractAnthropicToolResultIds } from './anthropic.js';
import { extractOpenAiToolCalls, extractOpenAiToolResultId } from './openai.js';
import type { MessageStructure, ToolCallRef } from './structure.js';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function extractRole(message: unknown): string | undefined {
  if (!isRecord(message)) return undefined;
  return typeof message.role === 'string' ? message.role : undefined;
}

/** Extracts `message.name` (participant identity beyond role), when present. */
function extractName(message: unknown): string | undefined {
  if (!isRecord(message)) return undefined;
  return typeof message.name === 'string' ? message.name : undefined;
}

/** Extracts `toolCalls[].{id, name, arguments}` from a `ChatMessageLike`/`ChatMessage`-shaped message. */
function extractChatMessageLikeToolCalls(message: unknown): readonly ToolCallRef[] {
  if (!isRecord(message) || !Array.isArray(message.toolCalls)) {
    return [];
  }
  const refs: ToolCallRef[] = [];
  for (const raw of message.toolCalls as readonly unknown[]) {
    if (!isRecord(raw)) continue;
    refs.push({
      id: typeof raw.id === 'string' ? raw.id : undefined,
      name: typeof raw.name === 'string' ? raw.name : undefined,
      ...(raw.arguments !== undefined ? { arguments: raw.arguments } : {}),
    });
  }
  return refs;
}

/** Extracts `toolCallId` from a `ChatMessageLike`/`ChatMessage`-shaped message. */
function extractChatMessageLikeToolResultId(message: unknown): string | undefined {
  if (!isRecord(message)) return undefined;
  return typeof message.toolCallId === 'string' ? message.toolCallId : undefined;
}

function dedupeIds(ids: readonly string[]): readonly string[] {
  return [...new Set(ids)];
}

function dedupeToolCalls(refs: readonly ToolCallRef[]): readonly ToolCallRef[] {
  const seen = new Set<string>();
  const result: ToolCallRef[] = [];
  for (const ref of refs) {
    const key = ref.id ?? `__unkeyed_${String(result.length)}`;
    if (ref.id !== undefined && seen.has(key)) continue;
    if (ref.id !== undefined) seen.add(key);
    result.push(ref);
  }
  return result;
}

/**
 * Reads every recognized shape off `message` and merges the result. Never
 * throws: an unrecognized or malformed shape simply contributes nothing.
 */
export function readMessageStructure(message: unknown): MessageStructure {
  const role = extractRole(message);
  const name = extractName(message);

  const toolCalls = dedupeToolCalls([
    ...extractChatMessageLikeToolCalls(message),
    ...extractOpenAiToolCalls(message),
    ...extractAnthropicToolCalls(message),
  ]);

  const openAiResultId = extractOpenAiToolResultId(message);
  const toolResultIds = dedupeIds([
    ...(extractChatMessageLikeToolResultId(message) !== undefined
      ? [extractChatMessageLikeToolResultId(message) as string]
      : []),
    ...(openAiResultId !== undefined ? [openAiResultId] : []),
    ...extractAnthropicToolResultIds(message),
  ]);

  const looksLikeUnlinkedToolResult =
    role === 'tool' && toolCalls.length === 0 && toolResultIds.length === 0;

  return { role, name, toolCalls, toolResultIds, looksLikeUnlinkedToolResult };
}
