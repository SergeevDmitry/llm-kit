# usage-tab

## 1.1.0

### Minor Changes

- 6b8eca2: Add `sumExactUsd` and `createCostAggregator` — exact totals across many requests. The exact decimal channel previously dead-ended at a single request's `totalUsdExact`: a caller wanting a daily or monthly figure — the package's namesake use case — either wrote `sum += breakdown.totalUsd`, reintroducing float drift at exactly the boundary the package pushed them past, or hand-parsed decimal strings. Both new functions sum on the same `bigint` fixed-point path every individual cost is already computed with, and reject anything that is not a non-negative decimal string (`InvalidRateError`) rather than coercing it. `createCostAggregator` also reports `count`, per-model totals keyed by resolved `provider:canonicalModel`, and every distinct `registryVersion` the aggregate drew on, so a total that silently mixes pricing snapshots is visible.

  Also fix `parseDecimalRate` throwing a raw `TypeError`, outside the package's error taxonomy, for a non-string rate that reached it past the type — a hand-built override or a JSON round-trip. `RegExp.test` stringifies its argument, so a numeric `1.5` passed the decimal pattern and then failed on `indexOf`. It now throws `InvalidRateError` like every other malformed rate.

- da64bf2: Read every ISO `at` string as UTC, including the offset-less form. `calculateCost` passed `at` to `Date.parse`, where a datetime without a UTC offset (`"2026-09-01T05:00:00"` — a log timestamp, a `datetime-local` input, several DB drivers) is local time by specification, while an ISO date and an offset-carrying datetime are both UTC. Pricing periods start at UTC midnight, so the local-time reading landed on either side of a price restatement depending on the host: the identical historical lookup priced at $12.00 in one deployment and $18.00 in another, silently breaking the reproducibility a dated, committed price registry exists to provide. Such values are now normalized to UTC — the reading every other accepted ISO form already got — rather than inheriting the process's timezone. The same normalization applies to `effectiveFrom`/`effectiveTo` on a caller-supplied override, which never passed through the registry's schema validation.

  Non-ISO strings (`"2026/09/01"`, `"September 1, 2026"`) are implementation-defined rather than specified, so there is no single reading to normalize them to; they still go to `Date.parse` unchanged, and the documentation now says to pass a `Date` or an ISO form instead.

  Also fix an invalid `Date` in `at` escaping the error taxonomy: building the `InvalidLookupDateError` called `toISOString()`, which throws on an invalid date, so callers saw an uncoded `RangeError` instead. It now throws `InvalidLookupDateError` (`INVALID_LOOKUP_DATE`) like the equivalent string.

### Patch Changes

- 3cbd4c7: Fix a provider-qualified lookup silently resolving duplicate entries by array order instead of reporting ambiguity. When two caller-supplied `overrides` (or two entries of a caller-supplied registry) shared the same `provider` and `canonicalId` — the shape produced by merging an org-wide price list with a team's — the exact-canonical step took whichever came first, so the identical request could price differently depending on concatenation order. Supplying the provider qualifier, which the documentation tells callers to do, therefore made ambiguity detection weaker than the unqualified lookup, which already raised `AMBIGUOUS_ALIAS`. Both channels now raise `AMBIGUOUS_ALIAS` with every duplicate listed as a candidate. Well-formed data, where provider and canonical id are unique, is unaffected.
