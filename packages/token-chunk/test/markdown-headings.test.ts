import { describe, expect, it } from 'vitest';
import { chunkMarkdown } from '../src/index.js';

describe('Markdown heading detection', () => {
  it('builds ancestry through ATX headings of increasing depth', () => {
    // A small budget forces one section per chunk, so each heading's own
    // ancestry is directly observable (a chunk's `headings` reflects the
    // ancestry active at *its own start* — a large budget merging every
    // section into one chunk would only show the first section's ancestry,
    // which is exercised separately below).
    const doc = '# One\n\nbody1\n\n## Two\n\nbody2\n\n### Three\n\nbody3\n';
    const chunks = chunkMarkdown(doc, { maxTokens: 6 });
    const withBody3 = chunks.find((c) => c.text.includes('body3'));
    expect(withBody3?.headings.map((h) => h.text)).toEqual(['One', 'Two', 'Three']);
  });

  it('pops the stack back when a heading returns to a shallower depth', () => {
    const doc = '# One\n\n## Two\n\nbody\n\n# Four\n\nbody2\n';
    const chunks = chunkMarkdown(doc, { maxTokens: 6 });
    const withBody2 = chunks.find((c) => c.text.includes('body2'));
    expect(withBody2?.headings.map((h) => h.text)).toEqual(['Four']);
  });

  it('recognizes Setext H1 (===) and H2 (---) headings', () => {
    const doc = 'Title\n=====\n\nbody\n\nSubtitle\n--------\n\nmore body\n';
    const chunks = chunkMarkdown(doc, { maxTokens: 6 });
    const headingsSeen = new Set(
      chunks.flatMap((c) => c.headings.map((h) => `${String(h.depth)}:${h.text}`)),
    );
    expect(headingsSeen.has('1:Title')).toBe(true);
    expect(headingsSeen.has('2:Subtitle')).toBe(true);
  });

  it('does not treat heading-like text inside a fenced code block as a heading', () => {
    const doc = '# Real Heading\n\n```text\n# not a heading\n## also not\n```\n\nbody\n';
    const chunks = chunkMarkdown(doc, { maxTokens: 200 });
    const headingTexts = new Set(chunks.flatMap((c) => c.headings.map((h) => h.text)));
    expect(headingTexts.has('Real Heading')).toBe(true);
    expect(headingTexts.has('not a heading')).toBe(false);
    expect(headingTexts.has('also not')).toBe(false);
    // the fenced content itself should still appear verbatim somewhere
    expect(chunks.some((c) => c.text.includes('# not a heading'))).toBe(true);
  });

  it('preserveHeadingPath: false reports only the nearest heading', () => {
    const doc = '# One\n\n## Two\n\n### Three\n\nbody\n';
    const full = chunkMarkdown(doc, { maxTokens: 6, preserveHeadingPath: true });
    const nearest = chunkMarkdown(doc, { maxTokens: 6, preserveHeadingPath: false });
    const fullWithBody = full.find((c) => c.text.includes('body'));
    const nearestWithBody = nearest.find((c) => c.text.includes('body'));
    expect(fullWithBody?.headings.map((h) => h.text)).toEqual(['One', 'Two', 'Three']);
    expect(nearestWithBody?.headings.map((h) => h.text)).toEqual(['Three']);
  });

  it('a heading with no body is still a valid, non-empty chunk', () => {
    const doc = '# Heading One\n\n# Heading Two\n\nbody after second heading\n';
    const chunks = chunkMarkdown(doc, { maxTokens: 200 });
    for (const chunk of chunks) {
      expect(chunk.text.length).toBeGreaterThan(0);
    }
    expect(chunks.some((c) => c.text.includes('Heading One'))).toBe(true);
  });

  it('includeHeadingTextInContent renders a breadcrumb prefix that counts toward the budget', () => {
    const doc = '# Guide\n\n## Install\n\n' + 'word '.repeat(50);
    const withoutPrefix = chunkMarkdown(doc, { maxTokens: 30 });
    const withPrefix = chunkMarkdown(doc, { maxTokens: 30, includeHeadingTextInContent: true });
    // Every chunk under the "Install" section should start with the rendered breadcrumb.
    const installChunks = withPrefix.filter((c) => c.headings.some((h) => h.text === 'Install'));
    expect(installChunks.length).toBeGreaterThan(0);
    for (const chunk of installChunks) {
      expect(chunk.text.startsWith('# Guide\n## Install\n\n')).toBe(true);
      expect(chunk.tokenCount).toBeLessThanOrEqual(30);
    }
    expect(withoutPrefix.some((c) => c.text.startsWith('# Guide\n## Install'))).toBe(false);
  });

  it('generates a deterministic, lowercase slug for headings', () => {
    const doc = '# Hello, World! Édition\n\nbody\n';
    const chunks = chunkMarkdown(doc, { maxTokens: 200 });
    expect(chunks[0]?.headings[0]?.slug).toBe('hello-world-édition');
  });

  it('strips a decorative trailing hash run (and the whitespace before it) from ATX heading text', () => {
    const doc = '## Title ##\n\nbody\n';
    const chunks = chunkMarkdown(doc, { maxTokens: 200 });
    expect(chunks[0]?.headings[0]).toMatchObject({ depth: 2, text: 'Title' });
  });

  it('leaves a hash run that is not at the true end of the line untouched', () => {
    const doc = '## Title ### foo\n\nbody\n';
    const chunks = chunkMarkdown(doc, { maxTokens: 200 });
    expect(chunks[0]?.headings[0]).toMatchObject({ depth: 2, text: 'Title ### foo' });
  });

  it('treats a bare run of more than 6 "#" characters as a depth-6 heading with empty text', () => {
    const doc = '########\n\nbody\n';
    const chunks = chunkMarkdown(doc, { maxTokens: 200 });
    expect(chunks[0]?.headings[0]).toMatchObject({ depth: 6, text: '' });
  });

  // Pinned per an independent review (see boundaries/headings.ts's doc
  // comment on `matchAtxHeading` for the full mechanism). A heading line
  // containing U+2028 LINE SEPARATOR or U+2029 PARAGRAPH SEPARATOR outside
  // any trailing `#` run is now recognized as a heading, where the old
  // `.`-based regex (`(.*?)` can never match a JS `LineTerminator` code
  // point without the `dotAll` flag) silently fell through to a paragraph
  // instead — an accident of that regex detail, not a documented
  // limitation. CommonMark treats U+2028/U+2029 as ordinary characters
  // (line endings are only `\n`/`\r`/`\r\n`), so this is the correct
  // behavior, and is pinned here so a future ".-based rewrite" doesn't
  // reintroduce the old, spec-incorrect exclusion thinking it's equivalent.
  it('recognizes an ATX heading whose text contains U+2028 LINE SEPARATOR', () => {
    const doc = `# Title\u2028more\n\nbody\n`;
    const chunks = chunkMarkdown(doc, { maxTokens: 200 });
    expect(chunks[0]?.headings[0]).toMatchObject({ depth: 1, text: 'Title\u2028more' });
  });

  it('recognizes an ATX heading whose text contains U+2029 PARAGRAPH SEPARATOR', () => {
    const doc = `# Title\u2029more\n\nbody\n`;
    const chunks = chunkMarkdown(doc, { maxTokens: 200 });
    expect(chunks[0]?.headings[0]).toMatchObject({ depth: 1, text: 'Title\u2029more' });
  });

  it('U+2028/U+2029 do not affect trailing-hash stripping (only mid-body text is affected)', () => {
    // Both old and new implementations agree here: the separator falls
    // where only \s* (which, unlike `.`, always matched it) needed to
    // cross it, not the `.`-based lazy body group.
    const withLineSep = chunkMarkdown(`## Title\u2028##\n\nbody\n`, { maxTokens: 200 });
    const withParaSep = chunkMarkdown(`## Title\u2029##\n\nbody\n`, { maxTokens: 200 });
    expect(withLineSep[0]?.headings[0]).toMatchObject({ depth: 2, text: 'Title' });
    expect(withParaSep[0]?.headings[0]).toMatchObject({ depth: 2, text: 'Title' });
  });
});
