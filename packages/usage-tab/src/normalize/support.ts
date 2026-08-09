/**
 * Shared structural helpers for the four provider usage adapters
 * (`openai.ts`, `anthropic.ts`, `google.ts`, `openai-compatible.ts`) and the
 * internal generic fallback (`generic.ts`). Every adapter reads an `unknown`
 * value the same cautious way — no provider SDK types, only plain-object/
 * number narrowing — so this lives once rather than once per adapter.
 */
import { InvalidUsageError } from '../errors.js';

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function assertUsageObject(value: unknown, adapterName: string): Record<string, unknown> {
  if (!isPlainObject(value)) {
    throw new InvalidUsageError(`${adapterName} expected an object, received ${typeof value}.`);
  }
  return value;
}

/**
 * A billable usage field is valid only as a non-negative, finite integer.
 * `NaN`, `Infinity`/`-Infinity`, negative numbers, fractional numbers, and
 * any non-number type are all rejected: a known usage field with an invalid
 * *value* (not just an invalid type) must never be silently priced as though
 * it were absent.
 */
export function isValidTokenCount(value: unknown): value is number {
  return (
    typeof value === 'number' && Number.isFinite(value) && Number.isInteger(value) && value >= 0
  );
}

/**
 * Renders an arbitrary value for an error message. Must never throw: it runs
 * while an error is being constructed (`describeInvalidNumber`,
 * `readNumericField` in `../normalize/generic.js`), and a throw from inside
 * an error-construction expression discards the error under construction, so
 * the caller would see a raw, uncoded exception instead of the stable-`code`
 * `InvalidUsageError` the contract promises. A `bigint` usage value (routine
 * from node-postgres/mysql2 driver rows) makes bare `JSON.stringify` throw,
 * which is exactly the case this function exists to cover.
 *
 * `JSON.stringify` is not total — it throws on a `bigint`, on a circular
 * object, and on an object whose `toJSON` throws, and it silently returns
 * `undefined` (not the string `"undefined"`) for a bare `symbol`, `function`,
 * or `undefined`. Every one of those is handled explicitly or covered by the
 * `catch` below.
 */
export function describeValue(value: unknown): string {
  if (typeof value === 'bigint') return `${value.toString()}n`;
  if (typeof value === 'symbol') return value.toString();
  if (typeof value === 'function') {
    return value.name.length > 0 ? `[Function: ${value.name}]` : '[Function (anonymous)]';
  }
  if (typeof value === 'undefined') return 'undefined';
  if (typeof value === 'number') {
    // `JSON.stringify` renders every one of these uselessly: `NaN` and
    // `±Infinity` both become the string `"null"` (indistinguishable from an
    // actual `null`), and `-0` becomes `"0"`, silently dropping the sign a
    // caller debugging a driver/serialization bug would want to see.
    if (Number.isNaN(value)) return 'NaN';
    if (!Number.isFinite(value)) return String(value);
    if (Object.is(value, -0)) return '-0';
    return String(value);
  }
  try {
    const json = JSON.stringify(value);
    // `JSON.stringify` returns `undefined` (the JS value) rather than
    // throwing for a handful of shapes not already excluded above — e.g. a
    // value nested only behind a `toJSON` that itself returns `undefined`.
    return json === undefined ? String(value) : json;
  } catch {
    // Circular structure, or a throwing `toJSON` — the exact failure doesn't
    // matter here; a coarse but safe fallback beats propagating any throw.
    return Object.prototype.toString.call(value);
  }
}

/** Renders a rejected token-count value for an error message. */
export function describeInvalidNumber(value: unknown): string {
  if (typeof value !== 'number') return `${typeof value} ${describeValue(value)}`;
  if (Number.isNaN(value)) return 'NaN';
  if (!Number.isFinite(value)) return String(value);
  if (!Number.isInteger(value)) return `a fractional value (${value})`;
  return `a negative value (${value})`;
}

/**
 * Reads `obj[key]` as a number.
 *
 * A known usage field has exactly two valid states: absent (the key is
 * missing, or explicitly `null` — providers routinely emit `null` for "not
 * applicable", treated the same as absent, never as invalid) or present as a
 * non-negative finite integer. Any other present value (a string,
 * boolean, object, `NaN`, `Infinity`, a negative number, a fractional
 * number) is a malformed known field, not an absent one, and throws
 * `InvalidUsageError` rather than silently pricing it as zero.
 */
export function readNumber(
  obj: Record<string, unknown>,
  key: string,
  adapterName: string,
): number | undefined {
  const value = obj[key];
  if (value === undefined || value === null) return undefined;
  if (!isValidTokenCount(value)) {
    throw new InvalidUsageError(
      `${adapterName} expected "${key}" to be a non-negative integer, received ${describeInvalidNumber(value)}.`,
    );
  }
  return value;
}

/**
 * Reads `obj[parentKey]?.[key]` as a number. The parent object is subject to
 * the same absent-vs-invalid distinction as `readNumber`: an absent or
 * `null` parent is absent, but a parent that is present and not an object is
 * a malformed known field and throws — it does not silently fall through to
 * "no nested value found".
 */
export function readNestedNumber(
  obj: Record<string, unknown>,
  parentKey: string,
  key: string,
  adapterName: string,
): number | undefined {
  const parent = obj[parentKey];
  if (parent === undefined || parent === null) return undefined;
  if (!isPlainObject(parent)) {
    throw new InvalidUsageError(
      `${adapterName} expected "${parentKey}" to be an object, received ${typeof parent}.`,
    );
  }
  return readNumber(parent, key, adapterName);
}
