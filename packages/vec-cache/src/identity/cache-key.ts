/**
 * Cache identity — never mixed across model ids or namespaces:
 * `schema-version + namespace + model-id + exact text bytes + requested
 * dimensions`, SHA-256 via `node:crypto`. Text is never normalized — see the
 * module doc on `lengthPrefixed` for why naive concatenation is unsafe. Trimming or
 * Unicode-normalizing the text here would also be wrong even if it were safe
 * to concatenate: normalization changes the embedding, so it must never be
 * silently applied behind a caller's back.
 *
 * `dimensions` is a fifth, optional component. Several current
 * embedding providers accept a requested output width that the model id
 * alone does not capture — OpenAI's `dimensions` on `text-embedding-3-*`,
 * Gemini's `outputDimensionality`, Matryoshka-truncated open models — so two
 * calls with the same `model` but a different requested width are, in
 * effect, two different embedding functions. Folding it into identity means
 * a caller who *does* pass `dimensions` gets automatic separation the same
 * way a different `model` string already would; a caller who never passes
 * it keeps exactly today's keys (see `dimensionsComponent` below for why
 * "never passed" cannot collide with any specific passed value). This is
 * independent of, and does not replace, `plan-batch.ts`'s defensive
 * same-batch dimension check for callers who don't use this parameter.
 */
import { createHash } from 'node:crypto';
import { CACHE_SCHEMA_VERSION } from '../storage/schema.js';

/**
 * Length-prefixes `value` (4-byte big-endian UTF-8 byte count + the bytes)
 * before it goes into the hash. Plain concatenation would be ambiguous the
 * instant any component could contain the delimiter — and `text` can
 * contain anything, including the exact bytes another component would use
 * as a separator. Length-prefixing makes the four-part identity injective:
 * namespace `"a"` + model `"bc"` cannot collide with namespace `"ab"` +
 * model `"c"` for any text.
 */
function lengthPrefixed(value: string): Buffer {
  const bytes = Buffer.from(value, 'utf8');
  const prefix = Buffer.alloc(4);
  prefix.writeUInt32BE(bytes.length, 0);
  return Buffer.concat([prefix, bytes]);
}

/**
 * Encodes the optional fifth `dimensions` component. Absent and present
 * encodings are made injective by a leading one-byte tag rather than by any
 * property of the number itself: absent is exactly the single byte `0x00`;
 * present is `0x01` followed by `dimensions` length-prefixed as text (same
 * `lengthPrefixed` helper as every other component). `0x00`
 * can never be produced by the present branch, which always starts with
 * `0x01`, so no present value — however it stringifies — can ever collide
 * with "absent", and this holds independent of whatever `String(dimensions)`
 * happens to produce for a given number.
 */
function dimensionsComponent(dimensions: number | undefined): Buffer {
  if (dimensions === undefined) {
    return Buffer.from([0x00]);
  }
  return Buffer.concat([Buffer.from([0x01]), lengthPrefixed(String(dimensions))]);
}

/**
 * Computes the cache key for one (namespace, model, text) triple, optionally
 * scoped to a requested output `dimensions`. Omitting `dimensions` reproduces
 * the same key as if it were never a component at all.
 */
export function computeCacheKey(
  namespace: string,
  modelId: string,
  text: string,
  dimensions?: number,
): string {
  const hash = createHash('sha256');
  hash.update(lengthPrefixed(String(CACHE_SCHEMA_VERSION)));
  hash.update(lengthPrefixed(namespace));
  hash.update(lengthPrefixed(modelId));
  hash.update(lengthPrefixed(text));
  hash.update(dimensionsComponent(dimensions));
  return hash.digest('hex');
}

/** Computes cache keys for a whole batch, preserving input order (one key per input position, duplicates included). */
export function computeCacheKeys(
  texts: readonly string[],
  namespace: string,
  modelId: string,
  dimensions?: number,
): string[] {
  return texts.map((text) => computeCacheKey(namespace, modelId, text, dimensions));
}
