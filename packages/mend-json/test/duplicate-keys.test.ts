import { describe, expect, it } from 'vitest';
import { mendJson } from '../src/index.js';
import { createJsonMender } from '../src/create-json-mender.js';
import { JsonMendDuplicateKeyError } from '../src/errors.js';

describe('duplicateKeyPolicy', () => {
  it('"last" (default) matches JSON.parse: last value wins, key keeps its first position', () => {
    const r = mendJson('{"a":1,"b":2,"a":3}');
    expect(r.value).toEqual({ a: 3, b: 2 });
    expect(Object.keys(r.value as object)).toEqual(['a', 'b']);
    expect(r.complete).toBe(true);
  });

  it('"first" keeps the first value and drops later duplicates from repairedJson', () => {
    const r = mendJson('{"a":1,"b":2,"a":3}', { duplicateKeyPolicy: 'first' });
    expect(r.value).toEqual({ a: 1, b: 2 });
    expect(JSON.parse(r.repairedJson as string)).toEqual({ a: 1, b: 2 });
    expect(r.diagnostics.some((d) => d.code === 'duplicate-key-skipped')).toBe(true);
  });

  it('"first" with the duplicate as the very last member', () => {
    const r = mendJson('{"x":1,"a":1,"a":2}', { duplicateKeyPolicy: 'first' });
    expect(r.value).toEqual({ x: 1, a: 1 });
    expect(JSON.parse(r.repairedJson as string)).toEqual({ x: 1, a: 1 });
  });

  it('"first" with a nested-object duplicate value keeps the whole first occurrence', () => {
    const r = mendJson('{"a":{"x":1},"a":{"y":2}}', { duplicateKeyPolicy: 'first' });
    expect(r.value).toEqual({ a: { x: 1 } });
    expect(JSON.parse(r.repairedJson as string)).toEqual({ a: { x: 1 } });
  });

  it('"first" with more than two occurrences drops every repeat after the first', () => {
    const r = mendJson('{"a":1,"a":2,"a":3}', { duplicateKeyPolicy: 'first' });
    expect(r.value).toEqual({ a: 1 });
  });

  it('"first" with two separate, non-adjacent duplicated keys drops each independently', () => {
    // Exercises two disjoint exclusion ranges with a kept member between
    // them, not just a single merged range.
    const r = mendJson('{"a":1,"b":2,"a":9,"c":3,"b":9}', { duplicateKeyPolicy: 'first' });
    expect(r.value).toEqual({ a: 1, b: 2, c: 3 });
    expect(JSON.parse(r.repairedJson as string)).toEqual({ a: 1, b: 2, c: 3 });
  });

  it('"first" with duplicates in separate, unrelated object frames (not a duplicate across frames)', () => {
    const r = mendJson('{"outer":{"a":1},"other":{"a":2}}', { duplicateKeyPolicy: 'first' });
    expect(r.value).toEqual({ outer: { a: 1 }, other: { a: 2 } });
  });

  it('"error" throws JsonMendDuplicateKeyError as soon as the duplicate key is confirmed', () => {
    expect(() => mendJson('{"a":1,"a":2}', { duplicateKeyPolicy: 'error' })).toThrow(
      JsonMendDuplicateKeyError,
    );
  });

  it('"error" does not throw when keys are all distinct', () => {
    expect(() => mendJson('{"a":1,"b":2}', { duplicateKeyPolicy: 'error' })).not.toThrow();
  });

  it('mid-stream: "first" suppression works across a chunk boundary inside the suppressed value', () => {
    const mender = createJsonMender({ duplicateKeyPolicy: 'first' });
    mender.push('{"a":1,"a":{"nes');
    const mid = mender.snapshot();
    expect(mid.value).toEqual({ a: 1 });
    expect(() => JSON.parse(mid.repairedJson as string)).not.toThrow();
    const done = mender.push('ted":2}}');
    expect(done.value).toEqual({ a: 1 });
    expect(done.complete).toBe(false); // exclusion applied, not a verbatim repair
  });
});
