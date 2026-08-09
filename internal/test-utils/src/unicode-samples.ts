/**
 * Shared multilingual calibration corpus.
 *
 * The approximate tokenizer, `token-chunk` and `chat-fit` all assert against
 * the same samples so that a tokenizer change shows up in every consumer at
 * once.
 */

export interface UnicodeSample {
  readonly id: string;
  readonly label: string;
  readonly text: string;
  /** Rough script/content class, used to group assertions. */
  readonly kind: 'latin' | 'cyrillic' | 'cjk' | 'emoji' | 'code' | 'markdown' | 'mixed';
}

export const unicodeSamples: readonly UnicodeSample[] = [
  {
    id: 'latin-prose',
    label: 'English prose',
    kind: 'latin',
    text: 'The quick brown fox jumps over the lazy dog. Retrieval pipelines need chunks that respect sentence boundaries, not arbitrary character windows.',
  },
  {
    id: 'latin-long-word',
    label: 'Long unbroken token',
    kind: 'latin',
    text: 'https://example.com/very/long/path/segment?query=parameter&another=value#fragment-anchor-that-keeps-going',
  },
  {
    id: 'cyrillic-prose',
    label: 'Russian prose',
    kind: 'cyrillic',
    text: 'Потоковый вывод модели часто содержит незакрытый JSON. Парсер должен возвращать валидный частичный объект на каждом чанке.',
  },
  {
    id: 'cjk-han',
    label: 'Chinese without spaces',
    kind: 'cjk',
    text: '大型语言模型的输出经常被截断。分块器必须在语义边界上切分文本，而不是按字符数硬切。',
  },
  {
    id: 'cjk-japanese',
    label: 'Japanese mixed scripts',
    kind: 'cjk',
    text: 'ストリーミング出力のJSONは途中で切れることがあります。部分的な値を安全に復元する必要があります。',
  },
  {
    id: 'emoji-sequences',
    label: 'Emoji with ZWJ and skin tones',
    kind: 'emoji',
    text: 'Shipping 🚀 with tests ✅ — family 👨‍👩‍👧‍👦, wave 👋🏽, flag 🇯🇵, keycap 1️⃣.',
  },
  {
    id: 'combining-marks',
    label: 'Combining marks and normalization traps',
    kind: 'mixed',
    text: 'café vs café, Å vs Å, ñ vs ñ — identical on screen, different bytes.',
  },
  {
    id: 'source-code',
    label: 'TypeScript source',
    kind: 'code',
    text: [
      'export function chunkText(input: string, options: ChunkOptions): readonly TextChunk[] {',
      '  const budget = options.maxTokens - (options.safetyMarginTokens ?? 0);',
      '  if (budget <= 0) throw new RangeError("maxTokens must exceed the safety margin");',
      '  return pack(parse(input), budget);',
      '}',
    ].join('\n'),
  },
  {
    id: 'minified-code',
    label: 'Minified JavaScript',
    kind: 'code',
    text: 'const a=(b,c)=>{let d=0;for(let e=0;e<b.length;e++)d+=b[e]*c[e];return d};export default a;',
  },
  {
    id: 'markdown-document',
    label: 'Markdown with nested structure',
    kind: 'markdown',
    text: [
      '# Guide',
      '',
      'Intro paragraph.',
      '',
      '## Installation',
      '',
      '```bash',
      'npm install token-chunk',
      '```',
      '',
      '### Notes',
      '',
      '- first item',
      '- second item',
      '',
      '> A block quote that should keep its marker.',
      '',
      '| column | value |',
      '| --- | --- |',
      '| a | 1 |',
    ].join('\n'),
  },
  {
    id: 'whitespace-heavy',
    label: 'Irregular whitespace and line endings',
    kind: 'mixed',
    text: 'line one\r\nline two\r\n\r\n\ttabbed non-breaking   multiple   spaces\n',
  },
];
