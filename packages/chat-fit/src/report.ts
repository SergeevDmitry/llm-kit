/**
 * Assembles the `FitChatReport`. Every field here must stay
 * JSON-serializable — the package's own tests assert that with
 * `assertJsonSerializable` from `@llm-kit/test-utils`.
 */
import type { GroupingDiagnostic } from './grouping/validation.js';
import { describeDiagnostic } from './grouping/validation.js';
import type { MessageGroup } from './types.js';
import type { FitChatReport, SummarizedRangeReport, ToolCallGroupReport } from './types.js';

export interface BuildReportParams<Message> {
  readonly initialTokenCount: number;
  readonly finalTokenCount: number;
  readonly maxTokens: number;
  readonly reserveTokens: number;
  readonly safetyMarginTokens: number;
  readonly availableBudget: number;
  readonly strategy: 'drop-oldest' | 'summarize-middle';
  readonly counterId: string;
  readonly approximateTokenization: boolean | 'unknown';
  readonly allGroups: readonly MessageGroup<Message>[];
  readonly keptGroups: ReadonlySet<MessageGroup<Message>>;
  readonly diagnostics: readonly GroupingDiagnostic[];
  readonly summarizedRange?: SummarizedRangeReport;
  readonly summaryAttempts: number;
  readonly extraWarnings: readonly string[];
}

export function buildReport<Message>(params: BuildReportParams<Message>): FitChatReport {
  const keptIndexes: number[] = [];
  const removedIndexes: number[] = [];
  const toolCallGroups: ToolCallGroupReport[] = [];

  for (const group of params.allGroups) {
    const kept = params.keptGroups.has(group);
    // A group's `indexes` array can grow past the engine's call-argument
    // limit (~125k) for a single atomic tool-call group, or for a caller's
    // own `groupMessages` returning one large group — spreading it into
    // `push(...)` threw `RangeError: Maximum call stack size exceeded`.
    // Loop instead; see `maxMessages` for the configurable ceiling on
    // total input size.
    const target = kept ? keptIndexes : removedIndexes;
    for (const index of group.indexes) {
      target.push(index);
    }
    if (group.toolCallIds.length > 0) {
      toolCallGroups.push({ toolCallIds: group.toolCallIds, indexes: group.indexes, kept });
    }
  }
  keptIndexes.sort((a, b) => a - b);
  removedIndexes.sort((a, b) => a - b);

  const warnings = [
    ...params.diagnostics.map((diagnostic) => describeDiagnostic(diagnostic)),
    ...params.extraWarnings,
  ];
  if (params.approximateTokenization === true) {
    warnings.push(
      `token counts use the approximate tokenizer ("${params.counterId}"); treat them as an ` +
        'upper bound, not an exact count',
    );
  } else if (params.approximateTokenization === 'unknown') {
    warnings.push(
      `token counts use a caller-supplied counter ("${params.counterId}") whose exactness ` +
        'this package cannot verify — MessageTokenCounter carries no provenance field; treat ' +
        'them with the same caution as an approximate upper bound unless you know this ' +
        'counter to be exact',
    );
  }

  return {
    initialTokenCount: params.initialTokenCount,
    finalTokenCount: params.finalTokenCount,
    maxTokens: params.maxTokens,
    reserveTokens: params.reserveTokens,
    safetyMarginTokens: params.safetyMarginTokens,
    availableBudget: params.availableBudget,
    strategy: params.strategy,
    counterId: params.counterId,
    approximateTokenization: params.approximateTokenization,
    keptIndexes,
    removedIndexes,
    toolCallGroups,
    ...(params.summarizedRange !== undefined ? { summarizedRange: params.summarizedRange } : {}),
    summaryAttempts: params.summaryAttempts,
    warnings,
  };
}
