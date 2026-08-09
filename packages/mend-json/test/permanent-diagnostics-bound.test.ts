/**
 * `repair-suffix.ts`'s `buildSnapshot` collects `permanentDiagnostics`
 * (`state-machine.ts`) with a plain loop rather than
 * `diagnostics.push(...state.permanentDiagnostics)`. `permanentDiagnostics`
 * grows by one entry per duplicate object key skipped under
 * `duplicateKeyPolicy: 'first'`, a direct function of untrusted input size
 * — well past the engine's argument-count limit at a fifth of this
 * package's own documented `maxBufferBytes` default (10 MB), a spread would
 * throw a raw `RangeError` out of `snapshot()` after scanning had already
 * advanced, leaving the scanner unfrozen and `permanentDiagnostics` never
 * shrinking, so every later `snapshot()`/`finish()` would throw the same
 * error.
 *
 * Three things are tested here:
 *
 * 1. No `RangeError` at a size well above the argument limit, correct
 *    value/diagnostics, mender still usable afterward.
 * 2. The general property this relies on: a `snapshot()` that throws for
 *    *any* reason must not corrupt the mender or make its last valid
 *    prefix unreachable — `buildSnapshot` never mutates `ScannerState`, so
 *    this should already hold, and this test proves it with fault
 *    injection rather than by inspection.
 * 3. `permanentDiagnostics` is bounded (`MAX_PERMANENT_DIAGNOSTICS`,
 *    `limits.ts`) regardless of `includeDiagnostics` — so retained memory
 *    stays bounded too, not just the crash. The cap engages visibly
 *    (`'diagnostics-truncated'`), not silently.
 */
import { describe, expect, it } from 'vitest';
import { createJsonMender } from '../src/create-json-mender.js';
import { mendJson } from '../src/index.js';
import { MAX_PERMANENT_DIAGNOSTICS } from '../src/limits.js';

// Simple reproduction shape: `{"k":0,"k":1,...}` — repeated keys, nothing exotic.
function buildDuplicateKeyDocument(memberCount: number): string {
  const members: string[] = [];
  for (let i = 0; i < memberCount; i += 1) {
    members.push(`"k":${String(i)}`);
  }
  return `{${members.join(',')}}`;
}

describe('permanentDiagnostics: no RangeError at a size well above the argument limit', () => {
  it('150,000 duplicate keys (well past the ~125,000-argument spread limit) does not throw', () => {
    const doc = buildDuplicateKeyDocument(150_000);

    let result: ReturnType<typeof mendJson> | undefined;
    expect(() => {
      result = mendJson(doc, { duplicateKeyPolicy: 'first' });
    }).not.toThrow();

    expect(result).toBeDefined();
    const r = result!;
    // Not `complete: true` — dropping every later duplicate is itself a
    // repair (an exclusion), so this is "valid after repair", not "valid
    // as-is". `mendJson`'s `mendJson` wrapper always calls `finish()`.
    expect(r.complete).toBe(false);
    expect(r.value).toEqual({ k: 0 }); // 'first' policy: earliest value wins
    expect(() => JSON.parse(r.repairedJson as string)).not.toThrow();

    // The repair itself is unaffected by the diagnostics cap: every
    // duplicate past the first is still dropped from the parsed value and
    // from repairedJson, capped diagnostics or not.
    expect(JSON.parse(r.repairedJson as string)).toEqual({ k: 0 });
  });

  it('200,000 duplicate keys streamed chunk-by-chunk through the stateful API stays usable throughout', () => {
    const doc = buildDuplicateKeyDocument(200_000);
    const mender = createJsonMender({ duplicateKeyPolicy: 'first' });

    const chunkSize = 4096;
    let last: ReturnType<typeof mender.push> | undefined;
    for (let i = 0; i < doc.length; i += chunkSize) {
      expect(() => {
        last = mender.push(doc.slice(i, i + chunkSize));
      }).not.toThrow();
    }
    const final = mender.finish();

    expect(last).toBeDefined();
    expect(final.value).toEqual({ k: 0 });
    expect(final.complete).toBe(false); // duplicate-key exclusion is a repair, not "as-is valid"

    // Still usable afterward — not bricked, no reset() required.
    expect(() => mender.snapshot()).not.toThrow();
    expect(mender.snapshot().value).toEqual({ k: 0 });
  });
});

