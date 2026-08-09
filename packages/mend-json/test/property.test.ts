/**
 * Property tests for the headline invariant: every snapshot that exposes
 * `value` also exposes a `repairedJson` string `JSON.parse` accepts. Also
 * fuzzes chunk boundaries and inserted truncations/malformed suffixes over
 * randomly generated valid JSON documents.
 *
 * Every `fast-check` run below is seeded so a CI failure reproduces exactly
 * from the printed seed.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { createSeededRandom } from '@llm-kit/test-utils';
import { createJsonMender } from '../src/create-json-mender.js';
import { mendJson } from '../src/index.js';

const FAST_CHECK_SEED = 0x6d656e64; // 'mend'
const FAST_CHECK_RUNS = 300;

/** A small recursive JSON value generator, biased toward realistic tool-call-argument shapes. */
const jsonValue = fc.letrec<{ value: unknown; object: unknown; array: unknown }>((tie) => ({
  value: fc.oneof(
    { depthSize: 'small' },
    fc.constant(null),
    fc.boolean(),
    fc.double({ noNaN: true, noDefaultInfinity: true, min: -1e6, max: 1e6 }),
    fc.integer({ min: -100_000, max: 100_000 }),
    fc.string({ maxLength: 40 }),
    tie('object'),
    tie('array'),
  ),
  object: fc.dictionary(fc.string({ minLength: 1, maxLength: 12 }), tie('value'), { maxKeys: 5 }),
  array: fc.array(tie('value'), { maxLength: 5 }),
})).value;

const jsonDocument = jsonValue.map((value) => JSON.stringify(value));

function assertHeadlineInvariant(snapshot: {
  value: unknown;
  repairedJson: string | undefined;
}): void {
  if (snapshot.value !== undefined) {
    expect(snapshot.repairedJson).toBeDefined();
    expect(() => JSON.parse(snapshot.repairedJson as string)).not.toThrow();
  } else {
    expect(snapshot.repairedJson).toBeUndefined();
  }
}

describe('property: headline invariant over random chunk splits of valid JSON', () => {
  it('holds for every snapshot when a random document is split into random-sized chunks', () => {
    fc.assert(
      fc.property(
        jsonDocument,
        fc.array(fc.integer({ min: 1, max: 17 }), { minLength: 1, maxLength: 30 }),
        (doc, chunkSizes) => {
          const mender = createJsonMender();
          let offset = 0;
          for (const size of chunkSizes) {
            if (offset >= doc.length) break;
            const chunk = doc.slice(offset, offset + size);
            offset += size;
            assertHeadlineInvariant(mender.push(chunk));
          }
          if (offset < doc.length) {
            assertHeadlineInvariant(mender.push(doc.slice(offset)));
          }
          const final = mender.finish();
          assertHeadlineInvariant(final);
          expect(final.complete).toBe(true);
          expect(final.value).toEqual(JSON.parse(doc));
        },
      ),
      { seed: FAST_CHECK_SEED, numRuns: FAST_CHECK_RUNS },
    );
  });

  it('holds for every prefix length of a random document (progressive truncation)', () => {
    fc.assert(
      fc.property(jsonDocument, fc.nat(), (doc, prefixSeed) => {
        const prefixLength = doc.length === 0 ? 0 : prefixSeed % (doc.length + 1);
        const prefix = doc.slice(0, prefixLength);
        const result = mendJson(prefix);
        assertHeadlineInvariant(result);
      }),
      { seed: FAST_CHECK_SEED, numRuns: FAST_CHECK_RUNS },
    );
  });
});

describe('fuzz: inserted truncations and malformed suffixes', () => {
  const random = createSeededRandom(0x6675_7a7a); // 'fuzz'

  it('never violates the headline invariant, however the suffix is mangled', () => {
    const docs = [
      '{"name":"Ivan","tags":["a","b","c"],"meta":{"n":1.5e10,"ok":true}}',
      '[1,2,3,{"nested":{"deep":[true,false,null,"str"]}}]',
      '{"unicode":"caf\\u00e9 \\ud83d\\ude00","esc":"a\\\\b\\"c"}',
    ];
    const mangleKinds = [
      'truncate',
      'append-garbage',
      'append-comma',
      'append-open-brace',
      'append-backslash',
      'append-quote',
    ] as const;

    for (let trial = 0; trial < 500; trial += 1) {
      const doc = random.pick(docs);
      const cut = random.int(0, doc.length);
      let mangled = doc.slice(0, cut);
      const kind = random.pick(mangleKinds);
      switch (kind) {
        case 'truncate':
          break;
        case 'append-garbage':
          mangled += random.pick(['xyz', '###', '}}}}', ']]]]', '::']);
          break;
        case 'append-comma':
          mangled += ',';
          break;
        case 'append-open-brace':
          mangled += '{';
          break;
        case 'append-backslash':
          mangled += '\\';
          break;
        case 'append-quote':
          mangled += '"';
          break;
      }

      // A thrown limit/duplicate-key error is out of scope for this fuzz
      // corpus (no duplicate keys or deep nesting are generated above); any
      // other outcome must still satisfy the headline invariant.
      const result = mendJson(mangled);
      assertHeadlineInvariant(result);
    }
  });
});
