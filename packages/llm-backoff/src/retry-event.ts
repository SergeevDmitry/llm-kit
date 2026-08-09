/**
 * Header-name sanitization for `RetryEvent.headerNames`. Retry events carry
 * sanitized header names only, never secrets or `Authorization` values.
 * `RetryEvent` itself never carries a raw `Headers` object at all — see the
 * type's doc comment in `types.ts` — this only guards the one field that
 * lists header *names*.
 */
import { SENSITIVE_HEADER_NAMES } from './defaults.js';

export function sanitizeHeaderNames(names: readonly string[]): readonly string[] {
  return names.filter((name) => !SENSITIVE_HEADER_NAMES.has(name.toLowerCase()));
}
