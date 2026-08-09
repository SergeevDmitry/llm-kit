/**
 * Property tests for the headline invariant: output index `i`
 * always corresponds to input index `i`, regardless of hits, misses,
 * duplicates or ordering. Seeded so a CI failure reproduces exactly from the
 * printed seed.
 */
import { createSeededRandom, createTempDatabase } from '@llm-kit/test-utils';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { restoreOrder } from '../src/batch/restore-order.js';
import { VectorCache } from '../src/index.js';
import { deterministicVector } from './helpers.js';

const FAST_CHECK_SEED = 0x76636163; // 'vcac'

describe('property: restoreOrder places every output at its designated source position', () => {
  it('holds for arbitrary key sequences and arbitrary hit/miss assignment, with duplicates', () => {
    const candidateKeys = ['k1', 'k2', 'k3', 'k4', 'k5'] as const;
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom(...candidateKeys), { minLength: 1, maxLength: 60 }),
        fc.array(fc.boolean(), {
          minLength: candidateKeys.length,
          maxLength: candidateKeys.length,
        }),
        (keys, hitFlags) => {
          const hitVectors = new Map<string, Float32Array>();
          const missVectors = new Map<string, Float32Array>();
          candidateKeys.forEach((key, index) => {
            const vector = new Float32Array([index, index * 2, index * 3]);
            if (hitFlags[index] === true) hitVectors.set(key, vector);
            else missVectors.set(key, vector);
          });

          const result = restoreOrder(keys, hitVectors, missVectors);
          expect(result).toHaveLength(keys.length);
          keys.forEach((key, index) => {
            const expected = hitVectors.get(key) ?? missVectors.get(key);
            expect(Array.from(result[index] as Float32Array)).toEqual(
              Array.from(expected as Float32Array),
            );
          });
        },
      ),
      { seed: FAST_CHECK_SEED, numRuns: 500 },
    );
  });
});

describe('property: VectorCache.getOrCreate reconstructs exact original order end-to-end', () => {
  it('holds for random text batches with duplicates and a random pre-seeded hit ratio', async () => {
    const textPool = [
      'alpha',
      'beta',
      'gamma',
      'delta text with spaces',
      'δ greek',
      '大型语言模型',
      'line\nbreak',
      'trailing space ',
      '',
      'emoji 🚀 text',
    ];

    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.constantFrom(...textPool), { minLength: 0, maxLength: 25 }),
        fc.integer({ min: 0, max: 0xffffffff }),
        async (texts, hitRatioSeed) => {
          const db = createTempDatabase();
          try {
            const cache = new VectorCache({ path: db.databasePath });
            const random = createSeededRandom(hitRatioSeed);

            const uniqueTexts = [...new Set(texts)];
            const preseeded = uniqueTexts.filter(() => random.next() < 0.5);
            if (preseeded.length > 0) {
              cache.setMany(
                preseeded.map((text) => ({
                  text,
                  model: 'property-model',
                  embedding: deterministicVector(text),
                })),
              );
            }

            const result = await cache.getOrCreate(texts, {
              model: 'property-model',
              embed: (request) =>
                Promise.resolve(request.texts.map((text) => deterministicVector(text))),
            });

            expect(result.embeddings).toHaveLength(texts.length);
            texts.forEach((text, index) => {
              expect(Array.from(result.embeddings[index] as Float32Array)).toEqual(
                Array.from(deterministicVector(text)),
              );
            });
            expect(result.report.totalCount).toBe(texts.length);
            expect(result.report.hitCount + result.report.missCount).toBe(texts.length);

            cache.close();
          } finally {
            db.cleanup();
          }
        },
      ),
      { seed: FAST_CHECK_SEED, numRuns: 40 },
    );
  });
});
