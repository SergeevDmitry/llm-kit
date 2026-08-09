/**
 * Cache identity (schema-version + namespace + model id + exact text bytes +
 * requested dimensions) and the rule that text is never normalized.
 */
import { createHash } from 'node:crypto';
import { unicodeSamples } from '@llm-kit/test-utils';
import { describe, expect, it } from 'vitest';
import { computeCacheKey, computeCacheKeys } from '../src/identity/cache-key.js';
import { hashText } from '../src/identity/hash-text.js';
import { CACHE_SCHEMA_VERSION } from '../src/storage/schema.js';

describe('computeCacheKey', () => {
  it('is deterministic for identical inputs', () => {
    expect(computeCacheKey('ns', 'model-a', 'hello world')).toBe(
      computeCacheKey('ns', 'model-a', 'hello world'),
    );
  });

  it('is a 64-character lowercase hex SHA-256 digest', () => {
    const key = computeCacheKey('ns', 'model-a', 'hello world');
    expect(key).toMatch(/^[0-9a-f]{64}$/);
  });

  it('changes when the model id changes — never mix embeddings across models', () => {
    expect(computeCacheKey('ns', 'model-a', 'text')).not.toBe(
      computeCacheKey('ns', 'model-b', 'text'),
    );
  });

  it('changes when the namespace changes — never mix embeddings across namespaces', () => {
    expect(computeCacheKey('ns-a', 'model', 'text')).not.toBe(
      computeCacheKey('ns-b', 'model', 'text'),
    );
  });

  it('changes when the text changes', () => {
    expect(computeCacheKey('ns', 'model', 'text-a')).not.toBe(
      computeCacheKey('ns', 'model', 'text-b'),
    );
  });

  it('never normalizes text: "a", "a " and "a\\n" are three distinct keys', () => {
    const keys = new Set([
      computeCacheKey('ns', 'model', 'a'),
      computeCacheKey('ns', 'model', 'a '),
      computeCacheKey('ns', 'model', 'a\n'),
      computeCacheKey('ns', 'model', ' a'),
      computeCacheKey('ns', 'model', 'a\r\n'),
    ]);
    expect(keys.size).toBe(5);
  });

  it('does not normalize Unicode: NFC and NFD forms of the same visual text are distinct keys', () => {
    // "café" as a precomposed é (U+00E9) vs. "e" + combining acute (U+0065 U+0301).
    const precomposed = 'café';
    const decomposed = 'café';
    expect(precomposed).not.toBe(decomposed); // sanity: genuinely different code units
    expect(computeCacheKey('ns', 'model', precomposed)).not.toBe(
      computeCacheKey('ns', 'model', decomposed),
    );
  });

  it('does not collide across a namespace/model boundary shift (length-prefixing prevents concatenation ambiguity)', () => {
    // namespace "a" + model "bc" must not collide with namespace "ab" + model "c",
    // for the same text — a delimiter-based concatenation could alias these.
    expect(computeCacheKey('a', 'bc', 'text')).not.toBe(computeCacheKey('ab', 'c', 'text'));
  });

  it('folds in CACHE_SCHEMA_VERSION so a schema bump would change every key', () => {
    // Reproduces the key computation independently (length-prefixed
    // concatenation, SHA-256) to pin the exact identity formula rather than
    // just asserting internal consistency.
    const namespace = 'ns';
    const modelId = 'model';
    const text = 'hello';
    const expected = createHash('sha256');
    for (const part of [String(CACHE_SCHEMA_VERSION), namespace, modelId, text]) {
      const bytes = Buffer.from(part, 'utf8');
      const prefix = Buffer.alloc(4);
      prefix.writeUInt32BE(bytes.length, 0);
      expected.update(prefix);
      expected.update(bytes);
    }
    expected.update(Buffer.from([0x00])); // absent `dimensions` component
    expect(computeCacheKey(namespace, modelId, text)).toBe(expected.digest('hex'));
  });

  describe('dimensions component', () => {
    it('omitting dimensions reproduces exactly the same key as when dimensions is unset (backward compatible)', () => {
      expect(computeCacheKey('ns', 'model', 'text')).toBe(
        computeCacheKey('ns', 'model', 'text', undefined),
      );
    });

    it('changes the key when dimensions is set — never mix embeddings across requested widths', () => {
      expect(computeCacheKey('ns', 'model', 'text', 1536)).not.toBe(
        computeCacheKey('ns', 'model', 'text', 512),
      );
    });

    it('an explicit dimensions value never collides with the absent case', () => {
      const withoutDimensions = computeCacheKey('ns', 'model', 'text');
      const keys = new Set([withoutDimensions]);
      // A spread of plausible dimension values, including ones whose
      // string form could plausibly interact with a naive absent-encoding
      // (e.g. an empty string sentinel would be unsafe here).
      for (const dims of [0, 1, 8, 512, 768, 1536, 3072, 999_999]) {
        keys.add(computeCacheKey('ns', 'model', 'text', dims));
      }
      expect(keys.size).toBe(9); // 1 absent + 8 distinct present values
    });

    it('reproduces the exact fifth-component byte encoding independently', () => {
      const namespace = 'ns';
      const modelId = 'model';
      const text = 'hello';
      const dimensions = 512;
      const expected = createHash('sha256');
      for (const part of [String(CACHE_SCHEMA_VERSION), namespace, modelId, text]) {
        const bytes = Buffer.from(part, 'utf8');
        const prefix = Buffer.alloc(4);
        prefix.writeUInt32BE(bytes.length, 0);
        expected.update(prefix);
        expected.update(bytes);
      }
      const dimBytes = Buffer.from(String(dimensions), 'utf8');
      const dimPrefix = Buffer.alloc(4);
      dimPrefix.writeUInt32BE(dimBytes.length, 0);
      expected.update(Buffer.from([0x01]));
      expected.update(dimPrefix);
      expected.update(dimBytes);
      expect(computeCacheKey(namespace, modelId, text, dimensions)).toBe(expected.digest('hex'));
    });
  });
});

