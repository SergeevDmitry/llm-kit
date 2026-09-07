---
'mend-json': patch
---

`incompleteScalarPolicy: 'best-effort'` no longer turns a contradicted number into a valid one. Inputs like `{"a":01}`, `{"a":1.x}` and `{"a":1e+x}` are syntax errors rather than truncations, so they are now omitted under `'best-effort'` exactly as under `'omit'` - matching the behaviour already in place for contradicted literals such as `tru5`. Genuine truncation (`1.`, `1e+`) still trims back to the typed digits with a `number-truncated` diagnostic.
