/**
 * `better-sqlite3`-backed implementation of {@link VectorCacheStore}.
 *
 * Concurrency: WAL mode is enabled where the filesystem supports it (silently
 * falls back to the default rollback journal otherwise — some network mounts
 * and sandboxes reject WAL), a `busy_timeout` is set so a lock contended by
 * another process/connection waits instead of failing immediately, and every
 * write batch runs inside one `db.transaction()`. SQLite itself serializes
 * cross-process writers; this store adds nothing beyond that (no lease, no
 * dogpile prevention) — see the README's "Concurrency" section.
 */
import Database from 'better-sqlite3';
import { VectorCacheError } from '../errors.js';
import { resolvePruneCriteria } from '../maintenance/prune.js';
import { buildStats, type RawNamespaceStatsRow, type RawTotalsRow } from '../maintenance/stats.js';
import type { PruneReport, VectorCacheStats } from '../types.js';
import { applyMigrations, planMigration } from './migrations.js';
import {
  chunk,
  INSERT_OR_UPDATE_SQL,
  MAX_IN_CLAUSE_PARAMS,
  rowToStoredEmbedding,
  SELECT_COLUMNS,
  storedEmbeddingToParams,
  type RawEmbeddingRow,
} from './statements.js';
import type { StoredEmbedding, StorePruneOptions, VectorCacheStore } from './store.js';

const DEFAULT_BUSY_TIMEOUT_MS = 5000;

export interface BetterSqliteStoreOptions {
  readonly path: string;
  readonly busyTimeoutMs?: number;
}

/**
 * `timeout` is passed to the constructor, not left to the `busy_timeout`
 * pragma below: the driver applies its own default of 5 s at native open, so
 * a configured timeout larger than that would be silently capped for the
 * whole open sequence — the header probe, the migration reads, the WAL
 * switch, and the migration write that runs on every open. Another process
 * checkpointing its WAL on `close()` holds an exclusive lock over exactly
 * that window. It is a connection setting, not a file write, so the
 * deliberate classify-before-WAL ordering in `createBetterSqliteStore` is
 * untouched.
 */
function openDatabase(path: string, busyTimeoutMs: number): Database.Database {
  let db: Database.Database | undefined;
  try {
    db = new Database(path, { timeout: busyTimeoutMs });
    // `new Database()` can succeed even when `path` is not a valid SQLite
    // file — the driver validates the file header lazily, on first real
    // access. Force that validation now, with a cheap header-only read
    // (`schema_version` never scans table data), so a malformed file fails
    // here as a clear `STORE_OPEN_FAILED` instead of surfacing a raw driver
    // error later — possibly *inside* the WAL-pragma fallback below, which
    // deliberately swallows one specific failure (WAL unsupported on this
    // filesystem) and must not also swallow a genuinely corrupt database.
    db.pragma('schema_version');
    return db;
  } catch (error) {
    try {
      db?.close();
    } catch {
      // Already broken; nothing more to release.
    }
    throw new VectorCacheError(
      `failed to open vec-cache database at "${path}"`,
      'STORE_OPEN_FAILED',
      { cause: error },
    );
  }
}

