/**
 * Turns linked components into the public `MessageGroup<Message>[]` shape,
 * and provides the default `groupMessages` policy: group tool calls with
 * their results (see `tool-call-groups.ts`); every other message — every
 * ordinary user/assistant turn, and every system/developer message — is its
 * own singleton group.
 *
 * That "singleton by default" choice is deliberate, not just simplest to
 * implement: pairing ordinary turns changes which unit recency selection
 * operates on, and that kind of policy needs to stay documented and
 * overridable rather than baked in. A caller that wants paired eviction
 * supplies its own `groupMessages`.
 */
import { readMessageStructure } from '../adapters/generic.js';
import type { MessageGroup } from '../types.js';
import { linkToolCallGroups } from './tool-call-groups.js';
import type { GroupingDiagnostic } from './validation.js';

export interface DefaultGroupingResult<Message> {
  readonly groups: readonly MessageGroup<Message>[];
  readonly diagnostics: readonly GroupingDiagnostic[];
}

/** Builds the default atomic groups for `messages`, plus the diagnostics produced while linking them. */
export function buildDefaultGroups<Message>(
  messages: readonly Message[],
): DefaultGroupingResult<Message> {
  const structures = messages.map((message) => readMessageStructure(message));
  const { representativeOf, toolCallIdsByRepresentative, diagnostics } =
    linkToolCallGroups(structures);

  const indexesByRepresentative = new Map<number, number[]>();
  representativeOf.forEach((representative, index) => {
    const bucket = indexesByRepresentative.get(representative);
    if (bucket === undefined) {
      indexesByRepresentative.set(representative, [index]);
    } else {
      bucket.push(index);
    }
  });

  const groups: MessageGroup<Message>[] = [...indexesByRepresentative.values()]
    .map((indexes) => indexes.slice().sort((a, b) => a - b))
    .sort((a, b) => (a[0] as number) - (b[0] as number))
    .map((indexes) => {
      const representative = representativeOf[indexes[0] as number] as number;
      return {
        indexes,
        messages: indexes.map((index) => messages[index] as Message),
        toolCallIds: toolCallIdsByRepresentative.get(representative) ?? [],
      };
    });

  return { groups, diagnostics };
}

/** `startIndex`/`endIndex` derived from an already-sorted group's `indexes`. */
export function groupSpan<Message>(group: MessageGroup<Message>): {
  startIndex: number;
  endIndex: number;
} {
  const indexes = group.indexes;
  return {
    startIndex: indexes[0] as number,
    endIndex: indexes[indexes.length - 1] as number,
  };
}
