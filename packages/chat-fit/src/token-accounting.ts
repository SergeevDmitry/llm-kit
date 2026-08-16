/**
 * The default `MessageTokenCounter` chat-fit builds when a caller supplies
 * neither `messageTokenCounter` nor a custom counter of their own.
 *
 * `@llm-kit/tokenizer` already ships `createMessageTokenCounter`, and it is
 * the right choice for its own `ChatMessageLike` shape (`role`, `content`,
 * optional `name`, `toolCalls: [{ id, name, arguments }]`). chat-fit cannot
 * use it directly as the *default*, though: `fitChat`/`fitChatAsync` are
 * generic over an arbitrary `Message`, and the README's marquee use case is
 * feeding OpenAI-shaped (`tool_calls[].function.name`/`.arguments`,
 * `tool_call_id`) or Anthropic-shaped (`content: [{ type: 'tool_use', name,
 * input }, ...]`) messages straight through with no adapter step.
 * `createMessageTokenCounter`'s `countMessage` reads `message.toolCalls`
 * literally — on an OpenAI- or Anthropic-shaped message that field is
 * `undefined`, so it would silently charge zero tokens for the tool-call
 * payload. That is a real undercount, which is the one direction token
 * counting must never go.
 *
 * So this module reimplements the same accounting model — reusing the
 * *primitives* `@llm-kit/tokenizer` exports for exactly this
 * (`describeMessageContent` and the overhead constants) — over chat-fit's
 * own multi-shape structural reader (`adapters/generic.ts`), which already
 * knows how to find `toolCalls`/`tool_calls`/`tool_use` blocks across all
 * three shapes.
 *
 * Reimplementing the accounting model this way drops `@llm-kit/tokenizer`'s
 * unrecognized-structural-field safeguard
 * (`internal/tokenizer/src/message-accounting.ts`'s `describeUnrecognizedFields`)
 * unless it is rebuilt here. Every own-enumerable message property this
 * module doesn't specifically read (`role`/`name`/`content`/`toolCalls`/
 * `toolCallId`/`tool_calls`/`tool_call_id`) would otherwise charge zero
 * tokens with no warning — a legacy OpenAI `function_call`, a
 * Responses-style `reasoning` block, or a `server_tool_use` payload could
 * all vanish from the count entirely, producing a report that looks like it
 * fits a budget it exceeds by orders of magnitude. `describeExtraFields`
 * below closes that gap the same way `describeUnrecognizedFields` does for
 * the foundation's own canonical shape: any *structural* (array/object)
 * property outside the keys this module actually consumes is routed
 * through the same conservative unknown-shape fallback
 * `describeMessageContent` already applies to unrecognized `content`, and
 * surfaced via `describeContentFallbacks` so a caller sees it in
 * `report.warnings` by key name. Scalar extras (an id, a numeric timestamp,
 * a finish reason) are still skipped — they cannot carry billable payload
 * and counting them would only add fallback noise to every routine
 * provider message.
 *
 * `isStructuralValue` below is a deliberate second copy of
 * `internal/tokenizer/src/message-accounting.ts`'s function of the same
 * name, not a shared import. The two must stay semantically identical: a
 * `Date`/`RegExp`/`Map`/`Set`/`Error`/typed array is `typeof 'object'` but
 * is the natural JS representation of scalar metadata (a timestamp, most
 * commonly), not message content, so it must be skipped the same way a
 * numeric or string scalar already is — otherwise a routine `timestamp: new
 * Date(...)` field generates fallback noise and an inflated count for no
 * reason. `internal/tokenizer` is never published and is bundled
 * per-consumer, so there is no runtime import to share here — but that also
 * means a fix to the foundation's copy does not reach this one
 * automatically. If `internal/tokenizer`'s `isStructuralValue` changes,
 * update this one to match.
 */
import {
  CONVERSATION_PRIMING_TOKENS,
  describeMessageContent,
  MESSAGE_OVERHEAD_TOKENS,
  NAME_OVERHEAD_TOKENS,
  TOOL_CALL_OVERHEAD_TOKENS,
  type MessageContentAccounting,
  type MessageTokenCounter,
  type Tokenizer,
} from '@llm-kit/tokenizer';
import { readMessageStructure } from './adapters/generic.js';

function messageContent(message: unknown): unknown {
  if (typeof message !== 'object' || message === null) return undefined;
  return (message as { content?: unknown }).content;
}

/** Framing overhead for an Anthropic `tool_result` block, mirroring `TOOL_CALL_OVERHEAD_TOKENS`'s role for `tool_use`. */
const TOOL_RESULT_OVERHEAD_TOKENS = 3;

function blockType(part: unknown): unknown {
  return typeof part === 'object' && part !== null ? (part as { type?: unknown }).type : undefined;
}

