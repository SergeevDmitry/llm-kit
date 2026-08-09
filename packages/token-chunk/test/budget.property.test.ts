/**
 * The core budget invariant: `tokenCount <= maxTokens` for every emitted
 * chunk, with heading prefixes and overlap counted, over randomly generated
 * documents and budgets.
 *
 * Seeded so a CI failure reproduces exactly.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { APPROX_TOKENIZER_ID, chunkMarkdown, chunkText } from '../src/index.js';

const FAST_CHECK_SEED = 0x62_75_64_67; // 'budg'
const FAST_CHECK_RUNS = 2000;

const words = [
  'hello',
  'world',
  '大型语言模型',
  'café',
  '🚀',
  '👨‍👩‍👧‍👦',
  'Привет',
  'мир',
  'the',
  'quick',
  'brown',
  'fox',
  'https://example.com/path?query=1',
  '```',
  '#',
  '##',
  '###',
  '-',
  '*',
  '1.',
  '>',
  '|',
  'a|b|c',
  '---',
  '===',
  '\r\n',
  // U+2028/U+2029 are ECMAScript `LineTerminator` code points that a `.`
  // metacharacter can never match without the `dotAll` flag, but that `\s`
  // (used throughout this package's boundary scanners) does match — the
  // exact class of character an independent review found reachable inside
  // an ATX heading line (`boundaries/headings.ts`'s doc comment on
  // `matchAtxHeading` has the full mechanism; pinned explicitly in
  // `test/markdown-headings.test.ts`). U+0085/U+000B/U+000C/U+00A0 were
  // checked alongside them and found to behave identically to ordinary
  // whitespace everywhere in this package; included here anyway so the
  // whole class stays permanently exercised across every property test
  // that shares this word list, not just the one pinned case.
  '\u2028',
  '\u2029',
  '\u0085',
  '\u000B',
  '\u000C',
  '\u00A0',
];

const docArb = fc
  .array(
    fc.oneof(
      fc.constantFrom(...words),
      fc.string({ maxLength: 20 }),
      fc.constant('\n'),
      fc.constant('\n\n'),
      fc.constant(' '),
    ),
    { minLength: 1, maxLength: 60 },
  )
  .map((parts) => parts.join(' '));

const optionsArb = fc.record({
  maxTokens: fc.integer({ min: 1, max: 60 }),
  overlapTokens: fc.integer({ min: 0, max: 20 }),
  safetyMarginTokens: fc.integer({ min: 0, max: 15 }),
  includeHeadingTextInContent: fc.boolean(),
  hardBoundary: fc.constantFrom<'sentence' | 'word' | 'token'>('sentence', 'word', 'token'),
  format: fc.constantFrom<'text' | 'markdown'>('text', 'markdown'),
});

describe('budget invariant (property)', () => {
  it('tokenCount never exceeds maxTokens - safetyMarginTokens, unless flagged in diagnostics', () => {
    fc.assert(
      fc.property(docArb, optionsArb, (doc, opts) => {
        fc.pre(opts.safetyMarginTokens < opts.maxTokens);
        const { format, ...rest } = opts;
        const chunks =
          format === 'markdown' ? chunkMarkdown(doc, rest) : chunkText(doc, { ...rest, format });
        const hardBudget = opts.maxTokens - opts.safetyMarginTokens;

        for (const chunk of chunks) {
          expect(chunk.text.length).toBeGreaterThan(0);
          if (chunk.tokenCount > hardBudget) {
            const flagged = (chunk.diagnostics ?? []).some(
              (d) => d.code === 'BUDGET_EXCEEDED' || d.code === 'HARD_BOUNDARY_REACHED',
            );
            expect(flagged).toBe(true);
          }
        }
      }),
      { seed: FAST_CHECK_SEED, numRuns: FAST_CHECK_RUNS },
    );
  });

  it('overlap.tokensFromPrevious never exceeds the requested overlapTokens', () => {
    fc.assert(
      fc.property(docArb, optionsArb, (doc, opts) => {
        fc.pre(opts.safetyMarginTokens < opts.maxTokens);
        const { format, ...rest } = opts;
        const chunks =
          format === 'markdown' ? chunkMarkdown(doc, rest) : chunkText(doc, { ...rest, format });
        for (const chunk of chunks) {
          expect(chunk.overlap.tokensFromPrevious).toBeLessThanOrEqual(opts.overlapTokens);
          expect(chunk.overlap.tokensFromPrevious).toBeGreaterThanOrEqual(0);
        }
      }),
      { seed: FAST_CHECK_SEED, numRuns: FAST_CHECK_RUNS },
    );
  });

  it('chunk indices are sequential starting at 0, and the first chunk never carries overlap', () => {
    fc.assert(
      fc.property(docArb, optionsArb, (doc, opts) => {
        fc.pre(opts.safetyMarginTokens < opts.maxTokens);
        const { format, ...rest } = opts;
        const chunks =
          format === 'markdown' ? chunkMarkdown(doc, rest) : chunkText(doc, { ...rest, format });
        chunks.forEach((chunk, i) => expect(chunk.index).toBe(i));
        if (chunks.length > 0) {
          expect(chunks[0]?.overlap.tokensFromPrevious).toBe(0);
        }
      }),
      { seed: FAST_CHECK_SEED, numRuns: FAST_CHECK_RUNS },
    );
  });

  it('every chunk carries tokenizerId, the default approximate tokenizer unless one was injected', () => {
    fc.assert(
      fc.property(docArb, optionsArb, (doc, opts) => {
        fc.pre(opts.safetyMarginTokens < opts.maxTokens);
        const { format, ...rest } = opts;
        const chunks =
          format === 'markdown' ? chunkMarkdown(doc, rest) : chunkText(doc, { ...rest, format });
        for (const chunk of chunks) {
          expect(chunk.tokenizerId).toBe(APPROX_TOKENIZER_ID);
        }
      }),
      { seed: FAST_CHECK_SEED, numRuns: FAST_CHECK_RUNS },
    );
  });
});
