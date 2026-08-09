# token-chunk

Token-budget-aware semantic chunking for text and Markdown, with heading breadcrumbs and deterministic overlap.

[![npm](https://img.shields.io/npm/v/token-chunk.svg)](https://www.npmjs.com/package/token-chunk)
[![CI](https://github.com/SergeevDmitry/llm-kit/actions/workflows/ci.yml/badge.svg)](https://github.com/SergeevDmitry/llm-kit/actions/workflows/ci.yml)
[![zero dependencies](https://img.shields.io/badge/dependencies-0-brightgreen)](https://www.npmjs.com/package/token-chunk?activeTab=dependencies)

## The problem

Retrieval pipelines need chunks that fit under a model's token budget, but a naïve character window cuts mid-sentence, throws away heading context, and has no idea what a "token" actually costs. `token-chunk` parses documents coarse to fine — heading → paragraph/block → sentence → word → token — so every chunk respects the budget, keeps its section breadcrumb, and reports exactly how it was produced.

## Before / after

```ts
import { chunkMarkdown } from 'token-chunk';

// Naïve: cut every N characters. Blind to sentences, headings, and tokens.
function naiveChunks(text: string, size: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < text.length; i += size) out.push(text.slice(i, i + size));
  return out;
}

const doc = `# Refund policy

Refunds are issued within 5-7 business days after we receive the returned
item. Items damaged in shipping are replaced free of charge, no return
required.`;

// Cuts mid-word ("busine|ss days"), doesn't know how many tokens it
// produced, and forgets which heading each piece came from the moment
// it's sliced out.
const naive = naiveChunks(doc, 60);

// Splits on sentence boundaries, never exceeds the budget, and every chunk
// still knows it belongs under "Refund policy".
const semantic = chunkMarkdown(doc, { maxTokens: 20 });

console.log(naive[0]); // "# Refund policy\n\nRefunds are issued within 5-7 busine" — cut mid-word
console.log(semantic[0]?.headings); // [{ depth: 1, text: 'Refund policy', slug: 'refund-policy' }]
console.log(semantic.every((chunk) => chunk.tokenCount <= 20)); // true, by construction
```

## Install

```bash
npm install token-chunk
```

## Minimal usage

```ts
import { chunkText } from 'token-chunk';

const document =
  'Retrieval pipelines need chunks that fit a token budget without cutting mid-sentence or losing context. This is the second sentence.';

const chunks = chunkText(document, { maxTokens: 12 });
for (const chunk of chunks) {
  console.log(chunk.index, chunk.tokenCount, chunk.tokenizerId, chunk.text);
}
```

`chunkMarkdown` is the same call, forced to Markdown parsing regardless of
content; `chunkText` auto-detects Markdown structure unless you pass
`format: 'text'` explicitly.

## Key guarantees

These are the invariants the package is built around — property-tested over
randomly generated documents and budgets (`fast-check`, seeded):

- **`chunk.tokenCount <= maxTokens` for every emitted chunk.** Heading
  prefixes (when rendered) and overlap both count toward the budget. The
  only exception is a chunk whose smallest possible content — one grapheme
  cluster, or one unit under a `hardBoundary` that forbids finer
  splitting — still doesn't fit; that case is always flagged in
  `chunk.diagnostics`, never silently shipped as if it were fine.
- **`chunk.text` never exceeds it, and is never empty.** A chunk with zero
  characters is never emitted.
- **Source ranges are exact.** With no rendered heading prefix,
  `chunk.text === normalizeLineEndings(input.slice(chunk.source.charStart, chunk.source.charEnd))`
  — a byte-for-byte reconstruction, including across CRLF/CR normalization.
  When a prefix is rendered (`includeHeadingTextInContent: true`, or a
  repeated table header), it comes first in `chunk.text` and is never part
  of `source` — the source-backed portion still reconstructs exactly as a
  suffix.
- **Content order is preserved.** Chunks are emitted in document order with
  sequential `index` values starting at `0`.
- **`overlapTokens` is a target maximum, never a license to exceed budget.**
  `chunk.overlap.tokensFromPrevious` reports the _actual_ overlap, which is
  always `<= overlapTokens` and is `0` for the first chunk. Overlap text is
  always a literal, contiguous slice of the source — never synthesized —
  so `overlap.sourceCharStart` is a real offset whenever overlap is present.
- **Approximate counts never look exact.** Every chunk carries
  `tokenizerId` — the injected `tokenizer.id`, or `APPROX_TOKENIZER_ID`
  (`'approx-v1'`) when none was supplied — so a chunk written to a vector
  store today and read back months later still says which tokenizer
  produced its `tokenCount`, without whatever wrote it having to remember.
  See [Advanced options and adapters](#advanced-options-and-adapters).

## API reference

```ts
import type {
  ChunkOptions,
  HeadingRef,
  TextChunk,
  ChunkOverlap,
  ChunkDiagnostic,
  Tokenizer,
} from 'token-chunk';

// The three exported functions:
//
//   chunkText(input: string, options: ChunkOptions): readonly TextChunk[]
//   chunkMarkdown(input: string, options: Omit<ChunkOptions, 'format'>): readonly TextChunk[]
//   createChunker(options: ChunkOptions): { chunk(input: string): readonly TextChunk[] }
//
// are documented below by their option and result types.

interface Options extends ChunkOptions {
  maxTokens: number; // required — the hard ceiling on chunk.tokenCount
  overlapTokens?: number; // default 0 — target max tokens repeated from the previous chunk
  tokenizer?: Tokenizer; // default: the bundled approximate tokenizer ('approx-v1')
  format?: 'text' | 'markdown' | 'auto'; // default 'auto' for chunkText; chunkMarkdown forces 'markdown'
  preserveHeadingPath?: boolean; // default true — full ancestor chain vs. nearest heading only
  includeHeadingTextInContent?: boolean; // default false — render a heading breadcrumb into chunk.text
  hardBoundary?: 'sentence' | 'word' | 'token'; // default 'token' — finest boundary allowed before accepting an over-budget chunk
  safetyMarginTokens?: number; // default 0 — see "Advanced options and adapters"
  maxInputChars?: number; // default 5_000_000 — hard cap on input.length; see "Limits"
}

interface Heading extends HeadingRef {
  depth: number; // 1-6, ATX/Setext heading depth
  text: string; // heading text, trimmed
  slug?: string; // deterministic, lowercase, hyphenated
}

interface Chunk extends TextChunk {
  id: string; // stable for the same input + options
  index: number; // 0-based position in the output
  text: string; // full chunk text, including any rendered prefix and overlap
  tokenCount: number; // token count for `text`, per the resolved tokenizer
  tokenizerId: string; // options.tokenizer?.id ?? APPROX_TOKENIZER_ID — travels with the chunk, not just the call
  source: { charStart: number; charEnd: number }; // offsets into the ORIGINAL input
  headings: readonly Heading[]; // ancestry active at the start of this chunk
  overlap: ChunkOverlap; // { tokensFromPrevious: number; sourceCharStart?: number }
  diagnostics?: readonly ChunkDiagnostic[]; // non-fatal notes; see "Edge cases and limitations"
}
```

`Tokenizer` (re-exported from the private `@llm-kit/tokenizer` foundation,
bundled into this package — you never install it separately):

```ts
import type { Tokenizer } from 'token-chunk';

// interface Tokenizer {
//   readonly id: string;
//   count(text: string): number;
//   encode?(text: string): readonly number[];
//   decode?(tokens: readonly number[]): string;
// }
declare const example: Tokenizer;
void example;
```

`encode`/`decode` are optional on purpose — see the next section.

`TokenChunkError` (extends `Error`, stable `code`) — every code is thrown
synchronously, before any parsing happens:

| Code                      | Thrown when                                                                 |
| ------------------------- | --------------------------------------------------------------------------- |
| `INVALID_MAX_TOKENS`      | `maxTokens` isn't a positive integer                                        |
| `INVALID_OVERLAP_TOKENS`  | `overlapTokens` isn't a non-negative integer                                |
| `INVALID_SAFETY_MARGIN`   | `safetyMarginTokens` isn't a non-negative integer                           |
| `BUDGET_NOT_POSITIVE`     | `safetyMarginTokens` leaves no budget under `maxTokens`                     |
| `INVALID_MAX_INPUT_CHARS` | `maxInputChars` isn't a positive integer                                    |
| `INPUT_TOO_LARGE`         | `input.length` exceeds `maxInputChars` (default `5_000_000`) — see "Limits" |

## Advanced options and adapters

### Exact tokenizer adapter

The bundled default is a zero-dependency **estimate** (see
[Edge cases and limitations](#edge-cases-and-limitations)). To budget
against a real encoder, wrap it in the plain `Tokenizer` shape — no
provider SDK is ever a dependency of `token-chunk` itself, so you own that
import:

```ts
import { chunkText, type Tokenizer } from 'token-chunk';

// Stand in for a real encoder (tiktoken, a provider SDK's local tokenizer,
// or an HTTP counting endpoint wrapped synchronously) — the shape is all
// that matters.
declare const encoder: { encode(text: string): number[] };

const exactTokenizer: Tokenizer = {
  id: 'cl100k_base',
  count: (text) => encoder.encode(text).length,
};

const chunks = chunkText('some long document...', { maxTokens: 500, tokenizer: exactTokenizer });
```

`encode`/`decode` are **optional** on the `Tokenizer` interface because the
bundled approximate tokenizer can only ever produce a count, never real
token ids. `token-chunk` never requires them: word- and token-boundary
splitting are both implemented against `count()` alone (a binary/exponential
search over candidate substrings), so a count-only tokenizer degrades
gracefully rather than losing functionality. When you _do_ supply
`encode`/`decode`, `token-chunk` still doesn't call `decode()` to build
chunk text — overlap and split boundaries are always literal substrings of
your input, verified with `count()`, so a tokenizer whose `decode` doesn't
round-trip its own `encode` output is still perfectly safe to use.

### Overlap

```ts
import { chunkText } from 'token-chunk';

const chunks = chunkText(
  'Sentence one. Sentence two. Sentence three. Sentence four. Sentence five.',
  {
    maxTokens: 8,
    overlapTokens: 3,
  },
);

console.log(chunks[0]?.overlap); // { tokensFromPrevious: 0 } — the first chunk never has overlap
console.log(chunks[1]?.overlap.tokensFromPrevious); // <= 3, and > 0 if there was room to give any
```

Overlap is built from the _previous chunk's own new content_ (never from
overlap it received itself, so overlap can't compound across many chunks),
in priority order:

1. complete trailing sentence/block units,
2. complete trailing words, when a single unit is itself larger than the
   overlap budget,
3. a token-budgeted trailing substring (found via `count()`, exact when
   your tokenizer's `count` is exact), when even a single word doesn't fit.

Every tier is verified against the real tokenizer and produces a literal,
contiguous slice of the source — never a synthesized or decoded
approximation — which is what makes `overlap.sourceCharStart` a genuine,
checkable offset whenever `tokensFromPrevious > 0`.

### `hardBoundary`

```ts
import { chunkText } from 'token-chunk';

const longUrl = 'https://example.com/' + 'a'.repeat(200);

// default 'token': always tries to respect maxTokens, splitting down to
// individual grapheme clusters if nothing coarser fits.
const tight = chunkText(longUrl, { maxTokens: 5 });
console.log(tight.every((c) => c.tokenCount <= 5)); // true

// 'sentence' or 'word' trade budget precision for leaving bigger, more
// legible pieces intact — an over-budget chunk is then flagged via
// diagnostics instead of being split further.
const loose = chunkText(longUrl, { maxTokens: 5, hardBoundary: 'word' });
console.log(loose[0]?.diagnostics?.[0]?.code); // 'HARD_BOUNDARY_REACHED'
```

### `safetyMarginTokens`

Default `0` — deliberately. The bundled approximate tokenizer already
over-counts real BPE tokenizers by roughly **1.15x to 2x**, depending on
script and content shape (measured in the tokenizer foundation's own docs).
That's a safety margin you're already getting for free from counting
alone; stacking a large additional `safetyMarginTokens` on top of it
compounds toward wasting nearly half of every budget for no added safety.
Raise it only when budgeting against an **exact** adapter (see above),
where no such built-in margin exists — and even then, a small value (on the
order of 5-10%) is usually enough to cover corpus drift, not a large one.

### Limits

```ts
import { chunkText, TokenChunkError } from 'token-chunk';

const untrustedInput = 'x'.repeat(10_000_000);

try {
  chunkText(untrustedInput, { maxTokens: 100, maxInputChars: 1_000_000 });
} catch (error) {
  if (error instanceof TokenChunkError && error.code === 'INPUT_TOO_LARGE') {
    console.log('input too large; enforce your own upload limit upstream instead');
  }
}
```

`maxInputChars` (default **`5_000_000`** characters, roughly 5-10 MB
depending on encoding) is a hard cap on `input.length`, checked by both
`chunkText` and `chunkMarkdown` before any parsing — including the
line-ending normalization pass — begins. Peak memory while chunking is
roughly **5-8x** input size (the original text, a normalized copy, an
offset map back to it, parsed structural units, leaf units, and the
emitted chunks all live at once), so an unbounded caller accepting
untrusted input is an OOM waiting to happen, and it compounds whatever
per-character cost remains in a long unbroken run (see Performance). The
default is sized generously for real single-document RAG ingestion — a
long PDF or manual converted to text is rarely more than a few hundred KB
to low single-digit MB — while still keeping worst-case peak memory in the
double-digit-MB range rather than unbounded. Raise it explicitly for a
legitimately larger single document, or lower it for a tighter bound.

### Heading metadata

```ts
import { chunkMarkdown } from 'token-chunk';

const doc = '# Guide\n\n## Installation\n\nRun the installer and restart.\n';
const chunks = chunkMarkdown(doc, { maxTokens: 100 });

console.log(chunks[0]?.headings);
// [{ depth: 1, text: 'Guide', slug: 'guide' }, { depth: 2, text: 'Installation', slug: 'installation' }]
```

`headings` is metadata by default — it never touches `chunk.text` or the
budget. Set `preserveHeadingPath: false` to report only the nearest
heading instead of the full ancestor chain. Set
`includeHeadingTextInContent: true` to additionally _render_ the chain as a
Markdown breadcrumb prefixed onto `chunk.text` — this counts toward
`maxTokens`, and is silently omitted (with a `HEADING_PREFIX_OMITTED`
diagnostic) on a budget too small to fit it alongside any real content.

## Edge cases and limitations

Not a CommonMark implementation — it's a purpose-built parser that
recognizes ATX/Setext headings, fenced code
blocks, block quotes, lists, tables, and paragraphs, which is what
real-world documentation chunking needs, not general Markdown rendering.
Not embedding-based segmentation. Doesn't load documents from URLs or
files — you read the file, `token-chunk` chunks the string.

- **Chunk boundaries are deterministic, but they are not stable across
  different surrounding documents.** Chunking the same input twice always
  produces identical chunks. But packing is greedy — a chunk absorbs following
  units while the budget allows — so how much room is left when a given section
  begins depends on whatever preceded it. The _same_ boilerplate section can
  therefore land on different boundaries in two documents, at identical
  `maxTokens`.

  This matters if you are deduplicating chunks across documents by exact text,
  which is how [`vec-cache`](https://www.npmjs.com/package/vec-cache) keys its
  entries: shared sections chunked as part of two different pages will usually
  _not_ produce byte-identical chunks, so they will not share a cache entry.
  If you want that reuse, chunk each shared section as its own `chunkMarkdown`
  call rather than chunking the assembled page. `examples/rag-pipeline` in the
  repository does exactly that and explains why.

- **Fenced code blocks stay atomic if they fit**, and split by line (not
  mid-line, and not by sentence) if they don't.
- **Tables stay atomic if they fit**; an oversized table splits by row and
  repeats the header on every resulting chunk — unless the header itself
  is too large to repeat within the budget, in which case it's dropped for
  that one chunk rather than pushed over budget.
- **Lists keep item boundaries** where possible; a nested item's indentation
  is preserved literally in its parent item's text, not exposed as
  structured nesting metadata.
- **An unclosed code fence** runs to end-of-document and is reported via an
  `UNCLOSED_CODE_FENCE` diagnostic, not silently treated as either all-code
  or all-prose.
- **CRLF and lone-CR line endings are normalized to `LF`** before parsing,
  with an exact offset map back to the original input — `source` offsets
  are always into your original string, never the normalized one.
- **CJK text with no spaces**, emoji (including ZWJ sequences and
  skin-tone/flag/keycap modifiers), and combining marks are all split at
  grapheme-cluster boundaries, never mid-cluster.
- **A single token estimate larger than the budget** (a wide emoji cluster
  against `maxTokens: 1`, for instance) is emitted as-is with a
  `BUDGET_EXCEEDED` diagnostic — there is nothing finer to split.
- **Long URLs and minified code** (no word boundaries at all) fall through
  to the token-window splitter, which is verified sub-quadratic in input
  length (see Performance) rather than re-scanning from the start of the
  remaining text on every cut.

## Runtime compatibility

Universal: **zero runtime dependencies**, no `node:` imports, built for a
neutral platform (`platform: 'neutral'` via `@llm-kit/build-config`) so
nothing Node-specific can sneak into the default entry point. Proven by
this repository's CI, not just claimed:

- **ESM** (`import`) and **CommonJS** (`require`) both work from one
  published artifact (`scripts/validate-published-artifacts.ts` installs
  the packed tarball into a clean project and exercises both).
- **Node 20+** — the package's stated minimum (`engines.node`).
- **Bun** — `scripts/bun-smoke.ts` imports the built package under Bun.
- **Browser bundlers** — `scripts/browser-bundle-smoke.ts` bundles the
  package with esbuild targeting `browser`/`es2022` and asserts no
  `node:` import survives.

`@llm-kit/tokenizer`, the one foundation this package depends on, is
bundled into `dist/` at build time — it is never a `dependencies` entry
and never resolved at your install time.

## Performance

Chunking is linear in document length for realistic content: parsing is a
single forward line scan, and the token-window fallback (used only for
unbroken runs with no sentence/word boundary — long URLs, minified code, a
single oversized table row) uses exponential-then-binary search per cut
rather than re-measuring the whole remaining text on every piece, which
keeps even a multi-kilobyte unbroken run close to linear instead of
quadratic in the number of pieces produced. Splitting an oversized unit into
leaves, and routing the resulting diagnostics back onto the chunks that
overlap them, are also both linear in the number of pieces produced — a
document that is mostly indivisible units (dense emoji, for instance) under
a very small `maxTokens` produces one leaf, one chunk, and one diagnostic
per unit, and total work still scales with that count rather than its
square.

Representative numbers from `benchmarks/chunk-text.bench.ts`
(`pnpm run bench`), single-threaded on a development machine — treat these
as orientation, not an SLA:

| Input                                                         | Size    | Throughput    |
| ------------------------------------------------------------- | ------- | ------------- |
| English prose, `maxTokens: 200`                               | ~100 KB | ~135 ms       |
| CJK text, `maxTokens: 100`                                    | ~100 KB | ~250 ms       |
| Minified code (no spaces), `maxTokens: 100`                   | ~100 KB | ~400 ms       |
| Markdown, ~200 sections, `maxTokens: 200`                     | ~300 KB | ~175 ms       |
| Pathological 24k-char unbroken run, `maxTokens: 20`           | 24 KB   | ~65 ms        |
| 64,000 indivisible units (1 diagnostic/chunk), `maxTokens: 1` | 128 KB  | ~1.8 s        |
| Overlap: `overlapTokens: 20` vs. `overlapTokens: 2,000`       | ~200 KB | same (~15 ms) |

Overlap (see [below](#overlap)) verifies each candidate against the real
tokenizer and shrinks if it doesn't fit — in principle O(k²) in candidate
pieces if shrinking ever needs more than one step. Measured
(`test/overlap-shrink-scaling.test.ts`): for the bundled approximate
tokenizer and any tokenizer whose cost is a pure function of literal text
content — which is what a real encoder is — it exits in exactly one step
even at `overlapTokens` in the tens of thousands, because concatenation is
subadditive for real encoders (the whole never costs more tokens than the
pieces summed). A large `overlapTokens` therefore costs about the same as a
small one, as the row above shows. This can only be broken by a tokenizer
engineered to be continuously superadditive under concatenation — cost
growing with the square of how many pieces are joined — which no real
tokenizer is shaped like.

Every `tokenizer.count()` call costs whatever your tokenizer costs —
`token-chunk` calls it once per candidate boundary while packing, so an
expensive injected exact adapter (a network round trip, for instance) will
dominate wall-clock time regardless of how fast the chunking logic itself
is. The bundled approximate tokenizer is synchronous, in-memory, and has
its own throughput baseline in `@llm-kit/tokenizer`'s benchmarks.

`maxInputChars` (default `5_000_000`; see [Limits](#limits)) bounds both
worst-case wall time and worst-case peak memory for a single call — reject
or pre-split anything larger before calling in, rather than relying on this
default alone as a performance guarantee for arbitrarily large documents.

## Security and privacy

No telemetry, no network calls, no `eval` or dynamic code generation
anywhere in this package. `chunkText`/`chunkMarkdown` are pure functions of
their arguments — the same input and options always produce the same
output, and nothing is written to disk or read from the environment.
`input.length` is capped at `maxInputChars` (default `5_000_000`; see
[Limits](#limits)), checked before any allocation begins, so an
unbounded-size document from an untrusted source raises `INPUT_TOO_LARGE`
instead of exhausting memory. Every boundary scanner in the coarse-to-fine
pipeline (sentence, heading, and table-separator detection) is verified
sub-quadratic against pathological input — long homogeneous punctuation
runs, long `#` runs, long whitespace runs with no closing boundary — by a
property test (`test/redos.property.test.ts`), not just typical content;
none of them can be driven into worst-case regex backtracking by adversarial
input. If you still want a tighter bound than the default for your own
ingestion path, apply it before calling in, the same way you would before
parsing untrusted JSON or reading an untrusted file.

## Contributing and license

Part of the [llm-kit](../../README.md) monorepo. MIT licensed — see
[`LICENSE`](./LICENSE).
