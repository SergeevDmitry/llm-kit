# Example: chat budgeting and resilient delivery

**Long tool-using conversation → `chat-fit` → a mock provider call wrapped
in `llm-backoff`.**

Demonstrates the second half of a typical agent loop: once a conversation
has grown past a model's context budget, `chat-fit` trims it down without
ever separating a tool call from its result. The fitted conversation is then
"sent" to a (simulated) provider that rejects the request twice with HTTP
429 and a real `Retry-After` header before succeeding — `llm-backoff`
honors that header exactly instead of guessing a delay.

## Run it

```sh
pnpm --filter example-chat-budgeting run start
```

No network access: `simulateProviderCall` is a deterministic stand-in for a
real provider SDK request.

## What to look for in the output

- The 34-message conversation (8 tool-using turns plus a system prompt and a
  mid-conversation developer instruction) is trimmed to 14 messages under a
  600-token budget.
- `every tool-call group kept intact: true` — every assistant message with a
  tool call keeps its tool result, and vice versa; `chat-fit` never returns
  a group half-trimmed.
- Both the leading system prompt and the mid-conversation developer
  instruction are preserved, even though the developer message is far from
  the start of the array.
- `llm-backoff` retries twice, and both retry lines report
  `via retry-after (retry-after)` — the delay came from the server's header,
  not a guessed exponential backoff.
