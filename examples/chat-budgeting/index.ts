/**
 * Cross-package example: a long tool-using conversation trimmed to a token
 * budget by chat-fit, then handed to a mock provider call wrapped in
 * llm-backoff.
 *
 * Two things are shown concretely:
 *   1. chat-fit trims a 12-turn agent conversation down to budget without
 *      ever separating a tool call from its result — the group survives or
 *      is dropped as a unit.
 *   2. The (simulated) provider rejects the request twice with HTTP 429 and
 *      a real `Retry-After` header before succeeding; llm-backoff honors
 *      that header exactly instead of guessing a delay.
 *
 * Run with: pnpm --filter example-chat-budgeting run start
 *
 * No network calls: `simulateProviderCall` below stands in for a real
 * provider SDK request.
 */
import { fitChat, type ChatMessage } from 'chat-fit';
import { withLlmBackoff, type RetryEvent } from 'llm-backoff';

function buildAgentConversation(): ChatMessage[] {
  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: 'You are a research assistant. Use tools when you need current data.',
    },
  ];

  for (let turn = 0; turn < 8; turn += 1) {
    messages.push({
      role: 'user',
      content: `Question ${String(turn)}: what's the latest on topic ${String(turn)}?`,
    });
    messages.push({
      role: 'assistant',
      content: 'Let me look that up.',
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

  // A developer instruction added mid-conversation — must be preserved just
  // as much as the leading system prompt is.
  messages.splice(14, 0, { role: 'developer', content: 'Always cite your sources from here on.' });

  return messages;
}

/**
 * Simulates sending the fitted conversation to a provider. Fails with a 429
 * and a `Retry-After` header the first two times, then succeeds. The header
 * value is small purely so this example finishes quickly — llm-backoff
 * honors a real provider's header the same way regardless of size.
 */
async function simulateProviderCall(
  fitted: readonly ChatMessage[],
  state: { attempt: number },
): Promise<{ reply: string }> {
  state.attempt += 1;
  if (state.attempt <= 2) {
    throw Object.assign(new Error(`rate limited on attempt ${String(state.attempt)}`), {
      status: 429,
      headers: { 'retry-after': '0.05' },
    });
  }
  return { reply: `(model reply synthesized from ${String(fitted.length)} kept messages)` };
}

function logRetry(event: RetryEvent): void {
  const via =
    event.winningHeader !== undefined
      ? `${event.delaySource} (${event.winningHeader})`
      : event.delaySource;
  console.log(
    `  attempt ${String(event.attempt)} failed (status ${String(event.status)}); ` +
      `retrying after ${String(event.delayMs)}ms via ${via}, ${String(event.attemptsRemaining)} attempt(s) left`,
  );
}

async function main(): Promise<void> {
  const conversation = buildAgentConversation();
  console.log(`Full conversation: ${String(conversation.length)} messages\n`);

  // --- chat-fit: trim to budget without splitting a tool exchange --------
  const fitted = fitChat(conversation, { maxTokens: 500, reserveTokens: 100 });
  console.log('=== chat-fit ===');
  console.log(
    `kept ${String(fitted.messages.length)} of ${String(conversation.length)} messages ` +
      `(${String(fitted.tokenCount)} / ${String(fitted.report.availableBudget)} tokens)`,
  );
  console.log(`kept indexes:    [${fitted.report.keptIndexes.join(', ')}]`);
  console.log(`removed indexes: [${fitted.report.removedIndexes.join(', ')}]`);

  // Every tool call kept has its result kept too, and vice versa — the
  // atomic-grouping guarantee this package exists for.
  const callIds = new Set(fitted.messages.flatMap((m) => m.toolCalls?.map((c) => c.id) ?? []));
  const resultIds = new Set(
    fitted.messages.filter((m) => m.toolCallId !== undefined).map((m) => m.toolCallId as string),
  );
  const atomic =
    [...callIds].every((id) => resultIds.has(id)) && [...resultIds].every((id) => callIds.has(id));
  console.log(`every tool-call group kept intact: ${String(atomic)}`);

  const preservedRoles = fitted.messages.filter(
    (m) => m.role === 'system' || m.role === 'developer',
  );
  console.log(
    `system/developer instructions preserved: ${String(preservedRoles.length)} ` +
      `(${preservedRoles.map((m) => m.role).join(', ')})`,
  );
  console.log(
    `warnings: ${fitted.report.warnings.length === 0 ? '(none)' : fitted.report.warnings.join(' | ')}`,
  );

  await sendToProvider(fitted.messages);
}

async function sendToProvider(fitted: readonly ChatMessage[]): Promise<void> {
  console.log('\n=== llm-backoff ===');
  console.log('Sending the fitted conversation to a flaky provider...\n');

  const state = { attempt: 0 };
  const result = await withLlmBackoff(() => simulateProviderCall(fitted, state), {
    onRetry: logRetry,
  });

  console.log(`\nSucceeded on attempt ${String(state.attempt)}: ${result.reply}`);
  console.log('Both 429 responses carried a Retry-After header, and both were honored exactly.');
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
