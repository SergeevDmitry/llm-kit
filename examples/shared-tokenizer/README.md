# Example: one shared, provider-neutral tokenizer

**One injected exact-tokenizer adapter used by both `token-chunk` and
`chat-fit`, plus a custom price override used by `usage-tab`.**

Every package in this repo defaults to the bundled approximate tokenizer
(`approx-v1`) when no tokenizer is supplied, and every report says so
explicitly: approximate counts must never look exact.
This example builds one exact `Tokenizer` adapter — a deterministic,
reversible word-boundary encoder standing in for a real one (tiktoken, a
provider SDK's local tokenizer, etc.) — and injects the _same instance_ into
`chunkText` (`token-chunk`) and `fitChat` (`chat-fit`). It then uses that
same tokenizer's `count` to measure the usage priced against a custom,
non-registry model through `usage-tab`'s override mechanism, so all three
packages are configured from one tokenizer choice instead of three
independent guesses.

## Run it

```sh
pnpm --filter example-shared-tokenizer run start
```

No network access, no real encoder dependency: the tokenizer is a plain
whitespace-splitting adapter built with `fromEncoder`, not tiktoken or any
provider's real BPE tokenizer.

## What to look for in the output

- `token-chunk`'s `chunk.tokenizerId` is `approx-v1` by default and
  `acme-word-tokenizer-v1` once the tokenizer is injected — the exact id
  travels with the chunk, not just the call that produced it.
- `chat-fit`'s `report.counterId` follows the same pattern:
  `approx-v1+chat-fit-message-accounting-v1` by default, and
  `acme-word-tokenizer-v1+chat-fit-message-accounting-v1` once injected —
  chat-fit's own suffix on top of whichever tokenizer it was given.
- The injected tokenizer's counts are consistently lower than the
  approximate tokenizer's, since the approximate tokenizer is deliberately
  conservative (over-counts) as a safety margin — the exact counter reports
  true word counts instead.
- `usage-tab`'s report is priced using the token counts the _same_ injected
  tokenizer produced for the prompt/response text, not a separate estimate.
- The summary line ties all three together: every package attributed its
  counts to `acme-word-tokenizer-v1`, never the default.
