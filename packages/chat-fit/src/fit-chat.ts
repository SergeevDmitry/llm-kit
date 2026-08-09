/**
 * Synchronous entry point: `'drop-oldest'` only, no summarizer, no I/O of
 * any kind. `fitChatAsync` is a strict superset — this function exists
 * because a synchronous call is a meaningfully different, simpler promise
 * to make to a caller who does not need summarization.
 */
import { buildFitPlan } from './selection/plan.js';
import { verifyAndTrim } from './selection/verify-and-trim.js';
import { finalizeResult } from './finalize.js';
import type { ChatMessage, FitChatOptions, FitChatResult } from './types.js';

export function fitChat<Message = ChatMessage>(
  messages: readonly Message[],
  options: Omit<FitChatOptions<Message>, 'strategy' | 'summary'> & { strategy?: 'drop-oldest' },
): FitChatResult<Message> {
  const plan = buildFitPlan(messages, { ...options, strategy: 'drop-oldest' });

  const verify = verifyAndTrim({
    preservedGroups: plan.preservedGroups,
    keptGroups: plan.selectedGroups,
    availableBudget: plan.availableBudget,
    messageTokenCounter: plan.normalized.messageTokenCounter,
    preservedTokenCount: plan.preservedTokenCount,
  });

  return finalizeResult({ plan, verify, summaryAttempts: 0, summaryWarnings: [] });
}
