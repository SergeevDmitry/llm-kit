/**
 * Guards against quadratic backtracking in three boundary regexes, each
 * with an adjacent-quantifier ambiguity —
 *
 *  - `boundaries/sentences.ts`'s `SENTENCE_BOUNDARY`, on a long run of
 *    `.`/`!`/`?` with no trailing whitespace to satisfy its lookahead;
 *  - `boundaries/headings.ts`'s ATX heading matcher, on a long run of
 *    non-hash characters followed by a long run of `#` with nothing after
 *    to anchor a lazy body group;
 *  - `boundaries/tables.ts`'s table-separator check, on a long whitespace
 *    run with no closing `|` to anchor against.
 *
 * The property this file exists to prove is "boundary detection is not
 * quadratic in input length" — not "chunkText finishes within N
 * milliseconds." An absolute wall-clock bound doesn't work here: it passes
 * in isolation but flakes when this suite runs in parallel with every other
 * package's under `pnpm run test:coverage`, since CPU contention plus V8
 * coverage instrumentation push isolated-machine timings well past any
 * fixed millisecond budget that isn't so loose it stops meaning anything.
 * Neither contention nor instrumentation has anything to do with the
 * property being tested; they inflate every measurement roughly equally,
 * which a *ratio* of two measurements taken back-to-back in the same
 * process cancels out and an absolute duration cannot.
 *
 * So instead: measure `chunkText`/`chunkMarkdown` at N, 2N and 4N characters
 * of each pathological shape and assert the wall-time growth per doubling
 * stays under a threshold that quadratic backtracking blows through. Those
 * assertions are opt-in — see `RUN_SCALING_ASSERTIONS` below for why a ratio
 * is robust against a *uniformly* slower machine but not against the margin
 * these particular shapes leave. A
 * linear implementation grows ~2.0x per doubling at these sizes; a
 * quadratic one measures ~2.7x-3.7x, so `MAX_GROWTH_RATIO_PER_DOUBLING = 3`
 * separates them with real margin on both steps for most shapes, and with
 * margin on at least one of the two steps for the tightest one (its first
 * doubling lands at ~2.95, just under 3, but its second still fails at
 * ~3.28 — why both doubling steps are checked, not just one).
 *
 * `BASE_N = 5000` is deliberate, not randomized: at small N (hundreds to
 * low thousands of characters) the measurement is dominated by fixed
 * per-call noise (JIT warmup, GC, scheduler jitter) — one shape's growth
 * ratio for the linear implementation was measured as low as 1.75x-2.42x at
 * N=1000-2000 purely from that noise, which would make the threshold
 * unreliable in both directions. At N=5000 (up to 20,000 at 4N) the
 * baseline measurement is tens to low hundreds of milliseconds, comfortably
 * above scheduler noise, and growth ratios settle down to consistently
 * reproduce the numbers above. Each measurement is the best of
 * `TIMING_SAMPLES` timed calls (matching the `mend-json` package's
 * convention for damping scheduler jitter) rather than a single sample.
 *
 * The shapes below are a deliberately trimmed set: one Latin punctuation-run
 * shape and one CJK punctuation-run shape are kept (not all six characters
 * from each family) because every character within a family exercises the
 * exact same `SENTENCE_BOUNDARY` alternation branch and measures the same —
 * the redundant variants added wall-clock cost to this file without adding
 * coverage of a different code path. Each remaining shape is enumerated as
 * its own test (not sampled by a property-based generator) so that every
 * pathological shape is exercised by name, with an unambiguous label on
 * failure, rather than relying on random sampling to hit all of them. The
 * always-on suite at the bottom runs every one of them on every CI run.
 *
 * A very loose absolute ceiling is kept as a secondary backstop
 * (`ABSOLUTE_HANG_CEILING_MS`): a ratio assertion cannot catch a regression
 * that inflates *every* measurement by the same large constant factor (e.g.
 * a pathological hang unrelated to input size), since both N and 2N would
 * grow together and the ratio would look fine. The ceiling exists only to
 * catch that failure mode and is sized so loose (30s for a document as
 * large as 20,000 characters) that it has no realistic flake risk of its
 * own.
 */
import { describe, expect, it } from 'vitest';
import { chunkMarkdown, chunkText } from '../src/index.js';

