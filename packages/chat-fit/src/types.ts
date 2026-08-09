/**
 * Public types for `chat-fit`.
 *
 * `Tokenizer` and `MessageTokenCounter` come from the private
 * `@llm-kit/tokenizer` foundation (never published on its own; bundled into
 * this package's declarations at build time, foundation types inlined for
 * real, not left as a broken relative import) and are re-exported here so a
 * consumer can name them without depending on a package that does not exist
 * on the registry. Importing rather than re-declaring keeps this package's
 * notion of the contract single-sourced with the foundation that owns it —
 * a shape change there is not something this file could silently drift out
 * of sync with.
 */
import type { MessageTokenCounter, Tokenizer } from '@llm-kit/tokenizer';

export type { Tokenizer, MessageTokenCounter } from '@llm-kit/tokenizer';

/** Common chat roles. Providers add their own; anything is accepted as a plain string. */
export type ChatRole = 'system' | 'developer' | 'user' | 'assistant' | 'tool';

/**
 * Minimal provider-neutral message shape. `chat-fit`'s functions are generic
 * over `Message` and work with this shape by default, but also accept
 * OpenAI-like and Anthropic-like message shapes directly — see
 * `src/adapters/`.
 */
export interface ChatMessage {
  id?: string;
  role: ChatRole | string;
  content: unknown;
  toolCallId?: string;
  toolCalls?: readonly { id: string; name?: string; arguments?: unknown }[];
  metadata?: Record<string, unknown>;
}

/**
 * One atomic unit of selection: a set of messages that are kept or dropped
 * together. Built by the default grouping policy (`src/grouping/`) or by a
 * caller-supplied `groupMessages`.
 *
 * `indexes` are positions in the *original* `messages` array the caller
 * passed in, ascending. A group whose messages carry linked tool calls and
 * tool results always has more than one index; every other group has
 * exactly one.
 */
export interface MessageGroup<Message> {
  /** Original array indexes belonging to this group, ascending. */
  readonly indexes: readonly number[];
  /** The messages themselves, in the same order as `indexes`. */
  readonly messages: readonly Message[];
  /**
   * Tool-call ids represented by this group, if any. Present so a report can
   * name which exchange a group corresponds to without re-deriving it.
   */
  readonly toolCallIds: readonly string[];
}

/** The selected middle range handed to a `Summarizer`, plus the room it has to work with. */
export interface SummaryRequest<Message> {
  /** The messages being summarized, in original chronological order. Never a partial tool-call group. */
  readonly messages: readonly Message[];
  /** Token budget the returned summary message should fit within. */
  readonly maxSummaryTokens: number;
  /** A previous summary being extended, if this is a later call over a growing history. */
  readonly previousSummary?: Message;
  readonly signal?: AbortSignal;
}

/**
 * User-supplied callback that turns a range of messages into one summary
 * message. `chat-fit` never calls an LLM itself — this is the only place a
 * network call could happen, and it is entirely the caller's responsibility.
 */
export type Summarizer<Message> = (request: SummaryRequest<Message>) => Promise<Message>;

export interface SummaryOptions<Message> {
  /** Produces the replacement message for a dropped middle range. Required when `strategy` is `'summarize-middle'`. */
  readonly summarizer: Summarizer<Message>;
  /**
   * Token budget the summary should fit within. Defaults to 20% of the
   * available budget (`maxTokens - reserveTokens - safetyMarginTokens`),
   * capped so it never eats into space reserved for preserved
   * system/developer content — see `fitChatAsync`'s "summarize-middle"
   * handling for the exact reservation policy.
   */
  readonly maxSummaryTokens?: number;
  /** Maximum number of summarizer calls attempted for one middle range before falling back to dropping it. Default 3. */
  readonly maxAttempts?: number;
}

