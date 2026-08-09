/**
 * The strategy-independent core of the selection algorithm: validate
 * options, build atomic groups, separate preserved from optional groups,
 * fail fast if preserved content alone cannot fit, then greedily select
 * optional groups newest-first. Both
 * `fitChat` (sync, `drop-oldest` only) and `fitChatAsync` (adds
 * `summarize-middle`) build on this same plan so the two strategies cannot
 * silently diverge on how groups are formed or prioritized.
 */
import { buildDefaultGroups } from '../grouping/message-groups.js';
import type { GroupingDiagnostic } from '../grouping/validation.js';
import { ChatFitError } from '../errors.js';
import type { NormalizedOptions } from '../normalize-options.js';
import { assertMessagesWithinLimit, normalizeOptions } from '../normalize-options.js';
import { assembleFinalMessages } from './middle-range.js';
import { selectNewestFirst } from './newest-first.js';
import { computePreservedMessageFlags, isPreservedGroup } from './preserve-system.js';
import { calculateAvailableBudget, countMessageSafe, countMessagesSafe } from './budget.js';
import type { FitChatOptions, MessageGroup } from '../types.js';
import { groupSpan } from '../grouping/message-groups.js';

export interface FitPlan<Message> {
  readonly messages: readonly Message[];
  readonly normalized: NormalizedOptions<Message>;
  readonly availableBudget: number;
  readonly initialTokenCount: number;
  readonly allGroups: readonly MessageGroup<Message>[];
  readonly diagnostics: readonly GroupingDiagnostic[];
  readonly preservedGroups: readonly MessageGroup<Message>[];
  readonly selectedGroups: readonly MessageGroup<Message>[];
  readonly droppedGroups: readonly MessageGroup<Message>[];
  readonly perMessageTokens: readonly number[];
  readonly preservedTokenCount: number;
  /** Approximate running total (`preservedTokenCount` + summed selected-group tokens); verify with `countMessagesSafe` before reporting. */
  readonly approximateRunningTotal: number;
}

function sortGroupsAscending<Message>(
  groups: readonly MessageGroup<Message>[],
): readonly MessageGroup<Message>[] {
  return [...groups].sort((a, b) => groupSpan(a).startIndex - groupSpan(b).startIndex);
}

function assertPartitionsMessages<Message>(
  messages: readonly Message[],
  groups: readonly MessageGroup<Message>[],
): void {
  const seen = new Uint8Array(messages.length);
  for (const group of groups) {
    for (const index of group.indexes) {
      if (index < 0 || index >= messages.length || seen[index] === 1) {
        throw new ChatFitError(
          'options.groupMessages must partition the input messages exactly once each, ' +
            'in-range and without duplicates',
          'INVALID_OPTIONS',
        );
      }
      seen[index] = 1;
    }
  }
  for (let index = 0; index < seen.length; index += 1) {
    if (seen[index] !== 1) {
      throw new ChatFitError(
        `options.groupMessages did not place message index ${String(index)} in any group`,
        'INVALID_OPTIONS',
      );
    }
  }
}

export function buildFitPlan<Message>(
  messages: readonly Message[],
  options: FitChatOptions<Message>,
): FitPlan<Message> {
  const normalized = normalizeOptions(options);
  assertMessagesWithinLimit(messages.length, normalized.maxMessages);
  const availableBudget = calculateAvailableBudget(
    normalized.maxTokens,
    normalized.reserveTokens,
    normalized.safetyMarginTokens,
  );

  if (messages.length === 0) {
    return {
      messages,
      normalized,
      availableBudget,
      initialTokenCount: 0,
      allGroups: [],
      diagnostics: [],
      preservedGroups: [],
      selectedGroups: [],
      droppedGroups: [],
      perMessageTokens: [],
      preservedTokenCount: 0,
      approximateRunningTotal: 0,
    };
  }

  const initialTokenCount = countMessagesSafe(normalized.messageTokenCounter, messages);

  let allGroups: readonly MessageGroup<Message>[];
  let diagnostics: readonly GroupingDiagnostic[];
  if (normalized.customGroupMessages !== undefined) {
    const groups = normalized.customGroupMessages(messages);
    assertPartitionsMessages(messages, groups);
    allGroups = sortGroupsAscending(groups);
    diagnostics = [];
  } else {
    const built = buildDefaultGroups(messages);
    allGroups = built.groups;
    diagnostics = built.diagnostics;
  }

  const preservedFlags = computePreservedMessageFlags(messages, normalized.preserveRoles);
  const preservedGroups: MessageGroup<Message>[] = [];
  const otherGroups: MessageGroup<Message>[] = [];
  for (const group of allGroups) {
    (isPreservedGroup(group, preservedFlags) ? preservedGroups : otherGroups).push(group);
  }

  const preservedMessages = assembleFinalMessages(preservedGroups);
  const preservedTokenCount = countMessagesSafe(normalized.messageTokenCounter, preservedMessages);

  if (preservedTokenCount > availableBudget) {
    throw new ChatFitError(
      `preserved messages require ${String(preservedTokenCount)} tokens, exceeding the ` +
        `available budget of ${String(availableBudget)} ` +
        `(maxTokens ${String(normalized.maxTokens)} - reserveTokens ${String(normalized.reserveTokens)} ` +
        `- safetyMarginTokens ${String(normalized.safetyMarginTokens)})`,
      'PRESERVED_MESSAGES_EXCEED_BUDGET',
    );
  }

  const perMessageTokens = messages.map((message) =>
    countMessageSafe(normalized.messageTokenCounter, message),
  );

  const { selected, dropped, runningTotal } = selectNewestFirst(
    otherGroups,
    perMessageTokens,
    preservedTokenCount,
    availableBudget,
  );

  return {
    messages,
    normalized,
    availableBudget,
    initialTokenCount,
    allGroups,
    diagnostics,
    preservedGroups,
    selectedGroups: selected,
    droppedGroups: dropped,
    perMessageTokens,
    preservedTokenCount,
    approximateRunningTotal: runningTotal,
  };
}
