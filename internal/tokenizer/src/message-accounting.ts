/**
 * Per-message and per-conversation overhead on top of raw content tokens.
 *
 * Every chat completion API charges tokens for more than the visible text:
 * role markers, message delimiters, tool-call structure, and a fixed
 * "priming" cost for the reply the API is about to generate. `chat-fit`
 * needs those numbers to budget a conversation accurately, not just its
 * content.
 *
 * `Message.content` is deliberately typed `unknown` at the boundary: a
 * consumer's chat message may carry a plain string, an array of content
 * parts (`{ type: 'text', text: '...' }`, images, tool results, …), or some
 * provider-specific object this package has never seen. Per the package
 * brief, counting must never throw on an unrecognized shape — it falls back
 * to a conservative estimate and reports that it did, via
 * {@link describeMessageContent}, so a caller can surface (or log, or just
 * trust) the fact that a number came from a guess rather than a real count.
 */
import type { MessageTokenCounter, Tokenizer } from './types.js';

/** A recognized content part: free text. Other `type` values fall back to the unknown-shape estimate. */
export interface TextContentPart {
  readonly type: 'text';
  readonly text: string;
}

/**
 * Any content part this package does not specifically recognize (an image,
 * a tool result, a provider extension, …). Counted via the unknown-shape
 * fallback, same as an arbitrary object.
 */
export interface OpaqueContentPart {
  readonly type: string;
  readonly [key: string]: unknown;
}

export type MessageContentPart = TextContentPart | OpaqueContentPart;

/** The shapes `describeMessageContent` accepts: a string, an array of parts, or anything else (unknown-shape fallback). */
export type MessageContent = string | readonly MessageContentPart[] | unknown;

export interface MessageToolCall {
  readonly id?: string;
  readonly name: string;
  /** Arguments as already-parsed data (object, array, …) or a raw JSON string. */
  readonly arguments?: unknown;
}

/**
 * A minimal chat-message shape general enough for `chat-fit` to use
 * directly or extend. `content`, `toolCalls[].arguments`, and any field this
 * type does not model are exactly the "arbitrary object" case the fallback
 * exists for.
 *
 * This is the canonical shape this package understands — nothing else.
 * A provider SDK's own message type (OpenAI's `tool_calls`, Anthropic's
 * `tool_use` content blocks living outside `content`, or any future shape)
 * is not parsed here; normalizing a provider payload into `ChatMessageLike`
 * is `chat-fit`'s job, not this foundation's — teaching the tokenizer
 * provider formats would break the provider-neutrality this package exists
 * to keep.
 *
 * That said, a provider-shaped object routinely satisfies this interface
 * *structurally* (TypeScript's excess-property check only fires on object
 * literals, not on values flowing through a variable), so a message can
 * carry real content under a key this type doesn't name — `tool_calls`
 * instead of `toolCalls`, for instance. `describeMessage`/
 * `createMessageTokenCounter` never silently drop that: any own-enumerable
 * property outside `role`/`name`/`content`/`toolCalls` whose value is
 * structural (an array or a plain object — not a scalar like an id, a
 * finish reason, or a `Date` timestamp; see `isStructuralValue`) is routed
 * through the same conservative unknown-shape fallback as unrecognized
 * `content`, and surfaced via `usedFallback`/`reason` — counted, not
 * ignored, because an undercount produces a request the provider rejects
 * for exceeding its budget, which is strictly worse than an overcount that
 * only wastes a little context.
 */
export interface ChatMessageLike {
  readonly role: string;
  readonly name?: string;
  readonly content: MessageContent;
  readonly toolCalls?: readonly MessageToolCall[];
}

/** Per-message overhead: role marker plus message delimiters. */
export const MESSAGE_OVERHEAD_TOKENS = 4;

/** Extra overhead when a message carries a `name` (participant identity beyond `role`). */
export const NAME_OVERHEAD_TOKENS = 1;

/** Overhead per tool call: name delimiter plus call-structure framing, on top of the counted name and arguments. */
export const TOOL_CALL_OVERHEAD_TOKENS = 6;

/** Charged once per `countMessages` call: most chat APIs prime the reply with a fixed number of structural tokens. */
export const CONVERSATION_PRIMING_TOKENS = 3;

