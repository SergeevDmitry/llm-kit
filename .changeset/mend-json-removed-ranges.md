---
'mend-json': minor
---

Add `JsonMendResult.removedRanges`: the half-open `[start, end)` ranges cut out from inside the valid prefix, sorted and non-overlapping. This completes the identity `appendedSuffix` documents - `input.slice(0, validPrefixLength)`, minus `removedRanges`, plus `appendedSuffix`, is exactly `repairedJson` - which previously had a silent exception under `duplicateKeyPolicy: 'first'`, where a caller slicing the raw buffer itself would render a member the package reports as dropped. Empty under every other policy and repair.

Also fixes an aliasing bug this exposed: merging exclusion ranges widened a tuple the scanner still owned, mutating scanner state from a call documented as read-only.
