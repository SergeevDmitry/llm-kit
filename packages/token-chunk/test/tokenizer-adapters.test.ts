import { describe, expect, it } from 'vitest';
import type { Tokenizer } from '../src/index.js';
import { APPROX_TOKENIZER_ID, chunkMarkdown, chunkText } from '../src/index.js';

/** A tokenizer with only `count` — exercises the "encode/decode are optional" contract clause. */
const countOnlyTokenizer: Tokenizer = {
  id: 'count-only-test',
  count: (text) => Math.max(1, Math.ceil(text.length / 4)),
};

/** A word-id encoder whose `decode` faithfully round-trips (space-joined words). */
function makeRoundTrippingTokenizer(): Tokenizer {
  const vocabulary = new Map<string, number>();
  const reverse = new Map<number, string>();
  const idFor = (word: string): number => {
    let id = vocabulary.get(word);
    if (id === undefined) {
      id = vocabulary.size;
      vocabulary.set(word, id);
      reverse.set(id, word);
    }
    return id;
  };
  return {
    id: 'word-id-roundtrip-test',
    count: (text) => (text.length === 0 ? 0 : text.split(/\s+/).filter(Boolean).length),
    encode: (text) => text.split(/\s+/).filter(Boolean).map(idFor),
    decode: (tokens) => tokens.map((t) => reverse.get(t) ?? '').join(' '),
  };
}

/** A lossy encoder: decode does NOT round-trip (always returns a placeholder). */
const lossyTokenizer: Tokenizer = {
  id: 'lossy-test',
  count: (text) => Math.max(1, Math.ceil(text.length / 3)),
  encode: (text) => Array.from(text, (ch) => ch.codePointAt(0) ?? 0),
  decode: () => '�'.repeat(3), // deliberately wrong — never equals the original input
};

describe('tokenizer contract: encode/decode are optional', () => {
  it('works end to end with a count-only tokenizer (approx-tokenizer shape)', () => {
    const chunks = chunkText('one two three four five six seven eight nine ten', {
      maxTokens: 8,
      tokenizer: countOnlyTokenizer,
    });
    expect(chunks.length).toBeGreaterThan(0);
    for (const chunk of chunks) {
      expect(chunk.tokenCount).toBeLessThanOrEqual(8);
      expect(chunk.tokenCount).toBe(countOnlyTokenizer.count(chunk.text));
    }
  });

  it('degrades to word- and token-boundary splitting for an oversized unit without ever needing encode/decode', () => {
    const tokenizer: Tokenizer = {
      id: 'count-only-spy',
      count: (text) => Math.max(1, Math.ceil(text.length / 4)),
    };
    // Sanity: this tokenizer object truly has no encode/decode — the whole
    // point of the test is that chunking still works and stays in budget.
    expect(tokenizer.encode).toBeUndefined();
    expect(tokenizer.decode).toBeUndefined();

    const doc =
      '# Guide\n\n' +
      'a very long unbroken run of characters with no spaces at all here'.replaceAll(' ', '');
    const chunks = chunkMarkdown(doc, { maxTokens: 6, overlapTokens: 2, tokenizer });
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.tokenCount).toBeLessThanOrEqual(6);
    }
  });

  it('a round-tripping encoder works end to end and stays in budget', () => {
    const text = 'alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu';
    const roundTripping = makeRoundTrippingTokenizer();
    const chunks = chunkText(text, { maxTokens: 5, overlapTokens: 1, tokenizer: roundTripping });
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.tokenCount).toBeLessThanOrEqual(5);
    }
    // Sanity on the fixture itself: for single-space-separated words with no
    // leading/trailing whitespace, this particular encoder does round-trip.
    const sample = 'alpha beta gamma';
    expect(roundTripping.decode?.(roundTripping.encode?.(sample) ?? [])).toBe(sample);
  });

  it('a tokenizer whose decode does NOT round-trip is still safe: token-chunk never materializes chunk text from decode', () => {
    const text = 'The quick brown fox jumps over the lazy dog repeatedly for a while.';
    const chunks = chunkText(text, { maxTokens: 6, overlapTokens: 2, tokenizer: lossyTokenizer });
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      // Every chunk's text is still a literal, correct fragment of the
      // source — never the lossy placeholder decode() would produce.
      expect(chunk.text).not.toContain('�');
      expect(text.slice(chunk.source.charStart, chunk.source.charEnd)).toBe(chunk.text);
      expect(chunk.tokenCount).toBeLessThanOrEqual(6);
    }
  });

  it('every chunk carries the id of the tokenizer that produced its tokenCount, so it travels with the chunk', () => {
    // A chunk routinely outlives the call that made it (written to a vector
    // store, read back by code that never saw `chunkText` run) — "the
    // caller already knows" is only true at the call site, so the id rides
    // with the chunk itself. An approximate count must never be presented
    // as exact.
    const chunks = chunkText('hello world', { maxTokens: 10, tokenizer: countOnlyTokenizer });
    expect(chunks[0]?.tokenizerId).toBe('count-only-test');

    const defaultChunks = chunkText('hello world', { maxTokens: 10 });
    expect(defaultChunks[0]?.tokenizerId).toBe(APPROX_TOKENIZER_ID);
  });
});
