import { describe, expect, it } from 'vitest';
import { createJsonMender } from '../src/create-json-mender.js';

describe('createJsonMender — stateful API', () => {
  it('matches the README streaming example', () => {
    const mender = createJsonMender();

    const r1 = mender.push('{"name":"Iv');
    expect(r1.value).toEqual({ name: 'Iv' });
    expect(r1.complete).toBe(false);
    expect(JSON.parse(r1.repairedJson as string)).toEqual({ name: 'Iv' });

    const r2 = mender.push('an","age":30}');
    expect(r2.value).toEqual({ name: 'Ivan', age: 30 });
    expect(r2.complete).toBe(true);
  });

  it('snapshot() does not consume input and is idempotent', () => {
    const mender = createJsonMender();
    mender.push('{"a":1');
    const s1 = mender.snapshot();
    const s2 = mender.snapshot();
    expect(s1).toEqual(s2);
  });

  it('accepts any number of chunk boundaries for the same logical document', () => {
    const mender = createJsonMender();
    mender.push('{');
    mender.push('"a"');
    mender.push(':');
    mender.push('1');
    mender.push(',');
    mender.push('"b"');
    mender.push(':');
    mender.push('2');
    const r = mender.push('}');
    expect(r.value).toEqual({ a: 1, b: 2 });
    expect(r.complete).toBe(true);
  });

  it('reset() discards all state', () => {
    const mender = createJsonMender();
    mender.push('{"a":1,"nested":{"b":2');
    mender.reset();
    const r = mender.push('{"c":3}');
    expect(r.value).toEqual({ c: 3 });
    expect(r.complete).toBe(true);
  });

  it('finish() declares no more input and returns the final snapshot', () => {
    const mender = createJsonMender();
    mender.push('{"a":1}');
    const r = mender.finish();
    expect(r.complete).toBe(true);
    expect(r.value).toEqual({ a: 1 });
  });

  it('finish() never promotes a genuinely invalid completed document to complete: true', () => {
    const mender = createJsonMender();
    mender.push('{"a":1,}'); // trailing comma: invalid, not merely truncated
    const r = mender.finish();
    expect(r.complete).toBe(false);
    expect(r.value).toEqual({ a: 1 });
  });

  it('finish() completes a clean in-progress number (end of stream is a valid number terminator)', () => {
    const mender = createJsonMender();
    mender.push('42');
    const mid = mender.snapshot();
    expect(mid.complete).toBe(false); // still might be "420" etc.
    const done = mender.finish();
    expect(done.complete).toBe(true);
    expect(done.value).toBe(42);
  });

  it('a number nested inside an unfinished object is not promoted to complete by finish()', () => {
    const mender = createJsonMender();
    mender.push('{"a":30');
    const r = mender.finish();
    expect(r.complete).toBe(false);
    expect(r.value).toEqual({ a: 30 });
  });

  it('root scalar values stream correctly', () => {
    const mender = createJsonMender();
    const r1 = mender.push('"hel');
    expect(r1.value).toBe('hel');
    const r2 = mender.push('lo"');
    expect(r2.value).toBe('hello');
    expect(r2.complete).toBe(true);
  });

  it('whitespace-only input has no value', () => {
    const mender = createJsonMender();
    const r = mender.push('   \n\t  ');
    expect(r.value).toBeUndefined();
    expect(r.repairedJson).toBeUndefined();
    expect(r.complete).toBe(false);
  });

  it('empty input has no value', () => {
    const mender = createJsonMender();
    const r = mender.snapshot();
    expect(r.value).toBeUndefined();
    expect(r.repairedJson).toBeUndefined();
    expect(r.validPrefixLength).toBe(0);
  });

  it('leading and trailing insignificant whitespace around a complete document is tolerated', () => {
    const mender = createJsonMender();
    const r = mender.push('  {"a":1}  ');
    expect(r.complete).toBe(true);
    expect(r.value).toEqual({ a: 1 });
  });

  it('accepts a Uint8Array chunk directly', () => {
    const mender = createJsonMender();
    const r = mender.push(new TextEncoder().encode('{"a":1}'));
    expect(r.complete).toBe(true);
    expect(r.value).toEqual({ a: 1 });
  });

  it('mixes string and byte chunks in the same stream', () => {
    const mender = createJsonMender();
    mender.push('{"name":"');
    mender.push(new TextEncoder().encode('café'));
    const r = mender.push('"}');
    expect(r.complete).toBe(true);
    expect(r.value).toEqual({ name: 'café' });
  });
});

describe('createJsonMender — repair touches only the unfinished suffix', () => {
  it('never alters an already-committed value on later chunks', () => {
    const mender = createJsonMender();
    const r1 = mender.push('{"a":1,"b":2,"c":');
    expect(r1.repairedJson).toBe('{"a":1,"b":2}');
    const r2 = mender.push('3}');
    expect(r2.repairedJson).toBe('{"a":1,"b":2,"c":3}');
    // The prefix that was already valid in r1 is a literal prefix of r2's repairedJson.
    expect(r2.repairedJson?.startsWith('{"a":1,"b":2')).toBe(true);
  });
});
