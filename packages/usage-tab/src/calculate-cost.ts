/**
 * `calculateCost` — the package's core function.
 *
 * Resolution → effective-date period selection → usage validation → cached/
 * cache-write/reasoning subset accounting → exact per-line billing → exact
 * total. Every step that could silently under-report cost either throws
 * (unresolvable model, no priced period) or attaches a `PriceWarning`
 * (unsupported usage field, a cheapest-tier rate, an unpriced token class
 * billed at a conservative fallback rate) — see `errors.ts` and
 * `warnings.ts`.
 */
import {
  MODEL_REGISTRY,
  REGISTRY_VERSION,
  type ModelDescriptor,
  type PricingPeriod,
} from '@llm-kit/model-registry';
import { InvalidTokenCountError } from './errors.js';
import {
  addExact,
  costOfTokens,
  formatExact,
  multiplyExact,
  parseDecimalRate,
  toDisplayNumber,
  type ExactAmount,
} from './fixed-point.js';
import { normalizeRequestUsage } from './normalize/generic.js';
import { selectPeriodOrThrow } from './pricing-period.js';
import { resolveModel } from './resolve-model.js';
import type {
  CostBreakdown,
  CostLine,
  LlmUsage,
  PriceOptions,
  PriceRequest,
  PriceWarning,
} from './types.js';
import {
  batchPricingUnavailableWarning,
  cacheWritePricedAsInputWarning,
  cachedExceedsInputWarning,
  cachedInputPricedAsInputWarning,
  partialTierPricingWarning,
  reasoningExceedsOutputWarning,
  reasoningPricedAsOutputWarning,
} from './warnings.js';

function assertSafeNonNegativeInteger(field: string, value: number): void {
  if (!Number.isInteger(value) || !Number.isSafeInteger(value) || value < 0) {
    throw new InvalidTokenCountError(field, value);
  }
}

function validateUsage(usage: LlmUsage): void {
  assertSafeNonNegativeInteger('inputTokens', usage.inputTokens);
  assertSafeNonNegativeInteger('outputTokens', usage.outputTokens);
  if (usage.cachedInputTokens !== undefined) {
    assertSafeNonNegativeInteger('cachedInputTokens', usage.cachedInputTokens);
  }
  if (usage.cacheWriteTokens !== undefined) {
    assertSafeNonNegativeInteger('cacheWriteTokens', usage.cacheWriteTokens);
  }
  if (usage.reasoningTokens !== undefined) {
    assertSafeNonNegativeInteger('reasoningTokens', usage.reasoningTokens);
  }
}

interface BuiltLine {
  readonly line: CostLine;
  readonly exact: ExactAmount;
}

function buildCostLine(tokens: number, rate: ExactAmount): BuiltLine {
  const exact = costOfTokens(tokens, rate);
  return {
    line: {
      tokens,
      rate: formatExact(rate),
      costUsd: toDisplayNumber(exact),
      costUsdExact: formatExact(exact),
    },
    exact,
  };
}

