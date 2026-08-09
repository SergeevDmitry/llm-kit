/**
 * Format-specific parsers for `x-ratelimit-reset-*`-style header values.
 *
 * Every parser here returns a *raw* delay in milliseconds (which may be
 * negative — a stale absolute timestamp) or `undefined` for a value that does
 * not match its format at all. Clamping negative results to `0` and
 * reporting that clamp is `choose-delay.ts`'s job, once it knows which
 * header the value came from.
 *
 * Every one of these formats is only ever invoked by a provider profile
 * (`src/providers/`) that has confirmed a specific header name uses it.
 * Nothing in this file guesses a unit from the raw value alone.
 */

/** Non-negative-or-optionally-signed decimal, e.g. "42", "42.5", "-3". */
const SIGNED_DECIMAL = /^[+-]?\d+(?:\.\d+)?$/;

/**
 * OpenAI-style durations: one or more `<number><unit>` pairs concatenated
 * with no separator, matching Go's `time.Duration.String()` — the format
 * OpenAI's `x-ratelimit-reset-*` headers actually use, e.g. `"1s"`,
 * `"6m0s"`, `"12ms"`, `"1h2m3s"`. Every character must be consumed by a
 * unit/number pair or the whole value is rejected — no partial matches.
 */
const DURATION_SEGMENT = /(\d+(?:\.\d+)?)(ns|us|µs|ms|s|m|h)/g;
const UNIT_TO_MS: Readonly<Record<string, number>> = {
  ns: 1 / 1_000_000,
  us: 1 / 1000,
  µs: 1 / 1000,
  ms: 1,
  s: 1000,
  m: 60_000,
  h: 3_600_000,
};

export function parseDuration(rawValue: string): number | undefined {
  const trimmed = rawValue.trim();
  if (trimmed === '') return undefined;
  if (trimmed === '0') return 0;

  let body = trimmed;
  let negative = false;
  if (body.startsWith('-')) {
    negative = true;
    body = body.slice(1);
  } else if (body.startsWith('+')) {
    body = body.slice(1);
  }

  let consumedLength = 0;
  let totalMs = 0;
  DURATION_SEGMENT.lastIndex = 0;
  for (
    let match = DURATION_SEGMENT.exec(body);
    match !== null;
    match = DURATION_SEGMENT.exec(body)
  ) {
    if (match.index !== consumedLength) break; // a gap means an unrecognized character; stop and fail below
    consumedLength += match[0].length;
    const amount = Number(match[1]);
    const unitMs = UNIT_TO_MS[match[2] as string];
    totalMs += amount * (unitMs ?? NaN);
  }

  // `Number.isFinite` subsumes the `Number.isNaN` check this already had, and
  // additionally catches an unbounded run of `<number>` segments (or one
  // absurdly large segment) summing to `Infinity` — see `retry-after.ts`'s
  // parser for why an overflowing result is treated as malformed rather than
  // as a huge-but-honored delay.
  if (consumedLength !== body.length || consumedLength === 0 || !Number.isFinite(totalMs)) {
    return undefined;
  }
  return negative ? -totalMs : totalMs;
}

/** Absolute epoch-seconds timestamp. Only ever applied where a provider profile says so. */
export function parseEpochSeconds(rawValue: string, nowMs: number): number | undefined {
  const trimmed = rawValue.trim();
  if (!SIGNED_DECIMAL.test(trimmed)) return undefined;
  const delayMs = Number(trimmed) * 1000 - nowMs;
  // Same unbounded-digit-string overflow as `retry-after.ts` — see its
  // comment for why an overflowing result is reported as malformed.
  return Number.isFinite(delayMs) ? delayMs : undefined;
}

/** Absolute epoch-milliseconds timestamp. */
export function parseEpochMilliseconds(rawValue: string, nowMs: number): number | undefined {
  const trimmed = rawValue.trim();
  if (!SIGNED_DECIMAL.test(trimmed)) return undefined;
  const delayMs = Number(trimmed) - nowMs;
  return Number.isFinite(delayMs) ? delayMs : undefined;
}

/** ISO-8601 / RFC 3339 timestamp, e.g. Anthropic's `anthropic-ratelimit-*-reset` headers. */
export function parseIsoTimestamp(rawValue: string, nowMs: number): number | undefined {
  const trimmed = rawValue.trim();
  // Date.parse is lenient enough to accept non-ISO strings too (e.g. bare
  // words resolve to NaN, but some ambiguous formats might not); restrict to
  // a real ISO 8601 shape first so "reset: 1699999999" doesn't silently parse
  // as some implementation-defined date.
  if (!/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}/.test(trimmed)) return undefined;
  const parsedMs = Date.parse(trimmed);
  if (Number.isNaN(parsedMs)) return undefined;
  return parsedMs - nowMs;
}

/** IETF `RateLimit-Reset` draft: delta-seconds, same shape as `Retry-After`'s numeric form. */
export function parseDeltaSeconds(rawValue: string): number | undefined {
  const trimmed = rawValue.trim();
  if (!/^\d+$/.test(trimmed)) return undefined;
  const delayMs = Number(trimmed) * 1000;
  // Same unbounded-digit-string overflow as `retry-after.ts` — see its
  // comment for why an overflowing result is reported as malformed.
  return Number.isFinite(delayMs) ? delayMs : undefined;
}
