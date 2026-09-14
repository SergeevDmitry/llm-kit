---
'chat-fit': minor
---

Add `countChatTokens(messages, options?)`, which counts a conversation without trimming it.

chat-fit's message accounting reads `ChatMessage`-, OpenAI- and Anthropic-shaped messages, including tool calls and fields it does not recognize, and until now `fitChat` was the only way to reach it. Asking "how big is this conversation?" meant running a fit against a huge `maxTokens` to read `report.initialTokenCount`, or writing a counter by hand and undercounting the provider shapes.

It returns `{ tokens, counterId, approximate, warnings }`. `tokens` is exactly the `initialTokenCount` a `fitChat` call would report for the same messages and tokenizer. `approximate` is true when the bundled tokenizer produced the count, in which case treat it as an upper bound, and `warnings` names any message whose shape had to be estimated. `tokenizer` and `maxMessages` work as they do in `FitChatOptions`.