/**
 * Content-array accounting that knows about two Anthropic block types
 * `@llm-kit/tokenizer`'s `describeMessageContent` doesn't: `tool_use` blocks
 * are skipped here (the `structure.toolCalls` loop in `countMessage` already
 * charges name + input for every tool call, across all three recognized
 * shapes — counting the same block again via the unknown-shape fallback was
 * a ~3x double charge), and `tool_result` blocks are counted directly (their
 * own `content` plus a small framing overhead) instead of falling back to
 * the unknown-shape estimate, so a well-formed Anthropic tool exchange
 * doesn't flood `report.warnings` with false "unrecognized part" claims.
 * Anything else — plain strings, `{type:'text'}` parts, non-array content,
 * genuinely unrecognized block types — defers to `describeMessageContent`
 * unchanged.
 */
function describeContentForCounting(
  content: unknown,
  tokenizer: Tokenizer,
): MessageContentAccounting {
  if (!Array.isArray(content)) {
    return describeMessageContent(content, tokenizer);
  }
  let tokens = 0;
  let usedFallback = false;
  const reasons: string[] = [];
  for (const part of content) {
    if (blockType(part) === 'tool_use') continue;
    if (blockType(part) === 'tool_result') {
      tokens += TOOL_RESULT_OVERHEAD_TOKENS;
      const resultContent = (part as { content?: unknown }).content;
      if (resultContent !== undefined) {
        const inner = describeContentForCounting(resultContent, tokenizer);
        tokens += inner.tokens;
        if (inner.usedFallback) {
          usedFallback = true;
          if (inner.reason !== undefined) reasons.push(inner.reason);
        }
      }
      continue;
    }
    const partResult = describeMessageContent([part], tokenizer);
    tokens += partResult.tokens;
    if (partResult.usedFallback) {
      usedFallback = true;
      if (partResult.reason !== undefined) reasons.push(partResult.reason);
    }
  }
  if (!usedFallback) return { tokens, usedFallback: false };
  return { tokens, usedFallback: true, reason: reasons.join('; ') };
}

/**
 * Every top-level message key this module actually reads elsewhere:
 * `role`/`name` (`readMessageStructure`), `content` (`messageContent`, which
 * also covers the Anthropic `tool_use`/`tool_result` blocks that live
 * *inside* `content` — those never surface as a separate top-level key),
 * `toolCalls`/`toolCallId` (the `ChatMessageLike` shape), and
 * `tool_calls`/`tool_call_id` (OpenAI). Getting this set right matters in
 * both directions: a key listed here but not actually consumed by
 * `readMessageStructure`/`messageContent` is a silent undercount; a key
 * consumed but missing from this set is a double count (the tool-call
 * payload would be charged once by `countMessage`'s `structure.toolCalls`
 * loop and again here as an "unrecognized" field). Verified against
 * `adapters/generic.ts`, `adapters/openai.ts` and `adapters/anthropic.ts` —
 * those three files are the only readers of a message's structure, and this
 * set is exactly their key list.
 *
 * `metadata` is here too, but for a different reason: it is not read by any
 * structure reader, but it *is* a field this package itself declares, on
 * `ChatMessage` (`types.ts`), as a place
 * for the caller's own bookkeeping (a trace id, an internal timestamp, …) —
 * chat-fit's contract, not an unknown shape it has to guess at. The
 * conservative-unknown-fallback rule exists for fields this package does
 * *not* know the semantics of; `metadata` is the one field where it does,
 * because it wrote that semantics itself. Counting it anyway would silently
 * cost budget for data the provider never receives, which is a real cost
 * with no corresponding safety benefit (the failure the conservative rule
 * guards against — an undercounted request the provider rejects — cannot
 * happen here, because `metadata` is never sent to a provider by
 * definition). A caller who repurposes `metadata` to carry real,
 * provider-bound content is using the field against its documented
 * contract and should supply their own `messageTokenCounter` — see the
 * README's "How the default counter handles fields it doesn't recognize".
 */
const CONSUMED_KEYS = new Set<string>([
  'role',
  'name',
  'content',
  'toolCalls',
  'toolCallId',
  'tool_calls',
  'tool_call_id',
  'metadata',
]);

/**
 * True for a plain object (`{}`, or `Object.create(null)`) or an array — the
 * two shapes a tool-call list or a content-block list actually takes.
 *
 * `typeof value === 'object'` alone is not enough to mean "structural
 * content": `Date`, `RegExp`, `Map`, `Set`, `Error`, typed arrays, and other
 * boxed/exotic built-ins are `typeof 'object'` too, but they are the
 * natural JS representation of scalar metadata (a timestamp, most
 * commonly) rather than message content — a routine `timestamp: new
 * Date(...)` field must not generate fallback noise and an inflated count
 * the way an unrecognized content block does. Everything that is neither
 * an array nor a plain object is therefore treated the same as a scalar
 * and skipped, matching `typeof value !== 'object'` scalars (id, finish
 * reason, …) that were already skipped. See the module doc comment above:
 * this is a deliberate second copy of `internal/tokenizer`'s function of
 * the same name, not a shared import — the two must stay in step by hand.
 */
