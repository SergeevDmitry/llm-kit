# Example: RAG ingestion pipeline

**Markdown → `token-chunk` → a mock embedding function → `vec-cache`.**

Demonstrates the everyday RAG ingestion loop and the concrete payoff of
caching embeddings: a documentation site reuses boilerplate sections (an
"Eligibility" policy, a "Need help?" footer) across many product pages.
Chunking each page with `token-chunk` and embedding through `vec-cache`
means the second page only pays the embedding cost for its genuinely new
content — the shared sections come back from the cache untouched.

## Run it

```sh
pnpm --filter example-rag-pipeline run start
```

No network access and no API key: `simulateProviderEmbed` is a deterministic
stand-in for a real embeddings endpoint.

## What to look for in the output

- Ingesting the first page ("Product A policies") is a full miss: every
  chunk is new, so every chunk is embedded.
- Ingesting the second page ("Product B policies") reports **2 cache hits**
  out of 4 chunks — the "Eligibility" and "Need help?" sections are
  byte-for-byte identical to chunks already cached from page A, so
  `vec-cache` returns their vectors without calling the embedding function
  again.
- The embedding provider is called only twice in total across both pages
  (once for 3 texts, once for 2), never once per chunk — `vec-cache` sends
  only the unique misses of each batch.
- The final cache stats include `oldestEntryMs`/`newestEntryMs`, 60,000ms
  apart — `VectorCache` is constructed with an injected `now` (a fixed
  clock, advanced by hand between the two ingests), not `Date.now()`, so
  this example's output is identical on every run.
