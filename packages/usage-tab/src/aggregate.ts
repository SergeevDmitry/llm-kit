/**
 * Exact aggregation across many `CostBreakdown`s.
 *
 * `totalUsdExact` is the authoritative per-request value, but a daily or
 * monthly total is the actual question most callers have. Summing
 * `breakdown.totalUsd` reintroduces binary floating point at exactly the
 * boundary this package pushed the caller past, so the sum is computed here
 * on the same `bigint` fixed-point path every individual cost already uses:
 * each `totalUsdExact` is parsed back into an exact decimal, never through
 * `Number()`/`parseFloat`.
 */
import {
  addExact,
  formatExact,
  parseDecimalRate,
  toDisplayNumber,
  ZERO,
  type ExactAmount,
} from './fixed-point.js';
import type { CostAggregator, CostBreakdown, CostTotal } from './types.js';

/**
 * Exact sum of decimal USD strings — `totalUsdExact`/`costUsdExact` values,
 * or any string in the same non-negative decimal format. Returns a decimal
 * string in that same format (`"0.00"` for an empty list).
 *
 * Throws `InvalidRateError` (`INVALID_RATE`) for anything that is not a
 * non-negative decimal string, rather than coercing it: a stringified
 * `NaN`, a float-formatted `"1e-7"`, or a `number` that slipped past a
 * `readonly string[]` at the type level are all silent under-reporting
 * waiting to happen.
 */
export function sumExactUsd(values: readonly string[]): string {
  const amounts: ExactAmount[] = [];
  for (const [index, value] of values.entries()) {
    amounts.push(parseDecimalRate(value, `values[${String(index)}]`));
  }
  return formatExact(addExact(amounts));
}

/** Key used by `byModel()`: matches the `provider:canonicalModel` form used in error messages. */
function modelKey(breakdown: CostBreakdown): string {
  return `${breakdown.provider}:${breakdown.canonicalModel}`;
}

interface Bucket {
  count: number;
  sum: ExactAmount;
  readonly registryVersions: Set<string>;
}

function newBucket(): Bucket {
  return { count: 0, sum: ZERO, registryVersions: new Set() };
}

function accumulate(bucket: Bucket, amount: ExactAmount, registryVersion: string): void {
  bucket.count += 1;
  bucket.sum = addExact([bucket.sum, amount]);
  bucket.registryVersions.add(registryVersion);
}

function toTotal(bucket: Bucket): CostTotal {
  return {
    count: bucket.count,
    totalUsd: toDisplayNumber(bucket.sum),
    totalUsdExact: formatExact(bucket.sum),
    registryVersions: [...bucket.registryVersions].sort(),
  };
}

/**
 * Accumulates `CostBreakdown`s into exact running totals — overall and per
 * `provider:canonicalModel`. Sums are kept as exact fixed-point amounts, so
 * memory does not grow with the number of breakdowns added; only the number
 * of distinct models does.
 *
 * `total().registryVersions` carries the aggregate's provenance: more than
 * one entry means the total mixes pricing snapshots, which is legitimate for
 * a historical report spanning a registry update and a bug for a total that
 * was supposed to be priced against one snapshot. This package cannot tell
 * the two apart, so it reports rather than warns.
 */
export function createCostAggregator(): CostAggregator {
  const overall = newBucket();
  const byModelBuckets = new Map<string, Bucket>();

  return {
    add(breakdown: CostBreakdown): void {
      // Parsed, not trusted: `CostBreakdown` is a plain interface a caller
      // can construct or round-trip through JSON, so a malformed
      // `totalUsdExact` must fail loudly here rather than land in a total.
      const amount = parseDecimalRate(breakdown.totalUsdExact, 'totalUsdExact');
      const key = modelKey(breakdown);
      let bucket = byModelBuckets.get(key);
      if (bucket === undefined) {
        bucket = newBucket();
        byModelBuckets.set(key, bucket);
      }
      accumulate(bucket, amount, breakdown.registryVersion);
      accumulate(overall, amount, breakdown.registryVersion);
    },

    total(): CostTotal {
      return toTotal(overall);
    },

    byModel(): ReadonlyMap<string, CostTotal> {
      const result = new Map<string, CostTotal>();
      for (const [key, bucket] of byModelBuckets) result.set(key, toTotal(bucket));
      return result;
    },
  };
}
