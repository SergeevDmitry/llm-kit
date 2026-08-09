/**
 * Cross-package example: provider-neutral configuration shared across
 * packages.
 *
 * One exact `Tokenizer` adapter — built once, over a plain word-boundary
 * encoder rather than any provider's real BPE tokenizer — is injected into
 * both token-chunk (`chunkText`) and chat-fit (`fitChat`). Both packages'
 * reports then attribute their token counts to that tokenizer's own id
 * instead of the bundled default, `approx-v1`. The same tokenizer's `count`
 * is then used to price a custom, non-registry model through usage-tab's
 * override mechanism — so the whole pipeline, from chunking through
 * budgeting through pricing, is configured against one tokenizer choice
 * instead of three independent guesses.
 *
 * Run with: pnpm --filter example-shared-tokenizer run start
 *
 * No network calls, no real encoder dependency: the "exact" tokenizer below
 * is a deterministic word-boundary splitter, standing in for a real one
 * (tiktoken, a provider SDK's local tokenizer, etc.) that an application
 * would already depend on.
 */
import { chunkText, APPROX_TOKENIZER_ID as CHUNK_DEFAULT_ID, type Tokenizer } from 'token-chunk';
import {
  fitChat,
  fromEncoder,
  APPROX_TOKENIZER_ID as CHAT_FIT_DEFAULT_ID,
  type ChatMessage,
} from 'chat-fit';
import { calculateCost, createPriceOverride } from 'usage-tab';

/**
 * Builds a deterministic, reversible word-boundary tokenizer: each distinct
 * whitespace-delimited piece of text seen gets a stable numeric id the
 * first time it appears. `encode`/`decode` round-trip exactly, which a real
 * BPE tokenizer's don't have to (see the token-chunk README) — this one
 * just makes for an easy, dependency-free stand-in.
 */
function createWordTokenizer(id: string): Tokenizer {
  const idByWord = new Map<string, number>();
  const wordById = new Map<number, string>();

  function idFor(word: string): number {
    let tokenId = idByWord.get(word);
    if (tokenId === undefined) {
      tokenId = idByWord.size;
      idByWord.set(word, tokenId);
      wordById.set(tokenId, word);
    }
    return tokenId;
  }

  return fromEncoder({
    id,
    encode(text: string): number[] {
      return text
        .split(/(\s+)/)
        .filter((piece) => piece.length > 0)
        .map(idFor);
    },
    decode(tokens: readonly number[]): string {
      return tokens.map((tokenId) => wordById.get(tokenId) ?? '').join('');
    },
  });
}

function main(): void {
  const sharedTokenizer = createWordTokenizer('acme-word-tokenizer-v1');

  // --- 1. token-chunk: same call, default vs. injected tokenizer --------
  console.log('=== token-chunk ===\n');
  const runbook =
    'Restart the payments worker before retrying failed webhooks. ' +
    'If the queue depth stays above one thousand for more than five minutes, ' +
    'page the on-call engineer instead of retrying again.';

  const defaultChunks = chunkText(runbook, { maxTokens: 200 });
  const exactChunks = chunkText(runbook, { maxTokens: 200, tokenizer: sharedTokenizer });

  console.log(
    `default tokenizerId:  ${defaultChunks[0]?.tokenizerId ?? '(none)'} (expected ${CHUNK_DEFAULT_ID})`,
  );
  console.log(`injected tokenizerId: ${exactChunks[0]?.tokenizerId ?? '(none)'}`);
  console.log(
    `default tokenCount: ${String(defaultChunks[0]?.tokenCount)}  ` +
      `injected tokenCount: ${String(exactChunks[0]?.tokenCount)} (exact word count, not an estimate)`,
  );

  // --- 2. chat-fit: same call, default vs. injected tokenizer -----------
  console.log('\n=== chat-fit ===\n');
  const conversation: ChatMessage[] = [
    { role: 'system', content: 'You are an on-call assistant.' },
    { role: 'user', content: 'The payments queue depth just crossed one thousand.' },
    {
      role: 'assistant',
      content: 'Checking the current queue depth.',
      toolCalls: [{ id: 'call_1', name: 'check_queue_depth', arguments: { queue: 'payments' } }],
    },
    { role: 'tool', toolCallId: 'call_1', content: '{"depth": 1240}' },
    { role: 'assistant', content: 'Depth is 1240 — paging the on-call engineer now.' },
  ];

  const defaultFit = fitChat(conversation, { maxTokens: 300, reserveTokens: 20 });
  const exactFit = fitChat(conversation, {
    maxTokens: 300,
    reserveTokens: 20,
    tokenizer: sharedTokenizer,
  });

  console.log(
    `default counterId:  ${defaultFit.report.counterId} (expected to start with "${CHAT_FIT_DEFAULT_ID}")`,
  );
  console.log(`injected counterId: ${exactFit.report.counterId}`);
  console.log(
    `default tokenCount: ${String(defaultFit.tokenCount)}  ` +
      `injected tokenCount: ${String(exactFit.tokenCount)}`,
  );

  // --- 3. usage-tab: price a custom model using the same exact counts ---
  console.log('\n=== usage-tab ===\n');
  const prompt = 'The payments queue depth just crossed one thousand.';
  const response = 'Depth is 1240 — paging the on-call engineer now.';

  // The very tokenizer just used above measures the usage this custom,
  // non-registry model gets priced against — not a separate guess.
  const inputTokens = sharedTokenizer.count(prompt);
  const outputTokens = sharedTokenizer.count(response);

  const internalModel = createPriceOverride({
    canonicalId: 'acme-support-bot',
    provider: 'acme-internal',
    input: '0.35',
    output: '1.10',
  });

  const cost = calculateCost(
    { model: 'acme-support-bot', provider: 'acme-internal', usage: { inputTokens, outputTokens } },
    { overrides: [internalModel] },
  );

  console.log(
    `priced using ${String(inputTokens)} input + ${String(outputTokens)} output tokens, ` +
      `both counted by "${sharedTokenizer.id}" (not an approximation)`,
  );
  console.log(`total: $${cost.totalUsd} (exact: $${cost.totalUsdExact})`);

  // --- Summary ------------------------------------------------------------
  console.log('\n=== Summary ===');
  console.log(
    `token-chunk attributed its count to "${exactChunks[0]?.tokenizerId ?? '(none)'}", ` +
      `chat-fit attributed its count to "${exactFit.report.counterId}" — ` +
      'both reference the one injected tokenizer, not the default "approx-v1", ' +
      'and that same tokenizer measured the usage usage-tab priced.',
  );
}

main();
