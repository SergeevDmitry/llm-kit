# llm-kit

Six small, focused npm packages for the unglamorous parts of building on LLMs —
the streaming JSON that arrives half-written, the chunk that blows the token
budget, the tool call that gets separated from its result, the retry that sleeps
for the wrong amount of time.

Each package solves one problem, installs on its own, and ships with types,
tests, and a README you can read in a minute.

## The packages

| Package                               | What it does                                                                                      | Runtime deps |
| ------------------------------------- | ------------------------------------------------------------------------------------------------- | ------------ |
| [`mend-json`](packages/mend-json)     | Turns a truncated JSON stream into a valid partial value, on every chunk                          | **0**        |
| [`token-chunk`](packages/token-chunk) | Chunks text and Markdown to a token budget along semantic boundaries, keeping heading breadcrumbs | **0**        |
| [`chat-fit`](packages/chat-fit)       | Trims chat history to a budget without ever splitting a tool call from its result                 | **0**        |
| [`usage-tab`](packages/usage-tab)     | Turns provider usage objects into a reproducible cost breakdown from committed pricing data       | **0**        |
| [`llm-backoff`](packages/llm-backoff) | Retries that read the provider's rate-limit headers instead of guessing                           | **0**        |
| [`vec-cache`](packages/vec-cache)     | SQLite embedding cache with partial batch hits, in-batch dedup and model-scoped keys              | 1            |

Nothing here depends on a provider SDK, makes a network call, or sends
telemetry. Packages are independent by design: none of them imports another.

## Why they exist

A few of the problems are sharper than they first look.

**Pricing the same model differently depending on who sells it.** Azure resells
OpenAI's models — and not always at OpenAI's price. `gpt-5.6-luna` is
`$0.20/$1.20` per million tokens on OpenAI and `$1.00/$6.00` on Azure. Anyone
assuming parity under-reports their bill by 80%. `usage-tab` keys prices by
`(provider, model)` and **refuses to guess** when a model name is ambiguous:

```ts
import { calculateCost } from 'usage-tab';

const usage = { inputTokens: 1_000_000, outputTokens: 1_000_000 };

calculateCost({ model: 'gpt-5.6-luna', provider: 'openai', usage }).totalUsdExact;
// → "1.40"
calculateCost({ model: 'gpt-5.6-luna', provider: 'azure-openai', usage }).totalUsdExact;
// → "7.00"
calculateCost({ model: 'gpt-5.6-luna', usage });
// → throws AMBIGUOUS_ALIAS — it will not pick one for you
```

**Money is never computed in floating point.** `0.1 * 3` is
`0.30000000000000004` in JavaScript. Accumulate a hundred thousand small
charges and the drift is real. Rates stay decimal strings end to end and
arithmetic runs in integers, so `totalUsdExact` is exact and `totalUsd` is the
ergonomic convenience — not the other way round.

**Trimming a conversation is not just dropping the oldest messages.** Cut
between an assistant's tool call and its result and most providers reject the
whole request. `chat-fit` treats a tool call and every result it spawned as one
atomic group, whatever order they arrived in.

**A truncated document is not a malformed one.** `mend-json` repairs
_truncation_ and says so — a completed document that is genuinely invalid is
never reported as complete, because quietly "fixing" it is how you ship wrong
data.

## Requirements

Node.js 20 or newer.

`mend-json`, `token-chunk`, `chat-fit`, `usage-tab` and `llm-backoff` also run
in browsers, edge runtimes, and Bun. `vec-cache` is Node-only, and **does not
currently work under Bun** — `better-sqlite3` is not yet supported there.
Every runtime claim is backed by a CI job that exercises the package rather
than merely importing it.

Every package ships ESM and CommonJS with declarations for both.

## Status

Pre-release. All six packages build, test, pack, and install cleanly into a
fresh project.

- 2,421 tests, with property and fuzz suites over the parser, chunker, message
  grouping and batch reconstruction
- 123 models across 10 providers in the pricing registry, every price fetched
  from the provider's own page or API and carrying a source URL and an observed
  date
- Coverage held at 90% statements/lines/functions and 85% branches per package

## Examples

Runnable, offline, no API keys — see [`examples/`](examples/):

| Example               | Shows                                                                 |
| --------------------- | --------------------------------------------------------------------- |
| `rag-pipeline`        | Markdown → `token-chunk` → mock embeddings → `vec-cache` partial hits |
| `chat-budgeting`      | Long conversation → `chat-fit` → mock call wrapped in `llm-backoff`   |
| `streaming-tool-args` | Streamed tool arguments → `mend-json` → cost report from `usage-tab`  |
| `shared-tokenizer`    | One injected tokenizer and price override shared across packages      |

## Development

```bash
pnpm install
pnpm run ci      # lint, format, typecheck, test, build, and every validator
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for the workflow.

## Design principles

- **Small, explicit APIs.** One job per package, no framework.
- **Determinism.** Same input, same options, same registry version, same output.
- **Diagnostics are first class.** Every non-trivial operation can explain
  itself: why a chunk split, why a message was dropped, why a retry waited that
  long, which embeddings were cache hits.
- **Safe defaults, explicit escape hatches.** Permissive behaviour is opt-in and
  always reported.
- **Data is versioned, not fetched.** Pricing is committed, dated and
  reviewable. Nothing changes because a network call returned something new.
- **Claim only what CI proves.** Support matrices are backed by jobs that
  exercise the package, not by optimism.

## License

MIT
