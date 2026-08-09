/**
 * Bun import smoke test. Run with `bun run scripts/bun-smoke.ts`.
 *
 * Bun support is only claimed in a README when this script passes in CI.
 *
 * Pass `--include-native` to additionally exercise `vec-cache`, whose
 * `better-sqlite3` dependency is best-effort under Bun.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { PUBLIC_PACKAGES, publicPackageDir } from './lib/workspace.js';

const includeNative = process.argv.includes('--include-native');
const failures: string[] = [];

/**
 * Importing a module proves almost nothing for a package with a native
 * dependency: the addon is only dlopen'd when something actually constructs
 * the thing that uses it. `vec-cache` imports cleanly under Bun and then fails
 * with `ERR_DLOPEN_FAILED` the moment you build a `VectorCache`, so an
 * import-only check reports a green that would have become a false Bun-support
 * claim in the README.
 *
 * Each package therefore gets a smoke *exercise* that does real work. Keep
 * these tiny and dependency-free — they run under Bun, not vitest.
 */
const EXERCISES: Record<string, (api: Record<string, unknown>) => Promise<void> | void> = {
  'mend-json': (api) => {
    const mend = api.mendJson as (input: string) => { value?: unknown; complete: boolean };
    const result = mend('{"a":1,"b":"tru');
    if (result.complete) throw new Error('truncated input reported complete');
    if ((result.value as { a?: number } | undefined)?.a !== 1)
      throw new Error('partial value wrong');
  },
  'token-chunk': (api) => {
    const chunk = api.chunkText as (t: string, o: object) => readonly { tokenCount: number }[];
    const chunks = chunk('One sentence. Another sentence. A third one here.', { maxTokens: 8 });
    if (chunks.length === 0) throw new Error('no chunks produced');
    if (chunks.some((c) => c.tokenCount > 8)) throw new Error('chunk exceeded budget');
  },
  'chat-fit': (api) => {
    const fit = api.fitChat as (m: unknown[], o: object) => { messages: unknown[] };
    const out = fit(
      [
        { role: 'system', content: 'sys' },
        { role: 'user', content: 'hello there' },
      ],
      { maxTokens: 100 },
    );
    if (out.messages.length === 0) throw new Error('fitChat returned nothing');
  },
  'usage-tab': (api) => {
    const calc = api.calculateCost as (r: object) => { totalUsdExact: string };
    const out = calc({
      model: 'claude-opus-5',
      provider: 'anthropic',
      usage: { inputTokens: 1_000_000, outputTokens: 0 },
    });
    if (out.totalUsdExact !== '5.00') throw new Error(`unexpected total ${out.totalUsdExact}`);
  },
  'llm-backoff': async (api) => {
    const classify = api.classifyLlmError as (e: unknown) => { retryable: boolean };
    const http = (status: number): unknown =>
      Object.assign(new Error('x'), { status, headers: {} });
    if (!classify(http(429)).retryable) throw new Error('429 must be retryable');
    if (classify(http(400)).retryable) throw new Error('400 must not be retryable');
  },
  'vec-cache': async (api) => {
    // The whole point: construct the class so the native addon is loaded.
    const VectorCache = api.VectorCache as new (o: object) => {
      getOrCreate(
        t: readonly string[],
        o: object,
      ): Promise<{ embeddings: readonly (readonly number[])[] }>;
      close(): void;
    };
    const path = `${process.env.TMPDIR ?? '/tmp'}/vec-cache-bun-smoke-${String(Date.now())}.sqlite`;
    const cache = new VectorCache({ path });
    try {
      const { embeddings } = await cache.getOrCreate(['smoke'], {
        model: 'm',
        embed: async () => [[1, 2, 3]],
      });
      if (embeddings.length !== 1) throw new Error('wrong embedding count');
    } finally {
      cache.close();
    }
  },
};

for (const [name, rules] of Object.entries(PUBLIC_PACKAGES)) {
  const isNative = rules.runtime === 'node';
  if (isNative && !includeNative) continue;
  if (!isNative && includeNative) continue;

  const entry = join(publicPackageDir(name), 'dist', 'index.js');
  if (!existsSync(entry)) {
    failures.push(`${name}: dist/index.js missing — build first`);
    continue;
  }

  let api: Record<string, unknown>;
  try {
    api = await import(entry);
  } catch (error) {
    failures.push(`${name}: bun import failed: ${String(error)}`);
    continue;
  }

  const exported = Object.keys(api).filter((key) => key !== 'default');
  if (exported.length === 0) {
    failures.push(`${name}: imported under Bun but exported nothing`);
    continue;
  }

  const exercise = EXERCISES[name];
  if (exercise === undefined) {
    failures.push(
      `${name}: no Bun smoke exercise defined — import-only checks cannot support a compatibility claim`,
    );
    continue;
  }

  try {
    await exercise(api);
    console.log(`${name}: bun ok (${String(exported.length)} exports, exercise passed)`);
  } catch (error) {
    failures.push(`${name}: imported under Bun but failed when exercised: ${String(error)}`);
  }
}

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(`  FAIL  ${failure}`);
  }
  process.exit(1);
}

console.log('bun smoke: OK');
