/**
 * @llm-kit/tokenizer — public surface.
 *
 * Private, source-only foundation: bundled into `token-chunk` and `chat-fit`
 * at build time, never published on its own.
 */

export {
  type Tokenizer,
  type MessageTokenCounter,
  type TokenizerErrorCode,
  TokenizerError,
  APPROX_TOKENIZER_ID,
} from './types.js';

export {
  estimateTokenCount,
  createApproximateTokenizer,
  approximateTokenizer,
} from './approximate-tokenizer.js';

export {
  type MessageContentPart,
  type TextContentPart,
  type OpaqueContentPart,
  type MessageContent,
  type MessageToolCall,
  type ChatMessageLike,
  type MessageContentAccounting,
  type MessageAccountingOptions,
  type MessageAccounting,
  describeMessageContent,
  describeMessage,
  createMessageTokenCounter,
  MESSAGE_OVERHEAD_TOKENS,
  NAME_OVERHEAD_TOKENS,
  TOOL_CALL_OVERHEAD_TOKENS,
  CONVERSATION_PRIMING_TOKENS,
  UNKNOWN_CONTENT_FALLBACK_TOKENS,
  UNKNOWN_CONTENT_SAFETY_MULTIPLIER,
} from './message-accounting.js';

export { type EncoderLike, fromEncoder } from './adapters/generic-encoder.js';
export { type TiktokenLikeEncoder, fromTiktokenLikeEncoder } from './adapters/tiktoken-like.js';
export { type AnthropicLikeCounter, fromAnthropicLikeCounter } from './adapters/anthropic-like.js';

export {
  type ScriptClass,
  graphemeClusters,
  classifyGrapheme,
  utf8ByteLength,
  usesIntlSegmenter,
} from './unicode.js';
