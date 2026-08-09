import type { DocumentUnit } from './types.js';

/**
 * Extends every unit's `end` to the next unit's `start` (or to the end of
 * the document for the last unit), folding blank-line separators into the
 * *preceding* unit's literal text instead of dropping them.
 *
 * This is what makes the source-reconstruction guarantee exact: once every
 * unit is contiguous with its neighbor, a chunk's packed units concatenate
 * to precisely `normalizedText.slice(firstUnit.start, lastUnit.end)` — no
 * separate bookkeeping needed downstream in packing or overlap. A leading
 * gap (blank lines before the first unit) is left alone; nothing claims
 * that span.
 */
export function closeGaps(units: readonly DocumentUnit[], normalizedText: string): DocumentUnit[] {
  return units.map((unit, index) => {
    const nextStart = units[index + 1]?.start ?? normalizedText.length;
    if (nextStart === unit.end) return unit;
    return { ...unit, end: nextStart, text: normalizedText.slice(unit.start, nextStart) };
  });
}
