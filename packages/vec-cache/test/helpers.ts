/**
 * Shared test fixtures: a deterministic fake embedder (so assertions can
 * check exact vector identity instead of "some vector"), and a call-counting
 * wrapper used across the invariant tests (full-hit never calls back,
 * dedup calls back once per unique miss, single-flight calls back once for
 * concurrent requests).
 */
import type { EmbedBatch, EmbedBatchRequest, EmbeddingVector } from '../src/index.js';

/** A small, cheap, fully deterministic hash-based vector for a given text. Never the same for two different texts (collision-negligible for test corpora). */
export function deterministicVector(text: string, dimensions = 4): Float32Array {
  const vector = new Float32Array(dimensions);
  for (let dim = 0; dim < dimensions; dim += 1) {
    let hash = 0x811c9dc5 ^ dim;
    for (let index = 0; index < text.length; index += 1) {
      hash = Math.imul(hash ^ text.charCodeAt(index), 0x01000193);
    }
    vector[dim] = ((hash >>> 0) % 100_000) / 100_000;
  }
  return vector;
}

export function toPlainArray(vector: EmbeddingVector): number[] {
  return Array.from(vector);
}

export interface CountingEmbed {
  readonly embed: EmbedBatch;
  readonly calls: EmbedBatchRequest[];
  callCount(): number;
  /** Every text ever passed to `embed`, flattened across all calls, in call order. */
  allTexts(): string[];
}

export function createCountingEmbed(dimensions = 4): CountingEmbed {
  const calls: EmbedBatchRequest[] = [];
  const embed: EmbedBatch = (request) => {
    calls.push(request);
    return Promise.resolve(request.texts.map((text) => deterministicVector(text, dimensions)));
  };
  return {
    embed,
    calls,
    callCount: () => calls.length,
    allTexts: () => calls.flatMap((call) => [...call.texts]),
  };
}

/** An `embed` that never resolves until the returned `release` function is called — for single-flight/close-during-active-operation tests. */
export function createControlledEmbed(dimensions = 4): {
  embed: EmbedBatch;
  callCount: () => number;
  release: () => void;
} {
  let calls = 0;
  let releaseFns: (() => void)[] = [];
  const embed: EmbedBatch = (request) =>
    new Promise((resolve) => {
      calls += 1;
      releaseFns.push(() => {
        resolve(request.texts.map((text) => deterministicVector(text, dimensions)));
      });
    });
  return {
    embed,
    callCount: () => calls,
    release: () => {
      const fns = releaseFns;
      releaseFns = [];
      for (const fn of fns) fn();
    },
  };
}
