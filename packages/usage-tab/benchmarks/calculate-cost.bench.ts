/**
 * Throughput baseline (`vitest bench`), not a correctness check — the test
 * suite owns that. Three scenarios: a single calculation, a 100k-line
 * aggregate, and a bare registry lookup.
 */
import { bench, describe } from 'vitest';
import { calculateCost } from '../src/calculate-cost.js';
import { resolveModel } from '../src/resolve-model.js';

describe('calculateCost — single calculation', () => {
  bench('input/output only (openai:gpt-5)', () => {
    calculateCost({
      model: 'gpt-5',
      provider: 'openai',
      usage: { inputTokens: 1000, outputTokens: 500 },
      at: '2026-08-05',
    });
  });

  bench('input/output/cached/cacheWrite (anthropic:claude-sonnet-5)', () => {
    calculateCost({
      model: 'claude-sonnet-5',
      provider: 'anthropic',
      usage: {
        inputTokens: 10_000,
        outputTokens: 2_000,
        cachedInputTokens: 2_000,
        cacheWriteTokens: 1_000,
      },
      at: '2026-08-05',
    });
  });

  bench('batch mode', () => {
    calculateCost({
      model: 'gpt-5',
      provider: 'openai',
      usage: { inputTokens: 1000, outputTokens: 500 },
      mode: 'batch',
      at: '2026-08-05',
    });
  });
});

describe('calculateCost — 100k-request aggregate', () => {
  bench('100,000 sequential calculations, summed', () => {
    let totalNano = 0n;
    for (let i = 0; i < 100_000; i += 1) {
      const result = calculateCost({
        model: 'gpt-5',
        provider: 'openai',
        usage: { inputTokens: 1000 + (i % 50), outputTokens: 500 + (i % 25) },
        at: '2026-08-05',
      });
      // Cheap way to force the exact string to actually be computed/used.
      totalNano += BigInt(result.totalUsdExact.replace('.', ''));
    }
    if (totalNano < 0n) throw new Error('unreachable — costs are never negative');
  });
});

describe('resolveModel — bare registry lookup', () => {
  bench('canonical id, provider-qualified', () => {
    resolveModel('gpt-5', { provider: 'openai' });
  });

  bench('alias, globally unambiguous', () => {
    resolveModel('claude-haiku-4-5', { provider: 'anthropic' });
  });
});
