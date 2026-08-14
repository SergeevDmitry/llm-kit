---
'mend-json': patch
---

Fix `push()` on a frozen mender not being the documented no-op: it could still grow the internal buffer, silently flip an already-reported `complete: true` to `false` with no diagnostic, or throw a second, unrelated `JsonMendLimitError`. `finish()`'s pending-byte flush got the same fix, for the same underlying reason.
