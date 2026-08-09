import { describe, expect, it } from 'vitest';
import { estimateTokenCount } from '../src/approximate-tokenizer.js';

/**
 * Pins the isolated-whitespace-folding behavior of the estimator for
 * line-dense input (many short lines, each ending in a single `\n`) — the
 * one place where charging 0 tokens for an isolated whitespace character can
 * break the "prefer over-estimating" property.
 *
 * The rules, settled by measurement rather than assumption:
 * - An isolated newline never folds, regardless of what's on either side —
 *   it always costs 1 token when isolated.
 * - An isolated space or tab's folding depends on *what follows it* — a
 *   space folds before a letter or punctuation but not before a digit, an
 *   emoji cluster, or (reliably) CJK.
 * - An isolated tab does not generalize the same way a space does: about a
 *   third of probed words did not fold with a preceding tab, with no
 *   character-class rule predicting which. A tab is therefore treated as
 *   never folding, in any position.
 *
 * `estimateTokenCount` was run — outside this repository, in a disposable
 * scratch project, via `gpt-tokenizer` (never a dependency of this package,
 * not even as a devDependency — no provider tokenizer library may be
 * imported here) — against realistic line-dense corpora, to check these
 * rules against a real tokenizer rather than just intuition. This test cannot re-run that
 * comparison in CI (no reference tokenizer is available here), so it pins
 * this package's own output as a regression guard — a future change that
 * quietly reintroduced an under-count would change these numbers and fail
 * this test.
 */
describe('isolated newline vs. isolated space/tab', () => {
  it('charges 1 token for an isolated newline between two words, unlike an isolated space before a letter', () => {
    // Word lengths are multiples of the Latin run divisor (3) so ceiling
    // rounding cannot itself account for a difference — mirrors the existing
    // "does not charge extra for a single space" test in
    // approximate-tokenizer.test.ts, but for `\n` instead of ` `.
    const withNewline = estimateTokenCount('abc\ndef');
    const withSpace = estimateTokenCount('abc def');
    const withoutSeparator = estimateTokenCount('abcdef');

    expect(withSpace).toBe(withoutSeparator);
    expect(withNewline).toBe(withoutSeparator + 1);
  });

  it('charges 1 token for an isolated \\r\\n pair (one grapheme cluster), same as a bare \\n', () => {
    expect(estimateTokenCount('abc\r\ndef')).toBe(estimateTokenCount('abc\ndef'));
  });

  it('charges 1 token for an isolated tab even before a Latin letter — tab folding is not reliable', () => {
    // 'abc\tdef' looked, at first, like the same "isolated separator folds
    // before a letter" case as space. It is not: a real tokenizer folds
    // some tab+word pairs and not others with no predictable rule, so an
    // isolated tab is now always charged, unlike an isolated space.
    const withTab = estimateTokenCount('abc\tdef');
    const withoutSeparator = estimateTokenCount('abcdef');
    expect(withTab).toBe(withoutSeparator + 1);
  });

  it('a whitespace run of length > 1 is unaffected by whether it contains a newline', () => {
    // Two isolated-length-1 cases collapse into the existing ">1" ceiling
    // rule once they're adjacent, so this documents that the newline
    // exception only applies to a run of exactly one character.
    const twoNewlines = estimateTokenCount('abc\n\ndef');
    const twoSpaces = estimateTokenCount('abc  def');
    expect(twoNewlines).toBe(twoSpaces);
  });

  it('charges 1 token for a leading or trailing isolated newline, not just an interior one', () => {
    const leading = estimateTokenCount('\nabc');
    const trailing = estimateTokenCount('abc\n');
    const bare = estimateTokenCount('abc');
    expect(leading).toBe(bare + 1);
    expect(trailing).toBe(bare + 1);
  });
});

/**
 * Pins that folding depends on what follows the separator, and that a tab
 * never reliably folds.
 */
