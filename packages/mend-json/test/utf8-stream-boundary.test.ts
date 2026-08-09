/**
 * `createJsonMender`-level tests for two hazards: bytes silently dropped at
 * end-of-stream, and mixed string/byte chunks reordering the stream.
 *
 * `test/utf8-decoder-finish.test.ts` proves `StreamingUtf8Decoder#finish()`
 * itself matches the platform `TextDecoder`; this file proves
 * `create-json-mender.ts` calls it at the right moments — `finish()`, and
 * before scanning a `string` chunk that follows byte chunks with something
 * still pending — and that doing so fixes both hazards without breaking
 * the ordinary all-string / all-bytes streaming paths.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { createJsonMender } from '../src/create-json-mender.js';
import { mendJson } from '../src/index.js';

const FAST_CHECK_SEED = 0x666c7368; // 'flsh'
const FAST_CHECK_RUNS = 300;

/** Reference: stream `chunks` through a real `TextDecoder`, then finalize — what `finish()` is defined to match. */
function referenceStreamThenFinish(chunks: readonly Uint8Array[]): string {
  const decoder = new TextDecoder('utf-8', { fatal: false });
  let out = '';
  for (const chunk of chunks) out += decoder.decode(chunk, { stream: true });
  out += decoder.decode();
  return out;
}

describe('bytes-only trailing partial sequence at end of stream', () => {
  it('resolves the trailing byte to U+FFFD, matching a final TextDecoder.decode()', () => {
    const mender = createJsonMender();
    mender.push(new Uint8Array([0x22, 0x61, 0xe2])); // '"a' + a lone 3-byte lead
    const r = mender.finish();

    // Pinned exact value: the trailing 0xe2 (an incomplete 3-byte lead) is
    // exactly what a real, final `TextDecoder.decode()` turns into a single
    // U+FFFD — verified directly below against the platform decoder.
    expect(r.value).toBe('a�');
    expect(r.repairedJson).toBe(JSON.stringify('a�'));
    expect(() => JSON.parse(r.repairedJson as string)).not.toThrow();

    const reference = referenceStreamThenFinish([new Uint8Array([0x22, 0x61, 0xe2])]);
    expect(reference).toBe('"a�');
    expect(r.value).toBe(reference.slice(1)); // drop the opening quote consumed by the JSON grammar
  });
});

describe('mixed string/byte chunks preserve logical stream order', () => {
  it('flushes the pending byte sequence before the string chunk instead of reordering across it', () => {
    const mender = createJsonMender();
    mender.push(new Uint8Array([0x22, 0xe2])); // '"' + the lead byte of '€' (0xe2 0x82 0xac)
    mender.push('x'); // a string chunk arrives before the sequence completes
    mender.push(new Uint8Array([0x82, 0xac, 0x22])); // the rest of '€''s bytes, plus the closing quote
    const r = mender.finish();

    // Defined behavior, pinned (no TextDecoder analogue exists for mixed
    // string/Uint8Array input): flushing the pending 0xe2 resolves it to
    // U+FFFD *before* "x" is scanned, preserving arrival
    // order. The 0x82/0xac bytes that arrive afterward are no longer part
    // of any pending sequence (the decoder was reset by the flush), so each
    // is scanned as an orphan continuation byte and independently resolves
    // to its own U+FFFD — this is the correct WHATWG resynchronization
    // behavior for a bare continuation byte with no lead, not a second bug.
    // The critical property this pins is *order*: "x" appears exactly once,
    // between the two U+FFFDs contributed by the two byte chunks, matching
    // the sequence the caller actually pushed.
    expect(r.value).toBe('�x��');
    expect(r.repairedJson).toBe(JSON.stringify('�x��'));
    expect(r.complete).toBe(true);

    // Guard against reordering: a decoder that resolves the pending byte
    // after "x" instead of before it would produce "x€".
    expect(r.value).not.toBe('x€');
  });

  it('a string chunk that follows only *complete* byte chunks is unaffected (flush is a no-op)', () => {
    const mender = createJsonMender();
    mender.push(new Uint8Array([0x22])); // '"'
    mender.push(new TextEncoder().encode('€')); // complete char, nothing left pending
    mender.push('x"');
    const r = mender.finish();
    expect(r.value).toBe('€x');
    expect(r.complete).toBe(true);
  });
});

describe('bytes-only trailing-prefix cases for every UTF-8 sequence length, truncated at every possible position', () => {
  const REPRESENTATIVE_CHARS: ReadonlyArray<[length: 2 | 3 | 4, char: string]> = [
    [2, 'é'],
    [3, '€'],
    [4, '🚀'],
  ];

  for (const [length, char] of REPRESENTATIVE_CHARS) {
    const charBytes = new TextEncoder().encode(char);
    expect(charBytes.length).toBe(length);

    for (let truncatedLength = 1; truncatedLength < length; truncatedLength += 1) {
      it(`${length}-byte lead ${JSON.stringify(char)} truncated to ${String(truncatedLength)} byte(s) inside a JSON string`, () => {
        const truncated = charBytes.slice(0, truncatedLength);
        const fullInput = new Uint8Array([0x22, ...truncated]); // '"' + the truncated char

        const mender = createJsonMender();
        mender.push(fullInput);
        const r = mender.finish();

        const reference = referenceStreamThenFinish([fullInput]);
        expect(r.value, `truncated to ${String(truncatedLength)} bytes`).toBe(reference.slice(1));
        expect(() => JSON.parse(r.repairedJson as string)).not.toThrow();
      });
    }
  }

  it('the same sweep also holds when the truncated bytes arrive as their own trailing push()', () => {
    for (const [length, char] of REPRESENTATIVE_CHARS) {
      const charBytes = new TextEncoder().encode(char);
      for (let truncatedLength = 1; truncatedLength < length; truncatedLength += 1) {
        const truncated = charBytes.slice(0, truncatedLength);
        const mender = createJsonMender();
        mender.push(new Uint8Array([0x22, 0x61])); // '"a'
        mender.push(truncated);
        const r = mender.finish();
        const reference = referenceStreamThenFinish([new Uint8Array([0x22, 0x61]), truncated]);
        expect(r.value, `${String(length)}-byte lead cut to ${String(truncatedLength)}`).toBe(
          reference.slice(1),
        );
      }
    }
  });
});

