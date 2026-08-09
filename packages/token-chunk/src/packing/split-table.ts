/**
 * Splits an oversized Markdown table by row, repeating the header row (and
 * separator) at the start of every chunk after the first. Continuation
 * pieces carry the repeated header as a
 * `syntheticPrefix` rather than baking it into `text` — the header is a real
 * substring of the source only in the first piece; later pieces render it
 * as non-source-backed content, exactly like a heading breadcrumb.
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
  const bodySpans = bodyLines.map((line) => {
    const start = unit.start + cursor;
    cursor += line.length + 1;
    return { text: line, start };
  });

  const pieces: LeafUnit[] = [];
  let rowsInPiece: { text: string; start: number }[] = [];
  let budgetForRows = hardBudget - headerTokens;

  const flush = (): void => {
    if (rowsInPiece.length === 0) return;
    const isFirstPiece = pieces.length === 0;
    const text = rowsInPiece.map((row) => `${row.text}\n`).join('');
    const start = rowsInPiece[0]?.start ?? unit.start;
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
        pieces.push(pieces.length === 0 ? piece : { ...piece, syntheticPrefix: headerBlock });
      }
      continue;
    }
    rowsInPiece.push(row);
    budgetForRows -= rowTokens;
  }
  flush();

  return pieces;
}