export interface FitChatOptions<Message = ChatMessage> {
  /** Hard ceiling for the fitted conversation, in tokens (as counted by `messageTokenCounter`). */
  readonly maxTokens: number;
  /** Tokens set aside for the model's reply; not available to the fitted messages. Default 0. */
  readonly reserveTokens?: number;
  /** Content tokenizer used to build the default `messageTokenCounter`. Ignored if `messageTokenCounter` is supplied. Default: the bundled approximate tokenizer. */
  readonly tokenizer?: Tokenizer;
  /** Overrides token counting entirely, including per-message and per-conversation overhead. */
  readonly messageTokenCounter?: MessageTokenCounter<Message>;
  /** `'drop-oldest'` omits overflow groups. `'summarize-middle'` replaces them with a generated summary. Default `'drop-oldest'`. */
  readonly strategy?: 'drop-oldest' | 'summarize-middle';
  /** Roles whose messages are always preserved, wherever they appear. Default `['system', 'developer']`. */
  readonly preserveRoles?: readonly string[];
  /** Overrides the default atomic-grouping policy. Preserved-role marking is still applied afterward. */
  readonly groupMessages?: (messages: readonly Message[]) => readonly MessageGroup<Message>[];
  /** Required when `strategy` is `'summarize-middle'`. */
  readonly summary?: SummaryOptions<Message>;
  /**
   * Extra headroom subtracted from `maxTokens` beyond `reserveTokens`.
   * Default 0 — the bundled approximate tokenizer already over-counts by
   * roughly 1.15x-2x, so it already carries a safety margin. Set this only
   * when using an exact injected tokenizer, or when you have measured your
   * own provider's overhead independently.
   */
  readonly safetyMarginTokens?: number;
  /**
   * Caps `messages.length`. `chat-fit` consumes conversation history that
   * includes model output — untrusted by construction, per `SECURITY.md` —
   * so any unbounded input needs a documented, configurable cap, the same
   * way `token-chunk` has `maxInputChars` and `mend-json` has
   * `maxBufferBytes`. Exceeding it throws `ChatFitError` with code
   * `INPUT_TOO_LARGE`, before any grouping or token counting begins.
   *
   * Default `50_000`. Selection is `O(messages)` in several passes plus an
   * `O(messages log messages)` sort (see the README's Performance section),
   * so this is not a hard cliff on its own — the ceiling exists because an
   * unbounded `messages` array is also what removes the bound from a single
   * atomic tool-call group (`report.ts`'s index bookkeeping) and from every
   * per-message counting pass. 50,000 is generous for any real conversation
   * history — even a chat session running for a year at a hundred turns a
   * day is a fraction of that, and the package's own benchmarks only go up
   * to 10,000 messages — while still bounding a caller's worst case to a
   * fixed, predictable amount of work instead of "whatever array showed
   * up." Raise it explicitly for a genuinely larger corpus (e.g.
   * bulk-migrating archived transcripts).
   */
  readonly maxMessages?: number;
}

/** Diagnostic summary of one omitted-and-summarized range. */
export interface SummarizedRangeReport {
  /** First original index included in the summarized range. */
  readonly startIndex: number;
  /** Last original index included in the summarized range. */
  readonly endIndex: number;
  /** Number of original messages the range replaced. */
  readonly messageCount: number;
  /** Token count of the produced summary message, if one was produced. */
  readonly summaryTokenCount?: number;
}

/** Per-group bookkeeping surfaced in the report. */
export interface ToolCallGroupReport {
  readonly toolCallIds: readonly string[];
  readonly indexes: readonly number[];
  readonly kept: boolean;
}

/** Diagnostics returned alongside the fitted messages. Must stay JSON-serializable. */
export interface FitChatReport {
  readonly initialTokenCount: number;
  readonly finalTokenCount: number;
  readonly maxTokens: number;
  readonly reserveTokens: number;
  readonly safetyMarginTokens: number;
  /** `maxTokens - reserveTokens - safetyMarginTokens`. */
  readonly availableBudget: number;
  readonly strategy: 'drop-oldest' | 'summarize-middle';
  /** `messageTokenCounter.id` in effect for this call. */
  readonly counterId: string;
  /**
   * Whether counting used the bundled approximate tokenizer (`true`), a
   * default counter built over an injected `Tokenizer` whose id is not the
   * bundled one (`false` — presumed exact, since only the bundled tokenizer
   * is known to over-count), or a fully caller-supplied `messageTokenCounter`
   * (`'unknown'`).
   *
   * `MessageTokenCounter` (from `@llm-kit/tokenizer`) declares nothing about
   * its own exactness, so a custom counter's provenance genuinely cannot be
   * verified — `'unknown'` says that honestly rather than picking `true`
   * (which would misname the caller's own counter as "the approximate
   * tokenizer") or `false` (which would
   * claim an exactness this package cannot check). An approximate token
   * count must never look exact, so when in doubt this leans cautious:
   * `'unknown'` still triggers a report warning, just one that
   * names the actual counter and says its exactness is unverified instead of
   * asserting it either way.
   */
  readonly approximateTokenization: boolean | 'unknown';
  /** Original indexes present in the output, ascending. */
  readonly keptIndexes: readonly number[];
  /** Original indexes omitted from the output (dropped or folded into a summary), ascending. */
  readonly removedIndexes: readonly number[];
  /** Every tool-linked group `chat-fit` identified, and whether it survived selection. */
  readonly toolCallGroups: readonly ToolCallGroupReport[];
  /** Present only under `'summarize-middle'` when a range was actually summarized. */
  readonly summarizedRange?: SummarizedRangeReport;
  /** Number of summarizer calls made across the whole operation. */
  readonly summaryAttempts: number;
  /** Human-readable diagnostics: unresolved tool links, fallback content accounting, summary retries. */
  readonly warnings: readonly string[];
}

export interface FitChatResult<Message> {
  readonly messages: readonly Message[];
  readonly tokenCount: number;
  readonly report: FitChatReport;
}
