---
"mend-json": patch
---

Fix `incompleteScalarPolicy: 'best-effort'` completing a literal the input already contradicted (e.g. `tRue`, `tru5`) instead of omitting it like `'omit'` does — nothing is invented from input that disproved the completion.