describe('isolated space/tab folding depends on what follows it', () => {
  it('an isolated space folds before a letter or punctuation, but not before a digit', () => {
    // Compared against the sum of each side's own run cost (not a merged
    // word) — merging two runs into one can itself change the ceiling
    // rounding independent of the separator (documented per-run-rounding
    // behavior), so that isn't a valid way to check the separator's own
    // marginal cost.
    const beforeLetter = estimateTokenCount('a alpha'); // 'a' + folds + 'alpha'
    const beforeDigit = estimateTokenCount('a 100'); // 'a' + charged + '100'
    const beforePunct = estimateTokenCount('a |'); // 'a' + folds + '|'

    expect(beforeLetter).toBe(estimateTokenCount('a') + estimateTokenCount('alpha'));
    expect(beforeDigit).toBe(estimateTokenCount('a') + 1 + estimateTokenCount('100'));
    expect(beforePunct).toBe(estimateTokenCount('a') + estimateTokenCount('|'));
  });

  it('an isolated tab costs 1 token before a letter, a digit, and punctuation alike', () => {
    // Real cl100k_base: "a\talpha" folds, but "a\teta"/"a\tpi" do not — no
    // rule based on the following character's script class distinguishes
    // them, so a tab is charged uniformly regardless of what follows.
    const beforeLetter = estimateTokenCount('a\talpha');
    const beforeDigit = estimateTokenCount('a\t100');
    const beforePunct = estimateTokenCount('a\t|');

    expect(beforeLetter).toBe(estimateTokenCount('a') + 1 + estimateTokenCount('alpha'));
    expect(beforeDigit).toBe(estimateTokenCount('a') + 1 + estimateTokenCount('100'));
    expect(beforePunct).toBe(estimateTokenCount('a') + 1 + estimateTokenCount('|'));
  });

  it('a trailing isolated space or tab (end of string, nothing to fold into) always costs 1 token', () => {
    const bare = estimateTokenCount('abc');
    expect(estimateTokenCount('abc ')).toBe(bare + 1);
    expect(estimateTokenCount('abc\t')).toBe(bare + 1);
  });

  describe('realistic varied TSV — pinned against a real cl100k_base measurement', () => {
    // A *varied* word + numeric column TSV, not the same word repeated — a
    // uniform corpus can hide an under-count entirely (over-charging a
    // repeated word happens to offset the under-charged tabs at certain
    // sizes). Matches a realistic shape: an "id\tname\tvalue" header, rows
    // like "7\tgamma\t700".
    const WORDS = [
      'alpha',
      'beta',
      'gamma',
      'delta',
      'epsilon',
      'zeta',
      'eta',
      'theta',
      'iota',
      'kappa',
      'lambda',
      'mu',
      'nu',
      'xi',
      'omicron',
      'pi',
      'rho',
      'sigma',
      'tau',
      'upsilon',
      'phi',
      'chi',
      'psi',
      'omega',
    ];

    function makeRealisticTsv(rows: number): string {
      const lines = ['id\tname\tvalue'];
      for (let i = 0; i < rows; i += 1) {
        const word = WORDS[i % WORDS.length];
        const value = (i + 1) * 100;
        lines.push(`${i + 1}\t${word}\t${value}`);
      }
      return lines.join('\n');
    }

    // Measured against cl100k_base outside this repo: this shape converges
    // to ~1.08-1.09x and stays there through 5000 rows (checked outside this
    // repo; not reproduced at that size here to keep the test fast).
    const cases: ReadonlyArray<{ rows: number; expected: number }> = [
      { rows: 3, expected: 28 }, // real 20, ratio 1.400
      { rows: 5, expected: 43 }, // real 32, ratio 1.344
      { rows: 20, expected: 154 }, // real 135, ratio 1.141
      { rows: 100, expected: 770 }, // real 697, ratio 1.105
      { rows: 1000, expected: 7709 }, // real 7036, ratio 1.096 — the narrowest margin measured
    ];

    for (const { rows, expected } of cases) {
      it(`estimateTokenCount is stable for a ${rows}-row varied TSV`, () => {
        expect(estimateTokenCount(makeRealisticTsv(rows))).toBe(expected);
      });
    }
  });
});

/**
 * Pins the letter/digit run-split behavior for Markdown tables and
 * alphanumeric identifiers. Markdown tables under-count systematically if
 * digits merge into an adjacent letter run, worsening with more columns
 * (e.g. a 500-row x 8-column table measured 0.824x — a 17.6% under-count).
 *
 * Root cause, found by decoding real `cl100k_base` token ids: `"| v00 | w00 |"`
 * is 7 real tokens — `["|", " v", "00", " |", " w", "00", " |"]`. If a digit
 * run directly adjacent to a Latin letter run (no separator, e.g. `v00`) is
 * merged into the *same* run and charged as one 3-chars-per-token span, the
 * estimator counts only 5. A real BPE vocabulary essentially always splits
 * at a letter/digit boundary — confirmed across many short alphanumeric
 * probes (`v00`, `abc123`, `item42`, `gpt4`, …), all tokenizing letters and
 * digits separately — so `estimateTokenCount` treats a digit run as its own
 * run, never merged with a neighboring letter run, even though both still
 * cost 1 token per 3 characters. This is the dominant token cost in short
 * alphanumeric identifiers and table-cell values, which is why it shows up
 * so strongly in Markdown tables.
 */
