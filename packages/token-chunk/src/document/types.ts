import type { HeadingRef } from '../types.js';

/**
 * Structural kind of a parsed block, before any finer splitting. Finer
 * splitting (sentence/word/token, or line for block content) produces
 * `'fragment'` units that keep their originating `sourceKind` for tier
 * selection but are no longer whole structural blocks.
 */
export type BlockKind =
  'heading' | 'paragraph' | 'code-fence' | 'list-item' | 'table' | 'blockquote';

/** A parsed block or a finer fragment of one, always a literal, contiguous slice of the normalized source. */
export interface DocumentUnit {
  readonly kind: BlockKind;
  /** Literal, contiguous slice of the normalized document. */
  readonly text: string;
  /** Normalized-document offsets (before original-offset mapping). */
  readonly start: number;
  readonly end: number;
  /** Heading ancestry active at this unit, root-first, including this unit's own heading if `kind === 'heading'`. */
  readonly headings: readonly HeadingRef[];
  /** True for `code-fence` and `table`, which prefer to stay whole and split by line/row rather than by sentence. */
  readonly blockLike: boolean;
}

export interface ParsedDocument {
  readonly units: readonly DocumentUnit[];
  readonly unclosedFenceStart?: number;
}

/** A leaf unit ready for packing: guaranteed (best-effort) to fit a budget on its own, with its token cost precomputed. */
export interface LeafUnit extends DocumentUnit {
  readonly tokenCount: number;
  /**
   * A synthesized, non-source-backed prefix that must be rendered whenever
   * this unit starts a chunk (currently: a repeated table header for a table
   * split across chunks). Never part of `text`/`start`/`end`, exactly like
   * the heading breadcrumb prefix — see `packing/pack-units.ts`.
   */
  readonly syntheticPrefix?: string;
}
