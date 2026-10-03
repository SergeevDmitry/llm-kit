---
'usage-tab': minor
---

Refresh every provider's pricing data (observed 2026-10-03) and add the models released since the last pass. 152 models to 172.

**Azure now charges OpenAI's first-party price for `gpt-5.6-sol`, `gpt-5.6-terra` and `gpt-5.6-luna`.** Azure cut sol from $5.00/$30.00 to $4.00/$20.00, terra from $2.50/$15.00 to $2.00/$12.00 and luna from $1.00/$6.00 to $0.20/$1.20 per million tokens. The new rates apply from 2026-10-03. Lookups dated earlier still return the prices observed then, so luna on 2026-08-05 is still 5x apart. The README's headline example now uses `gemma-4-31b`, which costs 2.5x more on Together than on AWS Bedrock today.

**Retired models are removed**, so a lookup for them now throws `UNKNOWN_MODEL` at any date; price historical usage for them with an override. They are Mistral's `devstral-2`, `devstral-small-2`, `magistral-medium`, `magistral-small`, `mistral-nemo`, `mixtral-8x7b` and `mixtral-8x22b`; Groq's `llama-3.1-8b-instant`, `llama-3.3-70b-versatile` and `qwen3.6-27b`; and Cohere's `aya-expanse-8b`.

`gemini-omni-1.1-flash` and `gemini-omni-flash-preview` record the $9.00 text output rate and carry a `PARTIAL_TIER_PRICING` warning, because video output costs $17.50 per million tokens. `openai:gpt-3.5-turbo` loses its batch rate, since OpenAI's Batch table no longer lists it: a batch request for it is priced at standard rates with a `BATCH_PRICING_UNAVAILABLE` warning.

Other price changes: `together:qwen3.7-max` rose from $1.25/$3.75 to $1.50/$4.50, and `together:qwen3.8-flash` fell from $0.15/$0.47 to $0.09/$0.28.

New models: `claude-opus-5-5`, `claude-sonnet-5-5`; `gpt-6.1-sol`, `gpt-6-sol`, `gpt-6-luna`, `chat-latest`, `gpt-5.3-codex`, `gpt-5-search-api`, `gpt-rosalind-research`, `gpt-5.6-cyber`, `gpt-5.5-cyber`; `gemini-3-flash-preview`, `gemini-omni-1.1-flash`, `gemini-omni-flash-preview`, `gemini-robotics-er-2-preview`, `gemini-robotics-er-2-streaming-preview`; `gpt-6-astra` on Azure; `gemma-4-26b-a4b`, `gemma-4-e2b`, `gemma-3-4b` and `nemotron-3-nano-30b` on Bedrock; `command-r7b-12-2024` and `command-r-08-2024` on Cohere; `zai-glm-5-3` on Mistral; seven more on Together.

Newly published rates fill in fields that were missing:

- `cacheWrite` on four OpenAI models and OpenRouter's Gemini entry, so their cache writes are priced at the published rate instead of the input rate with a warning.
- `cachedInput` on `gemini-3.5-flash-lite`, five Together models and four Mistral models.
- `batchMultiplier` on five Mistral models and on Azure's `gpt-4-turbo` and `gpt-4`.
