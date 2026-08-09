import type { SeededRandom } from '@llm-kit/test-utils';
import type { ChatMessage } from '../../src/types.js';
import { assistant, assistantWithToolCalls, toolResult, user } from './messages.js';

export interface RandomConversation {
  readonly messages: readonly ChatMessage[];
  /** Every tool-call group that must be kept-or-dropped together, as the exact message objects it contains. */
  readonly groups: readonly (readonly ChatMessage[])[];
}

/**
 * Builds a random conversation of plain user/assistant turns and multi-tool-
 * call exchanges, deliberately scrambling some tool results out of order (or
 * deferring them several turns later) to exercise the id-based linking
 * rather than positional adjacency. Every draw comes from `random`, so the
 * whole conversation is reproducible from its seed alone.
 */
export function buildRandomToolConversation(
  random: SeededRandom,
  turnCount: number,
): RandomConversation {
  const messages: ChatMessage[] = [];
  const groups: ChatMessage[][] = [];
  const pendingResults: ChatMessage[] = [];
  let callCounter = 0;

  const flushSomePending = (): void => {
    while (pendingResults.length > 0 && random.next() < 0.5) {
      messages.push(pendingResults.shift() as ChatMessage);
    }
  };

  for (let turn = 0; turn < turnCount; turn += 1) {
    flushSomePending();
    const kind = random.pick(['user', 'assistant', 'tool'] as const);

    if (kind === 'user') {
      messages.push(user(`user turn ${String(turn)}`));
      continue;
    }
    if (kind === 'assistant') {
      messages.push(assistant(`assistant turn ${String(turn)}`));
      continue;
    }

    const callCount = random.int(1, 3);
    const calls = Array.from({ length: callCount }, () => {
      callCounter += 1;
      return {
        id: `call-${String(callCounter)}`,
        name: `tool${String(callCounter)}`,
        arguments: { n: callCounter },
      };
    });
    const assistantMessage = assistantWithToolCalls(`assistant turn ${String(turn)}`, calls);
    messages.push(assistantMessage);

    const resultMessages = calls.map((call) => toolResult(call.id, { ok: true, for: call.id }));
    for (const resultMessage of random.shuffle(resultMessages)) {
      if (random.next() < 0.35) {
        pendingResults.push(resultMessage);
      } else {
        messages.push(resultMessage);
      }
    }
    groups.push([assistantMessage, ...resultMessages]);
  }

  messages.push(...pendingResults);

  return { messages, groups };
}

/**
 * A tool call and every result it spawned move together or not at all,
 * checked directly: every known tool-call group is either entirely present
 * in `kept` or entirely absent — never partially.
 */
export function assertGroupsAtomic(
  groups: readonly (readonly ChatMessage[])[],
  kept: readonly ChatMessage[],
): void {
  const keptSet = new Set(kept);
  for (const group of groups) {
    const presentCount = group.filter((message) => keptSet.has(message)).length;
    if (presentCount !== 0 && presentCount !== group.length) {
      throw new Error(
        `tool group split: ${String(presentCount)}/${String(group.length)} members kept ` +
          `(ids: ${group.map((m) => (m as { toolCallId?: string }).toolCallId ?? 'call').join(', ')})`,
      );
    }
  }
}

/** Kept messages must appear in the same relative order as in the original array. */
export function assertChronologicalOrder(
  original: readonly ChatMessage[],
  kept: readonly ChatMessage[],
): void {
  const indexOf = new Map(original.map((message, index) => [message, index]));
  let lastIndex = -1;
  for (const message of kept) {
    const index = indexOf.get(message);
    if (index === undefined) continue; // synthetic messages (summaries) are not in `original`
    if (index <= lastIndex) {
      throw new Error('kept messages are not in original chronological order');
    }
    lastIndex = index;
  }
}