describe('explicit alternating string/byte chunk sequences', () => {
  it('string, bytes(partial), string, bytes(rest) — flush happens exactly once, at the second string', () => {
    const mender = createJsonMender();
    mender.push('{"greeting":"');
    mender.push(new TextEncoder().encode('日').slice(0, 1)); // lead byte of a 3-byte CJK char, incomplete
    mender.push('x'); // flush point: the pending byte resolves to U+FFFD here
    mender.push(new TextEncoder().encode('本')); // a fresh, complete, unrelated character
    const r = mender.push('"}');
    expect(r.value).toEqual({ greeting: '�x本' });
    expect(r.complete).toBe(true);
  });

  it('bytes, string, bytes, string — repeated transitions never throw and never drop content', () => {
    const mender = createJsonMender();
    mender.push(new Uint8Array([0x22])); // '"'
    mender.push('a');
    mender.push(new TextEncoder().encode('b'));
    mender.push('c');
    const r = mender.push('"');
    expect(r.value).toBe('abc');
    expect(r.complete).toBe(true);
  });

  it('finish() called directly after a string chunk (no bytes pending) does not spuriously flush', () => {
    const mender = createJsonMender();
    mender.push(new TextEncoder().encode('"ab')); // complete bytes, nothing pending
    mender.push('c"');
    const r = mender.finish();
    expect(r.value).toBe('abc');
    expect(r.diagnostics).toEqual([]); // fully valid, complete — no repair of any kind
  });
});

describe('push() after finish(): the state machine stays coherent', () => {
  it('a further byte push after finish() flushed a pending sequence starts a clean new sequence', () => {
    const mender = createJsonMender();
    mender.push(new Uint8Array([0x22, 0xe2])); // '"' + a lone 3-byte lead
    const afterFinish = mender.finish();
    expect(afterFinish.value).toBe('�');
    expect(afterFinish.complete).toBe(false);

    // Not part of the documented contract, but nothing forbids it either:
    // the decoder was left freshly reset by finish()'s flush, so this new
    // byte chunk must decode as its own clean sequence, not as a resumption
    // of the byte already flushed.
    const afterMore = mender.push(new Uint8Array([0x61, 0x22])); // 'a' + closing quote
    expect(afterMore.value).toBe('�a');
    expect(afterMore.complete).toBe(true);

    const secondFinish = mender.finish();
    expect(secondFinish.value).toBe('�a');
    expect(secondFinish.complete).toBe(true);
  });

  it('finish() is idempotent when nothing was pending', () => {
    const mender = createJsonMender();
    mender.push('{"a":1}');
    const first = mender.finish();
    const second = mender.finish();
    expect(second).toEqual(first);
  });

  it('reset() after a flush clears the flush flag too — a fresh byte chunk is not treated as a continuation', () => {
    const mender = createJsonMender();
    mender.push(new Uint8Array([0x22, 0xe2]));
    mender.finish();
    mender.reset();
    const r = mender.push('{"b":2}');
    expect(r.value).toEqual({ b: 2 });
    expect(r.complete).toBe(true);
  });
});

describe('property: well-formed mixed chunks (byte chunks that are whole characters) round-trip exactly', () => {
  it('splitting a valid document into random string/byte pieces at character boundaries never changes the result', () => {
    const documents = [
      '{"a":"café","b":"🚀🚀","c":"日本語","d":[1,2,3]}',
      '{"emoji":"😀","nested":{"x":"Привет"}}',
    ];
    fc.assert(
      fc.property(
        fc.constantFrom(...documents),
        fc.array(fc.boolean(), { minLength: 1, maxLength: 12 }),
        (doc, asBytesFlags) => {
          // Split at *character* boundaries (never inside a multi-byte
          // sequence), then push each piece as either a string or its
          // Uint8Array encoding — every byte chunk here is always a whole
          // number of complete characters, so no flush is ever load-bearing;
          // this proves flushing (a no-op in this case) never corrupts the
          // ordinary streaming path.
          const chars = Array.from(doc);
          const pieceCount = Math.min(asBytesFlags.length, chars.length) || 1;
          const mender = createJsonMender();
          let idx = 0;
          for (let i = 0; i < pieceCount; i += 1) {
            const remaining = chars.length - idx;
            const take =
              i === pieceCount - 1
                ? remaining
                : Math.max(1, Math.floor(remaining / (pieceCount - i)));
            const piece = chars.slice(idx, idx + take).join('');
            idx += take;
            if (piece.length === 0) continue;
            mender.push(asBytesFlags[i] ? new TextEncoder().encode(piece) : piece);
          }
          const r = mender.finish();
          expect(r.complete).toBe(true);
          expect(r.value).toEqual(JSON.parse(doc));
        },
      ),
      { seed: FAST_CHECK_SEED, numRuns: FAST_CHECK_RUNS },
    );
  });
});

describe('mendJson() one-shot API sees the same finish()-time flush', () => {
  it('a truncated byte payload passed to mendJson() resolves its trailing partial sequence, not drops it', () => {
    const r = mendJson(new Uint8Array([0x22, 0x61, 0xe2]));
    expect(r.value).toBe('a�');
  });
});
