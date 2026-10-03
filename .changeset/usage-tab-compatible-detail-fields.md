---
'usage-tab': patch
---

`normalizeOpenAICompatibleUsage` now warns about unrecognized fields inside `prompt_tokens_details` and `completion_tokens_details`, matching `normalizeOpenAIUsage`.

It used to check top-level keys only, so a token class a gateway added inside a details object, such as `image_tokens`, went unpriced with no warning.
