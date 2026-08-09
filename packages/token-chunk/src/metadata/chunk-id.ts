/**
 * Deterministic chunk identifiers. "Stable" means: the same input, options,
 * and tokenizer id always produce the same id for the same chunk — not that
 * the id is globally unique across unrelated calls. Zero dependencies, so a
 * plain FNV-1a hash over the fields that define a chunk's identity.
 */
function fnv1a(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function createChunkId(fields: {
  readonly index: number;
  readonly charStart: number;
  readonly charEnd: number;
  readonly tokenizerId: string;
}): string {
  const digest = fnv1a(
    `${String(fields.charStart)}:${String(fields.charEnd)}:${fields.tokenizerId}`,
  );
  return `chunk-${String(fields.index)}-${digest}`;
}