describe('letter/digit run boundary (Markdown tables, alphanumeric identifiers)', () => {
  it('matches the real cl100k_base split for the exact case that exposed the bug', () => {
    // Real cl100k_base: ["|", " v", "00", " |", " w", "00", " |"] = 7 tokens.
    expect(estimateTokenCount('| v00 | w00 |')).toBe(7);
  });

  it('charges an adjacent letter/digit run pair 1 token less than the same pair with a space between them', () => {
    // 'v00' (no separator): 'v' -> 1 token, '00' -> 1 token = 2. A real
    // tokenizer spends the same 2 (letter + digit, never merged).
    //
    // 'v 00' (space-separated): a real tokenizer does NOT fold the space
    // into the digit run either — ["v", " ", "00"] = 3 tokens (an isolated
    // space folds before a letter or punctuation, but not before a digit).
    // So the space costs its own token here, same as it would for any
    // isolated space before a digit — this is not a special case of the
    // letter/digit run fix, it's the separate isolated-whitespace-folding
    // rule composing correctly with it.
    const adjacent = estimateTokenCount('v00');
    const separated = estimateTokenCount('v 00');
    expect(adjacent).toBe(2);
    expect(separated).toBe(3);
  });

  it('splits a longer alphanumeric identifier at every letter<->digit boundary', () => {
    // 'item42' -> 'item' (4 chars, ceil(4/3)=2) + '42' (2 chars, ceil(2/3)=1) = 3.
    expect(estimateTokenCount('item42')).toBe(3);
    // 'x2024' -> 'x' (1) + '2024' (ceil(4/3)=2) = 3.
    expect(estimateTokenCount('x2024')).toBe(3);
  });

  describe('Markdown pipe tables — pinned against a real cl100k_base measurement', () => {
    const COLUMN_LETTERS = 'vwxyzabcdefghijklmnopqrstu';

    function makeTable(rows: number, cols: number): string {
      const letters = COLUMN_LETTERS.slice(0, cols).split('');
      const header = `| ${letters.map((c) => `col${c}`).join(' | ')} |`;
      const separator = `| ${letters.map(() => '---').join(' | ')} |`;
      const dataRows = Array.from({ length: rows }, (_, r) => {
        const rowLabel = String(r).padStart(2, '0');
        return `| ${letters.map((c) => `${c}${rowLabel}`).join(' | ')} |`;
      });
      return [header, separator, ...dataRows].join('\n');
    }

    // Measured against cl100k_base outside this repo; every ratio (approx /
    // real) here is >= 1.0. A representative subset of the full grid checked
    // (1..800 rows x 1..8 cols, all >= 1.0) is pinned here to keep the test
    // fast while still covering small, large, narrow, and wide tables.
    const cases: ReadonlyArray<{ rows: number; cols: number; expected: number }> = [
      { rows: 5, cols: 2, expected: 57 }, // real 47, ratio 1.213
      { rows: 5, cols: 8, expected: 189 }, // real 166, ratio 1.139
      { rows: 20, cols: 8, expected: 579 }, // real 541, ratio 1.070
      { rows: 100, cols: 4, expected: 1431 }, // real 1322, ratio 1.082
      { rows: 500, cols: 8, expected: 13059 }, // real 12541, ratio 1.041 (the narrowest margin measured)
    ];

    for (const { rows, cols, expected } of cases) {
      it(`estimateTokenCount is stable for a ${rows}-row x ${cols}-column table`, () => {
        expect(estimateTokenCount(makeTable(rows, cols))).toBe(expected);
      });
    }
  });
});

