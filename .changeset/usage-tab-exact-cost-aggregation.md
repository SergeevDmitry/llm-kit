---
'usage-tab': minor
---

Add `sumExactUsd` and `createCostAggregator` — exact totals across many requests. The exact decimal channel previously dead-ended at a single request's `totalUsdExact`: a caller wanting a daily or monthly figure — the package's namesake use case — either wrote `sum += breakdown.totalUsd`, reintroducing float drift at exactly the boundary the package pushed them past, or hand-parsed decimal strings. Both new functions sum on the same `bigint` fixed-point path every individual cost is already computed with, and reject anything that is not a non-negative decimal string (`InvalidRateError`) rather than coercing it. `createCostAggregator` also reports `count`, per-model totals keyed by resolved `provider:canonicalModel`, and every distinct `registryVersion` the aggregate drew on, so a total that silently mixes pricing snapshots is visible.

Also fix `parseDecimalRate` throwing a raw `TypeError`, outside the package's error taxonomy, for a non-string rate that reached it past the type — a hand-built override or a JSON round-trip. `RegExp.test` stringifies its argument, so a numeric `1.5` passed the decimal pattern and then failed on `indexOf`. It now throws `InvalidRateError` like every other malformed rate.
