/**
 * Runnable example: wrap a flaky provider call that returns 429 twice (with
 * a real `Retry-After` header) before succeeding, and watch `withLlmBackoff`
 * honor the header exactly instead of guessing a delay.
 *
 * Run with: pnpm exec tsx examples/retry-a-flaky-provider.ts
 *
 * A real consumer would `npm install llm-backoff` and
 * `import { withLlmBackoff } from 'llm-backoff'`; this example imports from
 * the package source directly so it runs in this repository without a
 * publish step.
 */
import { withLlmBackoff } from '../src/index.js';
import type { RetryEvent } from '../src/index.js';

/**
 * Simulates a provider SDK call. Fails with a 429 and a `Retry-After` header
 * the first two times, then succeeds — the header values are small (a
 * fraction of a second) purely so this example finishes quickly; a real
 * provider's header is honored exactly the same way regardless of size.
 */
async function simulateProviderCall(state: { attempt: number }): Promise<{ text: string }> {
  state.attempt += 1;
  if (state.attempt <= 2) {
    throw Object.assign(new Error(`rate limited on attempt ${String(state.attempt)}`), {
      status: 429,
      headers: { 'retry-after': '0.15' },
    });
  }
  return { text: 'here is your completion' };
}

function logRetry(event: RetryEvent): void {
  // This is the only place this example logs anything — withLlmBackoff
  // itself never logs or phones home on its own (see the README's
  // "Security and privacy" section).
  const via =
    event.winningHeader !== undefined
      ? `${event.delaySource} (${event.winningHeader})`
      : event.delaySource;
  console.log(
    `  attempt ${String(event.attempt)} failed (status ${String(event.status)}); ` +
      `sleeping ${String(event.delayMs)}ms via ${via}, ${String(event.attemptsRemaining)} attempt(s) left`,
  );
}

async function main(): Promise<void> {
  console.log('Calling a flaky provider through withLlmBackoff...\n');

  const state = { attempt: 0 };
  const start = Date.now();

  const result = await withLlmBackoff(() => simulateProviderCall(state), {
    onRetry: logRetry,
  });

  const elapsedMs = Date.now() - start;
  console.log(`\nSucceeded on attempt ${String(state.attempt)}: ${result.text}`);
  console.log(
    `Wall-clock time for this run: ~${String(elapsedMs)}ms (mostly the two honored sleeps)`,
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
