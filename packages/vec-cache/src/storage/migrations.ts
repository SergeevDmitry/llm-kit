/**
 * Versioned, transactional migrations. The schema is at v1, so the ladder
 * currently has a single rung: create the tables on a database that has none.
 * The `fromVersion < N` shape means a later version adds one more rung rather
 * than a rewrite of this function. `applyMigrations` refuses to touch a
 * database whose recorded schema version is greater than
 * `CACHE_SCHEMA_VERSION`, rather than guess how to read rows a future layout
 * might have written differently.
 *
 * `CACHE_SCHEMA_VERSION` is hashed into every `computeCacheKey`
 * (`identity/cache-key.ts`), so a future bump makes every key computed under
 * the old version unreachable through the public API on its own, whatever
 * happens to the physical table. That is the real invalidation mechanism; a
 * rung that rewrites the table is only ever about the rows already on disk.
 *
 * `planMigration` is read-only: it classifies the file (empty / recognizably
 * ours / foreign) without writing anything, and throws `STORE_OPEN_FAILED`
 * for a foreign file before `applyMigrations` — the only function below that
 * writes — ever runs. `createBetterSqliteStore` calls `planMigration` before
 * it flips `journal_mode = WAL`, because that pragma itself rewrites the
 * database header; running the compatibility check after it would mean a
 * rejected foreign file had already been mutated by the time it was rejected.
 *
 * What this can and cannot guarantee: a file with zero tables, or whose
 * `metadata` table is absent, is straightforward — respectively "ours to
 * create" and "not ours, refuse". A `metadata` table that happens to have
 * `key`/`value` columns but belongs to some other application can't be
 * distinguished from ours by shape alone; that coincidence would still read
 * as a (very unusual) same-schema-family file. This module doesn't attempt
 * content-fingerprinting beyond the schema the package itself defines.
 */
import type BetterSqlite3 from 'better-sqlite3';
import { VectorCacheError } from '../errors.js';
import {
  CACHE_SCHEMA_VERSION,
  CREATE_EMBEDDINGS_TABLE_SQL,
  CREATE_INDEXES_SQL,
  CREATE_METADATA_TABLE_SQL,
} from './schema.js';

const SCHEMA_VERSION_KEY = 'schema_version';

interface SchemaVersionRow {
  readonly value: string;
}

interface TableNameRow {
  readonly name: string;
}

export interface MigrationPlan {
  /** Schema version already recorded in the file; 0 means "nothing recorded yet". */
  readonly existingVersion: number;
}

/**
 * Read-only classification of `path`'s current contents. Never issues a
 * write — no `CREATE TABLE`, no `INSERT` — so a database this function
 * rejects is left byte-for-byte as it was found.
 *
 * - Zero user tables: an empty file, safe to populate. `{ existingVersion: 0 }`.
 * - Has tables, none named `metadata`: not a vec-cache database (or at least
 *   not one this package recognizes) — refuse rather than colonize it.
 * - Has a `metadata` table but it cannot be read the way ours is shaped
 *   (wrong columns, wrong types): also refuse.
 * - Has a readable `metadata` table with no `schema_version` row: the
 *   crash-recovery case (a prior run created the table but never got to
 *   stamp a version) — treated the same as an empty file,
 *   `{ existingVersion: 0 }`, so migration finishes the job.
 * - Has a readable `schema_version`: validated and returned, or the open is
 *   refused as `SCHEMA_TOO_NEW` (canonical, but from a future package
 *   version) or `STORE_CORRUPT` (not in canonical form at all — the two are
 *   different failures and get different messages, even though both refuse
 *   to open).
 *
 * "Canonical form" means the stored string, trimmed, matches `/^\d+$/` — an
 * unsigned decimal integer, nothing else. Coercing with bare `Number()` and
 * checking `Number.isInteger` is too permissive, and every way it is too
 * permissive ends in silence rather than an error: `Number("")`/`Number(" ")`
 * is `0`, indistinguishable from a brand-new file, so a corrupt database gets
 * populated as if it were empty; `Number("0x2")` and `Number("2e0")` are both
 * `2`, quietly accepted as a version nobody wrote; and `Number("-5")` is
 * `-5`, which `applyMigrations` reads as `fromVersion < 1` — the same branch
 * a genuinely fresh file takes — so a corrupt marker is overwritten with the
 * current version and the corruption is lost. Requiring the canonical form
 * turns all of those into `STORE_CORRUPT` on a file that is left untouched.
 */
export function planMigration(db: BetterSqlite3.Database, path: string): MigrationPlan {
  const tables = db
    .prepare<[], TableNameRow>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'",
    )
    .all();
  const tableNames = tables.map((table) => table.name);

  if (tableNames.length === 0) {
    return { existingVersion: 0 };
  }

  if (!tableNames.includes('metadata')) {
    throw new VectorCacheError(
      `refusing to open "${path}" as a vec-cache database: it already contains ` +
        `table(s) ${tableNames.map((name) => `"${name}"`).join(', ')} unrelated to vec-cache's schema. ` +
        `Point at an empty file or an existing vec-cache database instead.`,
      'STORE_OPEN_FAILED',
    );
  }

  let row: SchemaVersionRow | undefined;
  try {
    row = db.prepare('SELECT value FROM metadata WHERE key = ?').get(SCHEMA_VERSION_KEY) as
      SchemaVersionRow | undefined;
  } catch (error) {
    throw new VectorCacheError(
      `refusing to open "${path}" as a vec-cache database: it has a "metadata" table ` +
        `that is not shaped like vec-cache's schema.`,
      'STORE_OPEN_FAILED',
      { cause: error },
    );
  }

  if (row === undefined) {
    return { existingVersion: 0 };
  }

  // Canonical form only: an unsigned decimal integer, optionally surrounded
  // by whitespace (trimmed below before parsing, never before matching) —
  // see the doc comment above for why bare `Number()` isn't strict enough.
  if (typeof row.value !== 'string' || !/^\d+$/.test(row.value.trim())) {
    throw new VectorCacheError(
      `vec-cache database at "${path}" has a metadata.schema_version value of ` +
        `${JSON.stringify(row.value)}, which is not a valid integer — the file may be corrupt ` +
        `or was written by something other than vec-cache; refusing to open it.`,
      'STORE_CORRUPT',
    );
  }
  const existingVersion = Number(row.value.trim());
  if (existingVersion > CACHE_SCHEMA_VERSION) {
    throw new VectorCacheError(
      `vec-cache database schema version ${String(existingVersion)} is newer than this package version supports (${String(CACHE_SCHEMA_VERSION)}); upgrade vec-cache or point at a different database file`,
      'SCHEMA_TOO_NEW',
    );
  }

  return { existingVersion };
}

/**
 * Applies the migration ladder implied by `plan.existingVersion`. Only ever
 * called after `planMigration` has approved the file — this is the one
 * function in this module that writes.
 */
export function applyMigrations(db: BetterSqlite3.Database, plan: MigrationPlan): void {
  const migrate = db.transaction((fromVersion: number) => {
    if (fromVersion < 1) {
      db.exec(CREATE_METADATA_TABLE_SQL);
      db.exec(CREATE_EMBEDDINGS_TABLE_SQL);
      db.exec(CREATE_INDEXES_SQL);
    }
    db.prepare(
      `INSERT INTO metadata (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    ).run(SCHEMA_VERSION_KEY, String(CACHE_SCHEMA_VERSION));
  });

  migrate(plan.existingVersion);
}
