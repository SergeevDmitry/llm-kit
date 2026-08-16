---
'chat-fit': patch
---

Fix the default token counter charging zero tokens, with no warning, for an object-valued `tool_calls`/`toolCalls` field — the shape a common OpenAI streaming-delta accumulator produces (`{0: {...}, 1: {...}}`) — because the field was unconditionally exempted from the unrecognized-field fallback by key name alone, even though the structural readers only ever consume an array-valued one. It now falls through to the same conservative fallback and warning an unrecognized field already gets; an array-valued `tool_calls`/`toolCalls` is unaffected and still never double-charged.
