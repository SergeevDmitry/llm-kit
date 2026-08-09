/**
 * Greedily packs leaf units into budget-respecting chunks: accumulate while
 * the budget allows, reserve room for an optional rendered heading prefix
 * and for overlap, then verify and (rarely) shrink the assembled text
 * against the real tokenizer.
 */
import { nearestHeadingOnly, renderHeadingPrefix } from '../metadata/heading-path.js';
import { createChunkId } from '../metadata/chunk-id.js';
import { diagnostic } from '../diagnostics.js';
import type { LeafUnit } from '../document/types.js';
import type { ChunkDiagnostic, TextChunk } from '../types.js';
import type { ResolvedOptions } from '../options.js';
import { assembleWithinBudget } from './budget.js';
import { computeOverlap } from './overlap.js';

export function packLeafUnits(
  leafUnits: readonly LeafUnit[],
  resolved: ResolvedOptions,
  toOriginalOffset: (normalizedIndex: number) => number,
): TextChunk[] {
  const chunks: TextChunk[] = [];
  let previousOwnUnits: LeafUnit[] = [];
  let index = 0;
  let i = 0;

  while (i < leafUnits.length) {
    const first = leafUnits[i];
    if (first === undefined) break;
    const startHeadings = first.headings;
    const chunkDiagnostics: ChunkDiagnostic[] = [];

    let headingPrefixText = '';
    if (resolved.includeHeadingTextInContent) {
      const rendered = renderHeadingPrefix(startHeadings);
      if (rendered.length > 0) {
        const renderedTokens = resolved.tokenizer.count(rendered);
        if (renderedTokens < resolved.budget) {
          headingPrefixText = rendered;
        } else {
          chunkDiagnostics.push(
            diagnostic(
              'HEADING_PREFIX_OMITTED',
              'the rendered heading breadcrumb alone would not leave room for any content under the budget; omitted',
            ),
          );
        }
      }
    }
    const tablePrefix = first.syntheticPrefix ?? '';
    const prefixText = headingPrefixText + tablePrefix;
    const prefixTokens = resolved.tokenizer.count(prefixText);

    const remainingAfterPrefix = Math.max(0, resolved.budget - prefixTokens);
    const canOverlap =
      chunks.length > 0 &&
      resolved.overlapTokens > 0 &&
      previousOwnUnits.length > 0 &&
      tablePrefix === '';
    const reserveOverlap = canOverlap
      ? Math.max(0, Math.min(resolved.overlapTokens, remainingAfterPrefix - 1))
      : 0;
    const contentBudget = Math.max(0, remainingAfterPrefix - reserveOverlap);

    const packed: LeafUnit[] = [];
    let sum = 0;
    let j = i;
    while (j < leafUnits.length) {
      const unit = leafUnits[j];
      if (unit === undefined) break;
      if (packed.length > 0 && unit.syntheticPrefix !== undefined) break;
      if (packed.length === 0) {
        packed.push(unit);
        sum += unit.tokenCount;
        j += 1;
        continue;
      }
      if (sum + unit.tokenCount > contentBudget) break;
      packed.push(unit);
      sum += unit.tokenCount;
      j += 1;
    }

    const overlapResult =
      reserveOverlap > 0
        ? computeOverlap(previousOwnUnits, reserveOverlap, resolved.tokenizer)
        : { text: '', tokens: 0 };

    const assembled = assembleWithinBudget(
      { prefix: prefixText, overlap: overlapResult.text, unitTexts: packed.map((u) => u.text) },
      resolved.budget,
      resolved.tokenizer,
    );

    const unusedCount = packed.length - assembled.unitsUsed;
    if (unusedCount > 0) j -= unusedCount;
    const usedUnits = packed.slice(0, assembled.unitsUsed);
    const anchor = usedUnits[0] ?? first;
    const lastUsed = usedUnits[usedUnits.length - 1] ?? first;

    if (assembled.exceeded) {
      chunkDiagnostics.push(
        diagnostic(
          'BUDGET_EXCEEDED',
          'this chunk exceeds maxTokens: even the smallest possible content, with overlap and any prefix dropped, is still over budget',
          { charStart: anchor.start, charEnd: lastUsed.end },
        ),
      );
    }

    const realStart =
      assembled.usedOverlap && overlapResult.sourceStart !== undefined
        ? overlapResult.sourceStart
        : anchor.start;
    const realEnd = lastUsed.end;
    const headings = resolved.preserveHeadingPath
      ? startHeadings
      : nearestHeadingOnly(startHeadings);

    const sourceCharStart = toOriginalOffset(realStart);
    const sourceCharEnd = toOriginalOffset(realEnd);

    chunks.push({
      id: createChunkId({
        index,
        charStart: sourceCharStart,
        charEnd: sourceCharEnd,
        tokenizerId: resolved.tokenizer.id,
      }),
      index,
      text: assembled.text,
      tokenCount: assembled.tokenCount,
      tokenizerId: resolved.tokenizer.id,
      source: { charStart: sourceCharStart, charEnd: sourceCharEnd },
      headings,
      overlap: assembled.usedOverlap
        ? {
            tokensFromPrevious: overlapResult.tokens,
            sourceCharStart:
              overlapResult.sourceStart !== undefined
                ? toOriginalOffset(overlapResult.sourceStart)
                : undefined,
          }
        : { tokensFromPrevious: 0 },
      ...(chunkDiagnostics.length > 0 ? { diagnostics: chunkDiagnostics } : {}),
    });

    previousOwnUnits = usedUnits;
    index += 1;
    i = usedUnits.length > 0 ? j : j + 1;
  }

  return chunks;
}
