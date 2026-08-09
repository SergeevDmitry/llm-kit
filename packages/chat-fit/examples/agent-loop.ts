/**
 * Runnable example: fitting a growing tool-using agent conversation to a
 * token budget, both synchronously (`drop-oldest`) and asynchronously
 * (`summarize-middle`).
 *
 * Run with:
 *   pnpm exec tsx packages/chat-fit/examples/agent-loop.ts
 */
import { fitChat, fitChatAsync, type ChatMessage, type SummaryRequest } from '../src/index.js';

function buildAgentConversation(): ChatMessage[] {
  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: 'You are a research assistant. Use tools when you need current data.',
    },
  ];

  for (let turn = 0; turn < 12; turn += 1) {
    messages.push({
      role: 'user',
      content: `Question ${String(turn)}: what's the latest on topic ${String(turn)}?`,
    });
    messages.push({
      role: 'assistant',
      content: `Let me look that up.`,
      toolCalls: [
        {
          id: `search-${String(turn)}`,
          name: 'web_search',
          arguments: { query: `topic ${String(turn)}` },
        },
      ],
    });
    messages.push({
      role: 'tool',
      toolCallId: `search-${String(turn)}`,
      content: `Search results for topic ${String(turn)}: three relevant articles found, summarized here.`,
    });
    messages.push({
      role: 'assistant',
      content: `Here's what I found on topic ${String(turn)}: ...`,
    });
  }

  // A developer instruction added mid-conversation — must survive trimming
  // just as much as the leading system prompt does.
  messages.splice(20, 0, { role: 'developer', content: 'Always cite your sources from here on.' });

  return messages;
}

function summarizeCount(messages: readonly ChatMessage[]): string {
  return `${String(messages.length)} messages`;
}

async function main(): Promise<void> {
  const conversation = buildAgentConversation();
  console.log(`Full conversation: ${summarizeCount(conversation)}\n`);

  // --- The naive fix, and why it's broken -----------------------------
  // Each turn is [user, assistant-with-call, tool-result, assistant-reply].
  // A suffix window whose start falls *between* a call and its result keeps
  // the result but drops the call that produced it — exactly the malformed
  // shape most providers reject outright.
  const naiveTrim = conversation.slice(-2);
  const naiveCallIds = new Set(naiveTrim.flatMap((m) => m.toolCalls?.map((c) => c.id) ?? []));
  const naiveResultIds = new Set(
    naiveTrim.filter((m) => m.toolCallId !== undefined).map((m) => m.toolCallId as string),
  );
  const naiveBroken = [...naiveResultIds].some((id) => !naiveCallIds.has(id));
  console.log(
    `naive slice(-2) keeps a tool result whose call was trimmed away: ${String(naiveBroken)}`,
  );

  // --- fitChat: synchronous, drop-oldest -------------------------------
  const fitted = fitChat(conversation, { maxTokens: 600, reserveTokens: 100 });
  console.log(
    `\nfitChat kept ${summarizeCount(fitted.messages)} of ${summarizeCount(conversation)}`,
  );
  console.log(
    `  tokenCount: ${String(fitted.tokenCount)} / availableBudget: ${String(fitted.report.availableBudget)}`,
  );
  console.log(`  kept indexes: [${fitted.report.keptIndexes.join(', ')}]`);
  console.log(
    `  warnings: ${fitted.report.warnings.length === 0 ? '(none)' : fitted.report.warnings.join(' | ')}`,
  );

  // Every tool call kept has its result kept too, and vice versa.
  const callIds = new Set(fitted.messages.flatMap((m) => m.toolCalls?.map((c) => c.id) ?? []));
  const resultIds = new Set(
    fitted.messages.filter((m) => m.toolCallId !== undefined).map((m) => m.toolCallId as string),
  );
  const atomic =
    [...callIds].every((id) => resultIds.has(id)) && [...resultIds].every((id) => callIds.has(id));
  console.log(`  every tool exchange atomic: ${String(atomic)}`);

  // --- fitChatAsync: summarize the middle instead of dropping it ------
  async function summarizeRange(request: SummaryRequest<ChatMessage>): Promise<ChatMessage> {
    // A real implementation would call a model here, passing
    // `request.maxSummaryTokens` along as the model's own output-length
    // budget. This one is deterministic and network-free on purpose, and
    // respects the budget by truncating — roughly 3 characters per token,
    // matching the approximate tokenizer's own English-prose calibration.
    const topics = request.messages
      .filter((m) => m.role === 'user')
      .map((m) => String(m.content))
      .join(' | ');
    const budget = Math.max(0, request.maxSummaryTokens - 10) * 3;
    const truncated = topics.length > budget ? `${topics.slice(0, budget)}…` : topics;
    return {
      role: 'system',
      content: `[condensed ${String(request.messages.length)} earlier messages: ${truncated}]`,
    };
  }

  const summarized = await fitChatAsync(conversation, {
    maxTokens: 600,
    reserveTokens: 100,
    strategy: 'summarize-middle',
    summary: { summarizer: summarizeRange, maxSummaryTokens: 220 },
  });

  console.log(`\nfitChatAsync (summarize-middle) kept ${summarizeCount(summarized.messages)}`);
  if (summarized.report.summarizedRange !== undefined) {
    const range = summarized.report.summarizedRange;
    console.log(
      `  summarized original indexes ${String(range.startIndex)}-${String(range.endIndex)} ` +
        `(${String(range.messageCount)} messages) into ${String(range.summaryTokenCount)} tokens`,
    );
  } else {
    console.log('  nothing needed summarizing (or the summary was dropped — see warnings)');
  }
  console.log(`  summary attempts: ${String(summarized.report.summaryAttempts)}`);
  console.log(`  warnings: ${summarized.report.warnings.join(' | ')}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
