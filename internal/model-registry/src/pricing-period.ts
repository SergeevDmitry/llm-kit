/**
 * Effective-date pricing-period selection.
 */
import {
  AmbiguousPricingPeriodError,
  InvalidLookupDateError,
  type AmbiguousPricingPeriodIdentity,
} from './errors.js';
import type { PricingPeriod } from './types.js';

/**
 * An ISO datetime with no UTC offset — `2026-09-01T05:00:00`, the shape a log
 * timestamp, a `datetime-local` input, and several DB drivers produce.
 *
 * `Date.parse` reads this in the *machine's* timezone, by specification,
 * while an ISO date (`2026-09-01`) and an offset-carrying datetime are both
 * UTC. Period boundaries are UTC midnights, so the local-time reading lands
 * on either side of a price restatement depending on the host: the identical
 * historical lookup priced one way in CI and another in production. These
 * values are therefore read as UTC — the interpretation every *other*
 * accepted string form already gets — rather than inheriting whatever
 * timezone the process happens to run in.
 *
 * Not covered, because they are implementation-defined rather than
 * specified: non-ISO forms (`2026/09/01`, `September 1, 2026`), which V8
 * reads as local midnight. Pass a `Date` or an ISO form; see the caller's
 * documentation.
 */
const OFFSETLESS_ISO_DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/;

function toTimestamp(value: Date | string): number {
  if (value instanceof Date) {
    const ms = value.getTime();
    if (Number.isNaN(ms)) throw new InvalidLookupDateError(String(value));
    return ms;
  }
  const ms = Date.parse(OFFSETLESS_ISO_DATETIME.test(value) ? `${value}Z` : value);
  if (Number.isNaN(ms)) {
    throw new InvalidLookupDateError(value);
  }
  return ms;
}

/**
 * Selects the pricing period active at `at`.
 *
 * A period is active for `effectiveFrom <= at < effectiveTo`; `effectiveTo`
 * is exclusive, so a restated price takes over cleanly with no shared
 * instant between two periods. A period with no `effectiveTo` is open-ended
 * and stays active until superseded by a later `effectiveFrom`.
 *
 * Among qualifying periods, the one with the latest `effectiveFrom` wins, on
 * the theory that it is the most recent restatement for that moment. If more
 * than one qualifying period shares that same (latest) `effectiveFrom` —
 * an exact tie — this throws {@link AmbiguousPricingPeriodError} rather than
 * picking one by array order. Well-formed data never produces this:
 * `validateModelDescriptor` rejects overlapping periods, and two periods
 * with the same `effectiveFrom` necessarily overlap, so the only way to
 * reach this path is a caller-supplied `ModelDescriptor` (e.g. `usage-tab`'s
 * `options.overrides`) that was never run through that validator. Ambiguity
 * is surfaced explicitly, never guessed — the same stance this registry
 * already takes for an ambiguous alias (`AmbiguousAliasError`).
 *
 * Returns `undefined` when `at` precedes every known period — a historical
 * price lookup before the first known period. This is a normal result, not
 * an error: callers decide whether an unpriced historical lookup should
 * warn, fall back, or fail.
 *
 * `at` is a required parameter rather than defaulting to "now" — this keeps
 * the function pure and its result reproducible from its arguments alone;
 * callers that want "now" pass `new Date()` explicitly.
 *
 * `identity` is optional and purely cosmetic: this function only ever sees a
 * bare `periods` array, never a full `ModelDescriptor`, so it cannot name
 * the model itself in a thrown {@link AmbiguousPricingPeriodError}. A caller
 * that has the descriptor (`usage-tab`'s `selectPeriodOrThrow`, for
 * instance) can pass `{ canonicalId, provider }` so the error is actionable
 * across many overrides, not just "some period tied." Omitting it reproduces
 * the exact pre-existing message and error shape — nothing about the
 * non-error return path changes.
 */
export function selectPricingPeriod(
  periods: readonly PricingPeriod[],
  at: Date | string,
  identity?: AmbiguousPricingPeriodIdentity,
): PricingPeriod | undefined {
  const atMs = toTimestamp(at);

  let best: PricingPeriod | undefined;
  let bestFromMs = Number.NEGATIVE_INFINITY;
  let tieCount = 0;

  for (const period of periods) {
    const fromMs = toTimestamp(period.effectiveFrom);
    if (fromMs > atMs) continue;
    if (period.effectiveTo !== undefined && atMs >= toTimestamp(period.effectiveTo)) continue;
    if (fromMs > bestFromMs) {
      best = period;
      bestFromMs = fromMs;
      tieCount = 1;
    } else if (fromMs === bestFromMs) {
      tieCount += 1;
    }
  }

  if (best !== undefined && tieCount > 1) {
    throw new AmbiguousPricingPeriodError(
      at instanceof Date ? at.toISOString() : at,
      best.effectiveFrom,
      tieCount,
      identity,
    );
  }

  return best;
}
