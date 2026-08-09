# Example: streaming tool-call arguments and their cost

**Streamed tool-call arguments → `mend-json` → a cost report from
`usage-tab` once the stream completes.**

Demonstrates what a chat UI does while an LLM is still generating a tool
call: the raw JSON text arrives in small, irregular pieces that rarely land
on a token boundary, but `mend-json` renders a valid, `JSON.parse`-able
partial value after every single piece. Once the stream finishes, the
provider's response usage is priced with `usage-tab`, so a caller can show
"what did that tool call cost" right next to the arguments it produced.

## Run it

```sh
pnpm --filter example-streaming-tool-args run start
```

No network access: `simulateProviderStream` yields a fixed, non-random
sequence of chunk sizes, and the usage block priced at the end is a fixed
stand-in for a real provider response — not derived from the stream itself.

## What to look for in the output

- A progress bar and a growing, always-valid JSON preview after every one of
  the 22 streamed chunks — arguments accumulate key by key and even
  mid-string (`"cabinClass":"eco"` → `"econom"` → `"economy"`) without ever
  producing a value `JSON.parse` would reject.
- `repairedJson parses: yes` on every single line — the headline invariant
  `mend-json` exists for.
- The final snapshot reports `complete: true` and `0` repair actions, since
  the input turned out to be well-formed, complete JSON by the last chunk.
- The cost report at the end breaks out ordinary input, cached input, and
  output tokens with their per-million rates, plus both the numeric and the
  fixed-point-exact total (`usage-tab`'s authoritative value).
