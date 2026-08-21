---
'usage-tab': patch
---

Fix a provider-qualified lookup silently resolving duplicate entries by array order instead of reporting ambiguity. When two caller-supplied `overrides` (or two entries of a caller-supplied registry) shared the same `provider` and `canonicalId` — the shape produced by merging an org-wide price list with a team's — the exact-canonical step took whichever came first, so the identical request could price differently depending on concatenation order. Supplying the provider qualifier, which the documentation tells callers to do, therefore made ambiguity detection weaker than the unqualified lookup, which already raised `AMBIGUOUS_ALIAS`. Both channels now raise `AMBIGUOUS_ALIAS` with every duplicate listed as a candidate. Well-formed data, where provider and canonical id are unique, is unaffected.
