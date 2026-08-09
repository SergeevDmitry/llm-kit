/**
 * System/developer preservation: every system/developer instruction is kept,
 * including ones that appear later in the history, not just leading ones.
 * Applied after grouping, and independently of whether grouping was the
 * default policy or a caller-supplied `groupMessages` — a group is preserved
 * the moment any message inside it has a preserved role, wherever in the
 * conversation it appears.
 */
import { readMessageStructure } from '../adapters/generic.js';
import type { MessageGroup } from '../types.js';

/** One flag per original message index: true when that message's role is in `preserveRoles`. */
export function computePreservedMessageFlags<Message>(
  messages: readonly Message[],
  preserveRoles: readonly string[],
): readonly boolean[] {
  const roles = new Set(preserveRoles);
  return messages.map((message) => {
    const role = readMessageStructure(message).role;
    return role !== undefined && roles.has(role);
  });
}

export function isPreservedGroup<Message>(
  group: MessageGroup<Message>,
  preservedFlags: readonly boolean[],
): boolean {
  return group.indexes.some((index) => preservedFlags[index] === true);
}
