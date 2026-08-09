import { splitParagraphs } from '../boundaries/paragraphs.js';
import { closeGaps } from './close-gaps.js';
import type { DocumentUnit, ParsedDocument } from './types.js';

/** Plain text has no heading concept: every unit is a paragraph with empty ancestry. */
export function parsePlainText(normalizedText: string): ParsedDocument {
  const spans = splitParagraphs(normalizedText, 0);
  const units: DocumentUnit[] = spans.map((span) => ({
    kind: 'paragraph',
    text: span.text,
    start: span.start,
    end: span.end,
    headings: [],
    blockLike: false,
  }));
  return { units: closeGaps(units, normalizedText) };
}
