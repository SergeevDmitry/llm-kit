---
'chat-fit': minor
---

Add `chat-fit/models`, a separate entry point with `resolveModelBudget(modelId, options?)` and `fitChatForModel(messages, options)` — resolves a model id against the bundled `@llm-kit/model-registry` to a `{ maxTokens, reserveTokens }` budget instead of requiring you to hand-copy a context-window constant that goes stale the next time a provider changes it. Kept out of the package root on purpose: importing `chat-fit/models` is what pulls the registry into your build, so `fitChat`/`fitChatAsync` callers who only ever pass `maxTokens` directly never carry that data. An unresolvable model id throws `UnknownModelError`, an ambiguous one throws `AmbiguousAliasError` (both unchanged from the registry), and a model with no recorded context window throws the new `ModelContextWindowUnknownError` rather than guessing one.
