/**
 * Public entry points. Algorithm: normalize line endings (keeping an offset
 * map back to the original input) -> detect or use the given format ->
 * parse into structural units -> split any oversized unit at progressively
 * finer boundaries -> pack -> emit chunks.
 */
import { normalizeLineEndings } from './document/normalize.js';
import { parseMarkdown } from './document/markdown-block-parser.js';
import { parsePlainText } from './document/plain-text-parser.js';
import type { DocumentUnit, LeafUnit } from './document/types.js';
import { isTableSeparatorLine } from './boundaries/tables.js';
import { diagnostic } from './diagnostics.js';
import { assertInputWithinLimit, resolveOptions } from './options.js';
import { splitOversizedUnit } from './packing/split-oversized.js';
import { splitTable } from './packing/split-table.js';
import { packLeafUnits } from './packing/pack-units.js';
import type { ChunkDiagnostic, ChunkFormat, ChunkOptions, TextChunk } from './types.js';

const ATX_HEADING_HINT = /^ {0,3}#{1,6}\s+\S/m;
const FENCE_HINT = /^ {0,3}(`{3,}|~{3,})/m;
const LIST_HINT = /^ {0,3}(?:[-*+]|\d+[.)])\s+\S/m;
const BLOCKQUOTE_HINT = /^ {0,3}>/m;

/**
 * A document has a table if any line looks like a separator row (at least
 * two `-`-cells). Scanned line by line via `isTableSeparatorLine` rather
 * than a single `/m`-flagged regex — see that function's doc comment for
 * why.
 */
function hasTableSeparatorLine(normalizedText: string): boolean {
  for (const line of normalizedText.split('\n')) {
    if (isTableSeparatorLine(line, 2)) return true;
  }
  return false;
}

function detectFormat(normalizedText: string): 'text' | 'markdown' {
  const isMarkdown =
    ATX_HEADING_HINT.test(normalizedText) ||
    FENCE_HINT.test(normalizedText) ||
    hasTableSeparatorLine(normalizedText) ||
    LIST_HINT.test(normalizedText) ||
    BLOCKQUOTE_HINT.test(normalizedText);
  return isMarkdown ? 'markdown' : 'text';
}

function resolveFormat(format: ChunkFormat, normalizedText: string): 'text' | 'markdown' {
  if (format === 'text' || format === 'markdown') return format;
  return detectFormat(normalizedText);
}

function toLeafUnits(
  units: readonly DocumentUnit[],
  hardBudget: number,
  tokenizer: ReturnType<typeof resolveOptions>['tokenizer'],
  hardBoundary: ReturnType<typeof resolveOptions>['hardBoundary'],
  diagnostics: ChunkDiagnostic[],
): LeafUnit[] {
  const leaves: LeafUnit[] = [];
  for (const unit of units) {
    if (unit.text.length === 0) continue;
    // Bounded iterative append, not `push(...pieces)`: `pieces` can have
    // tens of thousands of entries (e.g. one leaf per indivisible grapheme
    // in an emoji run), and spreading an array into call arguments is
    // capped far below that by the engine's argument-count limit —
    // `push.apply`/`Math.max(...)`/`String.fromCharCode(...)` share the
    // same failure mode and must not be reintroduced here either.
    if (unit.kind === 'table') {
      for (const piece of splitTable(unit, hardBudget, tokenizer, hardBoundary, diagnostics)) {
        leaves.push(piece);
      }
    } else {
      for (const piece of splitOversizedUnit(unit, {
        hardBudget,
        tokenizer,
        hardBoundary,
        diagnostics,
      })) {
        leaves.push(piece);
      }
    }
  }
  return leaves.filter((leaf) => leaf.text.length > 0);
}

/** A converted diagnostic with both offsets resolved, tagged with its position in the input list. */
interface RoutableDiagnostic extends ChunkDiagnostic {
  readonly charStart: number;
  readonly charEnd: number;
  readonly originalIndex: number;
}

/**
 * Diagnostics collected while parsing and splitting (an unclosed fence, a
 * unit that couldn't be split further) carry *normalized*-document offsets
 * and are collected once, up front — before packing decides which chunk
 * each unit lands in. This attaches each one to every chunk whose (already
 * original-offset) `source` range overlaps it, converting offsets along the
 * way, instead of dumping the whole list onto the first chunk regardless of
 * where it actually applies.
 *
 * Both `chunks` and `diagnostics` are ordered by source offset (chunk
 * `source.charStart`/`charEnd` are non-decreasing across the array, even
 * with overlap — a later chunk's overlap text is always drawn from within
 * the previous chunk's own range, never before it). A version that mapped
 * over every chunk and, per chunk, filtered the *entire* diagnostics
 * collection was O(chunks x diagnostics), which an indivisible-unit input
 * (one `BUDGET_EXCEEDED` diagnostic per leaf, one leaf per chunk) turns
 * quadratic in input size.
 *
 * This instead sorts diagnostics once by `charStart` and sweeps them in
 * lockstep with `chunks`, maintaining only the diagnostics whose range
 * currently overlaps the chunk under consideration ("active"). Per chunk,
 * work is proportional to how many diagnostics enter/leave the active set
 * at that point plus how many are actually attached — not to the total
 * diagnostic count — so the common case (each diagnostic overlaps O(1)
 * chunks) is linear overall. A diagnostic that legitimately spans many
 * chunks (e.g. `UNCLOSED_CODE_FENCE` running to end of input) still costs
 * one active-set entry per chunk it truly overlaps, matching the size of
 * the output it produces.
 *
 * The active set is accumulated in sorted-by-`charStart` order, which is
 * not necessarily the order diagnostics were originally generated in (an
 * `UNCLOSED_CODE_FENCE` diagnostic for a fence near the end of the document
 * is pushed before diagnostics for earlier units that get split). Each
 * chunk's attached list is re-sorted by `originalIndex` before use so the
 * output order is identical to the old `Array.prototype.filter` behavior —
 * verified by `test/route-diagnostics-differential.property.test.ts`.
 */
// Exported (but not re-exported from `index.ts` — not part of the public
// API) so `test/route-diagnostics-differential.property.test.ts` can drive
// it directly against a reference implementation, the same white-box
// pattern `test/normalize.test.ts` uses for `normalizeLineEndings`.
export function routeDiagnostics(
  chunks: readonly TextChunk[],
  diagnostics: readonly ChunkDiagnostic[],
  toOriginalOffset: (normalizedIndex: number) => number,
): TextChunk[] {
  if (diagnostics.length === 0 || chunks.length === 0) return [...chunks];

  const routable: RoutableDiagnostic[] = [];
  diagnostics.forEach((d, originalIndex) => {
    if (d.charStart === undefined || d.charEnd === undefined) return;
    routable.push({
      ...d,
      charStart: toOriginalOffset(d.charStart),
      charEnd: toOriginalOffset(d.charEnd),
      originalIndex,
    });
  });
  if (routable.length === 0) return [...chunks];

  const byStart = [...routable].sort((a, b) => a.charStart - b.charStart);

  const result: TextChunk[] = [];
  let active: RoutableDiagnostic[] = [];
  let enterIndex = 0;

  for (const chunk of chunks) {
    // Admit every diagnostic that has started by the time this chunk ends.
    // `chunk.source.charEnd` is non-decreasing across chunks, so once a
    // diagnostic is admitted it is never re-considered for entry.
    for (;;) {
      const candidate = byStart[enterIndex];
      if (candidate === undefined || candidate.charStart >= chunk.source.charEnd) break;
      active.push(candidate);
      enterIndex += 1;
    }
    // Evict every diagnostic that ended at or before this chunk starts.
    // `chunk.source.charStart` is also non-decreasing, so eviction is
    // one-directional too; nothing evicted here can become active again.
    active = active.filter((d) => d.charEnd > chunk.source.charStart);

    if (active.length === 0) {
      result.push(chunk);
      continue;
    }

    const attached = [...active]
      .sort((a, b) => a.originalIndex - b.originalIndex)
      .map(({ originalIndex: _originalIndex, ...d }) => d);
    result.push({ ...chunk, diagnostics: [...(chunk.diagnostics ?? []), ...attached] });
  }

  return result;
}

function chunkNormalized(
  parsedFormat: 'text' | 'markdown',
  normalized: ReturnType<typeof normalizeLineEndings>,
  resolved: ReturnType<typeof resolveOptions>,
): readonly TextChunk[] {
  const parsed =
    parsedFormat === 'markdown' ? parseMarkdown(normalized.text) : parsePlainText(normalized.text);

  const parseDiagnostics: ChunkDiagnostic[] = [];
  if (parsed.unclosedFenceStart !== undefined) {
    parseDiagnostics.push(
      diagnostic(
        'UNCLOSED_CODE_FENCE',
        'a fenced code block was never closed; treated as running to end of input',
        {
          charStart: parsed.unclosedFenceStart,
          charEnd: normalized.text.length,
        },
      ),
    );
  }

  const leaves = toLeafUnits(
    parsed.units,
    resolved.budget,
    resolved.tokenizer,
    resolved.hardBoundary,
    parseDiagnostics,
  );
  const chunks = packLeafUnits(leaves, resolved, normalized.toOriginalOffset);

  return routeDiagnostics(chunks, parseDiagnostics, normalized.toOriginalOffset);
}

export function chunkText(input: string, options: ChunkOptions): readonly TextChunk[] {
  if (input.length === 0) return [];
  const resolved = resolveOptions(options);
  assertInputWithinLimit(input, resolved.maxInputChars);
  const normalized = normalizeLineEndings(input);
  const format = resolveFormat(options.format ?? 'auto', normalized.text);
  return chunkNormalized(format, normalized, resolved);
}

export function chunkMarkdown(
  input: string,
  options: Omit<ChunkOptions, 'format'>,
): readonly TextChunk[] {
  if (input.length === 0) return [];
  const resolved = resolveOptions({ ...options, format: 'markdown' });
  assertInputWithinLimit(input, resolved.maxInputChars);
  const normalized = normalizeLineEndings(input);
  return chunkNormalized('markdown', normalized, resolved);
}

export function createChunker(options: ChunkOptions): {
  chunk(input: string): readonly TextChunk[];
} {
  // Validate eagerly so a bad option surfaces at construction time, not on first use.
  resolveOptions(options);
  return { chunk: (input: string): readonly TextChunk[] => chunkText(input, options) };
}
