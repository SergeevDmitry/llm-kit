/**
 * Tests for `StreamingUtf8Decoder#finish()`: resolving a trailing partial
 * multi-byte sequence at end-of-stream.
 *
 * Without it, a byte stream that ended mid-multi-byte-character had its
 * trailing bytes silently dropped: `create-json-mender.ts`'s `finish()`
 * called `buildSnapshot` directly and never asked the decoder whether
 * anything was still buffered. `finish()` on `StreamingUtf8Decoder` is
 * implemented on both the platform-backed decoder (`createUtf8Decoder`, via
 * a real `TextDecoder`) and the manual fallback (`createManualUtf8Decoder`),
 * and wired into `JsonMender#finish()`/mixed-chunk handling in
 * `create-json-mender.ts`.
 *
 * Every assertion here that has a real `TextDecoder` reference behavior is
 * checked against it directly, rather than against a description of it.
 */
import { describe, expect, it } from 'vitest';
import { createManualUtf8Decoder, createUtf8Decoder } from '../src/utf8-decoder.js';
import type { StreamingUtf8Decoder } from '../src/utf8-decoder.js';

/**
 * Reference behavior: stream `chunks` through a real platform `TextDecoder`
 * in streaming mode, then perform a final (non-streaming) decode — exactly
 * what `finish()` is defined to match. `decode()` with no arguments defaults
 * `stream` to `false`, which is the WHATWG "flush a pending partial
 * sequence to U+FFFD" behavior.
 */
function referenceStreamThenFinish(chunks: readonly Uint8Array[]): string {
  const decoder = new TextDecoder('utf-8', { fatal: false });
  let out = '';
  for (const chunk of chunks) {
    out += decoder.decode(chunk, { stream: true });
  }
  out += decoder.decode();
  return out;
}

/** One representative valid character per UTF-8 lead-byte length. */
const REPRESENTATIVE_CHARS: ReadonlyArray<[length: 2 | 3 | 4, char: string]> = [
  [2, 'é'], // U+00E9
  [3, '€'], // U+20AC
  [4, '🚀'], // U+1F680 (surrogate pair in JS)
];

const DECODER_FACTORIES: ReadonlyArray<[name: string, factory: () => StreamingUtf8Decoder]> = [
  ['createManualUtf8Decoder', createManualUtf8Decoder],
  ['createUtf8Decoder (platform TextDecoder on this runtime)', createUtf8Decoder],
];

describe('finish(): trailing partial sequence, every lead length and every truncation point', () => {
  for (const [decoderName, factory] of DECODER_FACTORIES) {
    describe(decoderName, () => {
      for (const [length, char] of REPRESENTATIVE_CHARS) {
        const fullBytes = new TextEncoder().encode(char);
        expect(fullBytes.length).toBe(length);

        for (let truncatedLength = 1; truncatedLength < length; truncatedLength += 1) {
          it(`${length}-byte lead ${JSON.stringify(char)} truncated to ${String(truncatedLength)} byte(s)`, () => {
            const truncated = fullBytes.slice(0, truncatedLength);
            const decoder = factory();
            const streamed = decoder.decode(truncated);
            expect(streamed).toBe(''); // still incomplete: nothing emitted yet
            const flushed = decoder.finish();
            expect(flushed).toBe('�');
            expect(streamed + flushed).toBe(referenceStreamThenFinish([truncated]));
          });
        }
      }
    });
  }
});

describe('finish(): nothing pending', () => {
  for (const [decoderName, factory] of DECODER_FACTORIES) {
    it(`${decoderName}: returns "" on a freshly created decoder`, () => {
      expect(factory().finish()).toBe('');
    });

    it(`${decoderName}: returns "" after a complete character was fully decoded`, () => {
      const decoder = factory();
      expect(decoder.decode(new TextEncoder().encode('hello 🌍'))).toBe('hello 🌍');
      expect(decoder.finish()).toBe('');
    });

    it(`${decoderName}: is idempotent — calling finish() twice in a row returns "" the second time`, () => {
      const decoder = factory();
      decoder.decode(new TextEncoder().encode('€').slice(0, 1));
      expect(decoder.finish()).toBe('�');
      expect(decoder.finish()).toBe('');
    });
  }
});

describe('finish(): resets the decoder so it is reusable for a fresh sequence', () => {
  for (const [decoderName, factory] of DECODER_FACTORIES) {
    it(`${decoderName}: a decode() after finish() starts a clean sequence, not a resumed one`, () => {
      const decoder = factory();
      const partial = new TextEncoder().encode('é').slice(0, 1); // just the lead byte
      decoder.decode(partial);
      expect(decoder.finish()).toBe('�');

      // A fresh, complete, unrelated character decodes correctly — proving
      // finish() didn't leave stale sequence state (codePoint/bytesNeeded)
      // behind to corrupt the next decode.
      const next = new TextEncoder().encode('日本語');
      expect(decoder.decode(next)).toBe('日本語');
    });
  }
});

describe('finish(): exactly one U+FFFD regardless of how many continuation bytes had already arrived', () => {
  for (const [decoderName, factory] of DECODER_FACTORIES) {
    it(`${decoderName}: a 4-byte lead with 1, 2, or 3 continuation bytes each flush to a single U+FFFD`, () => {
      const fullBytes = new TextEncoder().encode('🚀'); // 4 bytes
      for (let truncatedLength = 1; truncatedLength <= 3; truncatedLength += 1) {
        const decoder = factory();
        decoder.decode(fullBytes.slice(0, truncatedLength));
        const flushed = decoder.finish();
        expect(flushed).toBe('�');
        expect(flushed.length).toBe(1);
      }
    });
  }
});

describe('finish(): matches the reference across a byte-by-byte truncation sweep of mixed text', () => {
  for (const [decoderName, factory] of DECODER_FACTORIES) {
    it(`${decoderName}: every prefix length of a multi-script document, decoder.decode(prefix) + decoder.finish()`, () => {
      const text = 'café 🚀 日本語のテキスト Привет!';
      const fullBytes = new TextEncoder().encode(text);
      for (let cut = 0; cut <= fullBytes.length; cut += 1) {
        const prefix = fullBytes.slice(0, cut);
        const decoder = factory();
        const streamed = decoder.decode(prefix);
        const flushed = decoder.finish();
        expect(streamed + flushed, `cut at byte ${String(cut)}`).toBe(
          referenceStreamThenFinish([prefix]),
        );
      }
    });
  }
});