/**
 * Flat token count used when content could not be turned into text at all
 * (e.g. it contains a circular reference and cannot be serialized).
 */
export const UNKNOWN_CONTENT_FALLBACK_TOKENS = 64;

/**
 * Multiplier applied to the serialized-JSON estimate for an unrecognized but
 * serializable shape. The tokenizer already over-estimates plain text; this
 * adds extra margin because a real API's actual encoding of that data
 * (e.g. a base64 image payload) can be far denser than its JSON stand-in.
 */
export const UNKNOWN_CONTENT_SAFETY_MULTIPLIER = 1.5;

export interface MessageContentAccounting {
  /** Estimated token count for the content. */
  readonly tokens: number;
  /** True when any part of `content` did not match a recognized shape and was counted via the fallback. */
  readonly usedFallback: boolean;
  /** Human-readable explanation of what was unrecognized, present only when `usedFallback` is true. */
  readonly reason?: string;
}

function describeType(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

/** `JSON.stringify` that reports failure instead of throwing (circular references, `BigInt`, …). */
function safeStringify(value: unknown): string | undefined {
  try {
    return JSON.stringify(value);
  } catch {
    return undefined;
  }
}

function unknownShapeFallback(
  value: unknown,
  tokenizer: Tokenizer,
  reason: string,
): MessageContentAccounting {
  const serialized = safeStringify(value);
  if (serialized === undefined) {
    return {
      tokens: UNKNOWN_CONTENT_FALLBACK_TOKENS,
      usedFallback: true,
      reason: `${reason} (not JSON-serializable; used the flat ${UNKNOWN_CONTENT_FALLBACK_TOKENS}-token fallback)`,
    };
  }
  const tokens = Math.ceil(tokenizer.count(serialized) * UNKNOWN_CONTENT_SAFETY_MULTIPLIER);
  return { tokens, usedFallback: true, reason };
}

function isTextPart(value: unknown): value is TextContentPart {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { type?: unknown }).type === 'text' &&
    typeof (value as { text?: unknown }).text === 'string'
  );
}

function describePartLabel(part: unknown): string {
  const type = (part as { type?: unknown } | null)?.type;
  return typeof type === 'string' && type.length > 0 ? `"${type}"` : describeType(part);
}

function describeContentPart(part: unknown, tokenizer: Tokenizer): MessageContentAccounting {
  if (typeof part === 'string') {
    return { tokens: tokenizer.count(part), usedFallback: false };
  }
  if (isTextPart(part)) {
    return { tokens: tokenizer.count(part.text), usedFallback: false };
  }
  return unknownShapeFallback(part, tokenizer, `content part of type ${describePartLabel(part)}`);
}

/**
 * Estimates tokens for one message's `content`, in whatever shape it
 * arrives. Never throws.
 *
 * - A `string` is counted directly.
 * - A `readonly MessageContentPart[]` is counted part-by-part: `{ type:
 *   'text', text }` parts count their text; any other part (or a bare
 *   string element) falls back per-element without failing the whole array.
 * - Anything else — a plain object, `null`, `undefined`, a number, a
 *   function, a class instance — is an unknown shape: this package makes no
 *   assumption about how a provider bills it, so it estimates from the
 *   JSON-serialized form with a safety multiplier, or a flat constant if it
 *   cannot even be serialized.
 */
export function describeMessageContent(
  content: unknown,
  tokenizer: Tokenizer,
): MessageContentAccounting {
  if (typeof content === 'string') {
    return { tokens: tokenizer.count(content), usedFallback: false };
  }

  if (Array.isArray(content)) {
    let tokens = 0;
    let usedFallback = false;
    const reasons: string[] = [];
    for (const part of content) {
      const partResult = describeContentPart(part, tokenizer);
      tokens += partResult.tokens;
      if (partResult.usedFallback) {
        usedFallback = true;
        if (partResult.reason !== undefined) {
          reasons.push(partResult.reason);
        }
      }
    }
    if (!usedFallback) {
      return { tokens, usedFallback: false };
    }
    return {
      tokens,
      usedFallback: true,
      reason: `array content included unrecognized parts: ${reasons.join('; ')}`,
    };
  }

  return unknownShapeFallback(
    content,
    tokenizer,
    `content was ${describeType(content)}, not a string or content-part array`,
  );
}

