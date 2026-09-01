/**
 * Splits an oversized Markdown table by row, repeating the header row (and
 * separator) at the start of every chunk after the first. Continuation
 * pieces carry the repeated header as a
 * `syntheticPrefix` rather than baking it into `text` — the header is a real
 * substring of the source only in the first piece; later pieces render it
 * as non-source-backed content, exactly like a heading breadcrumb.
 *
 * Whichever path runs, exactly one piece covers the header's own source span:
 * the first piece `flush()` emits (header baked into `text`), or — when the
 * first body row is oversized and never reaches `flush()` — a header-only
 * leaf emitted by the row-splitting branch below.
 */
import type { DocumentUnit, LeafUnit } from '../document/types.js';
import type { ChunkDiagnostic, HardBoundary, Tokenizer } from '../types.js';
import { splitOversizedUnit } from './split-oversized.js';

export function splitTable(
  unit: DocumentUnit,
  hardBudget: number,
  tokenizer: Tokenizer,
  hardBoundary: HardBoundary,
  diagnostics: ChunkDiagnostic[],
): LeafUnit[] {
  const rawLines = unit.text.split('\n');
  while (rawLines.length > 0 && rawLines[rawLines.length - 1] === '') rawLines.pop();

  const headerLine = rawLines[0];
  const separatorLine = rawLines[1];
  const bodyLines = rawLines.slice(2);

  if (headerLine === undefined || separatorLine === undefined || bodyLines.length === 0) {
    return splitOversizedUnit(unit, { hardBudget, tokenizer, hardBoundary, diagnostics });
  }

  const headerBlock = `${headerLine}\n${separatorLine}\n`;
  const headerTokens = tokenizer.count(headerBlock);
  if (headerTokens >= hardBudget) {
    // Repeating the header would alone consume the whole budget; fall back
    // to a plain line split without repetition (still correct, just less legible).
    return splitOversizedUnit(unit, { hardBudget, tokenizer, hardBoundary, diagnostics });
  }

  let cursor = headerLine.length + 1 + separatorLine.length + 1;
  const bodySpans = bodyLines.map((line, index) => {
    const relStart = cursor;
    const isLastRow = index === bodyLines.length - 1;
    cursor += line.length + 1;
    // `relEnd` is this row's real end offset within `unit.text`: `cursor`
    // after advancing past it (which includes this row's own trailing
    // newline, since more table content follows every non-last row in the
    // source) — except for the last row, where `cursor` may overshoot by
    // one (the source may have no trailing newline at all, if the table
    // sits at the end of the input) and use the literal end of `unit.text`
    // instead, which also recovers any trailing blank lines `closeGaps`
    // folded into this unit.
    const relEnd = isLastRow ? unit.text.length : cursor;
    return { text: line, start: unit.start + relStart, relStart, relEnd };
  });

  const pieces: LeafUnit[] = [];
  let rowsInPiece: { text: string; start: number; relStart: number; relEnd: number }[] = [];
  let budgetForRows = hardBudget - headerTokens;

  const flush = (): void => {
    if (rowsInPiece.length === 0) return;
    const isFirstPiece = pieces.length === 0;
    const firstRow = rowsInPiece[0];
    const lastRow = rowsInPiece[rowsInPiece.length - 1];
    if (firstRow === undefined || lastRow === undefined) return;
    // A literal slice of the source, not a re-join of row texts with a
    // synthesized `\n` after every one — that fabricated a trailing newline
    // that does not exist in the source whenever a table sits at the end of
    // the input, pushing `end` one character past `unit.text.length`.
    const text = unit.text.slice(firstRow.relStart, lastRow.relEnd);
    const start = firstRow.start;
    pieces.push({
      kind: 'table',
      text: isFirstPiece ? `${headerBlock}${text}` : text,
      start: isFirstPiece ? unit.start : start,
      end: start + text.length,
      headings: unit.headings,
      blockLike: true,
      tokenCount: tokenizer.count(isFirstPiece ? `${headerBlock}${text}` : text),
      ...(isFirstPiece ? {} : { syntheticPrefix: headerBlock }),
    });
    rowsInPiece = [];
    budgetForRows = hardBudget - headerTokens;
  };

  for (const row of bodySpans) {
    const rowTokens = tokenizer.count(`${row.text}\n`);
    if (rowsInPiece.length > 0 && rowTokens > budgetForRows) {
      flush();
    }
    if (rowTokens > budgetForRows) {
      // A single row alone doesn't fit even with the header reserved: split
      // the row itself at finer boundaries, each as its own piece (no header
      // repetition inside a single logical row).
      //
      // Emit the header block itself first when nothing has emitted it yet.
      // `flush()` is the only other place that does, and it only bakes the
      // header into `text` for the *first* piece — so when the first body row
      // takes this branch, `flush()` has never run, every fragment below
      // carries the header as a non-source-backed `syntheticPrefix`, and the
      // header/separator span ends up in no chunk's `text` *and* in no
      // chunk's `source` range: those characters disappear from the result
      // entirely, taking the column names with them. It is not an
      // oversized-table edge case either — it fires whenever
      // `header + first row` exceeds the budget while the header alone fits,
      // which is routine at retrieval-sized budgets.
      //
      // A separate leaf, not `headerBlock + fragment.text` the way `flush()`
      // bakes it in: `splitOversizedUnit` already sized that fragment against
      // the whole budget, so prepending the header could push it over.
      // `headerTokens < hardBudget` is guaranteed above, so this leaf always
      // fits on its own, and having no `syntheticPrefix` lets `packLeafUnits`
      // pack it together with whatever precedes the table.
      if (pieces.length === 0) {
        pieces.push({
          kind: 'table',
          text: headerBlock,
          start: unit.start,
          end: unit.start + headerBlock.length,
          headings: unit.headings,
          blockLike: true,
          tokenCount: headerTokens,
        });
      }
      const rowUnit: DocumentUnit = {
        kind: 'table',
        text: row.text,
        start: row.start,
        end: row.start + row.text.length,
        headings: unit.headings,
        blockLike: false,
      };
      for (const piece of splitOversizedUnit(rowUnit, {
        hardBudget,
        tokenizer,
        hardBoundary,
        diagnostics,
      })) {
        // Every fragment repeats the header as a synthetic prefix — including
        // the first, which the header leaf above has already emitted as real,
        // source-backed text.
        pieces.push({ ...piece, syntheticPrefix: headerBlock });
      }
      continue;
    }
    rowsInPiece.push(row);
    budgetForRows -= rowTokens;
  }
  flush();

  return pieces;
}
