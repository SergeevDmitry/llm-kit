/**
 * Throughput baseline for `vec-cache` (`vitest bench`), covering every
 * scenario the package brief calls out explicitly: cold miss, full hit, the
 * headline 94%-hit batch ("1,000 texts, 940 cached, 60 sent"),
 * duplicate-heavy batches, and a 100k-row database.
 *
 * Not a correctness check — `test/` owns that. This tracks whether the
 * batch planner stays a small, bounded number of chunked SQL round trips
 * regardless of batch size, with no N+1 queries: the 100k-row scenarios in
 * particular would visibly regress from roughly flat to
 * roughly linear-in-database-size if a future change replaced the chunked
 * `IN (...)` lookup with a per-row query.
 *
 * Each `embed` here is a cheap synthetic function — this benchmark measures
 * `vec-cache`'s own overhead (key computation, planning, encode/decode,
 * SQLite I/O), not a real embedding provider's network latency.
 */
import { bench, describe } from 'vitest';
import { createTempDatabase } from '@llm-kit/test-utils';
import { VectorCache } from '../src/index.js';

function syntheticVector(text: string, dimensions = 1536): Float32Array {
  const vector = new Float32Array(dimensions);
  for (let i = 0; i < dimensions; i += 1) {
    vector[i] = ((text.length + i) % 97) / 97;
  }
  return vector;
}

async function syntheticEmbed(request: { texts: readonly string[] }): Promise<Float32Array[]> {
  return request.texts.map((text) => syntheticVector(text));
}

describe('vec-cache — cold miss', () => {
  const db = createTempDatabase('bench-cold-miss.sqlite');
  const cache = new VectorCache({ path: db.databasePath });
  let counter = 0;

  bench('getOrCreate: 100 never-before-seen texts', async () => {
    counter += 1;
    const texts = Array.from(
      { length: 100 },
      (_, i) => `bench-cold-${String(counter)}-${String(i)}`,
    );
    await cache.getOrCreate(texts, { model: 'bench-model', embed: syntheticEmbed });
  });
});

describe('vec-cache — full hit', () => {
  const db = createTempDatabase('bench-full-hit.sqlite');
  const cache = new VectorCache({ path: db.databasePath });
  const texts = Array.from({ length: 100 }, (_, i) => `bench-hit-${String(i)}`);
  cache.setMany(
    texts.map((text) => ({ text, model: 'bench-model', embedding: syntheticVector(text) })),
  );

  bench('getOrCreate: 100 already-cached texts (embed never called)', async () => {
    await cache.getOrCreate(texts, { model: 'bench-model', embed: syntheticEmbed });
  });
});

describe('vec-cache — 94% hit (the headline scenario: 1,000 texts, 940 cached, 60 sent)', () => {
  const db = createTempDatabase('bench-94-hit.sqlite');
  const cache = new VectorCache({ path: db.databasePath });
  const cachedTexts = Array.from({ length: 940 }, (_, i) => `bench-94-cached-${String(i)}`);
  cache.setMany(
    cachedTexts.map((text) => ({ text, model: 'bench-model', embedding: syntheticVector(text) })),
  );
  let counter = 0;

  bench('getOrCreate: 940 cached + 60 fresh, in original order', async () => {
    counter += 1;
    const freshTexts = Array.from(
      { length: 60 },
      (_, i) => `bench-94-fresh-${String(counter)}-${String(i)}`,
    );
    const texts = [...cachedTexts, ...freshTexts];
    await cache.getOrCreate(texts, { model: 'bench-model', embed: syntheticEmbed });
  });
});

describe('vec-cache — duplicate-heavy batch', () => {
  const db = createTempDatabase('bench-dedup.sqlite');
  const cache = new VectorCache({ path: db.databasePath });
  const uniqueTexts = Array.from({ length: 50 }, (_, i) => `bench-dup-${String(i)}`);
  // 1,000 positions built from only 50 unique texts — dedup does the heavy
  // lifting here, not embedding volume.
  const texts = Array.from(
    { length: 1000 },
    (_, i) => uniqueTexts[i % uniqueTexts.length] as string,
  );

  bench('getOrCreate: 1,000 positions, 50 unique texts', async () => {
    await cache.getOrCreate(texts, { model: 'bench-model', embed: syntheticEmbed });
  });
});

describe('vec-cache — 100k rows', () => {
  const db = createTempDatabase('bench-100k.sqlite');
  const cache = new VectorCache({ path: db.databasePath });
  const ROW_COUNT = 100_000;
  const allTexts = Array.from({ length: ROW_COUNT }, (_, i) => `bench-100k-${String(i)}`);
  // Seed in chunks so a single setMany call doesn't dominate module setup time.
  const SEED_CHUNK = 5_000;
  for (let start = 0; start < allTexts.length; start += SEED_CHUNK) {
    const chunk = allTexts.slice(start, start + SEED_CHUNK);
    cache.setMany(
      chunk.map((text) => ({ text, model: 'bench-model', embedding: syntheticVector(text, 128) })),
    );
  }

  const sampleKeys = Array.from(
    { length: 1000 },
    (_, i) => allTexts[(i * 97) % ROW_COUNT] as string,
  );

  bench('getMany: 1,000-key lookup against a 100,000-row database', () => {
    cache.getMany(sampleKeys, { model: 'bench-model' });
  });

  bench('stats() over a 100,000-row database', () => {
    cache.stats();
  });
});
