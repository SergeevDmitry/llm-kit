/**
 * A two-process smoke test. Spawns two real, separate Node processes
 * pointed at the same SQLite file and lets them race a `getOrCreate` for an
 * overlapping text set. Proves that SQLite's own cross-process locking plus
 * the `cache_key` primary key's upsert semantics keep the database correct
 * — no duplicate rows — even though (documented limitation) both processes
 * may independently compute and write their own embedding for the same
 * missing key.
 *
 * A worker exiting 0 with empty stdout would otherwise make the *parent*
 * fail with an opaque "unexpected end of JSON input" while parsing `""`.
 * `two-process-worker.ts` guards against that by `await`ing `main()` at
 * module scope inside a `try`/`catch` and awaiting the stdout write's
 * callback before exiting (see that file's module doc). This test also
 * asserts each child's exit code and non-empty stdout — with captured
 * stderr folded into the assertion message — *before* attempting to parse
 * anything as JSON, so a future failure here reports which worker failed
 * and why, instead of a bare JSON parse error.
 */
import { execFile } from 'node:child_process';
import { join } from 'node:path';
import { createTempDatabase, type TempDatabase } from '@llm-kit/test-utils';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createBetterSqliteStore } from '../src/storage/better-sqlite-store.js';
import { computeCacheKey } from '../src/identity/cache-key.js';

const WORKER_PATH = join(import.meta.dirname, 'fixtures', 'two-process-worker.ts');

interface WorkerOutcome {
  /** `0` on a clean exit; a non-zero process exit code; `-1` if the process could not even be spawned (see `error.code` being a string like `ENOENT` rather than a number). */
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
}

/**
 * Never rejects — always resolves with what actually happened, so the test
 * can assert on exit code and stdout content itself (with stderr available
 * for the failure message) rather than relying on `execFile`'s promisified
 * rejection shape, which does not distinguish "never started", "killed",
 * and "exited non-zero" as clearly as doing it explicitly here.
 */
function runWorker(dbPath: string, role: 'a' | 'b'): Promise<WorkerOutcome> {
  return new Promise((resolve) => {
    execFile(
      process.execPath,
      ['--import', 'tsx', WORKER_PATH, dbPath, role],
      { timeout: 30_000 },
      (error, stdout, stderr) => {
        const exitCode =
          error === null
            ? 0
            : typeof (error as NodeJS.ErrnoException).code === 'number'
              ? ((error as NodeJS.ErrnoException).code as unknown as number)
              : -1;
        resolve({ exitCode, stdout, stderr });
      },
    );
  });
}

/**
 * Both halves of the guarantee: a clean exit *and* a
 * non-empty result, checked before any `JSON.parse` runs. `stderr` rides
 * along in the assertion message so a real failure is diagnosable instead
 * of surfacing as "unexpected end of JSON input" three lines later.
 */
function assertWorkerSucceeded(outcome: WorkerOutcome, role: 'a' | 'b'): void {
  const context = `worker "${role}" exitCode=${String(outcome.exitCode)}\n--- stdout ---\n${outcome.stdout}\n--- stderr ---\n${outcome.stderr}`;
  expect(outcome.exitCode, context).toBe(0);
  expect(outcome.stdout.trim().length, context).toBeGreaterThan(0);
}

describe('two-process smoke test', () => {
  let db: TempDatabase;

  beforeEach(() => {
    db = createTempDatabase();
  });

  afterEach(() => {
    db.cleanup();
  });

  it('two concurrent processes writing overlapping keys never produce a duplicate row', async () => {
    const [resultA, resultB] = await Promise.all([
      runWorker(db.databasePath, 'a'),
      runWorker(db.databasePath, 'b'),
    ]);

    assertWorkerSucceeded(resultA, 'a');
    assertWorkerSucceeded(resultB, 'b');

    const parsedA = JSON.parse(resultA.stdout.trim()) as { role: string; report: unknown };
    const parsedB = JSON.parse(resultB.stdout.trim()) as { role: string; report: unknown };
    expect(parsedA.role).toBe('a');
    expect(parsedB.role).toBe('b');

    const store = createBetterSqliteStore({ path: db.databasePath });
    try {
      const namespace = 'default';
      const model = 'two-process-model';
      const sharedKey = computeCacheKey(namespace, model, 'shared-across-processes');
      const ownedAKey = computeCacheKey(namespace, model, 'owned-by-a');
      const ownedBKey = computeCacheKey(namespace, model, 'owned-by-b');

      const rows = store.getMany([sharedKey, ownedAKey, ownedBKey], Date.now());
      // Exactly one row per distinct key — no duplication despite both
      // processes racing to write the shared key.
      expect(rows).toHaveLength(3);
      const sharedRows = rows.filter((row) => row.cacheKey === sharedKey);
      expect(sharedRows).toHaveLength(1);
    } finally {
      store.close();
    }
  }, 35_000);
});
