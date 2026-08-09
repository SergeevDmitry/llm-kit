/**
 * The split-point tests: representative valid JSON documents, split into two
 * chunks at EVERY character boundary. Every resulting snapshot — from either
 * chunk, and from `finish()` — must satisfy the headline invariant (any
 * snapshot exposing `value` also exposes a `repairedJson` that `JSON.parse`
 * accepts), and `finish()` must reproduce the original document exactly.
 */
import { describe, expect, it } from 'vitest';
import { createJsonMender } from '../src/create-json-mender.js';

/** Nested objects/arrays, escapes, exponents, unicode escapes, deep nesting. */
const DOCUMENTS: readonly string[] = [
  '{"name":"Ivan","age":30}',
  '[1,2,3,[4,5,{"a":true,"b":false,"c":null}],"end"]',
  '{"deep":{"a":{"b":{"c":{"d":[1,2,3]}}}}}',
  String.raw`{"s":"hello \"world\" with \\backslash\\ and \/slash\/ and \n\t\r"}`,
  '{"n1":1.5e10,"n2":-3.14,"n3":0,"n4":-0.001,"n5":1E-5,"n6":123456789}',
  String.raw`{"u":"café 😀 done"}`,
  '{"emoji":"🚀🎉 hello world 日本語 текст"}',
  '[[[[[[[[[[1]]]]]]]]]]',
  '{"arr":[],"obj":{},"mixed":[{},[],{"x":[1,{"y":2}]}]}',
  'null',
  'true',
  '42',
  '-17.25e+3',
  '"just a string with \\u263A smiley"',
  '{"tool_calls":[{"id":"call_1","type":"function","function":{"name":"get_weather","arguments":"{\\"city\\":\\"Paris\\"}"}}]}',
];

function assertHeadlineInvariant(
  snapshot: { value: unknown; repairedJson: string | undefined },
  where: string,
): void {
  if (snapshot.value !== undefined) {
    expect(
      snapshot.repairedJson,
      `${where}: repairedJson must be defined when value is defined`,
    ).toBeDefined();
    expect(
      () => JSON.parse(snapshot.repairedJson as string),
      `${where}: repairedJson must parse`,
    ).not.toThrow();
  } else {
    expect(
      snapshot.repairedJson,
      `${where}: repairedJson must be undefined when value is undefined`,
    ).toBeUndefined();
  }
}

describe('split-point tests: every character boundary', () => {
  for (const doc of DOCUMENTS) {
    describe(JSON.stringify(doc.length > 60 ? `${doc.slice(0, 57)}...` : doc), () => {
      for (let i = 1; i < doc.length; i += 1) {
        it(`split at ${String(i)}/${String(doc.length)}`, () => {
          const first = doc.slice(0, i);
          const second = doc.slice(i);
          const mender = createJsonMender();

          const r1 = mender.push(first);
          assertHeadlineInvariant(r1, 'after first chunk');

          const r2 = mender.push(second);
          assertHeadlineInvariant(r2, 'after second chunk');

          const final = mender.finish();
          assertHeadlineInvariant(final, 'after finish');
          expect(final.complete, 'the reassembled document must be reported complete').toBe(true);
          expect(final.value).toEqual(JSON.parse(doc));
        });
      }
    });
  }
});
