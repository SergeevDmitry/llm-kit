/**
 * `Retry-After` parsing: seconds, or an HTTP date (RFC 7231 IMF-fixdate and
 * the two obsolete formats `Date.parse` also accepts). This is the header
 * with real HTTP-spec backing, so it is the top of the delay-selection
 * priority list — valid explicit server advice wins outright.
 *
 * RFC 7231 defines the numeric form as `delay-seconds`, an integer — but
 * several real providers send a fractional value (`"0.5"`, `"3.2"`), and a
 * caller who receives one should still get it honored exactly, with no
 * "helpful" rounding: if the server said 3.2 seconds, sleep 3.2 seconds.
 * Non-negative decimals are accepted for that reason.
 */
import type { RateLimitCandidate } from '../types.js';

const RETRY_AFTER_HEADER_NAME = 'retry-after';
const NON_NEGATIVE_NUMBER = /^\d+(?:\.\d+)?$/;
/**
 * A real HTTP-date (IMF-fixdate, RFC 850, or asctime) always contains a
 * letter — a weekday or month name, or a "GMT" suffix. Bare numeric strings
 * like `"-5"` or `"3.2"` that fail the numeric-seconds check above must not
 * fall through to `Date.parse`, which is lenient enough to misinterpret them
 * as some unrelated date instead of correctly reporting them as malformed.
 */
const LOOKS_LIKE_A_DATE = /[A-Za-z]/;

export function parseRetryAfterHeader(rawValue: string, nowMs: number): RateLimitCandidate {
  const trimmed = rawValue.trim();

  if (NON_NEGATIVE_NUMBER.test(trimmed)) {
    const seconds = Number(trimmed);
    const delayMs = seconds * 1000;
    // `NON_NEGATIVE_NUMBER` admits an unbounded digit string. `Number()` maps
    // anything past ~309 digits straight to `Infinity`, and since the result
    // is then multiplied by 1000, a *finite* `seconds` just one order of
    // magnitude short of that (~306 digits) can still overflow here. No real
    // server sends a wait anywhere near that dense (the realistic ceiling is
    // years), so an overflowing value can't represent genuine server timing —
    // treating it as malformed refuses noise, it doesn't shorten a real wait.
    // A non-finite `delayMs` also can't round-trip through `JSON.stringify`
    // (silently becomes `null`) or survive `defaultSleep`'s chunked-timer
    // loop, which needs `remaining` to eventually reach `<= MAX_SAFE_TIMEOUT_MS`.
    if (Number.isFinite(delayMs)) {
      return {
        headerName: RETRY_AFTER_HEADER_NAME,
        resource: 'retry-after',
        rawValue,
        format: 'retry-after-seconds',
        usable: true,
        delayMs,
        reason: undefined,
      };
    }
    return {
      headerName: RETRY_AFTER_HEADER_NAME,
      resource: 'retry-after',
      rawValue,
      format: 'unknown',
      usable: false,
      delayMs: undefined,
      reason: `malformed Retry-After value ${JSON.stringify(rawValue)}: numeric seconds value overflows to a non-finite delay`,
    };
  }

  const parsedMs = LOOKS_LIKE_A_DATE.test(trimmed) ? Date.parse(trimmed) : NaN;
  if (!Number.isNaN(parsedMs)) {
    const delayMs = parsedMs - nowMs;
    if (delayMs < 0) {
      return {
        headerName: RETRY_AFTER_HEADER_NAME,
        resource: 'retry-after',
        rawValue,
        format: 'retry-after-http-date',
        usable: true,
        delayMs: 0,
        reason: 'Retry-After date is already in the past; clamped to 0',
      };
    }
    return {
      headerName: RETRY_AFTER_HEADER_NAME,
      resource: 'retry-after',
      rawValue,
      format: 'retry-after-http-date',
      usable: true,
      delayMs,
      reason: undefined,
    };
  }

  return {
    headerName: RETRY_AFTER_HEADER_NAME,
    resource: 'retry-after',
    rawValue,
    format: 'unknown',
    usable: false,
    delayMs: undefined,
    reason: `malformed Retry-After value ${JSON.stringify(rawValue)}: neither a non-negative integer second count nor a parseable HTTP date`,
  };
}
