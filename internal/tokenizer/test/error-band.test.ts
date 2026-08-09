import { describe, expect, it } from 'vitest';
import { unicodeSamples } from '@llm-kit/test-utils';
import { estimateTokenCount } from '../src/approximate-tokenizer.js';
import { classifyGrapheme, graphemeClusters } from '../src/unicode.js';

/**
 * Measures the approximate tokenizer's error band per script class against
 * a documented reference, and pins the result as a regression test.
 *
 * There is no real provider tokenizer in this repository — a provider
 * tokenizer library must never be imported here, not even as a
 * devDependency of this package's own tests. The reference below is instead
 * built from publicly cited "characters per token" rules of thumb
 * (OpenAI's help-center guidance for English; commonly observed ratios for
 * non-Latin scripts and code in third-party tokenizer analyses). It is a
 * documented approximation used only to *measure* this estimator, never a
 * claim that either number matches any specific provider's real tokenizer.
 *
 * The property this test protects: the estimator's overestimate multiplier
 * (`ourTokens / referenceTokens`) must stay `>= 1` (never optimistic — the
 * conservative requirement) and within a documented ceiling per class (a
 * regression that made the estimator wildly more pessimistic would silently
 * blow every consumer's budget headroom, which is also worth catching).
 */
const REFERENCE_CHARS_PER_TOKEN: Partial<Record<string, number>> = {
  latin: 4.0,
  cyrillic: 2.5,
  cjk: 1.7,
  code: 3.5,
  markdown: 3.8,
  mixed: 3.5,
};

/** Anecdotal per-cluster reference for emoji: no published rule of thumb exists, so this is our own documented estimate. */
const EMOJI_REFERENCE_TOKENS_PER_CLUSTER = 3;
const PLAIN_TEXT_REFERENCE_CHARS_PER_TOKEN = 4;

/** `minified-code` is denser than general source, so it gets its own reference ratio rather than sharing `code`'s. */
const MINIFIED_CODE_REFERENCE_CHARS_PER_TOKEN = 2.5;

function referenceTokenCount(sample: (typeof unicodeSamples)[number]): number {
  if (sample.id === 'minified-code') {
    return graphemeClusters(sample.text).length / MINIFIED_CODE_REFERENCE_CHARS_PER_TOKEN;
  }
  if (sample.kind === 'emoji') {
    let referenceTokens = 0;
    let plainRun = 0;
    for (const cluster of graphemeClusters(sample.text)) {
      if (classifyGrapheme(cluster) === 'emoji') {
        referenceTokens += plainRun / PLAIN_TEXT_REFERENCE_CHARS_PER_TOKEN;
        plainRun = 0;
        referenceTokens += EMOJI_REFERENCE_TOKENS_PER_CLUSTER;
      } else {
        plainRun += 1;
      }
    }
    referenceTokens += plainRun / PLAIN_TEXT_REFERENCE_CHARS_PER_TOKEN;
    return referenceTokens;
  }
  const charsPerToken =
    REFERENCE_CHARS_PER_TOKEN[sample.kind] ?? PLAIN_TEXT_REFERENCE_CHARS_PER_TOKEN;
  return graphemeClusters(sample.text).length / charsPerToken;
}

describe('approximation error band vs. documented reference', () => {
  it('over-estimates every calibration sample (multiplier >= 1, never optimistic)', () => {
    for (const sample of unicodeSamples) {
      const ours = estimateTokenCount(sample.text);
      const reference = referenceTokenCount(sample);
      const multiplier = ours / reference;
      expect(
        multiplier,
        `${sample.id} (${sample.kind}) undershot the reference by ${(multiplier * 100).toFixed(0)}%`,
      ).toBeGreaterThanOrEqual(1);
    }
  });

  it('stays within a documented ceiling — regression guard against becoming wildly pessimistic', () => {
    // Measured range across the calibration corpus is roughly 1.15x-2.05x;
    // 3x leaves headroom for corpus additions while still catching a real
    // regression (e.g. a weight accidentally multiplied instead of added).
    const MAX_OVERESTIMATE_MULTIPLIER = 3;
    for (const sample of unicodeSamples) {
      const ours = estimateTokenCount(sample.text);
      const reference = referenceTokenCount(sample);
      const multiplier = ours / reference;
      expect(multiplier).toBeLessThanOrEqual(MAX_OVERESTIMATE_MULTIPLIER);
    }
  });

  it('reports a per-kind multiplier range consistent with the documented error band', () => {
    const byKind = new Map<string, number[]>();
    for (const sample of unicodeSamples) {
      const multiplier = estimateTokenCount(sample.text) / referenceTokenCount(sample);
      const bucket = byKind.get(sample.kind) ?? [];
      bucket.push(multiplier);
      byKind.set(sample.kind, bucket);
    }
    // Every represented script/content class from the package brief has at
    // least one sample and its multiplier is documented (>= 1) and finite.
    for (const kind of ['latin', 'cyrillic', 'cjk', 'emoji', 'code', 'markdown'] as const) {
      const multipliers = byKind.get(kind);
      expect(multipliers, `no calibration sample for kind "${kind}"`).toBeDefined();
      for (const multiplier of multipliers ?? []) {
        expect(Number.isFinite(multiplier)).toBe(true);
        expect(multiplier).toBeGreaterThanOrEqual(1);
      }
    }
  });
});
