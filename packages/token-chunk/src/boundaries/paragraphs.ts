/** A contiguous, non-blank span of `text`, with offsets relative to the full document. */
export interface TextSpan {
  readonly text: string;
  readonly start: number;
  readonly end: number;
}

/**
 * Splits `text` into paragraphs: maximal runs of non-blank lines, separated
 * by one or more blank (whitespace-only) lines. Blank-line separators are
 * dropped, not emitted as their own span — they carry no content.
 *
 * `baseOffset` is `text`'s own offset into the full normalized document, so
 * returned spans carry document-absolute offsets.
 */
export function splitParagraphs(text: string, baseOffset = 0): TextSpan[] {
  const spans: TextSpan[] = [];
  const lines = text.split('\n');
  let cursor = baseOffset;
  let start = -1;
  let end = -1;

  for (const line of lines) {
    const lineStart = cursor;
    const lineEnd = cursor + line.length;
    if (line.trim().length > 0) {
      if (start === -1) start = lineStart;
      end = lineEnd;
    } else if (start !== -1) {
      spans.push({ text: text.slice(start - baseOffset, end - baseOffset), start, end });
      start = -1;
    }
    cursor = lineEnd + 1;
  }
  if (start !== -1) {
    spans.push({ text: text.slice(start - baseOffset, end - baseOffset), start, end });
  }
  return spans;
}
