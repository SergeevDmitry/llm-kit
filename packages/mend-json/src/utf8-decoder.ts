/**
 * Streaming UTF-8 -> JS string decoder for `Uint8Array` chunks.
 *
 * A chunk boundary can land in the middle of a multi-byte code point (a
 * consumer forwarding raw bytes off a network socket has no reason to align
 * chunks to character boundaries). This decoder buffers a trailing partial
 * sequence across calls so `decode()` never emits a broken or split
 * surrogate pair — the scanner downstream only ever sees whole characters.
 *
 * `finish()` is the other half of that contract: it is how a caller (here,
 * `create-json-mender.ts`, on `JsonMender#finish()` and on any transition
 * from a byte chunk to a string chunk) declares that no more bytes are
 * coming for now, so whatever partial sequence is still buffered must be
 * resolved rather than held forever. A held-forever partial sequence would
 * mean the trailing bytes of a truncated byte-only stream silently vanish —
 * exactly the failure this module's contract (below) rules out.
 *
 * The platform `TextDecoder` already does exactly this in streaming mode
 * (`{ stream: true }`), so it is used when available. `createManualUtf8Decoder`
 * is a deterministic fallback for a runtime without it, exported separately
 * so it can be tested directly regardless of which path the host runtime
 * takes.
 */

export interface StreamingUtf8Decoder {
  /** Decodes `chunk`, returning only the complete characters it can produce so far. */
  decode(chunk: Uint8Array): string;
  /**
   * Ends the byte stream: resolves whatever partial multi-byte sequence is
   * still buffered into exactly one `U+FFFD` (matching a non-streaming/final
   * `TextDecoder.decode()` — i.e. `decode(bytes)` with no `stream` option, or
   * `decode(bytes, { stream: false })`), or returns `''` when nothing is
   * pending. Also resets internal sequence state, so the decoder is
   * immediately reusable for a fresh byte stream — calling `decode()` again
   * afterward starts clean, exactly as if the decoder had just been created.
   * Idempotent: calling `finish()` twice in a row returns `''` the second
   * time.
   */
  finish(): string;
}

/**
 * Manual streaming UTF-8 decoder, implementing the WHATWG Encoding
 * Standard's UTF-8 decoder algorithm directly (byte-range boundaries per
 * lead byte, not "decode then validate the code point") so behavior matches
 * the platform `TextDecoder` exactly, including its error-recovery
 * resynchronization: an out-of-range continuation byte is never consumed as
 * part of the failed sequence — it is re-examined as a fresh lead byte on
 * the next iteration, same as the spec's "prepend byte to stream" step.
 *
 * The lead-byte boundary tables below reject, as a `U+FFFD` replacement
 * rather than a valid character, everything the WHATWG decoder rejects:
 * overlong encodings (`0xE0`/`0xF0` narrow their first continuation byte's
 * lower bound so a shorter encoding of the same code point is impossible to
 * reach), surrogates `U+D800`-`U+DFFF` (`0xED` narrows its upper bound so
 * the second continuation byte can't complete one), and code points above
 * `U+10FFFF` (`0xF4` narrows its upper bound so the first continuation byte
 * can't complete one). This never throws — a malformed byte is always
 * replaced with `U+FFFD` and scanning resumes, matching the module's
 * contract: never crash, never silently drop bytes, never corrupt a
 * byte-split multi-byte character.
 *
 * State (`codePoint`/`bytesNeeded`/`bytesSeen`/the boundary pair) is held
 * across `decode()` calls, not reset per call, which is what lets a
 * truncated-but-valid multi-byte prefix survive a chunk boundary: if a
 * chunk ends mid-sequence, the next `decode()` call resumes accumulating
 * exactly where the last one left off instead of re-deriving anything from
 * a rescanned buffer.
 */
