# chat-fit

Trim chat history to a token budget without ever splitting a tool call from its result.

[![npm](https://img.shields.io/npm/v/chat-fit.svg)](https://www.npmjs.com/package/chat-fit)
[![CI](https://github.com/SergeevDmitry/llm-kit/actions/workflows/ci.yml/badge.svg)](https://github.com/SergeevDmitry/llm-kit/actions/workflows/ci.yml)
[![zero dependencies](https://img.shields.io/badge/dependencies-0-brightgreen)](https://www.npmjs.com/package/chat-fit?activeTab=dependencies)

## The problem

Chat histories outgrow context windows, and the obvious fix — `messages.slice(-N)`,
or dropping the oldest turns until it fits — has no idea that an assistant's
tool call and its tool result are two separate array entries that must travel
together. Most providers reject the request outright the moment one shows up
without the other.

## Before / after

```ts
import { fitChat, type ChatMessage } from 'chat-fit';

const conversation: ChatMessage[] = [
  { role: 'system', content: 'You are a terse assistant.' },
  { role: 'user', content: 'What is 41 + 1, using the calculator tool?' },
  {
    role: 'assistant',
    content: 'Let me check.',
    toolCalls: [{ id: 'call_1', name: 'calculator', arguments: { expression: '41 + 1' } }],
  },
  { role: 'tool', toolCallId: 'call_1', content: '42' },
  { role: 'assistant', content: 'The answer is 42.' },
];

// The naive fix: keep only the last 3 messages. It has no idea `call_1`'s
// tool call and its result are a pair — it keeps the call and drops the
// result, which most providers reject outright as a malformed request.
const naiveTrim = conversation.slice(-3);
const naiveHasCall = naiveTrim.some((m) => m.toolCalls?.some((c) => c.id === 'call_1'));
const naiveHasResult = naiveTrim.some((m) => m.toolCallId === 'call_1');
console.log('naive trim splits the exchange:', naiveHasCall !== naiveHasResult); // true

// fitChat treats the call and its result as one atomic unit: kept together,
// or dropped together — never split.
const fit = fitChat(conversation, { maxTokens: 60 });
const fitHasCall = fit.messages.some((m) => m.toolCalls?.some((c) => c.id === 'call_1'));
const fitHasResult = fit.messages.some((m) => m.toolCallId === 'call_1');
console.log('fitChat keeps the exchange atomic:', fitHasCall === fitHasResult); // true
```

## Install

```text
npm install chat-fit
```

## Minimal usage

```ts
import { fitChat } from 'chat-fit';

const result = fitChat(
  [
    { role: 'system', content: 'Be concise.' },
    { role: 'user', content: 'Hello!' },
    { role: 'assistant', content: 'Hi there — how can I help?' },
  ],
  { maxTokens: 200 },
);

result.messages; // the fitted conversation, in original order
result.tokenCount; // its token count under the same counter the budget used
result.report; // what was kept, dropped, and why
```

## Guarantees

- **A tool-call group is never split.** An assistant message with tool calls
  and every message that resolves one of those calls are kept together or
  dropped together — always, including when calls span multiple ids in one
  message, when results arrive out of order, or when a result carries no id
  at all (see [Edge cases](#edge-cases-and-limitations)).
- **System and developer messages are always preserved**, wherever they
  appear in the conversation — not just when they lead it.
- **Preserved content is never silently truncated.** If everything that must
  be kept does not fit the budget on its own, `fitChat`/`fitChatAsync` throw
  `ChatFitError` with code `PRESERVED_MESSAGES_EXCEED_BUDGET` instead of
  cutting a system prompt down to size.
- **Recent turns are prioritized**, and the final output is always in
  original chronological order, regardless of selection order internally.
- **Message content is never modified.** What survives selection is the
  exact object you passed in — `chat-fit` reorders and omits, it does not
  rewrite.
- **Token counts never claim to be exact.** The report always names the
  counter that produced them (`report.counterId`) and reports
  `report.approximateTokenization`: `true` when the bundled approximate
  tokenizer was used, `false` when a default counter was built over an
  injected `Tokenizer` whose id isn't the bundled one (presumed exact), and
  `'unknown'` when you supplied `messageTokenCounter` directly — `chat-fit`
  cannot verify a caller-supplied counter's exactness, so it says so rather
  than guessing either way (see [`FitChatReport`](#fitchatreport)).
- **Token counts never undercount a field they don't recognize.** The
  default counter charges every message's `content`, `name`, and tool calls
  (across `ChatMessage`, OpenAI, and Anthropic shapes) — and, for anything
  else on the message (a legacy `function_call`, a `reasoning` block, a
  vendor extension), it conservatively estimates that payload too instead of
  silently charging it zero, flagging the field by name in
  `report.warnings`. See
  [How the default counter handles fields it doesn't recognize](#how-the-default-counter-handles-fields-it-doesnt-recognize).
- **No network call, ever.** See [Security and privacy](#security-and-privacy).

## API

### `fitChat(messages, options)`

```ts no-check
function fitChat<Message = ChatMessage>(
  messages: readonly Message[],
  options: Omit<FitChatOptions<Message>, 'strategy' | 'summary'> & { strategy?: 'drop-oldest' },
): FitChatResult<Message>;
```

Synchronous. `'drop-oldest'` only — there is no summarizer to await, so
nothing here is ever asynchronous.

### `fitChatAsync(messages, options)`

```ts no-check
function fitChatAsync<Message = ChatMessage>(
  messages: readonly Message[],
  options: FitChatOptions<Message> & { signal?: AbortSignal },
): Promise<FitChatResult<Message>>;
```

Everything `fitChat` does, plus `strategy: 'summarize-middle'`. The only
`await` inside this function is your own `summarizer` callback.

### `FitChatOptions<Message>`

| Option                | Type                                             | Default                           | Meaning                                                                                                      |
| --------------------- | ------------------------------------------------ | --------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `maxTokens`           | `number`                                         | _required_                        | Hard ceiling for the fitted conversation.                                                                    |
| `reserveTokens`       | `number`                                         | `0`                               | Tokens set aside for the model's reply; unavailable to fitted messages.                                      |
| `tokenizer`           | `Tokenizer`                                      | the bundled approximate tokenizer | Content tokenizer used to build the default counter.                                                         |
| `messageTokenCounter` | `MessageTokenCounter<Message>`                   | built from `tokenizer`            | Overrides counting entirely, including overhead.                                                             |
| `strategy`            | `'drop-oldest' \| 'summarize-middle'`            | `'drop-oldest'`                   | What happens to groups that don't fit.                                                                       |
| `preserveRoles`       | `readonly string[]`                              | `['system', 'developer']`         | Roles always kept, wherever they appear.                                                                     |
| `groupMessages`       | `(messages) => readonly MessageGroup<Message>[]` | id-linked tool-call grouping      | Overrides atomic grouping.                                                                                   |
| `summary`             | `SummaryOptions<Message>`                        | —                                 | Required when `strategy` is `'summarize-middle'`.                                                            |
| `safetyMarginTokens`  | `number`                                         | `0`                               | Extra headroom beyond `reserveTokens`. See [below](#budget-reserve-and-safety-margin).                       |
| `maxMessages`         | `number`                                         | `50_000`                          | Caps `messages.length`. Throws `ChatFitError` (`INPUT_TOO_LARGE`) above it, before any grouping or counting. |

### `FitChatResult<Message>`

```ts no-check
interface FitChatResult<Message> {
  readonly messages: readonly Message[];
  readonly tokenCount: number;
  readonly report: FitChatReport;
}
```

### `FitChatReport`

Every field is plain JSON — safe to log, store, or send to a debugging
endpoint as-is.

```ts no-check
interface FitChatReport {
  readonly initialTokenCount: number;
  readonly finalTokenCount: number;
  readonly maxTokens: number;
  readonly reserveTokens: number;
  readonly safetyMarginTokens: number;
  readonly availableBudget: number; // maxTokens - reserveTokens - safetyMarginTokens
  readonly strategy: 'drop-oldest' | 'summarize-middle';
  readonly counterId: string;
  // true: the bundled approximate tokenizer counted these tokens.
  // false: a default counter over an injected `Tokenizer` (not the bundled
  //   one) counted them — presumed exact.
  // 'unknown': you supplied `messageTokenCounter` directly. It overrides
  //   counting entirely, but `MessageTokenCounter` declares nothing about
  //   its own exactness, so chat-fit cannot verify it either way and says
  //   so rather than mislabeling your counter as approximate or exact.
  readonly approximateTokenization: boolean | 'unknown';
  readonly keptIndexes: readonly number[]; // original indexes present in `messages`
  readonly removedIndexes: readonly number[]; // original indexes dropped or summarized away
  readonly toolCallGroups: readonly {
    readonly toolCallIds: readonly string[];
    readonly indexes: readonly number[];
    readonly kept: boolean;
  }[];
  readonly summarizedRange?: {
    readonly startIndex: number;
    readonly endIndex: number;
    readonly messageCount: number;
    readonly summaryTokenCount?: number;
  };
  readonly summaryAttempts: number;
  // "message N: <reason>" content-accounting warnings only ever name an N
  // present in `keptIndexes` — never a dropped message. See "How the
  // default counter handles fields it doesn't recognize" below.
  readonly warnings: readonly string[];
}
```

### `Summarizer<Message>` and `SummaryOptions<Message>`

```ts no-check
type Summarizer<Message> = (request: SummaryRequest<Message>) => Promise<Message>;

interface SummaryRequest<Message> {
  readonly messages: readonly Message[]; // the selected middle range, whole atomic groups only
  readonly maxSummaryTokens: number;
  readonly previousSummary?: Message;
  readonly signal?: AbortSignal;
}

interface SummaryOptions<Message> {
  readonly summarizer: Summarizer<Message>;
  readonly maxSummaryTokens?: number; // default: 20% of the available budget
  readonly maxAttempts?: number; // default: 3
}
```

### `ChatFitError`

```ts no-check
class ChatFitError extends Error {
  readonly code:
    | 'PRESERVED_MESSAGES_EXCEED_BUDGET'
    | 'INVALID_OPTIONS'
    | 'SUMMARY_FAILED'
    | 'TOKEN_COUNTING_FAILED'
    | 'INPUT_TOO_LARGE';
}
```

See [Edge cases](#edge-cases-and-limitations) for when each `code` is thrown.

### Other exported types

`ChatRole`, `ChatMessage`, `MessageGroup<Message>`, `SummarizedRangeReport`,
`ToolCallGroupReport` — the supporting shapes referenced above. `Tokenizer`
and `MessageTokenCounter<Message>`, plus `approximateTokenizer`,
`APPROX_TOKENIZER_ID`, `fromEncoder`, `fromTiktokenLikeEncoder`, and
`fromAnthropicLikeCounter`, are re-exported from the private tokenizer
foundation this package bundles — see
[Advanced options](#advanced-options-and-adapters). This is the only way to
reach them: that foundation is never published on its own.

## Advanced options and adapters

### Provider message shapes work with no adapter step

`fitChat`/`fitChatAsync` recognize `ChatMessage`-shaped, OpenAI-shaped
(`tool_calls[].function`, `tool_call_id`), and Anthropic-shaped
(`content: [{ type: 'tool_use' | 'tool_result', ... }]`) messages structurally
— by field shape, never by importing an SDK. Feed either straight through:

```ts
import { fitChat } from 'chat-fit';

// OpenAI-shaped, exactly as `chat.completions.create` returns it.
const openAiMessages = [
  { role: 'user', content: 'What is the weather in Boston?' },
  {
    role: 'assistant',
    content: null,
    tool_calls: [
      {
        id: 'call_abc',
        type: 'function',
        function: { name: 'get_weather', arguments: '{"city":"Boston"}' },
      },
    ],
  },
  { role: 'tool', tool_call_id: 'call_abc', content: '{"tempF":61}' },
];

const fitted = fitChat(openAiMessages, { maxTokens: 500 });
```

```ts
import { fitChat } from 'chat-fit';

// Anthropic-shaped: tool_use / tool_result content blocks.
const anthropicMessages = [
  { role: 'user', content: 'What is the weather in Boston?' },
  {
    role: 'assistant',
    content: [
      { type: 'text', text: 'Let me check.' },
      { type: 'tool_use', id: 'toolu_1', name: 'get_weather', input: { city: 'Boston' } },
    ],
  },
  {
    role: 'user',
    content: [{ type: 'tool_result', tool_use_id: 'toolu_1', content: '61F and sunny' }],
  },
];

const fitted = fitChat(anthropicMessages, { maxTokens: 500 });
```

### How the default counter handles fields it doesn't recognize

The default counter reads `role`, `name`, `content`, and tool calls
(`toolCalls`/`toolCallId`, OpenAI's `tool_calls`/`tool_call_id`, Anthropic's
`tool_use`/`tool_result` content blocks) directly. Anything else on a
message — a legacy OpenAI `function_call`, a Responses-style `reasoning`
block, a `server_tool_use` payload, a vendor extension your provider added
last month — is not something this package's structural reader knows how to
bill precisely. Rather than charge it zero tokens (a silent undercount, which
is strictly worse than an overcount: it produces a request the provider
rejects for exceeding its budget), the default counter estimates that field
the same conservative way it already estimates unrecognized `content`, and
names the field in `report.warnings`:

```ts
import { fitChat } from 'chat-fit';

const legacyFunctionCall = {
  role: 'assistant',
  content: null,
  function_call: { name: 'search', arguments: '{"query":"weather in Boston"}' },
};

const result = fitChat([legacyFunctionCall], { maxTokens: 500 });
result.report.warnings; // mentions: message field "function_call" is not a shape chat-fit counts directly
```

Only _structural_ extras — a plain object (`{}`) or an array — are estimated
this way. A scalar extra (an id, a numeric timestamp, a finish reason) is not
content and is never counted, so ordinary provider metadata does not generate
fallback noise. That "scalar" treatment also covers `Date`, `RegExp`, `Map`,
`Set`, `Error`, and typed arrays: all of these are `typeof 'object'` in
JavaScript, but they're the natural representation of metadata, not message
payload — a routine `timestamp: new Date(...)` field is free, the same as a
numeric timestamp would be, not conservatively estimated. (A `Date` used
directly as a message's `content`, rather than as an extra field, is still
real content and still gets the conservative fallback — this scalar
treatment applies only to fields outside the shapes the counter reads.)

`ChatMessage.metadata` is a **separate, explicit exemption** — not an
instance of the structural/scalar rule above. `metadata` is a field this
package itself declares, as a place for your own bookkeeping (a trace id, an
internal timestamp, whatever you like), so its semantics are chat-fit's to
define rather than an unknown shape to guess conservatively at. **`metadata`
is never counted, however large, structural or not.** If you put
provider-bound content there instead of using it for your own bookkeeping —
against its documented purpose — the default counter will not see it; supply
your own `messageTokenCounter` if you do that.

This only applies to the **default** counter (no `messageTokenCounter`
supplied). A caller-supplied `messageTokenCounter` overrides counting
entirely — see [`FitChatReport`](#fitchatreport)'s
`approximateTokenization: 'unknown'` note.

A `"message N: ..."` warning always names an index present in
`report.keptIndexes` — never a message that got dropped or summarized away.
A message trimmed from the conversation before it reached the output isn't
warned about even if its content would have triggered the conservative
fallback, since the point of the warning is to flag which parts of _the
result you got back_ were estimated conservatively, not to audit content
that never made it into `result.messages`. (This is also why the check costs
nothing extra: the default counter records the fallback reason as a byproduct
of the token counting it already does for every message, rather than
re-walking the input a second time — see [Performance](#performance).)

### Async: summarizing the middle instead of dropping it

```ts
import { fitChatAsync, type ChatMessage, type SummaryRequest } from 'chat-fit';

async function summarizeRange(request: SummaryRequest<ChatMessage>): Promise<ChatMessage> {
  // Call whatever model you like here — chat-fit never does this for you.
  const bullet = request.messages
    .filter((m) => typeof m.content === 'string')
    .map((m) => `${m.role}: ${String(m.content).slice(0, 40)}`)
    .join(' / ');
  return { role: 'system', content: `[earlier discussion: ${bullet}]` };
}

const longConversation: ChatMessage[] = Array.from({ length: 40 }, (_, i) => ({
  role: i % 2 === 0 ? 'user' : 'assistant',
  content: `turn ${i}`,
}));

const result = await fitChatAsync(longConversation, {
  maxTokens: 400,
  strategy: 'summarize-middle',
  summary: { summarizer: summarizeRange },
});

result.report.summarizedRange; // { startIndex, endIndex, messageCount, summaryTokenCount } or undefined
```

### Budget, reserve, and safety margin

```ts
import { fitChat, type ChatMessage } from 'chat-fit';

declare const conversationMessages: ChatMessage[];

fitChat(conversationMessages, {
  maxTokens: 8000, // the model's total context window you're budgeting against
  reserveTokens: 1000, // room for the reply you're about to ask the model to generate
  // availableBudget = maxTokens - reserveTokens - safetyMarginTokens = 7000 here
});
```

`safetyMarginTokens` defaults to `0`. The bundled approximate tokenizer
already over-counts by roughly 1.15x-2x depending on content, which is a
real safety margin on its own — stacking a large default on top of an
estimator that already runs high wastes context for no additional safety.
Set `safetyMarginTokens` yourself if you've measured your own provider's
overhead independently, or if you're using an exact injected tokenizer (see
below) that carries none of the approximate tokenizer's built-in headroom.

### Injecting an exact tokenizer

The default tokenizer is a zero-dependency estimator. If you have a real
encoder (e.g. a `tiktoken`-style object your application already depends on),
wrap it instead of trusting the estimate — `fromTiktokenLikeEncoder` adapts
any object with `encode`/`decode` methods, with no dependency added to this
package (the encoder is entirely yours):

```ts no-check
import { fitChat, fromTiktokenLikeEncoder } from 'chat-fit';
import { encoding_for_model } from 'tiktoken'; // your own dependency, not chat-fit's

const encoder = encoding_for_model('gpt-4o');
const tokenizer = fromTiktokenLikeEncoder(encoder, { id: 'tiktoken-gpt-4o' });

const result = fitChat(messages, { maxTokens: 8000, tokenizer });
```

`Tokenizer` is a small, structural interface —
`{ id, count(text), encode?(text), decode?(tokens) }` — so you can also build
one by hand, or use `fromEncoder` (generic) or `fromAnthropicLikeCounter`
(wraps a counting-only endpoint, no local `encode`/`decode`) for other
encoder shapes.

Passing `tokenizer` like this still uses the default `messageTokenCounter`
built over it, so `report.approximateTokenization` is `false` — chat-fit
knows this isn't its own bundled estimator. If you instead supply
`messageTokenCounter` directly (overriding counting entirely, including
per-message overhead), `report.approximateTokenization` is `'unknown'`, not
`false`: `MessageTokenCounter` carries no field declaring whether it counts
exactly, so chat-fit cannot claim exactness it hasn't verified — see
[`FitChatReport`](#fitchatreport).

### Custom grouping and preserved roles

```ts
import { fitChat, type ChatMessage } from 'chat-fit';

declare const messages: ChatMessage[];

fitChat(messages, {
  maxTokens: 500,
  // Anything beyond the default `['system', 'developer']` you want pinned:
  preserveRoles: ['system', 'developer', 'pinned-context'],
});
```

`groupMessages` lets you replace the default atomic-grouping policy entirely
(for example, to also pair every user/assistant turn as one evictable unit).
Whatever you return, `chat-fit` still validates it partitions every input
message exactly once, and preserved-role marking is still applied afterward
— you cannot accidentally make a system message droppable by grouping it
with something else.

## Edge cases and limitations

| Case                                                                                                                                                         | Behavior                                                                                                                                                                                                                                                                                                |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A system prompt alone exceeds the budget                                                                                                                     | Throws `ChatFitError` with code `PRESERVED_MESSAGES_EXCEED_BUDGET`. Never truncated.                                                                                                                                                                                                                    |
| Several system/developer messages scattered through history                                                                                                  | All preserved, wherever they appear — not just leading ones.                                                                                                                                                                                                                                            |
| `reserveTokens` exceeds `maxTokens`                                                                                                                          | `availableBudget` goes negative; surfaces as `PRESERVED_MESSAGES_EXCEED_BUDGET` (nothing can fit a non-positive budget).                                                                                                                                                                                |
| Tool results arrive out of order, or in a batch resolving multiple prior calls                                                                               | Linked by id, not position — grouped correctly regardless of array order.                                                                                                                                                                                                                               |
| A tool call or result has no id at all                                                                                                                       | Conservative adjacency fallback: paired with the nearest preceding still-open call only, and flagged in `report.warnings`. Never guessed further back.                                                                                                                                                  |
| A single atomic tool group is bigger than the whole budget                                                                                                   | Dropped (or summarized) as a unit — never partially included.                                                                                                                                                                                                                                           |
| An empty message array                                                                                                                                       | Returns `{ messages: [], tokenCount: 0, report: {...} }`, never throws.                                                                                                                                                                                                                                 |
| Non-string, multimodal, or unrecognized content (images, arbitrary objects)                                                                                  | Never throws. Falls back to a conservative estimate and flags it in `report.warnings`.                                                                                                                                                                                                                  |
| A message carries a structural (plain object or array) field the default counter doesn't recognize (legacy `function_call`, `reasoning`, a vendor extension) | Estimated conservatively, never charged zero — see [above](#how-the-default-counter-handles-fields-it-doesnt-recognize). Flagged in `report.warnings` by field name.                                                                                                                                    |
| A non-canonical field is a `Date`, `RegExp`, `Map`, `Set`, `Error`, or typed array                                                                           | Treated as scalar metadata, not payload — free, no warning. (A `Date` used directly as `content` is unaffected by this and still gets the conservative fallback.)                                                                                                                                       |
| A message carries `ChatMessage.metadata`                                                                                                                     | Never counted, however large or structural — see [above](#how-the-default-counter-handles-fields-it-doesnt-recognize). This is a deliberate exemption specific to `metadata`, not an instance of the scalar rule above.                                                                                 |
| `messages.length` exceeds `maxMessages` (default `50_000`)                                                                                                   | Throws `ChatFitError` with code `INPUT_TOO_LARGE`, before any grouping or counting.                                                                                                                                                                                                                     |
| A summary exceeds its requested token budget                                                                                                                 | Retried with a smaller request (up to `maxAttempts`), then the range is dropped instead — never a thrown error.                                                                                                                                                                                         |
| The injected `tokenizer` or `messageTokenCounter` throws                                                                                                     | Wrapped as `ChatFitError` with code `TOKEN_COUNTING_FAILED`, `cause` preserved.                                                                                                                                                                                                                         |
| `signal` is aborted during `fitChatAsync` (including mid-summarization)                                                                                      | The abort propagates as itself, unwrapped — never rewrapped as `ChatFitError`. An `Error` (or `DOMException`) reason propagates unchanged; a non-`Error` reason (a string, a plain object, `undefined`) is normalized into a `DOMException` named `AbortError`, matching `llm-backoff` and `vec-cache`. |
| Your `summarizer` callback throws                                                                                                                            | Wrapped as `ChatFitError` with code `SUMMARY_FAILED`, `cause` preserved.                                                                                                                                                                                                                                |

What this package deliberately does not do: call any model or API itself,
guess at a provider's exact token overhead (only an injected exact tokenizer
gets that), or mutate the messages you pass in.

## Runtime compatibility

Universal (browser-safe): `src/` contains no `node:` import, verified by a
dedicated test alongside the "no network calls" check. Published as ESM and
CommonJS from one build (`dist/index.js` and `dist/index.cjs`), both proven
by installing the packed tarball into a clean project and importing it both
ways. Node 20+ is the tested baseline (`engines.node: ">=20"`).

## Performance

Selection is linear in the number of messages: build atomic groups in one
pass, greedily select newest-first in a second pass, assemble and verify the
result in a third. Benchmarked (`pnpm run bench`) at 100, 1,000, and 10,000
plain messages, and at a 1,000-turn conversation where roughly a third of
turns carry multi-tool-call exchanges:

| Conversation                      | Budget                 | Approx. time |
| --------------------------------- | ---------------------- | ------------ |
| 100 messages                      | generous (no trimming) | ~11 ms       |
| 100 messages                      | tight (heavy trimming) | ~9 ms        |
| 1,000 messages                    | generous               | ~117 ms      |
| 1,000 messages                    | tight                  | ~86 ms       |
| 10,000 messages                   | generous               | ~1.17 s      |
| 10,000 messages                   | tight                  | ~0.88 s      |
| ~2,700 messages, tool-group-heavy | tight                  | ~120 ms      |

Measured on the CI reference machine; run `pnpm run bench` for numbers on
your own hardware. A tighter budget is consistently _faster_, not slower —
selection stops as soon as the next newest-first group would overflow it.

### Content-accounting cost

The default counter's content-fallback accounting (unrecognized `content`
shapes, unrecognized structural fields — see
["How the default counter handles fields it doesn't recognize"](#how-the-default-counter-handles-fields-it-doesnt-recognize))
runs once per call: the counter records fallback reasons as a byproduct of
the counting it already does, and `finalizeResult` reads that record
instead of recomputing it by walking every input message a second time.
Measured (`benchmarks/fit-chat.bench.ts`'s "content-accounting cost" suite;
a generous budget, so nothing is trimmed):

| Conversation                         | Time    |
| ------------------------------------ | ------- |
| 1,000 messages, plain                | ~89 ms  |
| 1,000 messages, unrecognized fields  | ~327 ms |
| 10,000 messages, plain               | ~0.91 s |
| 10,000 messages, unrecognized fields | ~3.08 s |
| 50,000 messages, plain               | ~4.6 s  |
| 50,000 messages, unrecognized fields | ~15.5 s |

"Unrecognized fields" conversations are still much slower in absolute terms
than "plain" ones — that's real accounting work: every message's
conservative fallback estimate genuinely costs more to compute than a plain
string content count.

### `verifyAndTrim`'s iteration bound

The final correctness gate re-joins and re-counts the whole assembled
message list once per trim iteration. For the bundled default counter, and
for any additive or subadditive custom counter — which is what a real exact
provider tokenizer is, since `countMessages` on an assembled result and the
sum of per-message `countMessage` calls agree — this always converges on the
first iteration, so it costs one extra `countMessages` call and nothing
more, regardless of conversation size.

A `messageTokenCounter` whose `countMessages` disagrees with the summed
`countMessage` by more than a rounding error (the `MessageTokenCounter`
contract only promises "not simply the sum") can force many iterations,
each re-joining and re-counting a shrinking message list — O(n) per
iteration, up to O(n) iterations without a cap. Measured with such a
counter: **~16 seconds and ~19,600 `countMessages` calls for a
20,000-message conversation**, uncapped. `verifyAndTrim` bounds this at a
fixed 64 iterations (`MAX_TRIM_ITERATIONS`,
`src/selection/verify-and-trim.ts`), independent of conversation size — see
`test/verify-and-trim-scaling.test.ts`. This never affects a realistic
counter (they converge on iteration 1, far inside the cap); it only changes
behavior for a counter that would have needed more than 64 trims, which
falls back to keeping only preserved content instead of continuing to trim.

That fallback's `finalTokenCount` is the exact number `fitChat`/`fitChatAsync`
already computed once, up front, to prove `PRESERVED_MESSAGES_EXCEED_BUDGET`
does not apply — not a fresh call to your `countMessages` on the same
preserved-only content. This matters because
`MessageTokenCounter` does not require `countMessages` to be a pure function
of its input; if it called your counter a second time and your counter
disagreed with its own earlier answer, the fallback could return a result
over `availableBudget` with no error raised — silently doing the one thing
this package exists to prevent. Reusing the already-proven count instead of
recomputing removes that possibility by construction: whenever trimming
gives up, `report.finalTokenCount` for preserved-only content is always the
value already proven to fit, and the result never exceeds `availableBudget`.
See `test/internals.test.ts`'s `makeInflatingPreservedCounter`.

## Security and privacy

**This package makes no network call and never invokes an LLM.** Every
`fetch`, `XMLHttpRequest`, and `node:http`/`node:https` import is absent from
`src/` — checked directly by a test, not just claimed here (see
`test/no-network-calls.test.ts`). Summarization under `strategy:
'summarize-middle'` calls exactly one function: the `summarizer` you supply.
What that function does — including whether it makes a network call at all —
is entirely your code's responsibility, not this package's.

No telemetry, no `eval`, no dynamic code generation. Error messages never
embed your message content or any secret by default. Token counts are
estimates unless you inject an exact tokenizer or supply a counter you know
to be exact; `report.approximateTokenization` (`true` / `false` / `'unknown'`)
and `report.counterId` always tell you which you got — see
[`FitChatReport`](#fitchatreport).

The default counter's accounting is conservative in the direction that
matters: a message field it doesn't specifically recognize is estimated, not
silently charged zero (see
[How the default counter handles fields it doesn't recognize](#how-the-default-counter-handles-fields-it-doesnt-recognize))
— an over-estimate wastes a little context; an under-estimate produces a
request the provider rejects for exceeding its budget, which is the failure
this whole package exists to prevent. `messages.length` is also bounded by
`maxMessages` (default `50,000`), since `chat-fit` consumes conversation
history that includes model output and treats it as untrusted input.

## Contributing and license

Part of the [llm-kit](../../README.md) monorepo. MIT licensed — see
[`LICENSE`](./LICENSE).
