/**
 * Shared property-test budget, so the nightly fuzz job can actually explore
 * more than the pull-request run does.
 *
 * `.github/workflows/fuzz.yml` sets `FUZZ_RUNS`, and every `fc.assert` needs
 * to actually read it — a hard-coded `numRuns` and seed would mean the
 * scheduled job re-explores the same inputs every night forever, which makes
 * it a green checkmark and nothing else.
 *
 * Usage — the defaults are what a pull request runs:
 *
 * ```ts
 * fc.assert(fc.property(...), fuzzConfig(0x6d656e64, 300));
 * ```
 */

/** Parses a positive-integer environment variable, falling back on anything unusable. */
function readPositiveInt(raw: string | undefined, fallback: number): number {
  if (raw === undefined) return fallback;
  const parsed = Number(raw);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

/**
 * `fc.assert` options carrying the effective seed and run count.
 *
 * `FUZZ_RUNS` scales the run count; `FUZZ_SEED` replaces the fixed seed so a
 * scheduled run explores a different region each night. Both are ignored when
 * unset or unusable, which is what keeps a local `pnpm test` deterministic.
 *
 * The seed is always reported through fast-check's own failure output, so a
 * CI failure reproduces exactly: with `FUZZ_SEED` set, the failing seed is in
 * the job log and can be replayed locally by setting the same value.
 */
export function fuzzConfig(
  defaultSeed: number,
  defaultRuns: number,
): { readonly seed: number; readonly numRuns: number } {
  return {
    seed: readPositiveInt(process.env.FUZZ_SEED, defaultSeed),
    numRuns: readPositiveInt(process.env.FUZZ_RUNS, defaultRuns),
  };
}
