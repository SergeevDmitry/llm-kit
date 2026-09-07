/**
 * `result.pending`: which part of the document is still incomplete.
 *
 * `complete` answers "is it done?"; these tests pin the other half, "which
 * part isn't?", including the three cases where nothing is pending even
 * though the document is not complete: a frozen scanner, a resting point
 * between values, and a suppressed duplicate member.
 */
import { describe, expect, it } from 'vitest';

import { createJsonMender, mendJson } from '../src/index.js';

describe('pending: the leaf currently being scanned', () => {
  it.each([
    ['an object key', '{"na', [], 'key'],
    ['a member whose value has not started', '{"a":', ['a'], 'member'],
    ['a string value', '{"a":"he', ['a'], 'string'],
    ['a number value', '{"a":12', ['a'], 'number'],
    ['a literal value', '{"a":tru', ['a'], 'literal'],
    ['a root string', '"hel', [], 'string'],
    ['a root literal', 'tru', [], 'literal'],
    ['an array element', '[1,2,[3,"ab', [2, 1], 'string'],
    [
      'a deep tool-call argument',
      '{"tool_calls":[{"arguments":{"query":"weath',
      ['tool_calls', 0, 'arguments', 'query'],
      'string',
    ],
  ])('%s', (_label, input, path, kind) => {
    expect(mendJson(input).pending).toEqual({ path, kind });
  });

  it('the path indexes into value, so a caller can look up what is still arriving', () => {
    const r = mendJson<{ tool_calls: { arguments: { query: string } }[] }>(
      '{"tool_calls":[{"arguments":{"query":"weath',
    );
    const path = r.pending?.path ?? [];
    let cursor: unknown = r.value;
    for (const step of path) {
      cursor = (cursor as Record<string | number, unknown>)[step];
    }
    expect(cursor).toBe('weath');
  });
});

describe('pending: when nothing is pending', () => {
  it.each([
    ['no value has started yet', '  '],
    ['an empty object frame', '{'],
    ['a resting point after a comma', '{"a":1,'],
    ['a complete document', '{"a":1}'],
    ['a scanner frozen by trailing data', '{"a":1} junk'],
    ['a scanner frozen by an invalid number', '{"a":01'],
  ])('%s', (_label, input) => {
    expect(mendJson(input).pending).toBeUndefined();
  });

  it('a leaf inside a suppressed duplicate member is not reported, since it never reaches value', () => {
    const r = mendJson('{"a":1,"a":"stil', { duplicateKeyPolicy: 'first' });
    expect(r.value).toEqual({ a: 1 });
    expect(r.pending).toBeUndefined();
  });

  it('finish() terminates a root number, so what was pending stops being pending', () => {
    const mender = createJsonMender();
    mender.push('12');
    expect(mender.snapshot().pending).toEqual({ path: [], kind: 'number' });
    // End of input is itself a valid number terminator, so `finish()`, and
    // only `finish()`, settles this one.
    const final = mender.finish();
    expect(final.complete).toBe(true);
    expect(final.pending).toBeUndefined();
  });

  it('but a truncated document stays pending after finish(), naming where it was cut off', () => {
    // `mendJson` finishes internally, so this is the one-shot case too.
    expect(mendJson('{"a":12').pending).toEqual({ path: ['a'], kind: 'number' });
  });
});

describe('pending: across a stream', () => {
  it('tracks the field currently arriving, chunk by chunk', () => {
    const mender = createJsonMender();
    const seen = ['{"na', 'me":"Iv', 'an","age":3', '4}'].map(
      (chunk) => mender.push(chunk).pending,
    );
    expect(seen).toEqual([
      { path: [], kind: 'key' },
      { path: ['name'], kind: 'string' },
      { path: ['age'], kind: 'number' },
      undefined,
    ]);
  });

  it('is JSON-serializable, like every other diagnostic-shaped field', () => {
    const r = mendJson('{"a":[{"b":"x');
    expect(JSON.parse(JSON.stringify(r.pending)) as unknown).toEqual({
      path: ['a', 0, 'b'],
      kind: 'string',
    });
  });
});
