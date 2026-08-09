/**
 * Cross-package example: streamed tool-call arguments rendered as a valid
 * partial value on every chunk with mend-json, then priced with llm-price
 * once the stream completes.
 *
 * This mirrors what a chat UI does while an LLM is still generating a tool
 * call: the raw text arrives in small, irregular pieces that rarely land on
 * a JSON token boundary, but the UI still wants something renderable after
 * every piece. Once the stream finishes, the provider's response includes a
 * usage block — this prices it, so a caller can show "what did that tool
 * call cost" right next to the arguments that were used.
 *
 * Run with: pnpm --filter example-streaming-tool-args run start
 *
 * No network calls: `simulateProviderStream` and the usage block below
 * stand in for a real provider SDK stream and response.
 */
import { createJsonMender } from 'mend-json';
import { calculateCost, normalizeOpenAIUsage } from 'llm-price';

interface FlightSearchArgs {
  origin: string;
  destination: string;
  date: string;
  passengers: number;
  cabinClass: string;
}

/**
 * Simulates a provider SDK yielding small, irregular text deltas — real
 * streaming rarely lines up with JSON token boundaries. The chunk sizes are
 * a fixed sequence, not random, so this example's output is reproducible.
 */
function* simulateProviderStream(fullArguments: string): Generator<string> {
  const chunkSizes = [1, 5, 3, 8, 2, 6, 4, 1, 9, 3, 7];
  let offset = 0;
  let step = 0;
  while (offset < fullArguments.length) {
    const size = chunkSizes[step % chunkSizes.length] as number;
    yield fullArguments.slice(offset, offset + size);
    offset += size;
    step += 1;
  }
}

function printBar(step: number, total: number): string {
  const filled = Math.round((step / total) * 20);
  return `[${'#'.repeat(filled)}${'-'.repeat(20 - filled)}]`;
}

function main(): void {
  const fullArguments = JSON.stringify({
    origin: 'SFO',
    destination: 'HND',
    date: '2026-09-14',
    passengers: 2,
    cabinClass: 'economy',
  } satisfies FlightSearchArgs);

  const mender = createJsonMender<FlightSearchArgs>();

  console.log('=== mend-json: streaming tool-call arguments ===\n');
  console.log(`(the model is generating ${String(fullArguments.length)} characters of JSON)\n`);

  let step = 0;
  let received = '';
  for (const chunk of simulateProviderStream(fullArguments)) {
    step += 1;
    received += chunk;
    const snapshot = mender.push(chunk);

    // The headline guarantee in action: every snapshot with a value has a
    // repairedJson JSON.parse actually accepts, so a UI never needs its own
    // try/catch around a half-arrived object.
    let repairedParses = 'n/a';
    if (snapshot.value !== undefined) {
      try {
        // Guaranteed defined whenever `value` is (the headline invariant).
        JSON.parse(snapshot.repairedJson as string);
        repairedParses = 'yes';
      } catch {
        repairedParses = 'NO — invariant violated';
      }
    }
    const preview =
      snapshot.value === undefined ? '(no value yet)' : JSON.stringify(snapshot.value);
    console.log(
      `${printBar(received.length, fullArguments.length)} ` +
        `chunk ${String(step).padStart(2, ' ')} +${JSON.stringify(chunk).padEnd(6, ' ')} ` +
        `${snapshot.complete ? '[done]   ' : '[partial]'} ${preview} (repairedJson parses: ${repairedParses})`,
    );
  }

  const final = mender.finish();
  console.log('\n--- final ---');
  console.log('value:      ', final.value);
  console.log('complete:   ', final.complete);
  console.log('diagnostics:', final.diagnostics.length, 'repair action(s) recorded along the way');

  // --- llm-price: what did the response that produced this call cost? ---
  console.log('\n=== llm-price: cost of the response that produced this call ===\n');

  // A real provider SDK returns a `usage` block alongside the streamed
  // content; this is a fixed stand-in for that block, not derived from the
  // stream above, so the reported cost is reproducible run to run.
  const rawUsage = {
    prompt_tokens: 640,
    completion_tokens: 48,
    prompt_tokens_details: { cached_tokens: 512 },
  };
  const { usage } = normalizeOpenAIUsage(rawUsage);
  const cost = calculateCost({ model: 'gpt-5', provider: 'openai', usage, at: '2026-08-05' });

  console.log(`ordinary input: ${String(cost.input.tokens)} tokens @ $${cost.input.rate}/M`);
  console.log(
    `cached input:   ${String(cost.cachedInput?.tokens ?? 0)} tokens @ $${cost.cachedInput?.rate}/M`,
  );
  console.log(`output:         ${String(cost.output.tokens)} tokens @ $${cost.output.rate}/M`);
  console.log(
    `total: $${cost.totalUsd} (exact: $${cost.totalUsdExact}), registry ${cost.registryVersion}`,
  );
}

main();
