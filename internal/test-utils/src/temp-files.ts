import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * Temporary directory and database helpers for `vec-cache` and packed-artifact
 * tests. Every helper cleans up recursively, including SQLite `-wal`/`-shm`
 * sidecar files.
 */

export interface TempDirectory {
  readonly path: string;
  /** Resolves a child path inside the temporary directory. */
  file(name: string): string;
  /** Removes the directory and everything in it. */
  cleanup(): void;
}

export function createTempDirectory(prefix = 'llm-kit-'): TempDirectory {
  const path = mkdtempSync(join(tmpdir(), prefix));
  return {
    path,
    file(name: string): string {
      return join(path, name);
    },
    cleanup(): void {
      rmSync(path, { recursive: true, force: true });
    },
  };
}

export interface TempDatabase extends TempDirectory {
  /** Absolute path to a `.sqlite` file inside the temporary directory. */
  readonly databasePath: string;
}

export function createTempDatabase(fileName = 'cache.sqlite'): TempDatabase {
  const directory = createTempDirectory('llm-kit-sqlite-');
  return {
    ...directory,
    databasePath: directory.file(fileName),
  };
}
