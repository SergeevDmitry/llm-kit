import { headingRef } from '../metadata/heading-path.js';
import type { HeadingRef } from '../types.js';

/**
 * ATX heading: 1-6 `#`, then whitespace, then text; an optional run of
 * trailing `#` (with any whitespace immediately before it) is stripped from
 * the text. A line consisting solely of `#` characters — even more than
 * 6 — is a bare heading marker with empty text, depth capped at 6.
 *
 * A regex-based version of this used a lazy `(.*?)` body group with no
 * anchor on a line lacking a trailing `#`/whitespace, so the engine retried
 * the split point at every offset before giving up — quadratic in line
 * length. `matchAtxHeading` instead finds the same split with two bounded,
 * non-backtracking passes: a fixed-quantifier prefix match (`{1,6}` only
 * ever tries 6 lengths), then a linear backward scan to trim a trailing
 * hash run.
 *
 * Deliberately avoids `.` for the body text: `.` in a non-`dotAll` JS regex
 * cannot match any ECMAScript `LineTerminator` code point (`\n`, `\r`,
 * U+2028, U+2029), so a heading line containing a raw U+2028/U+2029 outside
 * a trailing `#` run would fail to match and fall through to being parsed
 * as a paragraph. This implementation walks the string directly and tests
 * `\s`, which does include U+2028/U+2029, so such a line is recognized as a
 * heading — matching CommonMark, which treats those code points as
 * ordinary characters (only `\n`/`\r`/`\r\n` are line endings). Reachable
 * in practice: `normalizeLineEndings` only rewrites `\r`/`\r\n` and the
 * block parser only splits on `\n`, so a "line" here can still contain a
 * raw U+2028/U+2029 (some PDF/word-processor extraction uses U+2028 as an
 * in-paragraph break). Pinned in `test/markdown-headings.test.ts`
 * (`"line/paragraph separator inside..."`) so nobody reintroduces a
 * `.`-based pattern here thinking it is equivalent — it is not.
 */
const ATX_HASHES_ONLY = /^#+$/;
const ATX_PREFIX = /^(#{1,6})\s+/;

function isAsciiOrUnicodeWhitespace(char: string): boolean {
  return /\s/.test(char);
}

export function matchAtxHeading(trimmedLine: string): { depth: number; text: string } | undefined {
  if (!trimmedLine.startsWith('#')) return undefined;

  // A line that is nothing but `#` (any length, not just <= 6) is a bare
  // marker — depth still caps at 6, matching what the old regex accepted
  // via `#{1,6}` backtracking down to a length the trailing `#*\s*$` could
  // absorb, which only ever succeeded when the whole line was hash chars.
  if (ATX_HASHES_ONLY.test(trimmedLine)) {
    return { depth: Math.min(trimmedLine.length, 6), text: '' };
  }

  const prefix = ATX_PREFIX.exec(trimmedLine);
  if (prefix === null) return undefined;
  const hashes = prefix[1] ?? '';
  const body = trimmedLine.slice(prefix[0].length);

  // Strip a trailing `#` run and any whitespace immediately before it —
  // e.g. "Title ##" -> "Title" — but only when the run reaches the true
  // end of the (already right-trimmed) body; a hash run followed by more
  // real text, like "Title ### foo", is left untouched, matching the old
  // regex's `\s*#*\s*$` anchored at `$`.
  let end = body.length;
  while (end > 0 && body[end - 1] === '#') end -= 1;
  if (end !== body.length) {
    while (end > 0 && isAsciiOrUnicodeWhitespace(body[end - 1] ?? '')) end -= 1;
  }

  return { depth: hashes.length, text: body.slice(0, end).trim() };
}

/** Setext H1 underline: one or more `=`, nothing else on the line. */
const SETEXT_H1_UNDERLINE = /^=+\s*$/;

/** Setext H2 underline: one or more `-`, nothing else on the line (a bare `-` alone is not a list item, which requires trailing content). */
const SETEXT_H2_UNDERLINE = /^-+\s*$/;

export function isSetextH1Underline(trimmedLine: string): boolean {
  return SETEXT_H1_UNDERLINE.test(trimmedLine);
}

export function isSetextH2Underline(trimmedLine: string): boolean {
  return SETEXT_H2_UNDERLINE.test(trimmedLine);
}

/**
 * Mutable heading ancestry stack used while scanning a document top to
 * bottom. `push` pops any entries at the same or deeper depth, then adds the
 * new heading so the returned snapshot always ends with the heading just
 * pushed — that snapshot is what every unit inside that section (including
 * the heading line itself) reports as `headings`.
 */
export class HeadingStack {
  private entries: HeadingRef[] = [];

  push(depth: number, text: string): readonly HeadingRef[] {
    this.entries = this.entries.filter((entry) => entry.depth < depth);
    this.entries.push(headingRef(depth, text));
    return this.snapshot();
  }

  snapshot(): readonly HeadingRef[] {
    return [...this.entries];
  }
}
