/**
 * `busyTimeoutMs` has to reach `new Database()` itself. better-sqlite3
 * applies its own `timeout: 5000` default at native open, so a value set only
 * by the later pragma is silently capped at 5 s for the whole open sequence —
 * header probe, migration reads, WAL switch and the migration write — which
 * is exactly the window another process's `close()` checkpoint holds an
 * exclusive lock over.
 */
import type Database from 'better-sqlite3';
import { createTempDatabase, type TempDatabase } from '@llm-kit/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { VectorCache } from '../src/index.js';

const { constructorOptions } = vi.hoisted(() => ({ constructorOptions: [] as unknown[] }));

vi.mock('better-sqlite3', async (importOriginal) => {
  const actual = (await importOriginal<{ default: typeof Database }>()).default;
  class RecordingDatabase extends actual {
    constructor(path: string, options?: Database.Options) {
      super(path, options);
      constructorOptions.push(options);
    }
  }
  return { default: RecordingDatabase };
});

describe('busyTimeoutMs at open', () => {
  let db: TempDatabase;

  beforeEach(() => {
    constructorOptions.length = 0;
    db = createTempDatabase();
  });

  afterEach(() => {
    db.cleanup();
  });

  it('passes a configured busyTimeoutMs to the driver constructor, not just to the pragma', () => {
    const cache = new VectorCache({ path: db.databasePath, busyTimeoutMs: 30_000 });
    try {
      expect(constructorOptions).toEqual([{ timeout: 30_000 }]);
    } finally {
      cache.close();
    }
  });

  it('passes the package default when none is configured, rather than leaving it to the driver', () => {
    const cache = new VectorCache({ path: db.databasePath });
    try {
      expect(constructorOptions).toEqual([{ timeout: 5000 }]);
    } finally {
      cache.close();
    }
  });
});