export function createManualUtf8Decoder(): StreamingUtf8Decoder {
  let codePoint = 0;
  let bytesNeeded = 0;
  let bytesSeen = 0;
  let lowerBoundary = 0x80;
  let upperBoundary = 0xbf;

  function resetSequence(): void {
    codePoint = 0;
    bytesNeeded = 0;
    bytesSeen = 0;
    lowerBoundary = 0x80;
    upperBoundary = 0xbf;
  }

  return {
    decode(chunk: Uint8Array): string {
      let output = '';
      let i = 0;

      while (i < chunk.length) {
        const byte = chunk[i] as number;

        if (bytesNeeded === 0) {
          if (byte <= 0x7f) {
            output += String.fromCharCode(byte);
            i += 1;
            continue;
          }
          if (byte >= 0xc2 && byte <= 0xdf) {
            bytesNeeded = 1;
            codePoint = byte & 0x1f;
            i += 1;
            continue;
          }
          if (byte >= 0xe0 && byte <= 0xef) {
            if (byte === 0xe0)
              lowerBoundary = 0xa0; // reject overlong 3-byte (< U+0800)
            else if (byte === 0xed) upperBoundary = 0x9f; // reject surrogates U+D800-U+DFFF
            bytesNeeded = 2;
            codePoint = byte & 0xf;
            i += 1;
            continue;
          }
          if (byte >= 0xf0 && byte <= 0xf4) {
            if (byte === 0xf0)
              lowerBoundary = 0x90; // reject overlong 4-byte (< U+10000)
            else if (byte === 0xf4) upperBoundary = 0x8f; // reject code points above U+10FFFF
            bytesNeeded = 3;
            codePoint = byte & 0x7;
            i += 1;
            continue;
          }
          // 0x80-0xC1 (bare continuation byte or overlong 2-byte lead) or
          // 0xF5-0xFF (would decode past U+10FFFF): never a valid lead byte.
          output += '�';
          i += 1;
          continue;
        }

        // Expecting the next continuation byte of an in-progress sequence.
        if (byte < lowerBoundary || byte > upperBoundary) {
          // Out of range: the sequence so far is malformed. Emit one U+FFFD
          // for it and reprocess *this* byte as a fresh lead byte — do not
          // advance `i` — matching the WHATWG "restore byte to stream" step.
          resetSequence();
          output += '�';
          continue;
        }

        lowerBoundary = 0x80;
        upperBoundary = 0xbf;
        codePoint = (codePoint << 6) | (byte & 0x3f);
        bytesSeen += 1;
        i += 1;

        if (bytesSeen !== bytesNeeded) {
          continue; // more continuation bytes needed
        }

        output += String.fromCodePoint(codePoint);
        resetSequence();
      }

      return output;
    },

    finish(): string {
      // A pending sequence (`bytesNeeded > 0`, however many continuation
      // bytes have been seen so far) is, at end-of-stream, exactly the
      // "incomplete sequence at end of I/O" case the WHATWG UTF-8 decoder
      // algorithm resolves to a single replacement character, regardless of
      // how many bytes were accumulated — verified against the platform
      // `TextDecoder` in `test/utf8-decoder-finish.test.ts`.
      if (bytesNeeded === 0) {
        return '';
      }
      resetSequence();
      return '�';
    },
  };
}

/** Builds the best available streaming UTF-8 decoder for the current runtime. */
export function createUtf8Decoder(): StreamingUtf8Decoder {
  const Decoder = (globalThis as { TextDecoder?: typeof TextDecoder }).TextDecoder;
  if (typeof Decoder === 'function') {
    const decoder = new Decoder('utf-8', { fatal: false });
    return {
      decode(chunk: Uint8Array): string {
        return decoder.decode(chunk, { stream: true });
      },
      finish(): string {
        // Calling `decode()` with no arguments defaults `stream` to `false`:
        // per the WHATWG Encoding Standard, that is a *final* decode, which
        // both flushes a pending partial sequence to `U+FFFD` (verified
        // against real `TextDecoder` output — see
        // `test/utf8-decoder-finish.test.ts`) and resets the decoder's
        // internal state, so the same `decoder` instance is safe to feed
        // fresh bytes into afterward via `decode(chunk, { stream: true })`.
        return decoder.decode();
      },
    };
  }
  return createManualUtf8Decoder();
}
