---
'usage-tab': minor
---

Read every ISO `at` string as UTC, including the offset-less form. `calculateCost` passed `at` to `Date.parse`, where a datetime without a UTC offset (`"2026-09-01T05:00:00"` — a log timestamp, a `datetime-local` input, several DB drivers) is local time by specification, while an ISO date and an offset-carrying datetime are both UTC. Pricing periods start at UTC midnight, so the local-time reading landed on either side of a price restatement depending on the host: the identical historical lookup priced at $12.00 in one deployment and $18.00 in another, silently breaking the reproducibility a dated, committed price registry exists to provide. Such values are now normalized to UTC — the reading every other accepted ISO form already got — rather than inheriting the process's timezone. The same normalization applies to `effectiveFrom`/`effectiveTo` on a caller-supplied override, which never passed through the registry's schema validation.

Non-ISO strings (`"2026/09/01"`, `"September 1, 2026"`) are implementation-defined rather than specified, so there is no single reading to normalize them to; they still go to `Date.parse` unchanged, and the documentation now says to pass a `Date` or an ISO form instead.

Also fix an invalid `Date` in `at` escaping the error taxonomy: building the `InvalidLookupDateError` called `toISOString()`, which throws on an invalid date, so callers saw an uncoded `RangeError` instead. It now throws `InvalidLookupDateError` (`INVALID_LOOKUP_DATE`) like the equivalent string.
