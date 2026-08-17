# chat-fit

## 1.1.0

### Minor Changes

- 3e0b997: Add `chat-fit/models`, a separate entry point with `resolveModelBudget(modelId, options?)` and `fitChatForModel(messages, options)` — resolves a model id against the bundled `@llm-kit/model-registry` to a `{ maxTokens, reserveTokens }` budget instead of requiring you to hand-copy a context-window constant that goes stale the next time a provider changes it. Kept out of the package root on purpose: importing `chat-fit/models` is what pulls the registry into your build, so `fitChat`/`fitChatAsync` callers who only ever pass `maxTokens` directly never carry that data. An unresolvable model id throws `UnknownModelError`, an ambiguous one throws `AmbiguousAliasError` (both unchanged from the registry), and a model with no recorded context window throws the new `ModelContextWindowUnknownError` rather than guessing one.

### Patch Changes

- 735c1ad: Fix the default token counter charging an Anthropic-shaped `tool_use` block twice — once via the content walk's unknown-shape fallback, once via the tool-call overhead/name/input accounting — inflating tool-heavy Anthropic conversations by roughly 3x and trimming them far more aggressively than the budget requires. The same content walk also flagged every well-formed `tool_use`/`tool_result` block as an "unrecognized part" in `report.warnings`, contradicting the README's claim that both are read directly; `tool_result` blocks are now counted from their own inner content plus a small framing overhead instead of the flat unknown-shape estimate, and neither block type generates a fallback warning anymore.
- 50e8762: Fix the default token counter charging zero tokens, with no warning, for an object-valued `tool_calls`/`toolCalls` field — the shape a common OpenAI streaming-delta accumulator produces (`{0: {...}, 1: {...}}`) — because the field was unconditionally exempted from the unrecognized-field fallback by key name alone, even though the structural readers only ever consume an array-valued one. It now falls through to the same conservative fallback and warning an unrecognized field already gets; an array-valued `tool_calls`/`toolCalls` is unaffected and still never double-charged.

## 1.0.1

### Patch Changes

- 84e3c55: Fix the bundled approximate tokenizer (`@llm-kit/tokenizer`) under-counting real BPE tokenization on several content shapes: unbroken non-word Latin runs over ~20 characters (minified identifiers, hashes, base64 blobs), most non-Latin/non-Cyrillic alphabetic scripts (Greek, Hebrew, Arabic, Georgian, Armenian, Thai, Devanagari, and others — previously charged Cyrillic's lighter rate without being individually verified), and multi-code-point CJK grapheme clusters (most commonly NFD-decomposed Hangul). Also fixes an isolated space being assumed to fold before any alphabetic letter, which was only ever verified against Latin script and does not hold reliably for Cyrillic or the other affected scripts. Token counts for content in these shapes are now higher (more conservative); ordinary Latin prose, code, Cyrillic text, and ordinarily-composed CJK text are unaffected.
