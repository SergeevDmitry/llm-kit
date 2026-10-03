/**
 * Runnable example: pricing a real request end to end, the Azure-vs-OpenAI
 * provider-qualification story, ambiguous aliases, historical lookups, and a
 * negotiated-rate override.
 *
 * Run with:
 *   pnpm exec tsx packages/usage-tab/examples/basic-usage.ts
 */
import {
  AmbiguousAliasError,
  calculateCost,
  createPriceOverride,
  normalizeOpenAIUsage,
} from '../src/index.js';

// --- 1. A typical request, normalized from a raw OpenAI-shaped usage object ---

const rawOpenAiUsage = {
  prompt_tokens: 12_400,
  completion_tokens: 850,
  prompt_tokens_details: { cached_tokens: 9_600 },
};

const { usage } = normalizeOpenAIUsage(rawOpenAiUsage);
const everyday = calculateCost({
  model: 'gpt-5',
  provider: 'openai',
  usage,
  at: '2026-08-05',
});

console.log('--- everyday request ---');
console.log(`ordinary input: ${String(everyday.input.tokens)} tokens @ $${everyday.input.rate}/M`);
console.log(
  `cached input:   ${String(everyday.cachedInput?.tokens ?? 0)} tokens @ $${everyday.cachedInput?.rate}/M`,
);
console.log(
  `output:         ${String(everyday.output.tokens)} tokens @ $${everyday.output.rate}/M`,
);
console.log(`total: $${everyday.totalUsd} (exact: $${everyday.totalUsdExact})`);

// --- 2. The headline example: two providers host the same model at different prices ---

const sameUsage = { inputTokens: 1_000_000, outputTokens: 1_000_000 };

const onTogether = calculateCost({
  model: 'gemma-4-31b',
  provider: 'together',
  usage: sameUsage,
  at: '2026-10-03',
});
const onBedrock = calculateCost({
  model: 'gemma-4-31b',
  provider: 'aws-bedrock',
  usage: sameUsage,
  at: '2026-10-03',
});

console.log('\n--- gemma-4-31b: Together vs. AWS Bedrock (2.5x apart) ---');
console.log(`Together: $${onTogether.totalUsdExact} for 1M+1M tokens`);
console.log(`Bedrock:  $${onBedrock.totalUsdExact} for 1M+1M tokens`);

// Pricing the same id *without* a provider qualifier never silently picks one:
try {
  calculateCost({ model: 'gemma-4-31b', usage: sameUsage, at: '2026-10-03' });
} catch (error) {
  if (error instanceof AmbiguousAliasError) {
    console.log(`unqualified lookup correctly throws: ${error.code} - ${error.message}`);
  } else {
    throw error;
  }
}

// --- 3. Historical lookup: gemini-3.6-flash's promotional rate ---
// Google publishes both boundary dates: the promotional rate runs through
// 2026-12-31, and the standard rate resumes 2027-01-01.

const promotionalRate = calculateCost({
  model: 'gemini-3.6-flash',
  provider: 'google',
  usage: { inputTokens: 1_000_000, outputTokens: 1_000_000 },
  at: '2026-11-01', // inside the promotional window
});
const standardRate = calculateCost({
  model: 'gemini-3.6-flash',
  provider: 'google',
  usage: { inputTokens: 1_000_000, outputTokens: 1_000_000 },
  at: '2027-01-15', // after the boundary
});

console.log('\n--- gemini-3.6-flash: promotional vs. standard rate ---');
console.log(
  `2026-11-01: $${promotionalRate.totalUsdExact} (effective from ${promotionalRate.pricingEffectiveFrom})`,
);
console.log(
  `2027-01-15: $${standardRate.totalUsdExact} (effective from ${standardRate.pricingEffectiveFrom})`,
);

// --- 4. A negotiated-rate override ---

const negotiated = createPriceOverride({
  canonicalId: 'gpt-5',
  provider: 'openai',
  input: '0.90', // a negotiated discount off the $1.25 list rate
  output: '7.50',
});

const discounted = calculateCost(
  {
    model: 'gpt-5',
    provider: 'openai',
    usage: { inputTokens: 1_000_000, outputTokens: 1_000_000 },
  },
  { overrides: [negotiated] },
);

console.log('\n--- negotiated override beats the registry rate ---');
console.log(`negotiated total: $${discounted.totalUsdExact} (list rate would be $11.25)`);