describe('permanentDiagnostics: bounded and the truncation is visible, not silent', () => {
  it('caps duplicate-key-skipped entries at MAX_PERMANENT_DIAGNOSTICS and records one diagnostics-truncated entry', () => {
    const memberCount = MAX_PERMANENT_DIAGNOSTICS + 500; // more duplicates than the cap allows
    const doc = buildDuplicateKeyDocument(memberCount);
    const r = mendJson(doc, { duplicateKeyPolicy: 'first' });

    const skipped = r.diagnostics.filter((d) => d.code === 'duplicate-key-skipped');
    const truncated = r.diagnostics.filter((d) => d.code === 'diagnostics-truncated');

    expect(skipped).toHaveLength(MAX_PERMANENT_DIAGNOSTICS);
    expect(truncated).toHaveLength(1);
    // Bounded overall: no growth proportional to the (much larger) actual
    // number of duplicates skipped (memberCount - 1).
    expect(r.diagnostics.length).toBe(MAX_PERMANENT_DIAGNOSTICS + 1);

    // The truncation marker documents itself, safe to log.
    expect(truncated[0]?.message).not.toBe('');
    expect(typeof truncated[0]?.offset).toBe('number');
  });

  it('does not truncate when the number of duplicates stays under the cap', () => {
    const doc = buildDuplicateKeyDocument(10);
    const r = mendJson(doc, { duplicateKeyPolicy: 'first' });

    expect(r.diagnostics.filter((d) => d.code === 'duplicate-key-skipped')).toHaveLength(9);
    expect(r.diagnostics.some((d) => d.code === 'diagnostics-truncated')).toBe(false);
  });

  it('the cap is a fixed constant, not proportional to input — doubling the duplicate count changes nothing about diagnostics size', () => {
    const small = mendJson(buildDuplicateKeyDocument(MAX_PERMANENT_DIAGNOSTICS + 1000), {
      duplicateKeyPolicy: 'first',
    });
    const large = mendJson(buildDuplicateKeyDocument((MAX_PERMANENT_DIAGNOSTICS + 1000) * 5), {
      duplicateKeyPolicy: 'first',
    });

    expect(small.diagnostics.length).toBe(large.diagnostics.length);
    expect(small.diagnostics.length).toBe(MAX_PERMANENT_DIAGNOSTICS + 1);
  });
});

describe('general recoverability: a snapshot() that throws for any reason must not corrupt the mender', () => {
  it('a snapshot() failure from an unrelated, injected fault still leaves the last valid prefix reachable afterward', () => {
    const mender = createJsonMender();
    mender.push('{"a":"unfinished');

    const before = mender.snapshot();
    expect(before.value).toEqual({ a: 'unfinished' });
    expect(before.diagnostics.map((d) => d.code)).toEqual(
      expect.arrayContaining(['string-closed', 'closers-appended']),
    );

    // Fault injection, not a real bug: proves the *general* property —
    // buildSnapshot never mutates ScannerState, so a throw from inside it,
    // for any reason, must not corrupt anything. One-shot:
    // the mock restores itself before throwing, so it cannot affect anything
    // outside the single `mender.snapshot()` call below.
    const originalPush = Array.prototype.push;
    Array.prototype.push = function pushOnceThenThrow(this: unknown[]): number {
      Array.prototype.push = originalPush;
      throw new RangeError('injected fault (test only): simulates an unrelated snapshot() failure');
    } as typeof Array.prototype.push;

    let threw: unknown;
    try {
      mender.snapshot();
    } catch (error) {
      threw = error;
    } finally {
      Array.prototype.push = originalPush; // belt and suspenders
    }
    expect(threw).toBeInstanceOf(RangeError);

    // Recoverable without reset(): the next snapshot() is identical to the
    // one taken before the injected failure.
    const after = mender.snapshot();
    expect(after).toEqual(before);

    // And the mender keeps accepting new input normally — not bricked.
    const done = mender.push(' more"}');
    expect(done.value).toEqual({ a: 'unfinished more' });
    expect(done.complete).toBe(true);
  });
});
