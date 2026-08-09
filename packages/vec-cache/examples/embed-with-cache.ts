/**
 * Runnable example: the headline scenario — a batch of 1,000 texts where
 * 940 are already cached and 60 are new. `getOrCreate` looks every one of
 * them up independently, sends only the 60 unique misses to the (simulated)
 * embedding provider, and returns all 1,000 vectors in original order.
 *
 * Run with: pnpm exec tsx examples/embed-with-cache.ts
 *
 * A real consumer would `npm install vec-cache` and
 * `import { VectorCache } from 'vec-cache'`; this example imports from the
 * package source directly so it runs in this repository without a publish
 * step.
 */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { VectorCache } from '../src/index.js';
import type { EmbedBatchRequest, EmbeddingVector } from '../src/index.js';

/**
 * Stands in for a real provider call (e.g. OpenAI's `embeddings.create`).
 * Deterministic and offline so the example runs without an API key; a real
 * `embed` function would call the provider's batch endpoint instead.
 */
async function simulateProviderEmbed(request: EmbedBatchRequest): Promise<EmbeddingVector[]> {
  console.log(`  -> provider call: embedding ${String(request.texts.length)} unique text(s)`);
  return request.texts.map((text) => {
    const vector = new Float32Array(8);
    for (let i = 0; i < vector.length; i += 1) {
      vector[i] = ((text.length + i) % 23) / 23;
    }
    return vector;
  });
}

async function main(): Promise<void> {
  const dir = mkdtempSync(join(tmpdir(), 'vec-cache-example-'));
  const cache = new VectorCache({ path: join(dir, 'cache.sqlite') });

  try {
    // Warm the cache with 940 "already embedded on a previous run" texts —
    // in a real application these would already be sitting in the SQLite
    // file from yesterday's batch job. setMany writes without calling embed.
    const cachedTexts = Array.from({ length: 940 }, (_, i) => `document chunk #${String(i)}`);
    cache.setMany(
      cachedTexts.map((text) => ({
        text,
        model: 'text-embedding-3-small',
        embedding: new Float32Array(8).fill(0.5),
      })),
    );

    // Today's batch: the same 940 chunks plus 60 genuinely new ones,
    // interleaved in whatever order the caller happens to have them in.
    const freshTexts = Array.from({ length: 60 }, (_, i) => `new document chunk #${String(i)}`);
    const texts = [
      ...cachedTexts.slice(0, 470),
      ...freshTexts.slice(0, 30),
      ...cachedTexts.slice(470),
      ...freshTexts.slice(30),
    ];

    console.log(`Requesting embeddings for ${String(texts.length)} texts...`);
    const result = await cache.getOrCreate(texts, {
      model: 'text-embedding-3-small',
      embed: simulateProviderEmbed,
    });

    console.log('\nReport:');
    console.log(`  total:        ${String(result.report.totalCount)}`);
    console.log(`  cache hits:   ${String(result.report.hitCount)}`);
    console.log(
      `  cache misses: ${String(result.report.missCount)} (${String(result.report.uniqueMissCount)} unique)`,
    );
    console.log(
      `  embed calls:  ${String(result.report.embedCallCount)} (one call, however many unique misses)`,
    );

    console.log(
      `\nembeddings[0].length = ${String(result.embeddings[0]?.length)} — same order as the input texts`,
    );

    // Run it again: this time it's a full hit, and embed is never called.
    let calledAgain = false;
    await cache.getOrCreate(texts, {
      model: 'text-embedding-3-small',
      embed: async (request) => {
        calledAgain = true;
        return simulateProviderEmbed(request);
      },
    });
    console.log(
      `\nSecond call with the same texts: embed called again? ${String(calledAgain)} (expected: false)`,
    );

    console.log('\nStats:', cache.stats());
  } finally {
    cache.close();
    rmSync(dir, { recursive: true, force: true });
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