describe('realistic line-dense corpora — pinned counts (measured against a real tokenizer)', () => {
  const corpora: ReadonlyArray<{ id: string; text: string; expected: number }> = [
    {
      id: 'markdown-list (20 short items, one per line)',
      text: [
        '- alpha',
        '- beta',
        '- gamma',
        '- delta',
        '- epsilon',
        '- zeta',
        '- eta',
        '- theta',
        '- iota',
        '- kappa',
        '- lambda',
        '- mu',
        '- nu',
        '- xi',
        '- omicron',
        '- pi',
        '- rho',
        '- sigma',
        '- tau',
        '- upsilon',
      ].join('\n'),
      // Measured 1.172x against a real (cl100k) tokenizer.
      expected: 75,
    },
    {
      id: 'markdown-table (12 dense rows)',
      text: [
        '| id | name | status |',
        '| --- | --- | --- |',
        '| 1 | alpha | ok |',
        '| 2 | beta | ok |',
        '| 3 | gamma | fail |',
        '| 4 | delta | ok |',
        '| 5 | epsilon | pending |',
        '| 6 | zeta | ok |',
        '| 7 | eta | fail |',
        '| 8 | theta | ok |',
        '| 9 | iota | pending |',
        '| 10 | kappa | ok |',
      ].join('\n'),
      // Measured 1.330x against a real tokenizer — this table has a bare
      // space before each row's single-digit id, which is charged since an
      // isolated space does not fold before a digit.
      expected: 129,
    },
    {
      id: 'csv-rows (8 rows)',
      text: [
        'id,name,email,amount',
        '1,Alice Smith,alice@example.com,120.50',
        '2,Bob Jones,bob@example.com,45.00',
        '3,Carol White,carol@example.com,899.99',
        '4,Dave Brown,dave@example.com,12.25',
        '5,Eve Black,eve@example.com,0.99',
        '6,Frank Green,frank@example.com,300.00',
        '7,Grace Lee,grace@example.com,15.75',
        '8,Heidi Young,heidi@example.com,60.10',
      ].join('\n'),
      // Measured 1.447x against a real tokenizer.
      expected: 165,
    },
    {
      id: 'chat-transcript (10 short one-line messages)',
      text: [
        'alice: hi',
        'bob: hey',
        'alice: are you around?',
        'bob: yep',
        'alice: ok cool',
        'bob: whats up',
        'alice: nothing much',
        'bob: same',
        'alice: talk later',
        'bob: sure bye',
      ].join('\n'),
      // Measured 1.348x against a real tokenizer.
      expected: 62,
    },
    {
      id: 'log-lines (10 short bracketed lines)',
      text: [
        '[INFO] server started',
        '[INFO] listening on :8080',
        '[WARN] slow query 120ms',
        '[INFO] request GET /health',
        '[INFO] request GET /status',
        '[ERROR] connection reset',
        '[INFO] retry succeeded',
        '[INFO] request POST /api/v1',
        '[WARN] cache miss',
        '[INFO] shutdown signal received',
      ].join('\n'),
      // Measured 1.554x against a real tokenizer — "query 120ms" has a bare
      // space before the digit run, which is charged the same way.
      expected: 115,
    },
    {
      id: 'TypeScript source (27 short lines)',
      text: [
        'import { readFile } from "node:fs/promises";',
        'import { parseArgs } from "node:util";',
        '',
        'export interface Options {',
        '  readonly input: string;',
        '  readonly output: string;',
        '  readonly verbose: boolean;',
        '}',
        '',
        'function parseOptions(argv: readonly string[]): Options {',
        '  const input = argv[0] ?? "";',
        '  const output = argv[1] ?? "out.json";',
        '  const verbose = argv.includes("--verbose");',
        '  return { input, output, verbose };',
        '}',
        '',
        'export async function run(argv: readonly string[]): Promise<void> {',
        '  const opts = parseOptions(argv);',
        '  const data = await readFile(opts.input, "utf8");',
        '  const lines = data.split("\\n");',
        '  for (const line of lines) {',
        '    if (line.trim().length === 0) continue;',
        '    console.log(line);',
        '  }',
        '}',
        '',
        'run(process.argv.slice(2)).catch((err) => {',
        '  console.error(err);',
        '  process.exitCode = 1;',
        '});',
      ].join('\n'),
      // Measured 1.875x against a real tokenizer — "=== 0" and "= 1" each
      // have a bare space before a digit, charged the same way.
      expected: 375,
    },
  ];

  for (const corpus of corpora) {
    it(`estimateTokenCount is stable for: ${corpus.id}`, () => {
      expect(estimateTokenCount(corpus.text)).toBe(corpus.expected);
    });
  }

  it('every pinned corpus above is deterministic across repeated calls', () => {
    for (const corpus of corpora) {
      expect(estimateTokenCount(corpus.text)).toBe(estimateTokenCount(corpus.text));
    }
  });
});
