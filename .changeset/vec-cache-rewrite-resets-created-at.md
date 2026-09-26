---
'vec-cache': patch
---

Rewriting a cache entry now resets its creation time.

Re-embedding a TTL-expired entry, or calling `setMany` over an existing key, used to keep the old `created_at_ms`. `prune({ olderThanMs })` could then delete a row that had just been paid for, forcing another embed on the next request, and `stats().newestEntryMs` did not reflect the rewrite. An entry's age now counts from its latest write, as its `expires_at_ms` already did.
