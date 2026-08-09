/**
 * Schema migration edge cases (deliverables): fresh database creation,
 * reopening an existing database, and refusing a database created by a
 * newer schema version.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import Database from 'better-sqlite3';
import { createTempDatabase, type TempDatabase } from '@llm-kit/test-utils';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { VectorCacheError } from '../src/errors.js';
import { createBetterSqliteStore } from '../src/storage/better-sqlite-store.js';
import {
  CACHE_SCHEMA_VERSION,
  CREATE_EMBEDDINGS_TABLE_SQL,
  CREATE_INDEXES_SQL,
} from '../src/storage/schema.js';

describe('schema migrations', () => {
  let db: TempDatabase;

  beforeEach(() => {
    db = createTempDatabase();
  });

  afterEach(() => {
    db.cleanup();
  });

  it('creates the metadata and embeddings tables on a fresh database, stamped with the current schema version', () => {
    const store = createBetterSqliteStore({ path: db.databasePath });
    store.close();

    const raw = new Database(db.databasePath);
    try {
      const row = raw.prepare('SELECT value FROM metadata WHERE key = ?').get('schema_version') as
        { value: string } | undefined;
      expect(row?.value).toBe(String(CACHE_SCHEMA_VERSION));

      const tables = raw
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
        .all() as { name: string }[];
      expect(tables.map((t) => t.name)).toEqual(expect.arrayContaining(['embeddings', 'metadata']));
    } finally {
      raw.close();
    }
  });

  it('reopening an existing database is idempotent and preserves data', () => {
    const first = createBetterSqliteStore({ path: db.databasePath });
    first.putMany([
      {
        cacheKey: 'k',
        namespace: 'ns',
        modelId: 'model',
        textHash: 'hash',
        textValue: undefined,
        dimensions: 2,
        vectorEncoding: 'float32',
        vectorBlob: Buffer.alloc(8),
        createdAtMs: 1,
        expiresAtMs: undefined,
      },
    ]);
    first.close();

    const second = createBetterSqliteStore({ path: db.databasePath });
    try {
      const rows = second.getMany(['k'], 0);
      expect(rows).toHaveLength(1);
    } finally {
      second.close();
    }
  });

  it('refuses to open a database whose recorded schema version is newer than this package supports', () => {
    const raw = new Database(db.databasePath);
    raw.exec('CREATE TABLE metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL)');
    raw.prepare('INSERT INTO metadata (key, value) VALUES (?, ?)').run('schema_version', '99999');
    raw.close();

    let caught: unknown;
    try {
      createBetterSqliteStore({ path: db.databasePath });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(VectorCacheError);
    expect((caught as VectorCacheError).code).toBe('SCHEMA_TOO_NEW');
    // The message names the concrete, recoverable problem ("upgrade or point
    // elsewhere") rather than describing the value as unreadable — distinct
    // wording from the STORE_CORRUPT / non-numeric case below.
    expect((caught as VectorCacheError).message).toMatch(
      /newer than this package version supports/,
    );
  });

  it('a stale WAL file from an ungracefully-closed connection is recovered transparently on reopen', () => {
    const first = createBetterSqliteStore({ path: db.databasePath });
    first.putMany([
      {
        cacheKey: 'wal-key',
        namespace: 'ns',
        modelId: 'model',
        textHash: 'hash',
        textValue: undefined,
        dimensions: 2,
        vectorEncoding: 'float32',
        vectorBlob: Buffer.alloc(8),
        createdAtMs: 1,
        expiresAtMs: undefined,
      },
    ]);
    // No first.close() — simulates a crash: the connection reference is
    // simply dropped, potentially leaving a `-wal` sidecar file behind.
    // `createTempDirectory`/`createTempDatabase` clean those up regardless.

    const second = createBetterSqliteStore({ path: db.databasePath });
    try {
      expect(second.getMany(['wal-key'], 0)).toHaveLength(1);
    } finally {
      second.close();
    }
  });

  it('initializes a file that exists but is empty (zero bytes), the same as a nonexistent path', () => {
    writeFileSync(db.databasePath, '');

    const store = createBetterSqliteStore({ path: db.databasePath });
    store.close();

    const raw = new Database(db.databasePath);
    try {
      const row = raw.prepare('SELECT value FROM metadata WHERE key = ?').get('schema_version') as
        { value: string } | undefined;
      expect(row?.value).toBe(String(CACHE_SCHEMA_VERSION));
    } finally {
      raw.close();
    }
  });

  it('finishes initialization after a crash that created the metadata table but never stamped a version', () => {
    // Reproduces a process dying between `CREATE TABLE metadata` and the
    // version INSERT under the old, unconditional-write ordering. The
    // metadata table exists, is shaped correctly, but has no rows at all —
    // `planMigration` reads this as `existingVersion: 0`, same as a brand
    // new file, rather than refusing it as foreign.
    const raw = new Database(db.databasePath);
    raw.exec('CREATE TABLE metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL)');
    raw.close();

    const store = createBetterSqliteStore({ path: db.databasePath });
    store.close();

    const raw2 = new Database(db.databasePath);
    try {
      const row = raw2.prepare('SELECT value FROM metadata WHERE key = ?').get('schema_version') as
        { value: string } | undefined;
      expect(row?.value).toBe(String(CACHE_SCHEMA_VERSION));
      const tables = raw2
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
        .all() as { name: string }[];
      expect(tables.map((t) => t.name)).toEqual(expect.arrayContaining(['embeddings', 'metadata']));
    } finally {
      raw2.close();
    }
  });
});

describe('opening a foreign database', () => {
  let db: TempDatabase;

  beforeEach(() => {
    db = createTempDatabase();
  });

  afterEach(() => {
    db.cleanup();
  });

  it('refuses a foreign SQLite file with unrelated tables, and leaves it byte-for-byte unmodified', () => {
    const raw = new Database(db.databasePath);
    raw.exec('CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)');
    raw.prepare('INSERT INTO users (id, name) VALUES (?, ?)').run(1, 'alice');
    raw.close();
    const before = readFileSync(db.databasePath);

    let caught: unknown;
    try {
      createBetterSqliteStore({ path: db.databasePath });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(VectorCacheError);
    expect((caught as VectorCacheError).code).toBe('STORE_OPEN_FAILED');
    expect((caught as VectorCacheError).message).toMatch(/unrelated to vec-cache/);
    // Read-only classification runs before `journal_mode = WAL` (which itself
    // rewrites the file header) and before any `CREATE TABLE`/`INSERT`, so a
    // rejected foreign file is untouched — not merely "no new rows", but
    // literally the same bytes, and no WAL/SHM sidecar was created.
    expect(readFileSync(db.databasePath)).toEqual(before);
    expect(existsSync(`${db.databasePath}-wal`)).toBe(false);
    expect(existsSync(`${db.databasePath}-shm`)).toBe(false);
  });

  it('refuses a foreign file whose "metadata" table is not shaped like vec-cache\'s schema, and leaves it unmodified', () => {
    const raw = new Database(db.databasePath);
    // Same table name, incompatible columns — no `key`/`value`, so the
    // `SELECT value FROM metadata WHERE key = ?` vec-cache issues cannot
    // even be prepared/executed against it.
    raw.exec('CREATE TABLE metadata (id INTEGER PRIMARY KEY, note TEXT)');
    raw.prepare('INSERT INTO metadata (id, note) VALUES (?, ?)').run(1, 'not ours');
    raw.close();
    const before = readFileSync(db.databasePath);

    let caught: unknown;
    try {
      createBetterSqliteStore({ path: db.databasePath });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(VectorCacheError);
    expect((caught as VectorCacheError).code).toBe('STORE_OPEN_FAILED');
    expect((caught as VectorCacheError).message).toMatch(/not shaped like vec-cache/);
    expect((caught as VectorCacheError).cause).toBeDefined();
    expect(readFileSync(db.databasePath)).toEqual(before);
    expect(existsSync(`${db.databasePath}-wal`)).toBe(false);
    expect(existsSync(`${db.databasePath}-shm`)).toBe(false);
  });

  it('distinguishes an unreadable (non-numeric) schema_version from one that is merely newer than supported', () => {
    const raw = new Database(db.databasePath);
    raw.exec('CREATE TABLE metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL)');
    raw
      .prepare('INSERT INTO metadata (key, value) VALUES (?, ?)')
      .run('schema_version', 'not-a-number');
    raw.close();
    const before = readFileSync(db.databasePath);

    let caught: unknown;
    try {
      createBetterSqliteStore({ path: db.databasePath });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(VectorCacheError);
    // Distinct code from SCHEMA_TOO_NEW: the version could not be read at
    // all, as opposed to being read and found to be from the future.
    expect((caught as VectorCacheError).code).toBe('STORE_CORRUPT');
    expect((caught as VectorCacheError).message).toMatch(/not a valid integer/);
    expect((caught as VectorCacheError).message).not.toMatch(/newer than/);
    expect(readFileSync(db.databasePath)).toEqual(before);
  });
});

describe('non-canonical metadata.schema_version values', () => {
  // Bare `Number()` + `Number.isInteger` would accept several shapes a
  // version vec-cache itself never writes: `Number("")` and `Number(" ")`
  // are both `0` (indistinguishable from a brand-new file), `Number("0x2")`
  // and `Number("2e0")` are both `2` (silently accepted as the current
  // version), and `Number("-5")` is `-5` (read as `existingVersion < 1`, the
  // same no-op branch a genuinely fresh file takes). Requiring the trimmed
  // stored value to match `/^\d+$/` before coercing it rejects all five of
  // the above as `STORE_CORRUPT`. No vec-cache release has ever written a
  // value outside that pattern, so this rejects only non-canonical/
  // hand-edited input.
  let db: TempDatabase;

  beforeEach(() => {
    db = createTempDatabase();
  });

  afterEach(() => {
    db.cleanup();
  });

  function metadataOnlyDatabase(schemaVersionValue: string): void {
    const raw = new Database(db.databasePath);
    raw.exec('CREATE TABLE metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL)');
    raw
      .prepare('INSERT INTO metadata (key, value) VALUES (?, ?)')
      .run('schema_version', schemaVersionValue);
    raw.close();
  }

  it.each([
    ['empty string', ''],
    ['whitespace only', ' '],
    ['hexadecimal', '0x2'],
    ['exponential notation', '2e0'],
    ['negative number', '-5'],
  ])('rejects a schema_version of %s (%j) as STORE_CORRUPT, unmodified', (_label, value) => {
    metadataOnlyDatabase(value);
    const before = readFileSync(db.databasePath);

    let caught: unknown;
    try {
      createBetterSqliteStore({ path: db.databasePath });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(VectorCacheError);
    expect((caught as VectorCacheError).code).toBe('STORE_CORRUPT');
    expect((caught as VectorCacheError).message).toContain(JSON.stringify(value));
    expect(readFileSync(db.databasePath)).toEqual(before);
    expect(existsSync(`${db.databasePath}-wal`)).toBe(false);
    expect(existsSync(`${db.databasePath}-shm`)).toBe(false);
  });

  it('accepts a schema_version padded with incidental whitespace ("  1 ") as the canonical value it trims to', () => {
    // Distinct from the rejected cases above: after trimming, "  1 " is
    // exactly the canonical digit string "1" — the same value vec-cache
    // itself would have written for CACHE_SCHEMA_VERSION 1. This is not a
    // shape vec-cache produces, but it is unambiguously interpretable as a
    // version, unlike the five rejected shapes, so it stays accepted.
    const raw = new Database(db.databasePath);
    raw.exec('CREATE TABLE metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL)');
    raw.exec(CREATE_EMBEDDINGS_TABLE_SQL);
    raw.exec(CREATE_INDEXES_SQL);
    raw.prepare('INSERT INTO metadata (key, value) VALUES (?, ?)').run('schema_version', '  1 ');
    raw.close();

    expect(CACHE_SCHEMA_VERSION).toBe(1);
    const store = createBetterSqliteStore({ path: db.databasePath });
    store.close();

    const raw2 = new Database(db.databasePath, { readonly: true });
    try {
      const row = raw2
        .prepare('SELECT value FROM metadata WHERE key = ?')
        .get('schema_version') as { value: string };
      expect(row.value).toBe('1');
    } finally {
      raw2.close();
    }
  });

  it('a schema_version of "-5" is refused rather than silently overwritten with the current version', () => {
    // Under a bare-Number() check, "-5" would read as existingVersion -5,
    // which `applyMigrations` takes down the `fromVersion < 1` branch (all
    // `CREATE TABLE IF NOT EXISTS`, a no-op on an existing table) and then
    // stamps the file with the current version — quietly discarding the only
    // evidence that the file was corrupt. It has to be refused outright, and
    // the file left exactly as it was found.
    const raw = new Database(db.databasePath);
    raw.exec('CREATE TABLE metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL)');
    raw.exec(CREATE_EMBEDDINGS_TABLE_SQL);
    raw.exec(CREATE_INDEXES_SQL);
    raw.prepare('INSERT INTO metadata (key, value) VALUES (?, ?)').run('schema_version', '-5');
    raw.close();
    const before = readFileSync(db.databasePath);

    let caught: unknown;
    try {
      createBetterSqliteStore({ path: db.databasePath });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(VectorCacheError);
    expect((caught as VectorCacheError).code).toBe('STORE_CORRUPT');
    expect(readFileSync(db.databasePath)).toEqual(before);
    expect(existsSync(`${db.databasePath}-wal`)).toBe(false);
    expect(existsSync(`${db.databasePath}-shm`)).toBe(false);

    const raw2 = new Database(db.databasePath, { readonly: true });
    try {
      const versionRow = raw2
        .prepare('SELECT value FROM metadata WHERE key = ?')
        .get('schema_version') as { value: string };
      expect(versionRow.value).toBe('-5');
    } finally {
      raw2.close();
    }
  });

  it('legitimate path: an empty file is still treated as brand-new, not STORE_CORRUPT', () => {
    writeFileSync(db.databasePath, '');

    const store = createBetterSqliteStore({ path: db.databasePath });
    store.close();

    const raw = new Database(db.databasePath);
    try {
      const row = raw.prepare('SELECT value FROM metadata WHERE key = ?').get('schema_version') as
        { value: string } | undefined;
      expect(row?.value).toBe(String(CACHE_SCHEMA_VERSION));
    } finally {
      raw.close();
    }
  });

  it('legitimate path: a metadata table with no schema_version row (crash recovery) is still treated as brand-new, not STORE_CORRUPT', () => {
    const raw = new Database(db.databasePath);
    raw.exec('CREATE TABLE metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL)');
    raw.close();

    const store = createBetterSqliteStore({ path: db.databasePath });
    store.close();

    const raw2 = new Database(db.databasePath);
    try {
      const row = raw2.prepare('SELECT value FROM metadata WHERE key = ?').get('schema_version') as
        { value: string } | undefined;
      expect(row?.value).toBe(String(CACHE_SCHEMA_VERSION));
    } finally {
      raw2.close();
    }
  });

  it('legitimate path: a genuinely newer numeric version is SCHEMA_TOO_NEW, not STORE_CORRUPT', () => {
    metadataOnlyDatabase('99999');
    const before = readFileSync(db.databasePath);

    let caught: unknown;
    try {
      createBetterSqliteStore({ path: db.databasePath });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(VectorCacheError);
    expect((caught as VectorCacheError).code).toBe('SCHEMA_TOO_NEW');
    expect(readFileSync(db.databasePath)).toEqual(before);
  });
});

describe('malformed database', () => {
  let db: TempDatabase;

  beforeEach(() => {
    db = createTempDatabase();
  });

  afterEach(() => {
    db.cleanup();
  });

  it('throws STORE_OPEN_FAILED with the original cause when the path is not a valid SQLite file', () => {
    writeFileSync(db.databasePath, 'this is not a sqlite database file, just plain text\n');
    let caught: unknown;
    try {
      createBetterSqliteStore({ path: db.databasePath });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(VectorCacheError);
    expect((caught as VectorCacheError).code).toBe('STORE_OPEN_FAILED');
    expect((caught as VectorCacheError).cause).toBeDefined();
  });
});
