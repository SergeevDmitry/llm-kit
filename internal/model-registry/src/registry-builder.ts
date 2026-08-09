/**
 * Pure registry assembly and rendering.
 *
 * `scripts/generate-model-registry.ts` is the only caller in production use —
 * it does the file I/O (reading `docs/provider-data/`, hashing a version,
 * writing `generated/registry.ts`) and delegates every decision about shape,
 * order, and text to this module, so the decision itself is unit-testable
 * without touching the filesystem.
 *
 * Nothing here imports a Node built-in: this file must stay safe to import
 * from a browser context even though nothing currently does, because a
 * foundation's `src/` is bundled wholesale into universal public packages,
 * and a stray `node:` import would only surface as a broken browser build
 * downstream.
 */
import type { ProviderSourceValidationResult } from './schema.js';
import type { ModelDescriptor, PricingPeriod } from './types.js';

export interface BuildRegistryResult {
  readonly models: readonly ModelDescriptor[];
  readonly issues: readonly string[];
}

function sortPricingPeriods(periods: readonly PricingPeriod[]): PricingPeriod[] {
  return [...periods].sort((a, b) =>
    a.effectiveFrom < b.effectiveFrom ? -1 : a.effectiveFrom > b.effectiveFrom ? 1 : 0,
  );
}

/**
 * Combines already-validated per-provider results into the final registry:
 * sorted deterministically by `provider` then `canonicalId`, both
 * lexicographically, with each model's `aliases` and `pricing` sorted too, so
 * the rendered output depends only on content, never on source file order.
 *
 * The provider ordering is lexicographic rather than `PROVIDER_IDS`
 * declaration order on purpose. Ranking by declaration order would couple
 * every row's position to the order of a runtime array, so reordering
 * `PROVIDER_IDS` for readability — a change with no semantic content — would
 * reshuffle the whole generated file and fail `--check` in CI. Lexicographic
 * order is stable under that refactor and is what a reviewer reading
 * "sorted by provider then canonicalId" expects.
 *
 * If any provider carries validation issues, aggregates them instead of
 * building anything — generation must fail loudly rather than emit a partial
 * registry. The same "never guess" stance that governs alias ambiguity
 * applies to every other schema violation: fail generation, don't guess a
 * shape.
 */
export function buildRegistry(
  results: readonly ProviderSourceValidationResult[],
): BuildRegistryResult {
  const issues: string[] = [];
  for (const result of results) {
    for (const problem of result.issues) {
      issues.push(`${result.provider}: ${problem.path}: ${problem.message}`);
    }
  }
  if (issues.length > 0) {
    return { models: [], issues };
  }

  const models = results
    .flatMap((result) => result.models)
    .slice()
    .sort((a, b) => {
      if (a.provider !== b.provider) return a.provider < b.provider ? -1 : 1;
      return a.canonicalId < b.canonicalId ? -1 : a.canonicalId > b.canonicalId ? 1 : 0;
    })
    .map((model) => ({
      ...model,
      aliases: [...model.aliases].sort(),
      ...(model.pricing !== undefined ? { pricing: sortPricingPeriods(model.pricing) } : {}),
    }));

  return { models, issues: [] };
}

/**
 * Deterministic string form of the registry, used only to derive
 * `REGISTRY_VERSION` (a content hash — see `scripts/generate-model-registry.ts`).
 * Independent of `renderRegistryModule`'s emitted TS formatting, so
 * reformatting the generated file would not, by itself, change the version.
 */
export function canonicalizeRegistry(models: readonly ModelDescriptor[]): string {
  return JSON.stringify(models);
}

function renderPricingPeriod(period: PricingPeriod): string {
  const ordered: Record<string, unknown> = {
    effectiveFrom: period.effectiveFrom,
  };
  if (period.effectiveTo !== undefined) ordered.effectiveTo = period.effectiveTo;
  ordered.currency = period.currency;
  ordered.unit = period.unit;
  ordered.input = period.input;
  ordered.output = period.output;
  if (period.cachedInput !== undefined) ordered.cachedInput = period.cachedInput;
  if (period.cacheWrite !== undefined) ordered.cacheWrite = period.cacheWrite;
  if (period.reasoning !== undefined) ordered.reasoning = period.reasoning;
  if (period.batchMultiplier !== undefined) ordered.batchMultiplier = period.batchMultiplier;
  if (period.cheapestTier !== undefined) ordered.cheapestTier = period.cheapestTier;
  ordered.sourceUrl = period.sourceUrl;
  ordered.observedAt = period.observedAt;
  if (period.notes !== undefined) ordered.notes = period.notes;
  return `      ${JSON.stringify(ordered)},`;
}

function renderModel(model: ModelDescriptor): string {
  const lines: string[] = ['  {'];
  lines.push(`    canonicalId: ${JSON.stringify(model.canonicalId)},`);
  lines.push(`    provider: ${JSON.stringify(model.provider)},`);
  lines.push(`    aliases: ${JSON.stringify(model.aliases)},`);
  if (model.family !== undefined) lines.push(`    family: ${JSON.stringify(model.family)},`);
  if (model.tokenizerFamily !== undefined)
    lines.push(`    tokenizerFamily: ${JSON.stringify(model.tokenizerFamily)},`);
  if (model.contextWindow !== undefined)
    lines.push(`    contextWindow: ${String(model.contextWindow)},`);
  if (model.capabilities !== undefined)
    lines.push(`    capabilities: ${JSON.stringify(model.capabilities)},`);
  if (model.pricing !== undefined) {
    lines.push('    pricing: [');
    for (const period of model.pricing) lines.push(renderPricingPeriod(period));
    lines.push('    ],');
  }
  if (model.source !== undefined) lines.push(`    source: ${JSON.stringify(model.source)},`);
  lines.push('  },');
  return lines.join('\n');
}

/**
 * Renders the committed `generated/registry.ts` module text. A pure function
 * of its inputs: identical `models` and `registryVersion` always yield an
 * identical string, so regenerating from unchanged source produces a
 * byte-identical file.
 */
export function renderRegistryModule(
  models: readonly ModelDescriptor[],
  registryVersion: string,
): string {
  const lines: string[] = [
    '/**',
    ' * GENERATED FILE — DO NOT EDIT BY HAND.',
    ' *',
    ' * Produced by `scripts/generate-model-registry.ts` from the reviewed source',
    ' * files under `docs/provider-data/`. Editing this file directly is forbidden.',
    ' *',
    ' * Regenerate: pnpm exec tsx scripts/generate-model-registry.ts',
    ' * Verify:     pnpm exec tsx scripts/generate-model-registry.ts --check',
    ' */',
    "import type { ModelDescriptor } from '../types.js';",
    '',
    `export const REGISTRY_VERSION = ${JSON.stringify(registryVersion)};`,
    '',
    'export const MODEL_REGISTRY: readonly ModelDescriptor[] = [',
    ...models.map(renderModel),
    '];',
    '',
  ];
  return lines.join('\n');
}
