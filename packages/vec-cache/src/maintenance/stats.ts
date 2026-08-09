/** Pure shaping of raw aggregate query rows into {@link VectorCacheStats} — kept separate from SQL so it is independently testable. */
import type { VectorCacheStats } from '../types.js';

export interface RawTotalsRow {
  readonly count: number;
  readonly bytes: number;
  readonly oldestMs: number | null;
  readonly newestMs: number | null;
}

export interface RawNamespaceStatsRow {
  readonly namespace: string;
  readonly modelId: string;
  readonly count: number;
  readonly bytes: number;
}

export function buildStats(
  totals: RawTotalsRow,
  byNamespace: readonly RawNamespaceStatsRow[],
): VectorCacheStats {
  return {
    totalEntries: totals.count,
    totalBytes: totals.bytes,
    oldestEntryMs: totals.oldestMs ?? undefined,
    newestEntryMs: totals.newestMs ?? undefined,
    namespaces: byNamespace.map((row) => ({
      namespace: row.namespace,
      modelId: row.modelId,
      count: row.count,
      bytes: row.bytes,
    })),
  };
}
