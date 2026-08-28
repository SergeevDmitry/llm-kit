---
'vec-cache': patch
---

Honor `busyTimeoutMs` while the database is being opened. It was applied only
after the header probe, the migration reads and the WAL switch, so until then
the driver's own 5 s default was in force and a larger configured timeout was
silently capped — losing the race against another process checkpointing its
WAL on `close()`.
