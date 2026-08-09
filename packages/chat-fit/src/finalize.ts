/**
 * Shared tail end of both `fitChat` and `fitChatAsync`: turn a `FitPlan` plus
 * a `VerifyAndTrimResult` into the public `FitChatResult`, including every
 * diagnostic the report promises.
 */
import { APPROX_TOKENIZER_ID } from '@llm-kit/tokenizer';
import { buildReport } from './report.js';
import type { FitPlan } from './selection/plan.js';
import type { VerifyAndTrimResult } from './selection/verify-and-trim.js';
import type { FitChatResult, MessageGroup, SummarizedRangeReport } from './types.js';

export interface FinalizeParams<Message> {
  readonly plan: FitPlan<Message>;
  readonly verify: VerifyAndTrimResult<Message>;
  readonly summarizedRange?: SummarizedRangeReport;
  readonly summaryAttempts: number;
  readonly summaryWarnings: readonly string[];
}

export function finalizeResult<Message>(params: FinalizeParams<Message>): FitChatResult<Message> {
  const { plan, verify } = params;

  // Only the default counter's identity is derivable from `tokenizer.id` —
  // it is either the bundled approximate tokenizer or an injected `Tokenizer`
  // presumed exact. A fully caller-supplied `messageTokenCounter` declares
  // nothing about its own exactness (`MessageTokenCounter` carries no
  // provenance field), so it must not be reported as either — see the doc
  // comment on `FitChatReport.approximateTokenization`.
  const approximateTokenization: boolean | 'unknown' = plan.normalized.usingDefaultCounter
    ? plan.normalized.tokenizer.id === APPROX_TOKENIZER_ID
    : 'unknown';

  const keptGroups = new Set<MessageGroup<Message>>([
    ...plan.preservedGroups,
    ...verify.keptGroups,
  ]);

  // Re-walking every input message through `describeContentFallbacks` here
  // would redo accounting work `countMessage` already did once per message
  // while building the plan — measured at ~20-25% of total `fitChat` time
  // on a 50k-message conversation (see the package README's Performance
  // section) — and could name an index for a message the caller no longer
  // has, since `plan.messages` includes groups later dropped by selection.
  //
  // Instead, read `createDefaultMessageTokenCounter`'s `fallbackReasons`
  // side channel (populated as a byproduct of the counting `buildFitPlan`
  // already performs, not a second pass) and restrict the walk to the
  // groups that actually survived selection — `keptGroups` above, the exact
  // same set `buildReport` uses for `keptIndexes`. Every warning this
  // produces therefore names an index guaranteed to appear in
  // `report.keptIndexes`. The synthetic summary message (if any) is never a
  // member of a `MessageGroup`, so it is never visited here.
  const contentFallbackWarnings: string[] = [];
  if (plan.normalized.defaultCounterFallbacks !== undefined) {
    const fallbacks = plan.normalized.defaultCounterFallbacks;
    for (const group of plan.allGroups) {
      if (!keptGroups.has(group)) continue;
      group.indexes.forEach((index, position) => {
        const message = group.messages[position] as Message;
        const reasons = fallbacks.get(message);
        if (reasons !== undefined && reasons.length > 0) {
          contentFallbackWarnings.push(`message ${String(index)}: ${reasons.join('; ')}`);
        }
      });
    }
  }

  const report = buildReport({
    initialTokenCount: plan.initialTokenCount,
    finalTokenCount: verify.finalTokenCount,
    maxTokens: plan.normalized.maxTokens,
    reserveTokens: plan.normalized.reserveTokens,
    safetyMarginTokens: plan.normalized.safetyMarginTokens,
    availableBudget: plan.availableBudget,
    strategy: plan.normalized.strategy,
    counterId: plan.normalized.messageTokenCounter.id,
    approximateTokenization,
    allGroups: plan.allGroups,
    keptGroups,
    diagnostics: plan.diagnostics,
    ...(params.summarizedRange !== undefined ? { summarizedRange: params.summarizedRange } : {}),
    summaryAttempts: params.summaryAttempts,
    extraWarnings: [...contentFallbackWarnings, ...params.summaryWarnings],
  });

  return { messages: verify.finalMessages, tokenCount: verify.finalTokenCount, report };
}
