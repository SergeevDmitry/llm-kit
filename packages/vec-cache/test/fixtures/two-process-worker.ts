/**
 * Worker for the two-process smoke test (`test/two-process-smoke.test.ts`).
 * Run as a real, separate OS process (spawned via `node --import tsx`) so
 * the concurrency being exercised is genuine cross-process SQLite locking,
 * not two connections sharing one Node event loop.
 *
 * Usage: `node --import tsx two-process-worker.ts <dbPath> <role>`
 * `role` is `"a"` or `"b"`; each writes a disjoint text plus one shared
 * text through `getOrCreate`, then prints a JSON result line to stdout.
 *
 * Hardening: `main()` is `await`ed at module scope inside a `try`/`catch`
 * that sets a non-zero `process.exitCode` on failure — calling it without a
 * top-level `await` risks a rejection racing process teardown and exiting
 * the worker before its `.catch` handler runs. `writeLine` below returns a
 * promise that resolves only once `process.stdout.write`'s callback fires —
 * i.e. once the write has actually been accepted by the OS, not merely
 * buffered — so the process never reaches its natural exit with the result
 * line still in flight. `process.stdout` to a pipe is asynchronous on POSIX
 * platforms, so a fire-and-forget `write()` racing exit could otherwise
 * produce a worker that exits 0 with empty stdout.
 */
import { VectorCache } from '../../src/index.js';

function writeLine(line: string): Promise<void> {
  return new Promise((resolve, reject) => {
    process.stdout.write(line, (error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

async function main(): Promise<void> {
  const [, , dbPath, role] = process.argv;
  if (dbPath === undefined || role === undefined) {
    throw new Error('usage: two-process-worker.ts <dbPath> <role>');
  }

  const cache = new VectorCache({ path: dbPath, busyTimeoutMs: 10_000 });
  try {
    const ownText = `owned-by-${role}`;
    const texts = [ownText, 'shared-across-processes'];

    const result = await cache.getOrCreate(texts, {
      model: 'two-process-model',
      embed: (request) =>
        Promise.resolve(
          request.texts.map((text) => new Float32Array([text.length, role.charCodeAt(0)])),
        ),
    });

    await writeLine(
      `${JSON.stringify({
        role,
        report: result.report,
        embeddings: result.embeddings.map((vector) => Array.from(vector)),
      })}\n`,
    );
  } finally {
    cache.close();
  }
}

try {
  await main();
} catch (error: unknown) {
  console.error(error);
  process.exitCode = 1;
}
