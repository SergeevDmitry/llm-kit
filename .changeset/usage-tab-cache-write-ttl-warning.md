---
'usage-tab': patch
---

`normalizeAnthropicUsage` now warns with `CACHE_WRITE_TTL_NOT_MODELED` when a response reports 1-hour cache writes.

The registry records one cache-write rate per model, the 5-minute TTL rate. A 1-hour write costs more (2x input against 1.25x), so those tokens were under-priced with no warning. The cost is unchanged; the warning now says it is low. `cache_creation.ephemeral_5m_input_tokens` and `ephemeral_1h_input_tokens` are also validated when `cache_creation_input_tokens` is present, so a malformed value throws `InvalidUsageError` instead of being ignored.
