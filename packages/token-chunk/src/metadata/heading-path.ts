import type { HeadingRef } from '../types.js';

/**
 * Deterministic, GitHub-style-ish slug. Not a CommonMark/GFM slugger
 * (non-goal) — lowercases, strips characters that are not letters, digits,
 * spaces or hyphens, and collapses whitespace runs into single hyphens.
 */
export function slugify(text: string): string {
  const cleaned = text
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-{2,}/g, '-');
  return cleaned;
}

export function headingRef(depth: number, text: string): HeadingRef {
  const trimmed = text.trim();
  const slug = slugify(trimmed);
  return slug.length > 0 ? { depth, text: trimmed, slug } : { depth, text: trimmed };
}

/**
 * Renders a heading stack as a Markdown breadcrumb prefix, e.g.
 * `# Guide\n## Installation\n\n`. Used only when `includeHeadingTextInContent`
 * is enabled — this text is synthesized, not sourced, and counts toward the
 * budget by design.
 */
export function renderHeadingPrefix(headings: readonly HeadingRef[]): string {
  if (headings.length === 0) return '';
  const lines = headings.map((heading) => `${'#'.repeat(heading.depth)} ${heading.text}`);
  return `${lines.join('\n')}\n\n`;
}

/** Reduces a full ancestry chain to just the nearest heading, per `preserveHeadingPath: false`. */
export function nearestHeadingOnly(headings: readonly HeadingRef[]): readonly HeadingRef[] {
  const last = headings[headings.length - 1];
  return last === undefined ? [] : [last];
}