/**
 * The growth-ratio assertions need a machine that is not fighting seven other
 * packages' test suites for two cores. They are opt-in for that reason:
 *
 *   RUN_SCALING_ASSERTIONS=1 pnpm --filter token-chunk run test
 *
 * The calibration below separates linear from quadratic by about 3x versus
 * 2x per doubling, but the quadratic patterns only reach ~2.95x-3.28x at
 * these input sizes rather than a clean 4x — they are not yet in their
 * asymptotic regime. That leaves under half a turn of margin, which a shared
 * CI runner erases: the fixed, linear implementation measures 3.01x-3.32x
 * there, overlapping the quadratic range outright. Raising the threshold to
 * accommodate that would let every pattern this test exists to catch through,
 * so the assertion is gated instead of weakened.
 *
 * The always-on suite at the bottom of this file still runs every shape on
 * every CI run. It catches a catastrophic blowup, not the specific
 * quadratic patterns — those are caught by running this file with the flag
 * set, which is worth doing before a release and after touching anything in
 * `src/boundaries/`.
 */
const RUN_SCALING_ASSERTIONS = process.env.RUN_SCALING_ASSERTIONS === '1';

/** Baseline size for the N/2N/4N scaling comparison. See module doc comment for why this exact value. */
const BASE_N = 5000;

/** How many timed calls to take the minimum of, to damp scheduler jitter (same convention `mend-json` used for its own timing test). */
const TIMING_SAMPLES = 3;

/**
 * Growth ratio a doubling of input size may produce before this test treats
 * it as a quadratic regression. The fixed (linear) implementation measures
 * ~2.0x per doubling at these sizes; the three original quadratic patterns
 * measure ~2.7x-3.7x. 3 sits with real margin above the linear number and
 * real (if narrower, for one shape's first doubling step) margin below the
 * quadratic ones — see the module doc comment for the measurements this was
 * calibrated against.
 */
const MAX_GROWTH_RATIO_PER_DOUBLING = 3;

/**
 * Secondary backstop only — see module doc comment. Not sized to be tight;
 * sized to catch a hang, not to characterize performance.
 */
const ABSOLUTE_HANG_CEILING_MS = 30_000;

/** Long run of a Latin sentence-ending character with no trailing whitespace — the `sentences.ts` reproduction shape. */
function punctuationRun(n: number, char: string): string {
  return char.repeat(n) + 'x';
}

/** Long non-hash run followed by a long hash run with no whitespace after — the `headings.ts` reproduction shape. */
function headingRun(n: number): string {
  return `# ${'a'.repeat(n)}${'#'.repeat(n)}b\n`;
}

/** Long whitespace run with no closing `|` — the table-separator reproduction shape. */
function whitespaceTableRun(n: number): string {
  return `${' '.repeat(n)}--\nsome body\n`;
}

/**
 * Long non-hash run built from U+2028/U+2029 instead of `a`: these are
 * reachable inside an ATX heading line (`boundaries/headings.ts`'s
 * `matchAtxHeading` doc comment has the mechanism: `\s`, unlike a
 * `.`-based regex, matches them). They're ordinary characters to
 * `matchAtxHeading`'s bounded scan, not a distinct code path, so no
 * different performance behavior is expected — kept here as a regression
 * check for that.
 */
function headingRunWithLineSeparators(n: number): string {
  const body = ' '.repeat(Math.floor(n / 2)) + ' '.repeat(Math.ceil(n / 2));
  return `# ${body}${'#'.repeat(n)}b\n`;
}

interface PathologicalShape {
  readonly label: string;
  readonly generate: (n: number) => string;
}

const SHAPES: readonly PathologicalShape[] = [
  { label: 'punctuation run (Latin, !)', generate: (n) => punctuationRun(n, '!') },
  { label: 'punctuation run (CJK, 。)', generate: (n) => punctuationRun(n, '。') },
  { label: 'heading run', generate: headingRun },
  { label: 'heading run w/ line separators', generate: headingRunWithLineSeparators },
  { label: 'whitespace table run', generate: whitespaceTableRun },
  {
    label: 'mixed',
    // Several pathological shapes back to back in one document, so a
    // regression in any one of the three boundary checks still shows up.
    generate: (n) => `${punctuationRun(n, '!')}\n${headingRun(n)}\n${whitespaceTableRun(n)}`,
  },
];

/** Minimum of `TIMING_SAMPLES` timed calls to `fn`, damping scheduler jitter. */
function bestOfTiming(fn: () => void): number {
  let best = Number.POSITIVE_INFINITY;
  for (let i = 0; i < TIMING_SAMPLES; i += 1) {
    const start = performance.now();
    fn();
    const elapsedMs = performance.now() - start;
    if (elapsedMs < best) best = elapsedMs;
  }
  return best;
}

