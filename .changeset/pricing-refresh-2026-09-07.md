---
'usage-tab': minor
---

Refresh every provider's pricing data (observed 2026-09-07) and add the models released since the last pass. 123 models to 152.

**Correction: `anthropic:claude-sonnet-5` was over-reported by 50% for any date from 2026-09-01.** The previous snapshot modelled Anthropic's announced increase to $3.00/$15.00 per million tokens as a real pricing period. Anthropic's pricing page now states that increase will not occur and the $2.00/$10.00 launch rate is the standard price, so the period is removed - a rate that never took effect must not be reachable at any lookup date.

Other price changes: `openai:gpt-5.6-sol` cut from $5.00/$30.00 to $4.00/$20.00 (Azure's resale of the same model did not follow, so it is now a confirmed divergence); `google:gemini-3.6-flash` moved to a promotional $0.75/$3.75 published as running through 2026-12-31, with the standard $1.50/$7.50 resuming 2027-01-01.

New models: `claude-fable-5-1`, `claude-mythos-5-1`, `claude-mythos-5` and six legacy Claude models Anthropic still publishes rates for; `gpt-6-astra`; `gemini-3.8-flash`, `gemini-3.7-flash`, `gemini-3.1-flash-lite`; `qwen3.8-27b` on Groq; `zai-glm-5-2` on Mistral; eleven more on Together; `gemma-3-27b`, `gemma-3-12b` and `nemotron-3-super-120b` on Bedrock.

Newly published per-model detail fills in fields previously omitted for want of a source: `cachedInput` on eight Gemini models, three Mistral models and three OpenRouter models, `cacheWrite` on OpenRouter's Claude entry, and `batchMultiplier` on the two Gemini Pro models, three Mistral models and OpenAI's `-pro` tiers. The `UNCERTAIN` flag on `openrouter:anthropic/claude-sonnet-5` is withdrawn: the rate it questioned turned out to be correct.
