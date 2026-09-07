/**
 * `removedRanges`: the interior cuts `validPrefixLength` alone cannot
 * describe.
 *
 * `appendedSuffix` documents an identity: the raw prefix plus that suffix is
 * `repairedJson`. It held for every repair except duplicate-key exclusion,
 * where `repairedJson` additionally has ranges cut out of the middle and
 * nothing in the result said which, so a caller slicing the raw buffer
 * itself (the documented use of `validPrefixLength`) rendered a member this
 * package reports as dropped. These tests pin the completed identity.
 */
import { describe, expect, it } from 'vitest';

import { createJsonMender, mendJson } from '../src/index.js';
import type { JsonMendResult } from '../src/types.js';

/** The identity `removedRanges` completes: prefix, minus the cuts, plus the suffix. */
function reconstruct(input: string, r: JsonMendResult): string {
  let out = '';
  let cursor = 0;
  for (const [start, end] of r.removedRanges) {
    out += input.slice(cursor, start);
    cursor = end;
  }
  out += input.slice(cursor, r.validPrefixLength);
  return out + r.appendedSuffix;
}

describe('removedRanges', () => {
  it('names the cut a duplicate-key exclusion makes, so the identity reconstructs', () => {
    const input = '{"a":1,"a":2,"b":3}';
    const r = mendJson(input, { duplicateKeyPolicy: 'first' });

    expect(r.repairedJson).toBe('{"a":1,"b":3}');
    expect(r.removedRanges).toEqual([[6, 12]]);
    // Without removedRanges this is the whole input, duplicate included.
    expect(input.slice(0, r.validPrefixLength) + r.appendedSuffix).toBe(input);
    expect(reconstruct(input, r)).toBe(r.repairedJson);
  });

  it('is empty when nothing was cut, including under the default policy', () => {
    expect(mendJson('{"a":1,"a":2}').removedRanges).toEqual([]);
    expect(mendJson('{"a":"he').removedRanges).toEqual([]);
    expect(mendJson('').removedRanges).toEqual([]);
  });

  it('reports adjacent exclusions merged, and disjoint ones separately', () => {
    const merged = mendJson('{"a":1,"a":2,"a":3}', { duplicateKeyPolicy: 'first' });
    expect(merged.removedRanges).toEqual([[6, 18]]);

    const disjoint = mendJson('{"a":1,"a":2,"b":3,"b":4}', { duplicateKeyPolicy: 'first' });
    expect(disjoint.removedRanges).toEqual([
      [6, 12],
      [18, 24],
    ]);
  });

  it("never aliases the scanner's own ranges: reading one snapshot cannot change the next", () => {
    const input = '{"a":1,"a":2,"a":3}';
    const mender = createJsonMender({ duplicateKeyPolicy: 'first' });
    mender.push(input);

    const first = mender.snapshot();
    const ranges = first.removedRanges.map(([start, end]) => [start, end]);
    // A caller holding the ranges may write to their own copy; the mender
    // must be unaffected, and must keep reporting the same cut.
    (first.removedRanges as [number, number][])[0]![1] = 999;

    const second = mender.snapshot();
    expect(second.removedRanges.map(([s, e]) => [s, e])).toEqual(ranges);
    expect(second.repairedJson).toBe('{"a":1}');
  });

  it.each(['last', 'first'] as const)(
    'the identity holds at every truncation point of a duplicate-heavy document (%s)',
    (duplicateKeyPolicy) => {
      // Exhaustive over cut points rather than sampled: the document is
      // short enough that every prefix is cheaper than a seeded fuzz, and
      // it covers each cut landing mid-key, mid-value and mid-exclusion.
      const document = '{"a":1,"b":{"c":2,"c":3},"a":[4,5],"d":"x","d":"y"}';
      for (let cut = 1; cut <= document.length; cut += 1) {
        const input = document.slice(0, cut);
        const r = mendJson(input, { duplicateKeyPolicy });
        if (r.repairedJson === undefined) continue;
        expect(reconstruct(input, r)).toBe(r.repairedJson);
      }
    },
  );
});
