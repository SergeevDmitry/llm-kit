/**
 * Pulls an HTTP status and headers out of `unknown` — a thrown `Response`
 * (this package's own `FetchRetryableStatusError` included, since it exposes
 * `.status`/`.headers` directly), or an SDK error shaped like
 * `{ status, headers }` / `{ statusCode, response: { headers } }`, the two
 * shapes the OpenAI and Anthropic Node SDKs both use. Headers may be a real
 * `Headers` instance or a plain object (edge case: "SDK error carrying
 * plain-object headers").
 *
 * Returns `{ status: undefined, headers: undefined }` for anything else: an
 * unknown SDK error needs either status/header extraction or an explicit
 * user classifier to be handled.
 */
import type { HeadersLike } from './types.js';

export interface ExtractedHttpInfo {
  readonly status: number | undefined;
  readonly headers: HeadersLike | undefined;
}

const NO_INFO: ExtractedHttpInfo = { status: undefined, headers: undefined };

function isUsableHeaders(value: unknown): value is HeadersLike {
  if (typeof Headers !== 'undefined' && value instanceof Headers) return true;
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function pickStatus(record: Record<string, unknown>): number | undefined {
  if (typeof record.status === 'number') return record.status;
  if (typeof record.statusCode === 'number') return record.statusCode;
  const response = record.response;
  if (typeof response === 'object' && response !== null) {
    const nested = response as Record<string, unknown>;
    if (typeof nested.status === 'number') return nested.status;
    if (typeof nested.statusCode === 'number') return nested.statusCode;
  }
  return undefined;
}

function pickHeaders(record: Record<string, unknown>): HeadersLike | undefined {
  if (isUsableHeaders(record.headers)) return record.headers;
  const response = record.response;
  if (typeof response === 'object' && response !== null) {
    const nestedHeaders = (response as Record<string, unknown>).headers;
    if (isUsableHeaders(nestedHeaders)) return nestedHeaders;
  }
  return undefined;
}

export function extractHttpError(error: unknown): ExtractedHttpInfo {
  if (typeof Response !== 'undefined' && error instanceof Response) {
    return { status: error.status, headers: error.headers };
  }
  if (typeof error !== 'object' || error === null) {
    return NO_INFO;
  }
  const record = error as Record<string, unknown>;
  return { status: pickStatus(record), headers: pickHeaders(record) };
}