describe('computeCacheKeys', () => {
  it('preserves input order and length, including duplicates', () => {
    const texts = ['a', 'b', 'a', 'c', 'b'];
    const keys = computeCacheKeys(texts, 'ns', 'model');
    expect(keys).toHaveLength(5);
    expect(keys[0]).toBe(keys[2]); // both "a"
    expect(keys[1]).toBe(keys[4]); // both "b"
    expect(keys[0]).not.toBe(keys[1]);
    expect(keys[0]).not.toBe(keys[3]);
  });

  it('matches computeCacheKey called individually', () => {
    const texts = ['x', 'y', 'z'];
    const keys = computeCacheKeys(texts, 'ns', 'model');
    expect(keys).toEqual(texts.map((text) => computeCacheKey('ns', 'model', text)));
  });

  it('threads an explicit dimensions value through to every computed key', () => {
    const texts = ['x', 'y'];
    const keys = computeCacheKeys(texts, 'ns', 'model', 512);
    expect(keys).toEqual(texts.map((text) => computeCacheKey('ns', 'model', text, 512)));
    expect(keys).not.toEqual(computeCacheKeys(texts, 'ns', 'model'));
  });
});

describe('hashText', () => {
  it('matches a plain SHA-256 of the UTF-8 bytes', () => {
    expect(hashText('hello')).toBe(createHash('sha256').update('hello', 'utf8').digest('hex'));
  });

  it('is independent of namespace/model — only reflects exact text bytes', () => {
    expect(hashText('same text')).toBe(hashText('same text'));
  });

  it('handles the full multilingual sample corpus without throwing and without collisions', () => {
    const hashes = new Set(unicodeSamples.map((sample) => hashText(sample.text)));
    expect(hashes.size).toBe(unicodeSamples.length);
  });
});