export interface MessageAccountingOptions {
  /** Overrides {@link MESSAGE_OVERHEAD_TOKENS}. */
  readonly tokensPerMessage?: number;
  /** Overrides {@link NAME_OVERHEAD_TOKENS}. */
  readonly tokensPerName?: number;
  /** Overrides {@link TOOL_CALL_OVERHEAD_TOKENS}. */
  readonly tokensPerToolCall?: number;
  /** Overrides {@link CONVERSATION_PRIMING_TOKENS}. */
  readonly conversationPrimingTokens?: number;
}

/** Full per-message accounting result — see {@link describeMessage}. */
export interface MessageAccounting {
  /** Estimated token count for the whole message, including overhead. */
  readonly tokens: number;
  /** True when any part of the message — content or a structural field outside the canonical shape — was counted via a fallback. */
  readonly usedFallback: boolean;
  /** Human-readable explanation of what was unrecognized, present only when `usedFallback` is true. */
  readonly reason?: string;
}

function countToolCall(
  call: MessageToolCall,
  tokenizer: Tokenizer,
  tokensPerToolCall: number,
): number {
  let tokens = tokensPerToolCall + tokenizer.count(call.name);
  if (call.arguments !== undefined) {
    if (typeof call.arguments === 'string') {
      tokens += tokenizer.count(call.arguments);
    } else {
      tokens += describeMessageContent(call.arguments, tokenizer).tokens;
    }
  }
  return tokens;
}

/** The `ChatMessageLike` keys this package understands; every other key is handled by {@link describeUnrecognizedFields}. */
const CANONICAL_MESSAGE_KEYS = new Set<string>(['role', 'name', 'content', 'toolCalls']);

/**
 * True for a plain object (`{}`, or `Object.create(null)`) or an array — the
 * two shapes a tool-call list or a content-block list actually takes.
 *
 * `typeof value === 'object'` alone is not enough to mean "structural
 * content": `Date`, `RegExp`, `Map`, `Set`, and other boxed/exotic built-ins
 * are `typeof 'object'` too, but they are the natural JS representation of
 * scalar metadata (a timestamp, most commonly) rather than message content.
 * A real provider payload routinely carries `timestamp: new Date(...)`, and
 * counting that the way an unrecognized content block is counted produced a
 * ~6x-inflated, `usedFallback: true` result for an ordinary field — noise,
 * not a caught undercount. Everything that is neither an array nor a plain
 * object (Date, RegExp, Map, Set, Error, typed arrays/Buffer, boxed
 * primitives, arbitrary class instances, …) is therefore treated the same
 * as a scalar and skipped here, matching `typeof value !== 'object'`
 * scalars (id, finish reason, …) that were already skipped.
 */
