/**
 * UTF-8 byte-split tests: the same representative documents as
 * `split-point.test.ts`, but split as raw UTF-8 bytes at every
 * byte boundary — including boundaries that land in the middle of a
 * multi-byte code point. Also exercises `createManualUtf8Decoder` directly,
 * so the fallback path is proven correct even on a runtime (this one) where
 * the platform `TextDecoder` is what `createUtf8Decoder` actually picks.
 */
import { describe, expect, it } from 'vitest';
import { createJsonMender } from '../src/create-json-mender.js';
import { createManualUtf8Decoder, createUtf8Decoder } from '../src/utf8-decoder.js';

const MULTIBYTE_DOCUMENTS: readonly string[] = [
  '{"emoji":"🚀🎉 hello world"}',
  '{"cjk":"日本語のテキスト"}',
  '{"cyrillic":"Привет, мир!"}',
  '{"mixed":"café 😀 日本語 Привет"}',
  '{"zwj":"👨‍👩‍👧‍👦 family"}',
  '{"combining":"é café"}', // combining acute accent + precomposed é
];

describe('byte-split tests: every byte boundary of multi-byte UTF-8 content', () => {
  for (const doc of MULTIBYTE_DOCUMENTS) {
    const bytes = new TextEncoder().encode(doc);
    describe(JSON.stringify(doc), () => {
      for (let i = 1; i < bytes.length; i += 1) {
        it(`split at byte ${String(i)}/${String(bytes.length)}`, () => {
          const mender = createJsonMender();
          const r1 = mender.push(bytes.slice(0, i));
          if (r1.value !== undefined) {
            expect(() => JSON.parse(r1.repairedJson as string)).not.toThrow();
          }
          const r2 = mender.push(bytes.slice(i));
          if (r2.value !== undefined) {
            expect(() => JSON.parse(r2.repairedJson as string)).not.toThrow();
          }
          const final = mender.finish();
          expect(final.complete).toBe(true);
          expect(final.value).toEqual(JSON.parse(doc));
        });
      }
    });
  }
});

describe('byte-split tests: many single-byte chunks', () => {
  it('reassembles correctly when every byte arrives as its own chunk', () => {
    const doc = '{"greeting":"こんにちは 🌏"}';
    const bytes = new TextEncoder().encode(doc);
    const mender = createJsonMender();
    for (let i = 0; i < bytes.length; i += 1) {
      mender.push(bytes.slice(i, i + 1));
    }
    const final = mender.finish();
    expect(final.complete).toBe(true);
    expect(final.value).toEqual(JSON.parse(doc));
  });
});

describe('createManualUtf8Decoder', () => {
  it('decodes ASCII directly', () => {
    const decoder = createManualUtf8Decoder();
    expect(decoder.decode(new TextEncoder().encode('hello'))).toBe('hello');
  });

  it('decodes multi-byte sequences split across every byte boundary', () => {
    const text = '日本語 café 🚀👨‍👩‍👧‍👦';
    const bytes = new TextEncoder().encode(text);
    for (let i = 1; i < bytes.length; i += 1) {
      const decoder = createManualUtf8Decoder();
      const out = decoder.decode(bytes.slice(0, i)) + decoder.decode(bytes.slice(i));
      expect(out, `split at byte ${String(i)}`).toBe(text);
    }
  });

  it('replaces an invalid leading byte with U+FFFD and resynchronizes', () => {
    const decoder = createManualUtf8Decoder();
    // 0xFF is never a valid UTF-8 leading byte.
    const out = decoder.decode(new Uint8Array([0x61, 0xff, 0x62]));
    expect(out).toBe('a�b');
  });

  it('replaces a sequence with an invalid continuation byte', () => {
    const decoder = createManualUtf8Decoder();
    // 0xC2 announces a 2-byte sequence; 0x20 (space) is not a valid continuation byte.
    const out = decoder.decode(new Uint8Array([0xc2, 0x20]));
    expect(out).toBe('� ');
  });

  it('carries an incomplete trailing sequence across decode() calls', () => {
    const decoder = createManualUtf8Decoder();
    const bytes = new TextEncoder().encode('€'); // 3-byte sequence
    const first = decoder.decode(bytes.slice(0, 2));
    expect(first).toBe('');
    const second = decoder.decode(bytes.slice(2));
    expect(second).toBe('€');
  });
});

describe('createUtf8Decoder', () => {
  it('picks a working decoder on this runtime', () => {
    const decoder = createUtf8Decoder();
    expect(decoder.decode(new TextEncoder().encode('hello 🌍'))).toBe('hello 🌍');
  });
});
