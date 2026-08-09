/**
 * Public types. `Tokenizer` is re-exported verbatim from
 * `@llm-kit/tokenizer` (see that package's `types.ts`) — a shape change
 * there is a breaking change here too.
 */
import type { Tokenizer } from '@llm-kit/tokenizer';

export type { Tokenizer };

/** Which finer boundary the splitter is allowed to fall back to when a unit is oversized. */
export type HardBoundary = 'sentence' | 'word' | 'token';

/** Document format: explicit, or `'auto'` to sniff Markdown structure. */
export type ChunkFormat = 'text' | 'markdown' | 'auto';

export interface ChunkOptions {
  /** Hard ceiling on `tokenCount` for every emitted chunk (see the budget invariant). */
  readonly maxTokens: number;
  /**
   * Target maximum tokens of trailing content repeated at the start of the
   * next chunk. Never licenses exceeding `maxTokens`; the actual amount is
   * reported per-chunk in `overlap.tokensFromPrevious`. Default `0`.
   */
  readonly overlapTokens?: number;
  /** Token counter to budget against. Defaults to the bundled approximate tokenizer. */
  readonly tokenizer?: Tokenizer;
  /** `'text'`, `'markdown'`, or `'auto'` to sniff. `chunkMarkdown` forces `'markdown'`. */
  readonly format?: ChunkFormat;
  /**
   * When true (default), `TextChunk.headings` reports the full ancestor
   * chain (root heading through the current section). When false, only the
   * single nearest heading is reported.
   */
  readonly preserveHeadingPath?: boolean;
  /**
   * When true, a rendered heading breadcrumb is prepended to `chunk.text`
   * and counts toward the budget. Default `false` — heading ancestry is
   * metadata-only (`chunk.headings`) unless opted in.
   */
  readonly includeHeadingTextInContent?: boolean;
  /**
   * The finest boundary the splitter may fall back to before accepting an
   * over-budget chunk. Default `'token'` (try hardest to respect the
   * budget). `'sentence'` or `'word'` trade budget precision for leaving
   * larger, more legible pieces intact.
   */
  readonly hardBoundary?: HardBoundary;
  /**
   * Tokens deducted from `maxTokens` before packing, as extra headroom on
   * top of the token count. Default `0`.
   *
   * The bundled approximate tokenizer already over-counts by roughly 1.15x
   * to 2x depending on script and content shape (see `@llm-kit/tokenizer`'s
   * approximate-tokenizer docs) — that is a safety margin "for free". Stacking a large additional margin
   * on top compounds toward wasting nearly half of every budget. Raise this
   * only when budgeting against an exact adapter (`tokenizer.encode` /
   * `decode` supplied) where no such built-in margin exists.
   */
  readonly safetyMarginTokens?: number;
  /**
   * Hard cap on `input.length` (characters), checked before any chunking
   * work — including the line-ending normalization pass — begins. Default
   * `5_000_000` (see `DEFAULT_MAX_INPUT_CHARS`): peak memory while chunking
   * is roughly 5-8x input size (the original text, a normalized copy, an
   * offset map, parsed units, leaf units, and chunks all live at once), so
   * an unbounded caller accepting untrusted input is an OOM waiting to
   * happen. Raise it for a legitimately larger single document, or lower it
   * if you want a tighter bound than the default.
   */
  readonly maxInputChars?: number;
}

/** One entry in a chunk's heading ancestry, shallowest first. */
export interface HeadingRef {
  /** ATX/Setext heading depth, 1-6. */
  readonly depth: number;
  /** Heading text, trimmed, as it appears in the source. */
  readonly text: string;
  /** Deterministic, lowercase, hyphenated slug derived from `text`. */
  readonly slug?: string;
}

/** Stable codes for diagnostics emitted alongside a chunk. */
export type ChunkDiagnosticCode =
  'BUDGET_EXCEEDED' | 'HARD_BOUNDARY_REACHED' | 'HEADING_PREFIX_OMITTED' | 'UNCLOSED_CODE_FENCE';

/** A non-fatal note about a chunk or the parse that produced it. Always JSON-serializable. */
export interface ChunkDiagnostic {
  readonly code: ChunkDiagnosticCode;
  readonly message: string;
  readonly charStart?: number;
  readonly charEnd?: number;
}

export interface ChunkOverlap {
  /** Actual number of tokens repeated from the previous chunk. `0` when there is none. */
  readonly tokensFromPrevious: number;
  /** Source offset (original input) where the repeated text begins, when `tokensFromPrevious > 0`. */
  readonly sourceCharStart?: number;
}

export interface TextChunk {
  /** Stable, deterministic identifier — reproducible for the same input and options. */
  readonly id: string;
  /** 0-based position of this chunk in the output. */
  readonly index: number;
  /** The chunk's full text, including any rendered heading prefix and overlap. */
  readonly text: string;
  /** Token count for `text`, per the resolved tokenizer. Always `<= maxTokens` except the documented exception. */
  readonly tokenCount: number;
  /**
   * The `id` of the tokenizer that produced `tokenCount` — the injected
   * `options.tokenizer.id`, or {@link APPROX_TOKENIZER_ID} when none was
   * supplied. An approximate count must never be presented as exact, and a
   * chunk routinely outlives the call that made it (written to a vector
   * store, read back by code that never saw `chunkText` run) — so the id
   * has to travel with the chunk, not just be knowable at the call site.
   */
  readonly tokenizerId: string;
  /**
   * Character offsets into the *original* `input` string (before line-ending
   * normalization) spanning the chunk's real source content — the rendered
   * heading prefix, if any, is not source-backed and is excluded.
   */
  readonly source: { readonly charStart: number; readonly charEnd: number };
  /** Heading ancestry active at the start of this chunk. Empty for plain text or content before any heading. */
  readonly headings: readonly HeadingRef[];
  readonly overlap: ChunkOverlap;
  readonly diagnostics?: readonly ChunkDiagnostic[];
}

/** Stable string codes for every error `token-chunk` throws. */
export type TokenChunkErrorCode =
  | 'INVALID_MAX_TOKENS'
  | 'INVALID_OVERLAP_TOKENS'
  | 'INVALID_SAFETY_MARGIN'
  | 'BUDGET_NOT_POSITIVE'
  | 'INVALID_MAX_INPUT_CHARS'
  | 'INPUT_TOO_LARGE';

/**
 * The only error type this package throws. Every failure mode here — an
 * invalid `ChunkOptions` value, or `input` exceeding `maxInputChars` — is
 * caught before any chunking work begins.
 */
export class TokenChunkError extends Error {
  readonly code: TokenChunkErrorCode;

  constructor(message: string, code: TokenChunkErrorCode, options?: { readonly cause?: unknown }) {
    super(message, options);
    this.name = 'TokenChunkError';
    this.code = code;
  }
}
