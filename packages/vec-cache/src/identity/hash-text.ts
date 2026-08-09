import { createHash } from 'node:crypto';

/**
 * SHA-256 of the exact text bytes (UTF-8), independent of namespace/model.
 * Stored as `text_hash` alongside every row — a diagnostic/dedup-tooling
 * field, distinct from `cache_key` (see `cache-key.ts`), which is what
 * `vec-cache` actually looks entries up by.
 */
export function hashText(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}