function isStructuralValue(value: object): value is Record<string, unknown> | readonly unknown[] {
  if (Array.isArray(value)) {
    return true;
  }
  const proto: unknown = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/**
 * Accounts for message properties outside the canonical `ChatMessageLike`
 * shape (see that interface's doc comment for why they exist at all).
 *
 * Only *structural* values ({@link isStructuralValue} — arrays or plain
 * objects, the shape tool-call lists and content-block lists actually take)
 * are counted; scalars (a message id, a timestamp — including a `Date`, a
 * finish reason, …) are not content and are skipped, so routine provider
 * metadata does not generate fallback noise. Every structural field found is
 * routed through {@link describeMessageContent}'s unknown-shape path, the
 * same conservative estimate an unrecognized `content` value gets, and
 * reported by key name so the cause is visible.
 */
function describeUnrecognizedFields(
  message: ChatMessageLike,
  tokenizer: Tokenizer,
): { readonly tokens: number; readonly reasons: readonly string[] } {
  // A message built for a specific provider's SDK routinely satisfies
  // `ChatMessageLike` structurally while carrying extra keys the type
  // doesn't name (TypeScript's excess-property check only fires on object
  // literals, not on values flowing through a variable) — this cast is
  // exactly how we reach those runtime-only keys.
  const raw = message as unknown as Record<string, unknown>;
  let tokens = 0;
  const reasons: string[] = [];
  for (const key of Object.keys(raw)) {
    if (CANONICAL_MESSAGE_KEYS.has(key)) {
      continue;
    }
    const value = raw[key];
    if (value === null || typeof value !== 'object' || !isStructuralValue(value)) {
      continue;
    }
    const fieldResult = describeMessageContent(value, tokenizer);
    tokens += fieldResult.tokens;
    reasons.push(`message field "${key}" is not part of the canonical ChatMessageLike shape`);
  }
  return { tokens, reasons };
}

function accountMessage(
  message: ChatMessageLike,
  tokenizer: Tokenizer,
  tokensPerMessage: number,
  tokensPerName: number,
  tokensPerToolCall: number,
): MessageAccounting {
  let tokens = tokensPerMessage;
  const reasons: string[] = [];

  const contentResult = describeMessageContent(message.content, tokenizer);
  tokens += contentResult.tokens;
  if (contentResult.usedFallback && contentResult.reason !== undefined) {
    reasons.push(contentResult.reason);
  }

  if (message.name !== undefined) {
    tokens += tokensPerName;
  }

  if (message.toolCalls !== undefined) {
    for (const call of message.toolCalls) {
      tokens += countToolCall(call, tokenizer, tokensPerToolCall);
    }
  }

  const unrecognized = describeUnrecognizedFields(message, tokenizer);
  tokens += unrecognized.tokens;
  for (const unrecognizedReason of unrecognized.reasons) {
    reasons.push(unrecognizedReason);
  }

  return reasons.length === 0
    ? { tokens, usedFallback: false }
    : { tokens, usedFallback: true, reason: reasons.join('; ') };
}

/**
 * Full per-message accounting: content, `name`, `toolCalls`, and — per the
 * `ChatMessageLike` boundary above — any structural field outside that
 * canonical shape, all with the same fallback-visibility contract as
 * {@link describeMessageContent}. Use this instead of a bare
 * `MessageTokenCounter.countMessage` when a caller (like `chat-fit`) needs
 * to know whether a number is an exact count or included a guess.
 */
export function describeMessage(
  message: ChatMessageLike,
  tokenizer: Tokenizer,
  options: MessageAccountingOptions = {},
): MessageAccounting {
  return accountMessage(
    message,
    tokenizer,
    options.tokensPerMessage ?? MESSAGE_OVERHEAD_TOKENS,
    options.tokensPerName ?? NAME_OVERHEAD_TOKENS,
    options.tokensPerToolCall ?? TOOL_CALL_OVERHEAD_TOKENS,
  );
}

/**
 * Builds a {@link MessageTokenCounter} over {@link ChatMessageLike} from a
 * base content {@link Tokenizer} plus the accounting model above. The
 * returned `id` composes the content tokenizer's id with this model's
 * version, so a report stays attributable to both — an approximate count
 * must never be presented as if it were exact.
 *
 * `countMessage`/`countMessages` return plain numbers per the
 * `MessageTokenCounter` contract; call {@link describeMessage} directly for
 * the same numbers plus fallback visibility.
 */
export function createMessageTokenCounter(
  tokenizer: Tokenizer,
  options: MessageAccountingOptions = {},
): MessageTokenCounter<ChatMessageLike> {
  const tokensPerMessage = options.tokensPerMessage ?? MESSAGE_OVERHEAD_TOKENS;
  const tokensPerName = options.tokensPerName ?? NAME_OVERHEAD_TOKENS;
  const tokensPerToolCall = options.tokensPerToolCall ?? TOOL_CALL_OVERHEAD_TOKENS;
  const conversationPrimingTokens =
    options.conversationPrimingTokens ?? CONVERSATION_PRIMING_TOKENS;

  const countMessage = (message: ChatMessageLike): number =>
    accountMessage(message, tokenizer, tokensPerMessage, tokensPerName, tokensPerToolCall).tokens;

  const countMessages = (messages: readonly ChatMessageLike[]): number => {
    if (messages.length === 0) {
      return 0;
    }
    let tokens = conversationPrimingTokens;
    for (const message of messages) {
      tokens += countMessage(message);
    }
    return tokens;
  };

  return {
    id: `${tokenizer.id}+message-accounting-v1`,
    countMessage,
    countMessages,
  };
}
