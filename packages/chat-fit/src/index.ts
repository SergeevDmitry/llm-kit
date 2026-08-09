/**
 * chat-fit — public entry point.
 *
 * Trims a chat history to a token budget without ever splitting an assistant
 * tool call from its tool result. Makes no network call and never invokes an
 * LLM: `fitChat` is fully synchronous, and `fitChatAsync`'s only await is
 * the caller's own summarizer callback. See `README.md`.
 */

export { fitChat } from './fit-chat.js';
export { fitChatAsync } from './fit-chat-async.js';

export { ChatFitError, type ChatFitErrorCode } from './errors.js';

export type {
  ChatRole,
  ChatMessage,
  FitChatOptions,
  FitChatResult,
  FitChatReport,
  MessageGroup,
  SummarizedRangeReport,
  ToolCallGroupReport,
  SummaryOptions,
  SummaryRequest,
  Summarizer,
  Tokenizer,
  MessageTokenCounter,
} from './types.js';

// Re-exported from the private `@llm-kit/tokenizer` foundation this package
// bundles — a consumer cannot `npm install` it directly, so this is the
// only way to reach the pieces someone configuring token counting actually
// needs:
//  - `approximateTokenizer` / `APPROX_TOKENIZER_ID`: the default this
//    package uses when no `tokenizer` option is given, and the id
//    `report.counterId` carries when it's in effect. An approximate count
//    must never look exact, so this id is always surfaced to the caller.
//  - `fromEncoder` / `fromTiktokenLikeEncoder` / `fromAnthropicLikeCounter`:
//    build an exact `Tokenizer` from a real encoder or counting endpoint
//    your own code depends on — see "Injecting an exact tokenizer" in the
//    README.
// `createMessageTokenCounter` is deliberately *not* re-exported here: it
// reads a `ChatMessageLike`-shaped `toolCalls` field literally, so it
// silently under-counts OpenAI-/Anthropic-shaped messages (the exact shapes
// this package's provider adapters exist for) — using it as a
// `messageTokenCounter` override would reintroduce the bug this package's
// own default counter (`src/token-accounting.ts`) was written to avoid.
// Build a `MessageTokenCounter<Message>` against your own message shape
// directly if you need one; `Tokenizer` above is what it should be built on.
export {
  approximateTokenizer,
  APPROX_TOKENIZER_ID,
  fromEncoder,
  type EncoderLike,
  fromTiktokenLikeEncoder,
  type TiktokenLikeEncoder,
  fromAnthropicLikeCounter,
  type AnthropicLikeCounter,
} from '@llm-kit/tokenizer';
