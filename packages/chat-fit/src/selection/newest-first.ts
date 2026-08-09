/**
 * Newest-first greedy selection: walk the non-preserved groups from most
 * recent to oldest, keep adding while the running total fits, and stop at
 * the first group that does not. Stopping — rather than skipping a too-big
 * group and trying older, smaller ones — is what makes the dropped groups a
 * single contiguous range, which is the whole point under
 * `'summarize-middle'`: it needs one contiguous omitted middle range to
 * replace with a summary.
 */
import type { MessageGroup } from '../types.js';
import { groupSpan } from '../grouping/message-groups.js';

export interface NewestFirstSelection<Message> {
  /** Non-preserved groups kept, in original (ascending) order. */
  readonly selected: readonly MessageGroup<Message>[];
  /** Non-preserved groups dropped, in original (ascending) order — the candidate middle range. */
  readonly dropped: readonly MessageGroup<Message>[];
  /** `preservedTokenCount` plus the summed per-message tokens of every selected group. */
  readonly runningTotal: number;
}

export function selectNewestFirst<Message>(
  otherGroupsAscending: readonly MessageGroup<Message>[],
  perMessageTokens: readonly number[],
  preservedTokenCount: number,
  availableBudget: number,
): NewestFirstSelection<Message> {
  const newestFirst = [...otherGroupsAscending].sort(
    (a, b) => groupSpan(b).startIndex - groupSpan(a).startIndex,
  );

  const selectedSet = new Set<MessageGroup<Message>>();
  let runningTotal = preservedTokenCount;

  for (const group of newestFirst) {
    const groupTokens = group.indexes.reduce(
      (sum, index) => sum + (perMessageTokens[index] as number),
      0,
    );
    if (runningTotal + groupTokens <= availableBudget) {
      selectedSet.add(group);
      runningTotal += groupTokens;
    } else {
      break;
    }
  }

  const selected: MessageGroup<Message>[] = [];
  const dropped: MessageGroup<Message>[] = [];
  for (const group of otherGroupsAscending) {
    (selectedSet.has(group) ? selected : dropped).push(group);
  }

  return { selected, dropped, runningTotal };
}
