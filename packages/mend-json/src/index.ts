/**
 * mend-json — repair truncated JSON from an LLM stream into a valid partial
 * value on every chunk.
 *
 * Public surface: {@link createJsonMender} (stateful, chunk-at-a-time),
 * {@link mendJson} (one-shot), and {@link mendStream} (async-iteration
 * adapter). See the README for guarantees, non-guarantees, and the
 * reasoning behind the repair policy.
 */
export { createJsonMender } from './create-json-mender.js';
export { mendStream } from './mend-stream.js';
export {
  JsonMendDuplicateKeyError,
  JsonMendLimitError,
  type JsonMendLimitCode,
  JsonMendOptionsError,
  type JsonMendOptionsErrorCode,
} from './errors.js';
export type {
  DuplicateKeyPolicy,
  IncompleteScalarPolicy,
  JsonMendDiagnostic,
  JsonMendResult,
  JsonMender,
  JsonMenderOptions,
  MendStreamOptions,
} from './types.js';

import { createJsonMender } from './create-json-mender.js';
import type { JsonMenderOptions, JsonMendResult } from './types.js';

/**
 * One-shot repair of a single string or byte buffer. Equivalent to creating
 * a mender, pushing `input` once, and calling `finish()` — for a caller that
 * already has the whole (possibly truncated) payload in hand rather than a
 * live stream.
 */
export function mendJson<T = unknown>(
  input: string | Uint8Array,
  options?: JsonMenderOptions,
): JsonMendResult<T> {
  const mender = createJsonMender<T>(options);
  mender.push(input);
  return mender.finish();
}