export function createBetterSqliteStore(options: BetterSqliteStoreOptions): VectorCacheStore {
  const busyTimeoutMs = options.busyTimeoutMs ?? DEFAULT_BUSY_TIMEOUT_MS;
  const db = openDatabase(options.path, busyTimeoutMs);

  // Classify the file — empty, already ours, or foreign — before anything
  // below writes a single byte to it. `journal_mode = WAL` two lines down
  // rewrites the database header even when no table is touched, so the
  // read-only compatibility check has to run first: a foreign file rejected
  // here is rejected untouched (migrations.ts's module doc has the full
  // reasoning).
  let plan: ReturnType<typeof planMigration>;
  try {
    plan = planMigration(db, options.path);
  } catch (error) {
    db.close();
    throw error;
  }

  try {
    db.pragma('journal_mode = WAL');
  } catch {
    // Some filesystems (network mounts, certain CI sandboxes) reject WAL.
    // Falling back to the default rollback journal keeps the cache usable
    // rather than failing to open entirely — documented in the README. Safe
    // to swallow unconditionally here: `openDatabase` already proved this is
    // a genuine, readable SQLite file above.
  }
  // Redundant with the constructor's `timeout` above, and kept: it is the
  // documented pragma a `PRAGMA busy_timeout` read reports, and it costs one
  // statement per open.
  db.pragma(`busy_timeout = ${String(busyTimeoutMs)}`);

  try {
    applyMigrations(db, plan);
  } catch (error) {
    db.close();
    throw error;
  }

  const selectStatements = new Map<number, Database.Statement<unknown[], RawEmbeddingRow>>();
  function selectStatementFor(count: number): Database.Statement<unknown[], RawEmbeddingRow> {
    let statement = selectStatements.get(count);
    if (statement === undefined) {
      const placeholders = new Array<string>(count).fill('?').join(',');
      statement = db.prepare<unknown[], RawEmbeddingRow>(
        `SELECT ${SELECT_COLUMNS} FROM embeddings WHERE cache_key IN (${placeholders}) AND (expires_at_ms IS NULL OR expires_at_ms > ?)`,
      );
      selectStatements.set(count, statement);
    }
    return statement;
  }

  const insertStatement = db.prepare<Record<string, unknown>>(INSERT_OR_UPDATE_SQL);
  const insertMany = db.transaction((entries: readonly StoredEmbedding[]) => {
    for (const entry of entries) {
      insertStatement.run(storedEmbeddingToParams(entry));
    }
  });

  // Memoized by placeholder count, same as `selectStatementFor` above —
  // avoids re-`prepare`-ing a fresh statement per key group on every call.
  // Bounded at `MAX_IN_CLAUSE_PARAMS` distinct entries either way.
  const deleteStatements = new Map<number, Database.Statement<unknown[]>>();
  function deleteStatementFor(count: number): Database.Statement<unknown[]> {
    let statement = deleteStatements.get(count);
    if (statement === undefined) {
      const placeholders = new Array<string>(count).fill('?').join(',');
      statement = db.prepare<unknown[]>(
        `DELETE FROM embeddings WHERE cache_key IN (${placeholders})`,
      );
      deleteStatements.set(count, statement);
    }
    return statement;
  }

  const deleteMany = db.transaction((keyGroups: readonly (readonly string[])[]) => {
    let deleted = 0;
    for (const group of keyGroups) {
      const args: readonly string[] = [...group];
      // Bounded by MAX_IN_CLAUSE_PARAMS = 500 — `group` is always one chunk
      // from `chunk(keys, MAX_IN_CLAUSE_PARAMS)` (this function's only
      // caller), never the raw caller-supplied key list.
      // eslint-disable-next-line no-restricted-syntax
      const result = deleteStatementFor(group.length).run(...args);
      deleted += result.changes;
    }
    return deleted;
  });

  let closed = false;
  function assertOpen(): void {
    if (closed) {
      throw new VectorCacheError('vec-cache database is closed', 'STORE_CLOSED');
    }
  }

  return {
    getMany(keys, nowMs) {
      assertOpen();
      if (keys.length === 0) return [];
      const rows: StoredEmbedding[] = [];
      for (const group of chunk(keys, MAX_IN_CLAUSE_PARAMS)) {
        const args: readonly (string | number)[] = [...group, nowMs];
        // Bounded by MAX_IN_CLAUSE_PARAMS = 500 — `group` is one chunk from
        // `chunk(keys, MAX_IN_CLAUSE_PARAMS)` above, plus the fixed `nowMs`
        // param, never the raw caller-supplied key list.
        // eslint-disable-next-line no-restricted-syntax
        const found = selectStatementFor(group.length).all(...args) as RawEmbeddingRow[];
        for (const row of found) {
          rows.push(rowToStoredEmbedding(row));
        }
      }
      return rows;
    },

    putMany(entries) {
      assertOpen();
      if (entries.length === 0) return;
      insertMany(entries);
    },

    deleteMany(keys) {
      assertOpen();
      if (keys.length === 0) return 0;
      return deleteMany(chunk(keys, MAX_IN_CLAUSE_PARAMS));
    },

    prune(pruneOptions: StorePruneOptions): PruneReport {
      assertOpen();
      const criteria = resolvePruneCriteria(pruneOptions);
      const conditions = ['(expires_at_ms IS NOT NULL AND expires_at_ms <= @expiresAtOrBefore)'];
      const params: Record<string, unknown> = { expiresAtOrBefore: criteria.expiresAtOrBeforeMs };
      if (criteria.createdBeforeMs !== undefined) {
        conditions.push('(created_at_ms < @createdBefore)');
        params.createdBefore = criteria.createdBeforeMs;
      }
      let sql = `DELETE FROM embeddings WHERE (${conditions.join(' OR ')})`;
      if (criteria.namespace !== undefined) {
        sql += ' AND namespace = @namespace';
        params.namespace = criteria.namespace;
      }
      const result = db.prepare(sql).run(params);
      return { deletedCount: result.changes };
    },

    stats(): VectorCacheStats {
      assertOpen();
      const totals = db
        .prepare(
          'SELECT COUNT(*) as count, COALESCE(SUM(LENGTH(vector_blob)), 0) as bytes, MIN(created_at_ms) as oldestMs, MAX(created_at_ms) as newestMs FROM embeddings',
        )
        .get() as RawTotalsRow;
      const byNamespace = db
        .prepare(
          'SELECT namespace, model_id as modelId, COUNT(*) as count, COALESCE(SUM(LENGTH(vector_blob)), 0) as bytes FROM embeddings GROUP BY namespace, model_id ORDER BY namespace, modelId',
        )
        .all() as RawNamespaceStatsRow[];
      return buildStats(totals, byNamespace);
    },

    clear(namespace) {
      assertOpen();
      const result =
        namespace !== undefined
          ? db.prepare('DELETE FROM embeddings WHERE namespace = ?').run(namespace)
          : db.prepare('DELETE FROM embeddings').run();
      return result.changes;
    },

    close() {
      if (closed) return;
      closed = true;
      try {
        // Folds the WAL back into the main file so a closed cache doesn't
        // leave a stale/oversized `-wal` sidecar behind.
        db.pragma('wal_checkpoint(TRUNCATE)');
      } catch {
        // Best effort — closing must never throw because a checkpoint failed.
      }
      db.close();
    },
  };
}
