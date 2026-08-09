/**
 * Purpose-built Markdown block parser — not a CommonMark implementation
 * (a documented non-goal of this package). It recognizes exactly the
 * structures this package needs to chunk on: ATX/Setext headings, fenced
 * code blocks, block quotes, lists, tables, and paragraphs — enough to
 * chunk real-world documentation without pulling in a full renderer.
 *
 * The parser is a single forward scan over lines. Whichever block type
 * claims the current line consumes it (and, for multi-line blocks, the
 * lines after it) before the scan continues — this is what makes
 * heading-like text inside a fenced code block *not* a heading: while the
 * scan is inside a fence, no other branch runs at all.
 */
import {
  HeadingStack,
  isSetextH1Underline,
  isSetextH2Underline,
  matchAtxHeading,
} from '../boundaries/headings.js';
import { isTableSeparatorLine } from '../boundaries/tables.js';
import type { HeadingRef } from '../types.js';
import { closeGaps } from './close-gaps.js';
import type { BlockKind, DocumentUnit, ParsedDocument } from './types.js';

interface Line {
  readonly text: string;
  readonly start: number;
  readonly end: number;
}

function toLines(text: string): Line[] {
  const lines: Line[] = [];
  let cursor = 0;
  for (const raw of text.split('\n')) {
    lines.push({ text: raw, start: cursor, end: cursor + raw.length });
    cursor += raw.length + 1;
  }
  return lines;
}

const FENCE_OPEN = /^(`{3,}|~{3,})/;
const LIST_MARKER = /^(\s*)([-*+]|\d+[.)])(\s+)(?=\S)/;
const BLOCKQUOTE_MARKER = /^\s{0,3}>/;

function isBlank(line: string): boolean {
  return line.trim().length === 0;
}

function fenceMarker(trimmed: string): { char: string; length: number } | undefined {
  const match = FENCE_OPEN.exec(trimmed);
  if (match === null) return undefined;
  const marker = match[1] ?? '';
  return { char: marker[0] ?? '`', length: marker.length };
}

function isTableRow(line: string): boolean {
  return line.includes('|') && !isBlank(line);
}

function isListItemStart(line: string): boolean {
  return LIST_MARKER.test(line);
}

function isIndentedContinuation(line: string): boolean {
  return line.length > 0 && /^\s/.test(line) && !isBlank(line);
}

