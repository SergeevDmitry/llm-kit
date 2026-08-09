/**
 * Final assembly: places every kept message back in original chronological
 * order, regardless of how scattered its originating group's members were,
 * and — under `'summarize-middle'` — inserts one synthetic summary message
 * at the boundary of the range it replaced.
 */
import type { MessageGroup } from '../types.js';

interface PlacedMessage<Message> {
  readonly sortKey: number;
  readonly message: Message;
}

export interface SummaryInsertion<Message> {
  /** Sort key placing the summary between its neighbors; typically `middleRangeSpan(...).startIndex - 0.5`. */
  readonly sortKey: number;
  readonly message: Message;
}

/** Flattens kept groups (any order) into one message array in original chronological order, optionally splicing in a summary. */
export function assembleFinalMessages<Message>(
  keptGroups: readonly MessageGroup<Message>[],
  summaryInsertion?: SummaryInsertion<Message>,
): readonly Message[] {
  const placed: PlacedMessage<Message>[] = [];
  for (const group of keptGroups) {
    group.indexes.forEach((index, position) => {
      placed.push({ sortKey: index, message: group.messages[position] as Message });
    });
  }
  if (summaryInsertion !== undefined) {
    placed.push({ sortKey: summaryInsertion.sortKey, message: summaryInsertion.message });
  }
  placed.sort((a, b) => a.sortKey - b.sortKey);
  return placed.map((entry) => entry.message);
}

export interface MiddleRangeSpan {
  readonly startIndex: number;
  readonly endIndex: number;
  readonly messageCount: number;
}

/** The contiguous original-index span covered by a set of dropped groups, or `undefined` if there is nothing to summarize. */
export function middleRangeSpan<Message>(
  droppedGroups: readonly MessageGroup<Message>[],
): MiddleRangeSpan | undefined {
  if (droppedGroups.length === 0) return undefined;
  const allIndexes = droppedGroups.flatMap((group) => group.indexes);
  let startIndex = allIndexes[0] as number;
  let endIndex = allIndexes[0] as number;
  for (const index of allIndexes) {
    if (index < startIndex) startIndex = index;
    if (index > endIndex) endIndex = index;
  }
  return { startIndex, endIndex, messageCount: allIndexes.length };
}
