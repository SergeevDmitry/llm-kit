/**
 * Tests two failure modes that share a root cause: a scanner freeze
 * (`fail()`, or a thrown `JsonMendLimitError`/`JsonMendDuplicateKeyError`)
 * that does not record — and clamp every later slice to — the exact offset
 * where well-formed scanning stopped.
 *
 * Trailing-data case: trailing non-whitespace after an already-complete,
 * already-valid document must not destroy the committed value
 * (`value`/`repairedJson` becoming `undefined`) — it should freeze at the
 * last good prefix, preserving the "repair touches only the unfinished
 * suffix" guarantee.
 *
 * Desync case: a `JsonMendLimitError` thrown mid-chunk from `beginValue`
 * (depth limit) must not leave the scanner "live" while `buffer` keeps
 * growing past `state.pos` — otherwise a later `push()` (without `reset()`)
 * would resume scanning at a stale offset and produce a `validPrefixLength`
 * that does not describe a parseable prefix. The same desync risk applies
 * to any error thrown mid-chunk (`JsonMendDuplicateKeyError`, and —
 * defensively — `MAX_BUFFER_BYTES_EXCEEDED`, even though that one is
 * checked before any scanning happens).
 *
 * A subtler variant of the trailing-data case reached through the
 * resource-limit path instead of the syntax-error path: freezing via
 * `fail()`'s `state.pos - 1` default on every thrown error, for contract
 * uniformity, is wrong for `MAX_BUFFER_BYTES_EXCEEDED` specifically.
 * `push()`'s `checkBufferBytes` check runs *before* any character of the
 * rejected chunk is decoded or scanned, so `state.pos` already *is* the
 * boundary of the last well-formed prefix; subtracting one would discard an
 * already-committed character, destroying a complete value entirely,
 * silently shortening a root number, or dropping the last character of an
 * open string under a misleading `trailing-data-ignored` diagnostic. See
 * the dedicated describe block below and `state-machine.ts`'s `freezeAt`
 * doc comment for the fix.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { createJsonMender } from '../src/create-json-mender.js';
import { mendJson } from '../src/index.js';
import { JsonMendDuplicateKeyError, JsonMendLimitError } from '../src/errors.js';

describe('the headline streaming scenario — a model emits JSON then keeps talking', () => {
  it('never loses the committed value once the document is complete, chunk by chunk', () => {
    const mender = createJsonMender();

    const r1 = mender.push('{"na');
    expect(r1.value).toEqual({});
    expect(r1.complete).toBe(false);

    const r2 = mender.push('me":"Iv');
    expect(r2.value).toEqual({ name: 'Iv' });
    expect(r2.complete).toBe(false);

    const r3 = mender.push('an","ok":true}');
    expect(r3.value).toEqual({ name: 'Ivan', ok: true });
    expect(r3.complete).toBe(true);

    const r4 = mender.push('\n');
    expect(r4.value).toEqual({ name: 'Ivan', ok: true });
    expect(r4.complete).toBe(true);

    // The already-committed value must survive trailing garbage, not
    // collapse to undefined.
    const r5 = mender.push('```');
    expect(r5.value).toEqual({ name: 'Ivan', ok: true });
    expect(r5.complete).toBe(false); // genuinely no longer "as-is complete and valid"
    expect(r5.repairedJson).toBeDefined();
    expect(() => JSON.parse(r5.repairedJson as string)).not.toThrow();
    expect(r5.diagnostics.some((d) => d.code === 'trailing-data-ignored')).toBe(true);

    const r6 = mender.push('\nDone!');
    expect(r6.value).toEqual({ name: 'Ivan', ok: true });
    expect(r6.complete).toBe(false);
    // Pushing more trailing garbage must not keep moving validPrefixLength.
    expect(r6.validPrefixLength).toBe(r5.validPrefixLength);

    const final = mender.finish();
    expect(final.value).toEqual({ name: 'Ivan', ok: true });
    expect(final.repairedJson).toBeDefined();
    expect(() => JSON.parse(final.repairedJson as string)).not.toThrow();
    expect(final.complete).toBe(false);
  });
});

describe('validPrefixLength table — prefix + appendedSuffix must parse', () => {
  // The first five rows exercise cases where validPrefixLength could point
  // past the character that caused the freeze, or "value" could be lost
  // entirely; the last three were already correct and must stay that way.
  const rows: Array<[label: string, input: string]> = [
    ['object then trailing garbage char', '{"a":1}x'],
    ['object then trailing whitespace and garbage char', '{"a":1} x'],
    ['object then newline and a markdown fence', '{"a":1}\n```'],
    ['mismatched closer inside an array', '{"a":[1,2}'],
    ['extra closer after a complete root array', '[1,2]]'],
    ['trailing comma immediately closed (already correct)', '{"a":1,}'],
    ['unclosed object after a key with no value (already correct)', '{"a":1'],
    ['unclosed object after a colon (already correct)', '{"a":'],
  ];

  for (const [label, input] of rows) {
    it(`"${input}" (${label})`, () => {
      const r = mendJson(input);
      if (r.value === undefined) {
        // Only reachable for inputs with no valid prefix at all — none of
        // the rows above qualify, but keep the assertion honest.
        expect(r.repairedJson).toBeUndefined();
        return;
      }
      const prefix = input.slice(0, r.validPrefixLength);
      const candidate = prefix + r.appendedSuffix;
      expect(() => JSON.parse(candidate)).not.toThrow();
      // repairedJson must be exactly what prefix + appendedSuffix produces
      // (no duplicate-key exclusions are in play for any of these inputs).
      expect(r.repairedJson).toBe(candidate);
    });
  }
});

describe('genuinely invalid (not truncated) documents still freeze as complete: false', () => {
  it.each([
    ['trailing comma immediately closed', '{"a":1,}'],
    ['mismatched closer', '{"a":[1,2}'],
    ['invalid literal', 'tRue'],
    ['leading zero followed by a digit', '01'],
  ])('%s -> complete: false', (_label, input) => {
    const r = mendJson(input);
    expect(r.complete).toBe(false);
  });
});

describe('a depth-limit throw freezes the scanner instead of desynchronizing it', () => {
  it('push() after the throw does not move validPrefixLength, and finish() yields the last good prefix, not undefined', () => {
    const m = createJsonMender({ maxDepth: 1 });

    expect(() => m.push('{"a":{"b":1},"c":2}')).toThrow(JsonMendLimitError);

    const afterThrow = m.snapshot();
    expect(afterThrow.value).toEqual({});
    expect(afterThrow.validPrefixLength).toBe(1);
    expect(afterThrow.appendedSuffix).toBe('}');
    expect(afterThrow.complete).toBe(false);

    // A frozen mender must be a silent no-op, not resume advancing
    // state.pos out of sync with buffer.
    const afterMorePush = m.push('999');
    expect(afterMorePush.value).toEqual({});
    expect(afterMorePush.validPrefixLength).toBe(1); // must not have silently changed

    // finish() must still return the last good prefix, not an
    // out-of-sync slice of `buffer` that fails to parse.
    const final = m.finish();
    expect(final.value).toEqual({});
    expect(final.repairedJson).toBe('{}');
    expect(final.validPrefixLength).toBe(1);
    expect(final.complete).toBe(false);
  });

  it('the throw itself still happens synchronously out of push(), unchanged', () => {
    const mender = createJsonMender({ maxDepth: 1 });
    let threw = false;
    try {
      mender.push('{"a":{"b":1}}');
    } catch (error) {
      threw = true;
      expect(error).toBeInstanceOf(JsonMendLimitError);
      expect((error as JsonMendLimitError).code).toBe('MAX_DEPTH_EXCEEDED');
    }
    expect(threw).toBe(true);
  });

  it('depth-limit enforcement across chunk boundaries is unaffected', () => {
    const mender = createJsonMender({ maxDepth: 2 });
    mender.push('[[');
    expect(() => mender.push('[')).toThrow(JsonMendLimitError);
  });
});

describe('a duplicate-key throw freezes the scanner the same way', () => {
  it('push() after JsonMendDuplicateKeyError does not silently change validPrefixLength', () => {
    const mender = createJsonMender({ duplicateKeyPolicy: 'error' });
    mender.push('{"a":1,');
    const beforeThrow = mender.snapshot();

    expect(() => mender.push('"a":2}')).toThrow(JsonMendDuplicateKeyError);
    const afterThrow = mender.snapshot();
    expect(afterThrow.validPrefixLength).toBe(beforeThrow.validPrefixLength);
    // Unlike the buffer-cap-after-complete-document case, this freeze always
    // hits mid-object (the duplicate colon is only ever reached while an
    // object frame is still open), so `state.stack.length !== 0` keeps
    // `complete: false` regardless of the `complete` ruling above — see
    // `repair-suffix.ts`'s comment on `complete` for the exhaustive case
    // analysis of why this error type can never reach the "otherwise
    // complete" branch.
    expect(afterThrow.complete).toBe(false);

    const afterMorePush = mender.push('"more":"stuff"}');
    expect(afterMorePush.validPrefixLength).toBe(beforeThrow.validPrefixLength);

    const final = mender.finish();
    expect(final.validPrefixLength).toBe(beforeThrow.validPrefixLength);
    expect(final.value).toEqual(beforeThrow.value);
    // snapshot() and finish() agree here too.
    expect(final.complete).toBe(false);
  });
});

describe('a buffer-bytes throw freezes the mender too, for a uniform contract', () => {
  it('push() after MAX_BUFFER_BYTES_EXCEEDED does not silently resume accepting input', () => {
    const mender = createJsonMender({ maxBufferBytes: 10 });
    mender.push('{"a":1');
    const beforeThrow = mender.snapshot();

    expect(() => mender.push('234567890123')).toThrow(JsonMendLimitError);

    // Frozen: further pushes are silently ignored rather than resuming.
    const afterMorePush = mender.push('}');
    expect(afterMorePush.validPrefixLength).toBe(beforeThrow.validPrefixLength);
    expect(afterMorePush.complete).toBe(false);
  });

  it('a first push that already exceeds the byte budget freezes cleanly (no negative offsets)', () => {
    const mender = createJsonMender({ maxBufferBytes: 4 });
    expect(() => mender.push('{"a":1}')).toThrow(JsonMendLimitError);
    const r = mender.snapshot();
    expect(r.value).toBeUndefined();
    expect(r.validPrefixLength).toBe(0);
    for (const diagnostic of r.diagnostics) {
      expect(diagnostic.offset).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('reset() fully restores a clean, reusable mender after any freeze', () => {
  it('after MAX_DEPTH_EXCEEDED', () => {
    const mender = createJsonMender({ maxDepth: 1 });
    expect(() => mender.push('{"a":{"b":1}}')).toThrow(JsonMendLimitError);
    mender.reset();
    const r = mender.push('{"c":3}');
    expect(r.complete).toBe(true);
    expect(r.value).toEqual({ c: 3 });
  });

  it('after JsonMendDuplicateKeyError', () => {
    const mender = createJsonMender({ duplicateKeyPolicy: 'error' });
    expect(() => mender.push('{"a":1,"a":2}')).toThrow(JsonMendDuplicateKeyError);
    mender.reset();
    const r = mender.push('{"c":3}');
    expect(r.complete).toBe(true);
    expect(r.value).toEqual({ c: 3 });
  });

  it('after MAX_BUFFER_BYTES_EXCEEDED', () => {
    const mender = createJsonMender({ maxBufferBytes: 8 });
    expect(() => mender.push('{"a":"way too long for the budget"}')).toThrow(JsonMendLimitError);
    mender.reset();
    const r = mender.push('{"c":3}');
    expect(r.complete).toBe(true);
    expect(r.value).toEqual({ c: 3 });
  });
});

describe('MAX_BUFFER_BYTES_EXCEEDED must not discard an already-committed character', () => {
  // `push()`'s `checkBufferBytes` catch must not freeze via `fail()`,
  // whose `state.pos - 1` default only holds when a character was actually
  // consumed before the freeze. On this path nothing was — the byte check
  // runs before any decoding or scanning — so `state.pos` itself is the
  // boundary; subtracting one would discard a character already handed to
  // the caller in a prior snapshot. It calls `freezeAt` directly with
  // `state.pos` instead (see `create-json-mender.ts`'s `push()` and
  // `state-machine.ts`'s `freezeAt` doc comment).

  it('a complete document survives a subsequent over-cap push: complete stays true and value stays intact', () => {
    const mender = createJsonMender({ maxBufferBytes: 10 });

    const committed = mender.push('{"a":1}');
    expect(committed.complete).toBe(true);
    expect(committed.value).toEqual({ a: 1 });

    // Hitting the cap here must not destroy the already-returned committed value.
    expect(() => mender.push('xxxx')).toThrow(JsonMendLimitError);

    const snap = mender.snapshot();
    expect(snap.value).toEqual({ a: 1 });
    expect(snap.repairedJson).toBe('{"a":1}');
    // `complete` STAYS true (ruling below), not just "not destroyed": the
    // cap prevented looking at more input, it did not un-parse an
    // already-complete, already-valid value. No diagnostic accompanies this
    // because nothing was rolled back — see the "complete: true vs. false"
    // ruling below.
    expect(snap.complete).toBe(true);
    expect(snap.diagnostics).toEqual([]);
    expect(snap.diagnostics.some((d) => d.code === 'trailing-data-ignored')).toBe(false);

    const final = mender.finish();
    expect(final.value).toEqual({ a: 1 });
    expect(final.repairedJson).toBe('{"a":1}');
    // snapshot() and finish() must agree here: `isFinishing` only changes
    // `decideLeaf`'s `'in-number'` branch, and this document isn't a root
    // number.
    expect(final.complete).toBe(true);
    expect(final.diagnostics).toEqual([]);
  });

  it('a root number survives finish() unchanged, not silently shortened to a different number', () => {
    const mender = createJsonMender({ maxBufferBytes: 6 });

    mender.push('12345');
    // Hitting the cap here must not silently shorten the committed number
    // (e.g. to 1234) — that would be a wrong value, not a missing one, with
    // no diagnostic or complete:false signal distinguishing it from a
    // legitimately truncated number.
    expect(() => mender.push('zz')).toThrow(JsonMendLimitError);

    const final = mender.finish();
    expect(final.value).toBe(12345);
    expect(final.repairedJson).toBe('12345');
    // `complete: true` here — same ruling as the object case above: nothing
    // was rolled back, so the freeze doesn't taint the value. This is *not*
    // a new divergence from `snapshot()`: a root number under the default
    // `'omit'` policy already reports `complete: true` only from `finish()`
    // (`isFinishing` lets an in-progress number terminate at end-of-stream),
    // never from `snapshot()`, with or without any freeze at all — see the
    // dedicated test below.
    expect(final.complete).toBe(true);
    expect(final.diagnostics).toEqual([]);
  });

  it('snapshot() vs. finish() after a buffer-cap freeze on a root number: the same isFinishing divergence as an unfrozen stream, not a new one', () => {
    // Establishes the baseline: even with NO freeze at all, `'omit'` policy
    // `snapshot()` never completes an in-progress number (the value might
    // still grow), while `finish()` does (end-of-stream is a legal number
    // terminator) — `repair-suffix.ts`'s `decideLeaf` comment documents this
    // as `isFinishing`'s "one extra power". This divergence is pre-existing
    // and orthogonal to freezing.
    const unfrozen = createJsonMender();
    unfrozen.push('12345');
    expect(unfrozen.snapshot().complete).toBe(false);
    expect(unfrozen.finish().complete).toBe(true);

    // The buffer-cap freeze changes nothing about that divergence: it is
    // still driven entirely by `isFinishing`, not by `state.errored`.
    const frozen = createJsonMender({ maxBufferBytes: 6 });
    frozen.push('12345');
    expect(() => frozen.push('zz')).toThrow(JsonMendLimitError);
    expect(frozen.snapshot().complete).toBe(false);
    expect(frozen.snapshot().value).toBeUndefined();
    expect(frozen.finish().complete).toBe(true);
    expect(frozen.finish().value).toBe(12345);
  });

  it('an open string keeps every scanned character and reports string-closed, not trailing-data-ignored', () => {
    const mender = createJsonMender({ maxBufferBytes: 30 });

    const partial = mender.push('{"text":"partial content her');
    expect(partial.value).toEqual({ text: 'partial content her' });

    // Hitting the cap here must not silently drop the string's last
    // scanned character ("partial content he") under a misleading
    // trailing-data-ignored diagnostic — no trailing data actually exists.
    expect(() => mender.push('eeeeeeee')).toThrow(JsonMendLimitError);

    const snap = mender.snapshot();
    expect(snap.value).toEqual({ text: 'partial content her' });
    expect(snap.repairedJson).toBe('{"text":"partial content her"}');
    // An open string is genuinely incomplete — closing it is a repair, so
    // `complete` stays `false` here, unlike the object/array/literal case
    // above. The distinction is `rolledBack`: closing the string produces a
    // `'string-closed'` diagnostic (asserted below), which the object case
    // never gets because nothing needed closing or rolling back.
    expect(snap.complete).toBe(false);
    expect(snap.diagnostics.some((d) => d.code === 'trailing-data-ignored')).toBe(false);
    expect(snap.diagnostics.some((d) => d.code === 'string-closed')).toBe(true);
  });

  it('never emits trailing-data-ignored when no trailing data actually exists, across every decideLeaf shape', () => {
    // One representative input per `decideLeaf` branch that can freeze via
    // the buffer-bytes path without ever consuming a rejected character.
    const cases: Array<[maxBufferBytes: number, committed: string, overCap: string]> = [
      [10, '{"a":1}', 'xxxx'], // after-value, root object complete
      [5, '[1,2]', 'xxxx'], // after-value, root array complete
      [6, '12345', 'zz'], // in-number
      [30, '{"text":"partial content her', 'eeeeeeee'], // in-value-string
      [4, 'true', 'xxxx'], // after-value, root literal complete
    ];

    for (const [maxBufferBytes, committed, overCap] of cases) {
      const mender = createJsonMender({ maxBufferBytes });
      mender.push(committed);
      expect(() => mender.push(overCap)).toThrow(JsonMendLimitError);
      const snap = mender.snapshot();
      expect(snap.diagnostics.some((d) => d.code === 'trailing-data-ignored')).toBe(false);
    }
  });
});

describe('the "complete: true vs. false" ruling for a resource-limit freeze', () => {
  // Deriving `complete` from `state.errored` directly would force
  // `complete: false` on any freeze, unconditionally. That would mean a
  // caller polling `snapshot()` could watch a document that was already
  // reported `complete: true` silently flip to `false` on the very next
  // call, with an EMPTY `diagnostics` array — no code, no message, nothing
  // distinguishing it from a real problem. Compare to the precedent this
  // package already set for a `true -> false` transition (real trailing
  // data, tested above): that one always carries a `'trailing-data-ignored'`
  // diagnostic explaining it.
  //
  // The ruling: `complete` is a statement about the *value* — "is this
  // slice of the input, as repaired, complete and valid JSON as-is" — not a
  // promise about whether the mender will accept more input. A
  // `MAX_BUFFER_BYTES_EXCEEDED` freeze that lands exactly on an
  // already-complete value (or, via `finish()`, an already-terminated root
  // number) doesn't roll anything back, so `complete` stays `true` — with
  // no diagnostic, because none is warranted. `MAX_DEPTH_EXCEEDED` and
  // `JsonMendDuplicateKeyError` can never reach that state (proven in
  // `repair-suffix.ts`'s comment on `complete`: both always fire while a
  // frame is still open, or before any value exists at all), so they are
  // unaffected and keep reporting `complete: false` exactly as before.
  //
  // This table pins every combination the ruling depends on.
  it('the full comparison: resource-limit freeze on a complete value vs. genuine trailing data vs. a still-open structure', () => {
    // Row 1: MAX_BUFFER_BYTES_EXCEEDED after the document was already
    // complete — the case this ruling is about.
    const capAfterComplete = createJsonMender({ maxBufferBytes: 10 });
    capAfterComplete.push('{"a":1}');
    expect(() => capAfterComplete.push('xxxx')).toThrow(JsonMendLimitError);
    const row1 = capAfterComplete.snapshot();
    expect(row1.value).toEqual({ a: 1 });
    expect(row1.complete).toBe(true); // <- the ruling
    expect(row1.diagnostics).toEqual([]);

    // Row 2: genuine trailing data after the same document (no resource
    // limit involved at all) — the pre-existing precedent for a
    // true -> false transition, unaffected by this ruling.
    const realTrailingData = createJsonMender();
    realTrailingData.push('{"a":1}');
    realTrailingData.push('x');
    const row2 = realTrailingData.snapshot();
    expect(row2.value).toEqual({ a: 1 });
    expect(row2.complete).toBe(false);
    expect(row2.diagnostics.map((d) => d.code)).toEqual(['trailing-data-ignored']);

    // Row 3: MAX_BUFFER_BYTES_EXCEEDED while the document was still open
    // (a key with no value yet) — `complete` stays `false`, for an entirely
    // ordinary reason (a member was rolled back), independent of this
    // ruling.
    const capMidDocument = createJsonMender({ maxBufferBytes: 8 });
    capMidDocument.push('{"a":');
    expect(() => capMidDocument.push('xxxxxxxxxx')).toThrow(JsonMendLimitError);
    const row3 = capMidDocument.snapshot();
    expect(row3.value).toEqual({});
    expect(row3.complete).toBe(false);
    expect(row3.diagnostics.map((d) => d.code)).toEqual(['member-removed', 'closers-appended']);
  });

  it('MAX_DEPTH_EXCEEDED and JsonMendDuplicateKeyError never reach the "otherwise complete" branch, so they are unaffected by this ruling', () => {
    const depthFrozen = createJsonMender({ maxDepth: 1 });
    expect(() => depthFrozen.push('{"a":{"b":1}}')).toThrow(JsonMendLimitError);
    expect(depthFrozen.snapshot().complete).toBe(false);
    expect(depthFrozen.finish().complete).toBe(false);

    const dupFrozen = createJsonMender({ duplicateKeyPolicy: 'error' });
    dupFrozen.push('{"a":1,');
    expect(() => dupFrozen.push('"a":2}')).toThrow(JsonMendDuplicateKeyError);
    expect(dupFrozen.snapshot().complete).toBe(false);
    expect(dupFrozen.finish().complete).toBe(false);
  });
});

describe('property: prefix + appendedSuffix always parses, and a committed complete value is never later undefined', () => {
  const SEED = 0x68696732;
  const RUNS = 300;

  const jsonValue = fc.letrec<{ value: unknown; object: unknown; array: unknown }>((tie) => ({
    value: fc.oneof(
      { depthSize: 'small' },
      fc.constant(null),
      fc.boolean(),
      fc.double({ noNaN: true, noDefaultInfinity: true, min: -1e6, max: 1e6 }),
      fc.integer({ min: -100_000, max: 100_000 }),
      fc.string({ maxLength: 20 }),
      tie('object'),
      tie('array'),
    ),
    object: fc.dictionary(fc.string({ minLength: 1, maxLength: 8 }), tie('value'), { maxKeys: 4 }),
    array: fc.array(tie('value'), { maxLength: 4 }),
  })).value;
  const jsonDocument = jsonValue.map((value) => JSON.stringify(value));

  it('holds across random chunk splits with random trailing garbage appended after completion', () => {
    fc.assert(
      fc.property(
        jsonDocument,
        fc.array(fc.integer({ min: 1, max: 13 }), { minLength: 1, maxLength: 20 }),
        fc.array(fc.constantFrom('x', '\n', '```', ' ', ']', '}', ',', '{"', ':', '   z'), {
          minLength: 0,
          maxLength: 4,
        }),
        (doc, chunkSizes, trailingChunks) => {
          const mender = createJsonMender();
          let offset = 0;
          let sawComplete = false;
          let committedValueJson: string | undefined;

          function check(snap: {
            value: unknown;
            repairedJson: string | undefined;
            complete: boolean;
          }): void {
            if (snap.value !== undefined) {
              expect(snap.repairedJson).toBeDefined();
              expect(() => JSON.parse(snap.repairedJson as string)).not.toThrow();
            } else {
              expect(snap.repairedJson).toBeUndefined();
            }
            if (snap.complete) {
              expect(snap.value).toBeDefined();
              sawComplete = true;
              committedValueJson = JSON.stringify(snap.value);
            } else if (sawComplete) {
              expect(snap.value).toBeDefined();
              expect(JSON.stringify(snap.value)).toBe(committedValueJson);
            }
          }

          for (const size of chunkSizes) {
            if (offset >= doc.length) break;
            const chunk = doc.slice(offset, offset + size);
            offset += size;
            check(mender.push(chunk));
          }
          if (offset < doc.length) {
            check(mender.push(doc.slice(offset)));
          }
          for (const trailing of trailingChunks) {
            check(mender.push(trailing));
          }
          check(mender.finish());
        },
      ),
      { seed: SEED, numRuns: RUNS },
    );
  });
});