export function parseMarkdown(normalizedText: string): ParsedDocument {
  const lines = toLines(normalizedText);
  const units: DocumentUnit[] = [];
  const headingStack = new HeadingStack();
  let unclosedFenceStart: number | undefined;

  const currentHeadings = (): readonly HeadingRef[] => headingStack.snapshot();

  const sliceUnit = (
    kind: BlockKind,
    startLineIndex: number,
    endLineIndex: number,
    headings: readonly HeadingRef[],
    blockLike: boolean,
  ): void => {
    const startLine = lines[startLineIndex];
    const endLine = lines[endLineIndex];
    if (startLine === undefined || endLine === undefined) return;
    units.push({
      kind,
      text: normalizedText.slice(startLine.start, endLine.end),
      start: startLine.start,
      end: endLine.end,
      headings,
      blockLike,
    });
  };

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line === undefined) break;
    const trimmed = line.text.trim();

    if (isBlank(line.text)) {
      i += 1;
      continue;
    }

    // --- fenced code block ------------------------------------------------
    const fence = fenceMarker(trimmed);
    if (fence !== undefined) {
      let j = i + 1;
      let closed = false;
      while (j < lines.length) {
        const candidate = lines[j];
        if (candidate === undefined) break;
        const candidateTrimmed = candidate.text.trim();
        if (
          candidateTrimmed.startsWith(fence.char.repeat(fence.length)) &&
          /^(`{3,}|~{3,})\s*$/.test(candidateTrimmed)
        ) {
          closed = true;
          break;
        }
        j += 1;
      }
      const endLineIndex = closed ? j : lines.length - 1;
      if (!closed) {
        const startLine = lines[i];
        unclosedFenceStart = startLine?.start;
      }
      sliceUnit('code-fence', i, endLineIndex, currentHeadings(), true);
      i = endLineIndex + 1;
      continue;
    }

    // --- Setext heading (lookahead one line) -------------------------------
    const next = lines[i + 1];
    if (next !== undefined && !isBlank(next.text)) {
      const nextTrimmed = next.text.trim();
      const isCandidateTextLine =
        !FENCE_OPEN.test(trimmed) &&
        !BLOCKQUOTE_MARKER.test(line.text) &&
        !isListItemStart(line.text) &&
        matchAtxHeading(trimmed) === undefined;
      if (isCandidateTextLine && isSetextH1Underline(nextTrimmed)) {
        const headings = headingStack.push(1, trimmed);
        sliceUnit('heading', i, i + 1, headings, false);
        i += 2;
        continue;
      }
      if (isCandidateTextLine && isSetextH2Underline(nextTrimmed) && !isListItemStart(next.text)) {
        const headings = headingStack.push(2, trimmed);
        sliceUnit('heading', i, i + 1, headings, false);
        i += 2;
        continue;
      }
    }

    // --- ATX heading ---------------------------------------------------
    const atx = matchAtxHeading(trimmed);
    if (atx !== undefined) {
      const headings = headingStack.push(atx.depth, atx.text);
      sliceUnit('heading', i, i, headings, false);
      i += 1;
      continue;
    }

    // --- block quote -----------------------------------------------------
    // Consecutive `>`-marked lines only — no CommonMark "lazy continuation"
    // (a following plain-text line still counts as part of the quote).
    // Documented limitation.
    if (BLOCKQUOTE_MARKER.test(line.text)) {
      let j = i;
      while (j < lines.length) {
        const candidate = lines[j];
        if (candidate === undefined || !BLOCKQUOTE_MARKER.test(candidate.text)) break;
        j += 1;
      }
      sliceUnit('blockquote', i, j - 1, currentHeadings(), false);
      i = j;
      continue;
    }

    // --- table -------------------------------------------------------------
    const nextForTable = lines[i + 1];
    if (
      isTableRow(line.text) &&
      nextForTable !== undefined &&
      isTableSeparatorLine(nextForTable.text, 1)
    ) {
      let j = i + 2;
      while (j < lines.length) {
        const candidate = lines[j];
        if (candidate === undefined || !isTableRow(candidate.text)) break;
        j += 1;
      }
      sliceUnit('table', i, j - 1, currentHeadings(), true);
      i = j;
      continue;
    }

    // --- list ----------------------------------------------------------
    if (isListItemStart(line.text)) {
      let j = i;
      const itemBoundaries: number[] = [];
      while (j < lines.length) {
        const candidate = lines[j];
        if (candidate === undefined) break;
        if (isListItemStart(candidate.text)) {
          itemBoundaries.push(j);
          j += 1;
          continue;
        }
        if (isIndentedContinuation(candidate.text)) {
          j += 1;
          continue;
        }
        if (isBlank(candidate.text)) {
          const after = lines[j + 1];
          if (
            after !== undefined &&
            (isListItemStart(after.text) || isIndentedContinuation(after.text))
          ) {
            j += 1;
            continue;
          }
        }
        break;
      }
      const listEnd = j;
      const headings = currentHeadings();
      for (let k = 0; k < itemBoundaries.length; k += 1) {
        const itemStart = itemBoundaries[k];
        const itemEndExclusive = itemBoundaries[k + 1] ?? listEnd;
        if (itemStart === undefined) continue;
        // Trim trailing blank lines from this item's span.
        let itemEnd = itemEndExclusive - 1;
        while (itemEnd > itemStart && isBlank(lines[itemEnd]?.text ?? '')) itemEnd -= 1;
        sliceUnit('list-item', itemStart, itemEnd, headings, false);
      }
      i = listEnd;
      continue;
    }

    // --- paragraph (default) -----------------------------------------------
    let j = i;
    while (j < lines.length) {
      const candidate = lines[j];
      if (candidate === undefined || isBlank(candidate.text)) break;
      if (
        j > i &&
        (fenceMarker(candidate.text.trim()) !== undefined ||
          matchAtxHeading(candidate.text.trim()) !== undefined ||
          BLOCKQUOTE_MARKER.test(candidate.text) ||
          isListItemStart(candidate.text) ||
          (isTableRow(candidate.text) && isTableSeparatorLine(lines[j + 1]?.text ?? '', 1)))
      ) {
        break;
      }
      // A single-line paragraph followed by a Setext underline is claimed by
      // the heading branch above, not here — but a *multi-line* paragraph's
      // last line could still look like one. This purpose-built parser does
      // not special-case that (documented limitation): only a single
      // preceding line is recognized as Setext heading text.
      j += 1;
    }
    sliceUnit('paragraph', i, j - 1, currentHeadings(), false);
    i = j;
  }

  const closedUnits = closeGaps(units, normalizedText);
  return unclosedFenceStart === undefined
    ? { units: closedUnits }
    : { units: closedUnits, unclosedFenceStart };
}