function isStructuralValue(value: object): value is Record<string, unknown> | readonly unknown[] {
  if (Array.isArray(value)) {
    return true;
  }
  const proto: unknown = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/**
 * Accounts for message properties outside {@link CONSUMED_KEYS} — the same
 * safeguard `@llm-kit/tokenizer`'s `describeUnrecognizedFields` applies to
 * its own canonical shape, extended
 * over chat-fit's wider multi-provider key list. Only *structural* values
 * ({@link isStructuralValue} — arrays or plain objects, the shape a legacy
 * `function_call`, a `reasoning` block, or any other real payload actually
 * takes) are counted; scalars (an id, a numeric timestamp — including a
 * `Date`, a finish reason, …) are not content and are skipped, so routine
 * provider metadata does not generate fallback noise. Every structural
 * field found is routed through `describeMessageContent`'s unknown-shape
 * path and reported by key name.
 */
function describeExtraFields(
  message: unknown,
  tokenizer: Tokenizer,
): { readonly tokens: number; readonly reasons: readonly string[] } {
  if (typeof message !== 'object' || message === null) {
    return { tokens: 0, reasons: [] };
  }
  let tokens = 0;
  const reasons: string[] = [];
  for (const key of Object.keys(message as Record<string, unknown>)) {
    if (CONSUMED_KEYS.has(key)) continue;
    const value = (message as Record<string, unknown>)[key];
    if (value === null || typeof value !== 'object' || !isStructuralValue(value)) continue;
    const fieldResult = describeMessageContent(value, tokenizer);
    tokens += fieldResult.tokens;
    reasons.push(`message field "${key}" is not a shape chat-fit counts directly`);
  }
  return { tokens, reasons };
}

/**
 * Flags messages whose accounting fell back to a conservative estimate:
 * unrecognized `content` shape (`describeMessageContent`'s `usedFallback` —
 * the non-string multimodal content edge case) and/or an
 * unrecognized structural field outside {@link CONSUMED_KEYS}. Only
 * meaningful when chat-fit owns the counting path (the default counter); a
 * caller-supplied `messageTokenCounter` is opaque, so this is not run for
 * it.
 */
export function describeContentFallbacks<Message>(
  messages: readonly Message[],
  tokenizer: Tokenizer,
): readonly { readonly index: number; readonly reason: string }[] {
  const flagged: { index: number; reason: string }[] = [];
  messages.forEach((message, index) => {
    const reasons: string[] = [];
    const accounting = describeContentForCounting(messageContent(message), tokenizer);
    if (accounting.usedFallback) {
      reasons.push(accounting.reason ?? 'content used the unknown-shape fallback');
    }
    const extra = describeExtraFields(message, tokenizer);
    for (const reason of extra.reasons) {
      reasons.push(reason);
    }
    if (reasons.length > 0) {
      flagged.push({ index, reason: reasons.join('; ') });
    }
  });
  return flagged;
}

/**
 * Read-only, keyed lookup for the fallback reasons a `DefaultMessageTokenCounter`
 * recorded per message. Deliberately narrower than `ReadonlyMap` — no
 * `size`, no iteration, no `keys()`/`values()`/
 * `entries()` — because the only real consumer, `finalize.ts`, only ever does
 * `.get(message)` for messages it already has in hand (`plan.allGroups`), and
 * a lookup-only shape is exactly what a `WeakMap`-backed implementation can
 * satisfy without exposing anything a `WeakMap` can't do. If some future
 * caller genuinely needs to enumerate flagged messages, that is new surface
 * area to design deliberately, not a reason to widen this back to `ReadonlyMap`
 * by default.
 */
export interface FallbackReasonLookup<Message> {
  /** `undefined` when `message` never triggered conservative accounting. */
  get(message: Message): readonly string[] | undefined;
}

/**
 * A default counter, plus the fallback-accounting side channel `finalize.ts`
 * reads to build `report.warnings`. Not part of the public
 * `MessageTokenCounter<Message>` contract — internal to this package.
 */
export interface DefaultMessageTokenCounter<Message> extends MessageTokenCounter<Message> {
  /**
   * Every message `countMessage` has processed and found to need conservative
   * accounting (unrecognized `content` shape and/or a structural field
   * outside {@link CONSUMED_KEYS}), keyed by message reference, populated as
   * a side effect of the counting `buildFitPlan` already does — not a
   * separate pass over the input. Only messages that actually triggered a
   * fallback get an entry, so this stays small regardless of conversation
   * size. `finalize.ts` reads it after selection, restricted to the messages
   * that survived into the result, so a warning never names an index the
   * caller can't find in `report.keptIndexes`.
   *
   * Backed by a `WeakMap`, not a strong `Map`: this object is built fresh
   * inside `normalizeOptions` on every
   * `fitChat`/`fitChatAsync` call and is not part of the public API — today,
   * nothing outlives the call that built it, so a strong `Map` would already
   * be released with it. A `WeakMap` makes that true by construction instead
   * of by "nothing currently retains this", which is the kind of invariant
   * that quietly stops holding the day someone adds a
   * `createChatFitter`-style factory that builds a counter once and reuses
   * it across calls (see the caution note on
   * {@link createDefaultMessageTokenCounter}). The switch costs nothing here:
   * {@link FallbackReasonLookup} only supports keyed `.get`, which is all
   * `finalize.ts` ever does.
   */
  readonly fallbackReasons: FallbackReasonLookup<Message>;
}

/**
 * Builds the default `MessageTokenCounter<Message>` for `fitChat`/
 * `fitChatAsync`: content and overhead accounting identical in spirit to
 * `@llm-kit/tokenizer`'s own `createMessageTokenCounter`, but reading tool
 * calls through chat-fit's shape-agnostic structural reader so OpenAI-like
 * and Anthropic-like messages are counted accurately with no adapter step.
 *
 * `countMessage` already computes `describeMessageContent`'s `usedFallback`/
 * `reason` and `describeExtraFields`'s `reasons` to produce the token total;
 * `fallbackReasons` below just keeps what it already computed instead of
 * discarding it, so `finalize.ts` never has to recompute the same accounting
 * a second time over the whole input.
 *
 * Called exactly once per `fitChat`/`fitChatAsync` invocation, from inside
 * `normalizeOptions` — never exported from `src/index.ts`, so no caller can
 * obtain a `DefaultMessageTokenCounter` and hold onto it. If that ever
 * changes — a `createChatFitter`-style factory that builds and reuses one
 * `MessageTokenCounter` across many `fitChat` calls, say — `fallbackReasons`
 * would start accumulating entries for every message ever passed through it
 * for the factory's lifetime. The `WeakMap` below already makes that safe
 * (entries are collected once nothing else references the message), but
 * revisit this note if such a factory is ever added, since a `WeakMap`'s
 * *timing* of collection is still nondeterministic and unsuited to a case
 * that wants bounded memory on a predictable schedule.
 */
export function createDefaultMessageTokenCounter<Message>(
  tokenizer: Tokenizer,
): DefaultMessageTokenCounter<Message> {
  const rawFallbackReasons = new WeakMap<object, readonly string[]>();
  const fallbackReasons: FallbackReasonLookup<Message> = {
    get(message) {
      if (typeof message !== 'object' || message === null) return undefined;
      return rawFallbackReasons.get(message);
    },
  };

  const countMessage = (message: Message): number => {
    const structure = readMessageStructure(message);
    let tokens = MESSAGE_OVERHEAD_TOKENS;
    const contentAccounting = describeContentForCounting(messageContent(message), tokenizer);
    tokens += contentAccounting.tokens;
    if (structure.name !== undefined) {
      tokens += NAME_OVERHEAD_TOKENS;
    }
    for (const call of structure.toolCalls) {
      tokens += TOOL_CALL_OVERHEAD_TOKENS + tokenizer.count(call.name ?? '');
      if (call.arguments !== undefined) {
        tokens +=
          typeof call.arguments === 'string'
            ? tokenizer.count(call.arguments)
            : describeMessageContent(call.arguments, tokenizer).tokens;
      }
    }
    const extra = describeExtraFields(message, tokenizer);
    tokens += extra.tokens;

    const reasons: string[] = [];
    if (contentAccounting.usedFallback) {
      reasons.push(contentAccounting.reason ?? 'content used the unknown-shape fallback');
    }
    for (const reason of extra.reasons) {
      reasons.push(reason);
    }
    if (reasons.length > 0 && typeof message === 'object' && message !== null) {
      rawFallbackReasons.set(message, reasons);
    }

    return tokens;
  };

  const countMessages = (messages: readonly Message[]): number => {
    if (messages.length === 0) return 0;
    let tokens = CONVERSATION_PRIMING_TOKENS;
    for (const message of messages) {
      tokens += countMessage(message);
    }
    return tokens;
  };

  return {
    id: `${tokenizer.id}+chat-fit-message-accounting-v1`,
    countMessage,
    countMessages,
    fallbackReasons,
  };
}
