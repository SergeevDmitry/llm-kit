---
'usage-tab': minor
---

`createPriceCalculator` accepts a default `provider`.

An id registered under several providers, such as `gpt-5.6-luna` under `openai` and `azure-openai`, used to throw `AmbiguousAliasError` unless every call repeated the qualifier. A per-call `options.provider` or `request.provider` still takes precedence, and the default is a hard constraint like either of them: an id the provider does not list throws `UnknownModelError`.