/**
 * Measures `run` over a shape at N, 2N and 4N characters and asserts the
 * per-doubling growth ratio stays under `MAX_GROWTH_RATIO_PER_DOUBLING` at
 * both doubling steps, plus the loose absolute backstop at 4N. See module
 * doc comment for the full rationale and calibration.
 */
function assertLinearNotQuadratic(run: (input: string) => void, shape: PathologicalShape): void {
  const docN = shape.generate(BASE_N);
  const doc2N = shape.generate(2 * BASE_N);
  const doc4N = shape.generate(4 * BASE_N);

  const elapsedN = bestOfTiming(() => run(docN));
  const elapsed2N = bestOfTiming(() => run(doc2N));
  const elapsed4N = bestOfTiming(() => run(doc4N));

  // Floor avoids a division by (near-)zero turning sub-millisecond noise
  // into a spurious huge ratio.
  const floorMs = 1;
  const growthNTo2N = elapsed2N / Math.max(elapsedN, floorMs);
  const growth2NTo4N = elapsed4N / Math.max(elapsed2N, floorMs);

  expect(
    growthNTo2N,
    `${shape.label}: N->2N growth ${growthNTo2N.toFixed(2)}x (${elapsedN.toFixed(1)}ms -> ${elapsed2N.toFixed(1)}ms)`,
  ).toBeLessThan(MAX_GROWTH_RATIO_PER_DOUBLING);
  expect(
    growth2NTo4N,
    `${shape.label}: 2N->4N growth ${growth2NTo4N.toFixed(2)}x (${elapsed2N.toFixed(1)}ms -> ${elapsed4N.toFixed(1)}ms)`,
  ).toBeLessThan(MAX_GROWTH_RATIO_PER_DOUBLING);
  expect(elapsed4N, `${shape.label}: 4N call took ${elapsed4N.toFixed(1)}ms`).toBeLessThan(
    ABSOLUTE_HANG_CEILING_MS,
  );
}

describe('boundary regex ReDoS fix', () => {
  describe.each(SHAPES)('chunkText: $label', (shape) => {
    it.skipIf(!RUN_SCALING_ASSERTIONS)(
      'scales near-linearly, not quadratically',
      () => {
        assertLinearNotQuadratic(
          (input) => chunkText(input, { maxTokens: 20, format: 'auto' }),
          shape,
        );
      },
      120_000,
    );
  });

  describe.each(SHAPES)('chunkMarkdown: $label', (shape) => {
    it.skipIf(!RUN_SCALING_ASSERTIONS)(
      'scales near-linearly, not quadratically',
      () => {
        assertLinearNotQuadratic((input) => chunkMarkdown(input, { maxTokens: 20 }), shape);
      },
      120_000,
    );
  });
});

/**
 * Runs on every CI run, unlike the ratio assertions above.
 *
 * Each pathological shape is chunked once and must finish well inside
 * the hang ceiling. This is deliberately a weaker claim than "not quadratic":
 * the original quadratic patterns completed 20,000 characters in a few
 * seconds, so this would not have caught them. What it does catch is a
 * regression that stops being polynomial at all — the catastrophic
 * backtracking case, where a shape of this size runs for minutes — and it
 * does so without depending on how loaded the machine is.
 */
describe('boundary scanners complete on pathological input', () => {
  // BASE_N, not 4N. Catastrophic backtracking is superlinear, so it blows
  // through the ceiling at 5,000 characters just as surely as at 20,000,
  // while a merely-quadratic pattern finishes inside the ceiling at either
  // size (which is why the ratio tests exist). The larger input bought no
  // extra detection and cost four times as much — and each call is
  // synchronous, so a worker running one cannot answer the reporter, which
  // is what produced "Timeout calling onTaskUpdate" under coverage.
  const docs = new Map(SHAPES.map((shape) => [shape.label, shape.generate(BASE_N)]));

  describe.each(SHAPES)('$label', (shape) => {
    const input = docs.get(shape.label) ?? '';

    it(
      'chunkText completes',
      () => {
        const started = performance.now();
        expect(chunkText(input, { maxTokens: 20, format: 'auto' }).length).toBeGreaterThan(0);
        expect(performance.now() - started).toBeLessThan(ABSOLUTE_HANG_CEILING_MS);
      },
      ABSOLUTE_HANG_CEILING_MS + 30_000,
    );

    it(
      'chunkMarkdown completes',
      () => {
        const started = performance.now();
        expect(chunkMarkdown(input, { maxTokens: 20 }).length).toBeGreaterThan(0);
        expect(performance.now() - started).toBeLessThan(ABSOLUTE_HANG_CEILING_MS);
      },
      ABSOLUTE_HANG_CEILING_MS + 30_000,
    );
  });
});
