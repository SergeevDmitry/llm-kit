import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  classifyGrapheme,
  graphemeClusters,
  usesIntlSegmenter,
  utf8ByteLength,
  type ScriptClass,
} from '../src/unicode.js';

describe('graphemeClusters', () => {
  it('splits plain ASCII into one cluster per character', () => {
    expect(graphemeClusters('abc')).toEqual(['a', 'b', 'c']);
  });

  it('returns an empty array for an empty string', () => {
    expect(graphemeClusters('')).toEqual([]);
  });

  it('groups a base character with its combining mark into one cluster', () => {
    const decomposed = 'é'; // e + combining acute accent
    expect(graphemeClusters(decomposed)).toEqual(['é']);
  });

  it('groups a ZWJ family emoji into a single cluster', () => {
    const family = '\u{1F468}‍\u{1F469}‍\u{1F467}‍\u{1F466}'; // 👨‍👩‍👧‍👦
    expect(graphemeClusters(family)).toEqual([family]);
  });

  it('groups a flag (regional indicator pair) into a single cluster', () => {
    const flag = '\u{1F1EF}\u{1F1F5}'; // 🇯🇵
    expect(graphemeClusters(flag)).toEqual([flag]);
  });

  it('groups a keycap sequence into a single cluster', () => {
    const keycap = '1️⃣'; // 1️⃣
    expect(graphemeClusters(keycap)).toEqual([keycap]);
  });

  it('is deterministic across repeated calls', () => {
    const text = 'mixed 大型 🚀 café text';
    expect(graphemeClusters(text)).toEqual(graphemeClusters(text));
  });
});

describe('graphemeClusters — code-point fallback', () => {
  // Forces the `Intl.Segmenter`-unavailable branch by deleting it from a
  // freshly imported module instance, then restores the module registry so
  // other test files still get the real segmenter.
  it('still segments deterministically when Intl.Segmenter is unavailable', async () => {
    vi.resetModules();
    // `Intl` is declared as a readonly namespace in the ambient types, but at
    // runtime it is a plain object; this cast is test-only global
    // monkeypatching to simulate a platform without `Intl.Segmenter`.
    const mutableIntl = Intl as unknown as Record<string, unknown>;
    const originalSegmenter = mutableIntl.Segmenter;
    delete mutableIntl.Segmenter;
    try {
      const fallbackModule = await import('../src/unicode.js');
      expect(fallbackModule.usesIntlSegmenter()).toBe(false);
      expect(fallbackModule.graphemeClusters('abc')).toEqual(['a', 'b', 'c']);
      // The fallback does not merge ZWJ sequences: a family emoji becomes
      // several code points instead of one cluster.
      const family = '\u{1F468}‍\u{1F469}';
      expect(fallbackModule.graphemeClusters(family).length).toBeGreaterThan(1);
    } finally {
      mutableIntl.Segmenter = originalSegmenter;
      vi.resetModules();
    }
  });

  it('degrades the same way when Intl.Segmenter throws on construction', async () => {
    vi.resetModules();
    const mutableIntl = Intl as unknown as Record<string, unknown>;
    const originalSegmenter = mutableIntl.Segmenter;
    mutableIntl.Segmenter = function throwingSegmenter(): never {
      throw new Error('unsupported locale data');
    };
    try {
      const fallbackModule = await import('../src/unicode.js');
      expect(fallbackModule.usesIntlSegmenter()).toBe(false);
      expect(fallbackModule.graphemeClusters('abc')).toEqual(['a', 'b', 'c']);
    } finally {
      mutableIntl.Segmenter = originalSegmenter;
      vi.resetModules();
    }
  });
});

describe('usesIntlSegmenter', () => {
  it('reports true on this test runtime (Node 20+)', () => {
    expect(usesIntlSegmenter()).toBe(true);
  });
});

describe('classifyGrapheme', () => {
  const cases: ReadonlyArray<readonly [string, ScriptClass]> = [
    ['a', 'latin'],
    ['Z', 'latin'],
    ['5', 'digit'],
    [' ', 'whitespace'],
    ['\t', 'whitespace'],
    ['\n', 'whitespace'],
    ['.', 'other'],
    ['#', 'other'],
    ['大', 'cjk'],
    ['型', 'cjk'],
    ['ひ', 'cjk'], // hiragana
    ['カ', 'cjk'], // katakana
    ['한', 'cjk'], // hangul
    ['д', 'cyrillic'],
    ['П', 'cyrillic'],
    ['α', 'other-alphabetic'], // greek
    ['🚀', 'emoji'],
    ['✅', 'emoji'],
    ['\u{1F1EF}\u{1F1F5}', 'emoji'], // flag
    ['1️⃣', 'emoji'], // keycap — contains a digit, must still classify as emoji
    ['\u{1F468}‍\u{1F469}‍\u{1F467}‍\u{1F466}', 'emoji'], // ZWJ family
    ['\u{1F44B}\u{1F3FD}', 'emoji'], // waving hand + skin tone modifier
  ];

  it.each(cases)('classifies %j as %s', (cluster, expected) => {
    expect(classifyGrapheme(cluster)).toBe(expected);
  });

  it('classifies a base+combining-mark cluster by its base character', () => {
    expect(classifyGrapheme('é')).toBe('latin');
  });

  it('falls back to `other` for an empty cluster', () => {
    expect(classifyGrapheme('')).toBe('other');
  });
});

describe('utf8ByteLength', () => {
  it('matches ASCII character count', () => {
    expect(utf8ByteLength('abc')).toBe(3);
  });

  it('counts 2-byte characters correctly (Cyrillic)', () => {
    expect(utf8ByteLength('д')).toBe(2);
  });

  it('counts 3-byte characters correctly (CJK)', () => {
    expect(utf8ByteLength('大')).toBe(3);
  });

  it('counts 4-byte characters correctly (astral emoji)', () => {
    expect(utf8ByteLength('🚀')).toBe(4);
  });

  it('returns 0 for an empty string', () => {
    expect(utf8ByteLength('')).toBe(0);
  });

  it('matches TextEncoder exactly across the calibration corpus', () => {
    const encoder = new TextEncoder();
    const samples = ['plain ascii', 'Кириллица', '大型语言模型', '🚀✅👨‍👩‍👧‍👦', 'café mixed д'];
    for (const sample of samples) {
      expect(utf8ByteLength(sample)).toBe(encoder.encode(sample).length);
    }
  });
});

describe('utf8ByteLength — manual fallback', () => {
  // `utf8ByteLength` re-reads `globalThis.TextEncoder` on every call rather
  // than caching it at module load, specifically so this branch is
  // reachable without a module reset: deleting the global is enough.
  let originalTextEncoder: typeof TextEncoder | undefined;

  beforeEach(() => {
    originalTextEncoder = globalThis.TextEncoder;
    // @ts-expect-error -- intentionally removing a global to exercise the documented fallback path.
    delete globalThis.TextEncoder;
  });

  afterEach(() => {
    globalThis.TextEncoder = originalTextEncoder as typeof TextEncoder;
  });

  it('computes the same byte length as TextEncoder would, without it present', () => {
    expect(utf8ByteLength('abc')).toBe(3);
    expect(utf8ByteLength('д')).toBe(2);
    expect(utf8ByteLength('大')).toBe(3);
    expect(utf8ByteLength('🚀')).toBe(4);
  });
});
