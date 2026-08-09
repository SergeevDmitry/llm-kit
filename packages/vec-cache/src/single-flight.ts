/**
 * In-process single-flight registry. Coalesces concurrent `getOrCreate`
 * calls that need the *same cache key* so only one of them actually calls
 * `embed`/writes the store for that key — the others join its promise
 * instead of starting a redundant fetch.
 *
 * Granularity is per cache key, not per call: two overlapping-but-not-
 * identical batches (`["a","b"]` and `["b","c"]`, concurrently, same
 * model/namespace) each own the keys nobody else has claimed yet (`a` and
 * `c` respectively) and both join the single shared fetch for `b`.
 *
 * Limits (documented in the README): this is in-process only. Two separate OS processes
 * pointed at the same database file are not coordinated by this registry —
 * SQLite's own locking plus the `cache_key` primary key's upsert semantics
 * keep the database correct (no duplicate rows), but both processes may
 * still independently call their own `embed` for the same missing key.
 * Cross-process lease/dogpile prevention is explicitly out of scope for v1.
 */

export interface SingleFlightRegistry<T> {
  /** The in-flight promise currently registered for `key`, if any. */
  get(key: string): Promise<T> | undefined;
  /**
   * Registers `promise` under `key` and returns it back. The registration is
   * removed automatically once `promise` settles (success or failure), so a
   * later call for the same key starts fresh rather than replaying a
   * finished (and possibly failed) fetch.
   */
  register(key: string, promise: Promise<T>): Promise<T>;
  /** Number of keys currently in flight — for tests and introspection only. */
  readonly size: number;
}

export function createSingleFlightRegistry<T>(): SingleFlightRegistry<T> {
  const inFlight = new Map<string, Promise<T>>();

  return {
    get(key) {
      return inFlight.get(key);
    },
    register(key, promise) {
      // `.finally` gives back a *new* promise; track that one (not the
      // caller's original) so cleanup fires exactly when whoever awaits our
      // returned promise would observe settlement, and so a stale delete
      // can never race ahead of a fresher registration for the same key.
      const tracked = promise.finally(() => {
        if (inFlight.get(key) === tracked) {
          inFlight.delete(key);
        }
      });
      inFlight.set(key, tracked);
      return tracked;
    },
    get size() {
      return inFlight.size;
    },
  };
}
