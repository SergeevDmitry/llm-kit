/**
 * Recursively splits any single document unit whose own token cost exceeds
 * the budget at the next finer boundary: block (line, for code/tables) or
 * sentence -> word -> token, stopping at whichever tier `hardBoundary`
 * allows. A unit that still exceeds the budget after every allowed tier is
 * emitted anyway, as the one documented exception to "every chunk's
 * tokenCount is <= maxTokens", and reported via diagnostics.
 */
import { splitSentences } from '../boundaries/sentences.js';
import { splitByTokenBudget } from '../boundaries/token-window.js';
import { splitWords } from '../boundaries/words.js';
import type { TextSpan } from '../boundaries/paragraphs.js';
import type { DocumentUnit, LeafUnit } from '../document/types.js';
import type { ChunkDiagnostic, HardBoundary, HeadingRef, Tokenizer } from '../types.js';
import { diagnostic } from '../diagnostics.js';

const TIER_RANK: Record<HardBoundary, number> = { sentence: 1, word: 2, token: 3 };

function splitLines(text: string, baseOffset: number): TextSpan[] {
  const spans: TextSpan[] = [];
  const lines = text.split('\n');
  let cursor = 0;
  lines.forEach((line, index) => {
    const withNewline = index < lines.length - 1 ? `${line}\n` : line;
    if (withNewline.length > 0) {
      spans.push({
        text: withNewline,
        start: baseOffset + cursor,
        end: baseOffset + cursor + withNewline.length,
      });
    }
    cursor += withNewline.length;
  });
  return spans;
}

function leaf(
  unit: Pick<DocumentUnit, 'kind' | 'headings'>,
  text: string,
  start: number,
  tokenizer: Tokenizer,
  blockLike = false,
): LeafUnit {
  return {
    kind: unit.kind,
    text,
    start,
    end: start + text.length,
    headings: unit.headings,
    blockLike,
    tokenCount: tokenizer.count(text),
  };
}

interface SplitContext {
  readonly kind: DocumentUnit['kind'];
  readonly headings: readonly HeadingRef[];
  readonly hardBudget: number;
  readonly tokenizer: Tokenizer;
  readonly hardBoundary: HardBoundary;
  readonly diagnostics: ChunkDiagnostic[];
}

function tierC(text: string, start: number, ctx: SplitContext): LeafUnit[] {
  const count = ctx.tokenizer.count(text);
  if (count <= ctx.hardBudget) return [leaf(ctx, text, start, ctx.tokenizer)];
  if (TIER_RANK[ctx.hardBoundary] < TIER_RANK.token) {
    ctx.diagnostics.push(
      diagnostic(
        'HARD_BOUNDARY_REACHED',
        `unit exceeds budget at the word boundary and hardBoundary forbids token-level splitting`,
        {
          charStart: start,
          charEnd: start + text.length,
        },
      ),
    );
    return [leaf(ctx, text, start, ctx.tokenizer)];
  }
  const pieces = splitByTokenBudget(text, ctx.hardBudget, ctx.tokenizer, start);
  return pieces.map((piece) => {
    const pieceCount = ctx.tokenizer.count(piece.text);
    if (pieceCount > ctx.hardBudget) {
      ctx.diagnostics.push(
        diagnostic(
          'BUDGET_EXCEEDED',
          `a single indivisible unit's token estimate exceeds the budget`,
          {
            charStart: piece.start,
            charEnd: piece.end,
          },
        ),
      );
    }
    return leaf(ctx, piece.text, piece.start, ctx.tokenizer);
  });
}

function tierB(text: string, start: number, ctx: SplitContext): LeafUnit[] {
  const count = ctx.tokenizer.count(text);
  if (count <= ctx.hardBudget) return [leaf(ctx, text, start, ctx.tokenizer)];
  if (TIER_RANK[ctx.hardBoundary] < TIER_RANK.word) {
    ctx.diagnostics.push(
      diagnostic(
        'HARD_BOUNDARY_REACHED',
        `unit exceeds budget beyond the ${ctx.kind === 'code-fence' || ctx.kind === 'table' ? 'line' : 'sentence'} boundary and hardBoundary forbids finer splitting`,
        { charStart: start, charEnd: start + text.length },
      ),
    );
    return [leaf(ctx, text, start, ctx.tokenizer)];
  }
  const words = splitWords(text, start);
  if (words.length <= 1) return tierC(text, start, ctx);
  return words.flatMap((word) => tierC(word.text, word.start, ctx));
}

/** Splits one oversized document unit into leaf units, per its own structural kind. */
export function splitOversizedUnit(
  unit: DocumentUnit,
  ctxBase: Omit<SplitContext, 'kind' | 'headings'>,
): LeafUnit[] {
  const ctx: SplitContext = { ...ctxBase, kind: unit.kind, headings: unit.headings };
  const count = ctx.tokenizer.count(unit.text);
  if (count <= ctx.hardBudget)
    return [leaf(unit, unit.text, unit.start, ctx.tokenizer, unit.blockLike)];

  const tierASpans = unit.blockLike
    ? splitLines(unit.text, unit.start)
    : splitSentences(unit.text, unit.start);
  if (tierASpans.length <= 1) {
    return tierB(unit.text, unit.start, ctx);
  }
  return tierASpans.flatMap((span) => tierB(span.text, span.start, ctx));
}
