/**
 * Async entry point: everything `fitChat` does, plus `'summarize-middle'`.
 * The only place this package ever awaits anything is the caller's own
 * `Summarizer` callback — no network call, no timer, no other I/O.
 */
import { throwIfAborted } from './abort-utils.js';
import { buildFitPlan } from './selection/plan.js';
import { middleRangeSpan, type SummaryInsertion } from './selection/middle-range.js';
import { verifyAndTrim } from './selection/verify-and-trim.js';
import { summarizeMiddle } from './summary/summarize-middle.js';
import { finalizeResult } from './finalize.js';
import type { ChatMessage, FitChatOptions, FitChatResult, SummarizedRangeReport } from './types.js';

export async function fitChatAsync<Message = ChatMessage>(
  messages: readonly Message[],
  options: FitChatOptions<Message> & { signal?: AbortSignal },
): Promise<FitChatResult<Message>> {
  throwIfAborted(options.signal);

  const plan = buildFitPlan(messages, options);

  if (plan.normalized.strategy === 'drop-oldest' || plan.droppedGroups.length === 0) {
    const verify = verifyAndTrim({
      preservedGroups: plan.preservedGroups,
      keptGroups: plan.selectedGroups,
      availableBudget: plan.availableBudget,
      messageTokenCounter: plan.normalized.messageTokenCounter,
      preservedTokenCount: plan.preservedTokenCount,
    });
    return finalizeResult({ plan, verify, summaryAttempts: 0, summaryWarnings: [] });
  }

  // strategy === 'summarize-middle' and there is a non-empty middle range to summarize.
  throwIfAborted(options.signal);

  const range = middleRangeSpan(plan.droppedGroups);
  const rangeMessages = plan.droppedGroups.flatMap((group) => group.messages);

  // `plan.normalized.summary` is defined whenever strategy is
  // 'summarize-middle' — normalizeOptions enforces it.
  const summary = plan.normalized.summary as NonNullable<typeof plan.normalized.summary>;

  // The newest-first pass (`selectNewestFirst`) already spent the available
  // budget packing as much recent content as would fit, same as
  // `drop-oldest` — it has no reason to hold anything back for a summary it
  // doesn't know about yet. So the ceiling here is *not* "whatever is left
  // after that pass"; it is a deliberate reservation against the only thing
  // that is never trimmable — preserved content — because `verifyAndTrim`
  // below can and will give up some of the greedily-kept newest groups to
  // make room for the summary once it exists, recounting and retrying
  // within strict limits. Without an explicit override,
  // that reservation defaults to a fifth of the available budget: enough for
  // a real summary to be useful, small enough that summarizing rarely
  // outbids keeping actual recent messages.
  const defaultSummaryBudget = Math.max(1, Math.floor(plan.availableBudget * 0.2));
  const headroomExcludingPreserved = plan.availableBudget - plan.preservedTokenCount;
  const initialMaxSummaryTokens = Math.min(
    summary.maxSummaryTokens ?? defaultSummaryBudget,
    Math.max(0, headroomExcludingPreserved),
  );

  const outcome = await summarizeMiddle({
    rangeMessages,
    summarizer: summary.summarizer,
    maxAttempts: summary.maxAttempts,
    initialMaxSummaryTokens,
    messageTokenCounter: plan.normalized.messageTokenCounter,
    signal: options.signal,
  });

  let summaryInsertion: SummaryInsertion<Message> | undefined;
  let summarizedRange: SummarizedRangeReport | undefined;
  if (outcome.summary !== undefined && range !== undefined) {
    summaryInsertion = { sortKey: range.startIndex - 0.5, message: outcome.summary };
    summarizedRange = {
      startIndex: range.startIndex,
      endIndex: range.endIndex,
      messageCount: range.messageCount,
      ...(outcome.summaryTokenCount !== undefined
        ? { summaryTokenCount: outcome.summaryTokenCount }
        : {}),
    };
  }

  const verify = verifyAndTrim({
    preservedGroups: plan.preservedGroups,
    keptGroups: plan.selectedGroups,
    summaryInsertion,
    availableBudget: plan.availableBudget,
    messageTokenCounter: plan.normalized.messageTokenCounter,
    preservedTokenCount: plan.preservedTokenCount,
  });

  return finalizeResult({
    plan,
    verify,
    ...(summarizedRange !== undefined && !verify.summaryDropped ? { summarizedRange } : {}),
    summaryAttempts: outcome.attempts,
    summaryWarnings: outcome.warnings,
  });
}
