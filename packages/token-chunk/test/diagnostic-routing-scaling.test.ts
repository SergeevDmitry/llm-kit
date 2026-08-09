/**
 * `routeDiagnostics` must not map over every output chunk and, per chunk,
 * filter the *entire* diagnostics collection — that is O(chunks x
 * diagnostics), and both dimensions grow with input. An
 * indivisible-unit run under `maxTokens: 1` hits both dimensions at once:
 * the approximate tokenizer treats each emoji grapheme cluster as its own
 * over-budget unit, so `splitOversizedUnit` emits one `BUDGET_EXCEEDED`
 * diagnostic per leaf, and one leaf per chunk. Measured through the public
 * API at `maxTokens: 1`, `format: 'text'`, wall time grew roughly 3-4x per
 * doubling of input — the signature of quadratic growth, muddied at small n
 * by the genuinely linear cost of tokenizing tens of thousands of emoji
 * (which dominates until the diagnostics-routing term catches up).
 *
 * After the fix (`routeDiagnostics` sorts diagnostics once and sweeps them
 * in lockstep with chunks — see its doc comment in `src/chunk-text.ts`),
 * total time across this same 8x range of input sizes should track closer
 * to linear (~8x) than quadratic (~64x).
 *
 * Threshold rationale: comparing only the smallest (8,000) and largest
 * (64,000) measurement avoids the noisiest region (very small n, dominated
 * by fixed per-call overhead: regex/JIT warmup, GC, module-level setup)
 * and instead looks at the ratio across the full 8x range actually
 * exercised. A perfectly linear implementation gives ~8x; a quadratic one
 * (like the pre-fix code) gives ~64x. `20x` sits comfortably above every
 * realistic linear-with-overhead outcome (measured locally at ~8.5x) while
 * remaining far below what quadratic growth would produce, so a regression
 * back to O(chunks x diagnostics) fails this loudly rather than marginally.
 */
import { describe, expect, it } from 'vitest';
import { chunkText } from '../src/index.js';

/**
 * Wall-clock ratios are gated for the same reason as the ones in
 * 'test/redos.property.test.ts': a shared CI runner running eight packages'
 * suites at once distorts them beyond what a ratio can absorb. Observed on a
 * two-core runner: 133x across this range for the fixed, linear
 * implementation, against a 20x threshold. Raising the threshold past what
 * quadratic growth produces (~64x) would retire the test rather than fix it.
 */
const RUN_SCALING_ASSERTIONS = process.env.RUN_SCALING_ASSERTIONS === '1';

const SIZES = [8_000, 16_000, 32_000, 64_000] as const;
/** See threshold rationale above: linear predicts ~8x across this range, quadratic ~64x. */
const MAX_ACCEPTABLE_GROWTH_RATIO = 20;

/**
 * Must be an emoji, not the cheaper CJK ideograph used by
 * test/leaf-spread-argument-limit.ts. This test needs BOTH dimensions of
 * the old O(chunks x diagnostics) product to grow, and a diagnostic is only
 * emitted for a leaf that EXCEEDS the budget. An emoji counts as more than
 * one token, so every leaf is over budget at maxTokens: 1 and carries a
 * BUDGET_EXCEEDED diagnostic; a CJK ideograph counts as exactly one, fits,
 * and produces 0 diagnostics across the whole document. Swapping it for
 * speed silently removes the diagnostics dimension and leaves this test
 * measuring nothing it was written to measure.
 */
const UNIT = '😀';

function measure(n: number): { chunks: number; elapsedMs: number } {
  const text = UNIT.repeat(n);
  const start = performance.now();
  const chunks = chunkText(text, { maxTokens: 1, format: 'text' });
  const elapsedMs = performance.now() - start;
  return { chunks: chunks.length, elapsedMs };
}

describe('routeDiagnostics on the shape that made it quadratic', () => {
  // Always on: the reproduction shape itself, without a clock. If
  // routeDiagnostics ever stops attaching one diagnostic per chunk, or the
  // shape stops producing one chunk per unit, this fails regardless of how
  // loaded the machine is. Routing correctness is pinned separately by
  // test/route-diagnostics-differential.property.test.ts.
  it('produces one chunk and one diagnostic per indivisible unit', () => {
    // Small on purpose. This asserts the *shape* (one chunk and one
    // diagnostic per unit), which is size-independent — the largest size is
    // only needed by the gated ratio test below, and materializing 64,000
    // chunk objects here cost over a minute on a contended CI runner.
    const n = 2_000;
    const chunks = chunkText(UNIT.repeat(n), { maxTokens: 1, format: 'text' });
    expect(chunks.length).toBe(n);
    expect(chunks.every((c) => (c.diagnostics?.length ?? 0) > 0)).toBe(true);
  }, 60_000);

  it.skipIf(!RUN_SCALING_ASSERTIONS)(
    'wall time across an 8x range of indivisible-unit input grows near-linearly',
    () => {
      const results = SIZES.map((n) => ({ n, ...measure(n) }));

      for (const r of results) {
        expect(r.chunks).toBe(r.n);
      }

      const first = results[0]!;
      const last = results[results.length - 1]!;
      const sizeRatio = last.n / first.n;
      const timeRatio = last.elapsedMs / Math.max(first.elapsedMs, 1);

      console.log(
        `diagnostic routing scaling: ${results.map((r) => `n=${String(r.n)} -> ${r.elapsedMs.toFixed(0)}ms`).join(', ')} ` +
          `(size grew ${sizeRatio.toFixed(1)}x, time grew ${timeRatio.toFixed(1)}x)`,
      );

      expect(timeRatio).toBeLessThan(MAX_ACCEPTABLE_GROWTH_RATIO);
    },
    120_000,
  );
});