export function calculateCost(request: PriceRequest, options: PriceOptions = {}): CostBreakdown {
  const registry = options.registry ?? MODEL_REGISTRY;
  // Two channels can carry a provider qualifier: `request.provider` (the
  // README's documented path) and `options.provider` (typed on `PriceOptions`
  // — a `ResolveModelOptions` — and threaded by `createPriceCalculator`,
  // `calculator.ts`). `request.provider` wins when both are supplied; an
  // explicit `request.provider: undefined` is indistinguishable from an
  // omitted property in JS (this repo does not set
  // `exactOptionalPropertyTypes`), so it correctly falls through to
  // `options.provider` rather than forcing an unqualified lookup.
  const provider = request.provider ?? options.provider;
  const resolved = resolveModel(request.model, {
    provider,
    overrides: options.overrides,
    fallback: options.fallback,
    registry,
  });
  const descriptor: ModelDescriptor = resolved.descriptor;

  const at = request.at ?? new Date();
  const period: PricingPeriod = selectPeriodOrThrow(descriptor, at);

  const { usage, warnings: usageWarnings } = normalizeRequestUsage(request.usage);
  validateUsage(usage);

  const warnings: PriceWarning[] = [...usageWarnings];

  let batchAmount: ExactAmount | undefined;
  if (request.mode === 'batch') {
    if (period.batchMultiplier !== undefined) {
      batchAmount = parseDecimalRate(period.batchMultiplier, 'batchMultiplier');
    } else {
      warnings.push(batchPricingUnavailableWarning(descriptor.canonicalId, descriptor.provider));
    }
  }

  function effectiveRate(rateStr: string, field: string): ExactAmount {
    const rate = parseDecimalRate(rateStr, field);
    return batchAmount === undefined ? rate : multiplyExact(rate, batchAmount);
  }

  const cachedInputTokens = usage.cachedInputTokens ?? 0;
  const cacheWriteTokens = usage.cacheWriteTokens ?? 0;
  const inputSubsetTotal = cachedInputTokens + cacheWriteTokens;
  let ordinaryInputTokens = usage.inputTokens - inputSubsetTotal;
  if (ordinaryInputTokens < 0) {
    warnings.push(cachedExceedsInputWarning(usage.inputTokens, inputSubsetTotal));
    ordinaryInputTokens = 0;
  }

  const reasoningTokens = usage.reasoningTokens ?? 0;
  let ordinaryOutputTokens = usage.outputTokens - reasoningTokens;
  if (ordinaryOutputTokens < 0) {
    warnings.push(reasoningExceedsOutputWarning(usage.outputTokens, reasoningTokens));
    ordinaryOutputTokens = 0;
  }

  const inputRate = effectiveRate(period.input, 'input');
  const outputRate = effectiveRate(period.output, 'output');
  const inputLine = buildCostLine(ordinaryInputTokens, inputRate);
  const outputLine = buildCostLine(ordinaryOutputTokens, outputRate);

  const lineAmounts: ExactAmount[] = [inputLine.exact, outputLine.exact];

  let cachedInputLine: CostLine | undefined;
  if (usage.cachedInputTokens !== undefined) {
    let rate: ExactAmount;
    if (period.cachedInput !== undefined) {
      rate = effectiveRate(period.cachedInput, 'cachedInput');
    } else {
      rate = inputRate;
      if (cachedInputTokens > 0) {
        warnings.push(cachedInputPricedAsInputWarning(descriptor.canonicalId, descriptor.provider));
      }
    }
    const built = buildCostLine(cachedInputTokens, rate);
    cachedInputLine = built.line;
    lineAmounts.push(built.exact);
  }

  let cacheWriteLine: CostLine | undefined;
  if (usage.cacheWriteTokens !== undefined) {
    let rate: ExactAmount;
    if (period.cacheWrite !== undefined) {
      rate = effectiveRate(period.cacheWrite, 'cacheWrite');
    } else {
      rate = inputRate;
      if (cacheWriteTokens > 0) {
        warnings.push(cacheWritePricedAsInputWarning(descriptor.canonicalId, descriptor.provider));
      }
    }
    const built = buildCostLine(cacheWriteTokens, rate);
    cacheWriteLine = built.line;
    lineAmounts.push(built.exact);
  }

  let reasoningLine: CostLine | undefined;
  if (usage.reasoningTokens !== undefined) {
    let rate: ExactAmount;
    if (period.reasoning !== undefined) {
      rate = effectiveRate(period.reasoning, 'reasoning');
    } else {
      rate = outputRate;
      if (reasoningTokens > 0) {
        warnings.push(reasoningPricedAsOutputWarning(descriptor.canonicalId, descriptor.provider));
      }
    }
    const built = buildCostLine(reasoningTokens, rate);
    reasoningLine = built.line;
    lineAmounts.push(built.exact);
  }

  if (period.cheapestTier === true) {
    warnings.push(partialTierPricingWarning(descriptor.canonicalId, descriptor.provider));
  }

  const total = addExact(lineAmounts);
  const totalUsdExact = formatExact(total);
  const totalUsd = toDisplayNumber(total);

  return {
    model: request.model,
    canonicalModel: descriptor.canonicalId,
    provider: descriptor.provider,
    matchedBy: resolved.matchedBy,
    ...(resolved.requestedProvider !== undefined
      ? { requestedProvider: resolved.requestedProvider }
      : {}),
    currency: 'USD',
    input: inputLine.line,
    output: outputLine.line,
    ...(cachedInputLine !== undefined ? { cachedInput: cachedInputLine } : {}),
    ...(cacheWriteLine !== undefined ? { cacheWrite: cacheWriteLine } : {}),
    ...(reasoningLine !== undefined ? { reasoning: reasoningLine } : {}),
    totalUsd,
    totalUsdExact,
    registryVersion: REGISTRY_VERSION,
    pricingEffectiveFrom: period.effectiveFrom,
    warnings,
  };
}
