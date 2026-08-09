/**
 * Runnable example: render a tool-call's JSON arguments as they stream in,
 * the way a chat UI would while an LLM is still generating them.
 *
 * Run with: pnpm exec tsx examples/stream-tool-call-arguments.ts
 *
 * A real consumer would `npm install mend-json` and
 * `import { createJsonMender } from 'mend-json'`; this example imports from
 * the package source directly so it runs in this repository without a
 * publish step.
 */
import { createJsonMender } from '../src/index.js';

interface SearchArgs {
  query: string;
  filters: string[];
  limit: number;
}

/**
 * Simulates a provider SDK yielding small, irregular text deltas — real
 * streaming rarely lines up with JSON token boundaries.
 */
async function* simulateProviderStream(fullArguments: string): AsyncGenerator<string> {
  const chunkSizes = [1, 4, 2, 7, 3, 1, 9, 5, 2];
  let offset = 0;
  let step = 0;
  while (offset < fullArguments.length) {
    const size = chunkSizes[step % chunkSizes.length] as number;
    yield fullArguments.slice(offset, offset + size);
    offset += size;
    step += 1;
    await new Promise((resolve) => setTimeout(resolve, 5)); // simulate network delay
  }
}

async function main(): Promise<void> {
  const fullArguments = JSON.stringify({
    query: 'renewable energy adoption 2025',
    filters: ['peer-reviewed', 'english', 'last-2-years'],
    limit: 10,
  } satisfies SearchArgs);

  const mender = createJsonMender<SearchArgs>();

  console.log('Streaming tool-call arguments...\n');

  for await (const chunk of simulateProviderStream(fullArguments)) {
    const snapshot = mender.push(chunk);

    // This is the headline guarantee in action: every snapshot with a value
    // has a repairedJson JSON.parse actually accepts, so a UI never needs
    // its own try/catch around a half-arrived object.
    if (snapshot.value !== undefined) {
      const preview = JSON.stringify(snapshot.value);
      console.log(`${snapshot.complete ? '[done]  ' : '[partial]'} ${preview}`);
    }
  }

  const final = mender.finish();
  console.log('\nFinal value:', final.value);
  console.log('Complete:', final.complete);
  console.log('Diagnostics recorded along the way:', final.diagnostics.length);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
