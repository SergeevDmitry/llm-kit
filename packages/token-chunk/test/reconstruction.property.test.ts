/**
 * Source ranges must be correct and content order preserved. The exact,
 * documented relationship (README "Key guarantees"): when no synthetic
 * prefix is rendered
 * (`includeHeadingTextInContent: false`, and no oversized-table
 * header-repeat in play), `chunk.text` equals
 * `normalizeLineEndings(input.slice(chunk.source.charStart, chunk.source.charEnd))`
 * exactly — including across CRLF normalization, since `source` offsets are
 * always into the *original* input.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { chunkMarkdown, chunkText } from '../src/index.js';
import { normalizeLineEndings } from '../src/document/normalize.js';

const FAST_CHECK_SEED = 0x72_65_63_6f; // 'reco'
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
  '#',
  '##',
  '-',
  '*',
  '1.',
  '>',
  '===',
  // Same rationale as budget.property.test.ts: U+2028/U+2029 are
  // ECMAScript LineTerminator code points a `.`-based regex can never
  // cross without `dotAll`, but `\s` (used throughout this package's
  // boundary scanners) does match them — reachable inside an ATX heading
  // line (see `boundaries/headings.ts`). Kept in this word list so the
  // source-reconstruction invariant stays exercised against them too.
  // U+0085/U+000B/U+000C/U+00A0 included alongside for the same reason.
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
      fc.string({ maxLength: 15 }),
      fc.constant('\n'),
      fc.constant('\n\n'),
      fc.constant('\r\n'),
      fc.constant('\r'),
      fc.constant(' '),
    ),
    { minLength: 1, maxLength: 50 },
  )
  .map((parts) => parts.join(' '));

describe('source reconstruction (property)', () => {
  it('chunk.text equals normalizeLineEndings(input.slice(charStart, charEnd)) exactly (no rendered prefix)', () => {
    fc.assert(
      fc.property(
        docArb,
        fc.integer({ min: 1, max: 50 }),
        fc.integer({ min: 0, max: 15 }),
        fc.constantFrom<'text' | 'markdown'>('text', 'markdown'),
        (doc, maxTokens, overlapTokens, format) => {
          const chunks =
            format === 'markdown'
              ? chunkMarkdown(doc, { maxTokens, overlapTokens })
              : chunkText(doc, { maxTokens, overlapTokens, format });

          for (const chunk of chunks) {
            const slice = normalizeLineEndings(
              doc.slice(chunk.source.charStart, chunk.source.charEnd),
            ).text;
            expect(slice).toBe(chunk.text);
          }
        },
      ),
      { seed: FAST_CHECK_SEED, numRuns: FAST_CHECK_RUNS },
    );
  });

  it('source ranges are non-negative, ordered, and within the input length', () => {
    fc.assert(
      fc.property(
        docArb,
        fc.integer({ min: 1, max: 50 }),
        fc.integer({ min: 0, max: 15 }),
        (doc, maxTokens, overlapTokens) => {
          const chunks = chunkText(doc, { maxTokens, overlapTokens });
          for (const chunk of chunks) {
            expect(chunk.source.charStart).toBeGreaterThanOrEqual(0);
            expect(chunk.source.charEnd).toBeGreaterThanOrEqual(chunk.source.charStart);
            expect(chunk.source.charEnd).toBeLessThanOrEqual(doc.length);
          }
          // content order preserved: charStart is non-decreasing across chunks
          for (let i = 1; i < chunks.length; i += 1) {
            expect(chunks[i]?.source.charStart).toBeGreaterThanOrEqual(0);
          }
        },
      ),
      { seed: FAST_CHECK_SEED, numRuns: FAST_CHECK_RUNS },
    );
  });

  it('with a rendered heading prefix, stripping it still reconstructs the source content exactly', () => {
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom('# Section', '## Sub', 'body text here', 'more prose', '\n\n'), {
          minLength: 3,
          maxLength: 20,
        }),
        fc.integer({ min: 1, max: 30 }),
        (parts, maxTokens) => {
          const doc = parts.join('\n\n');
          const chunks = chunkMarkdown(doc, { maxTokens, includeHeadingTextInContent: true });
          for (const chunk of chunks) {
            const slice = doc.slice(chunk.source.charStart, chunk.source.charEnd);
            // The source-backed portion is a *suffix* of chunk.text (the
            // prefix, if any, comes first and is never source-backed) — and
            // `syntheticPrefixLength` says exactly where it starts, so this
            // is an equality rather than an `endsWith`: it also pins that the
            // reported prefix length is neither short (leaving synthesized
            // text in the "source" half) nor long (eating real content).
            expect(chunk.text.slice(chunk.syntheticPrefixLength)).toBe(slice);
          }
        },
      ),
      { seed: FAST_CHECK_SEED, numRuns: 500 },
    );
  });
});
