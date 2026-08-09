/**
 * Schema validation for provider source files and the model descriptors they
 * contain.
 *
 * This module never throws for ordinary invalid data — it collects every
 * issue as a `{ path, message }` pair so a reviewer fixes a source file in
 * one pass, rather than one `tsx` invocation per typo. `ModelRegistrySchemaError`
 * (in `errors.ts`) is available for callers that want a throwing form.
 */
import { PROVIDER_IDS, type ModelDescriptor, type ProviderId } from './types.js';

const DECIMAL_STRING_PATTERN = /^\d+(\.\d+)?$/;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export interface SourceValidationIssue {
  readonly path: string;
  readonly message: string;
}

/** Result of validating one provider's source file. `models` is empty whenever `issues` is non-empty. */
export interface ProviderSourceValidationResult {
  readonly provider: ProviderId;
  readonly models: readonly ModelDescriptor[];
  readonly issues: readonly SourceValidationIssue[];
}

function issue(path: string, message: string): SourceValidationIssue {
  return { path, message };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
}

function describeType(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

/** Renders a value for an error message: quoted strings, JSON for everything else, falling back to `String()` for values `JSON.stringify` rejects (e.g. a lone `undefined`). */
function describeValue(value: unknown): string {
  if (value === undefined) return 'undefined';
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function isIsoDate(value: string): boolean {
  return ISO_DATE_PATTERN.test(value) && !Number.isNaN(Date.parse(value));
}

function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function validateDecimalString(
  value: unknown,
  path: string,
  issues: SourceValidationIssue[],
  required: boolean,
): void {
  if (value === undefined) {
    if (required) {
      issues.push(issue(path, 'expected a decimal string (e.g. "3.00"), received undefined'));
    }
    return;
  }
  if (typeof value !== 'string') {
    issues.push(
      issue(
        path,
        `expected a decimal string, received ${describeType(value)} ${describeValue(value)} — rates must never be numbers: money must never be calculated with binary floating point`,
      ),
    );
    return;
  }
  if (!DECIMAL_STRING_PATTERN.test(value)) {
    issues.push(
      issue(
        path,
        `expected a non-negative decimal string like "3.00", received ${JSON.stringify(value)}`,
      ),
    );
  }
}

function validateIsoDateField(
  value: unknown,
  path: string,
  issues: SourceValidationIssue[],
  required: boolean,
): void {
  if (value === undefined) {
    if (required) {
      issues.push(issue(path, 'expected an ISO date (YYYY-MM-DD), received undefined'));
    }
    return;
  }
  if (typeof value !== 'string' || !isIsoDate(value)) {
    issues.push(issue(path, `expected an ISO date (YYYY-MM-DD), received ${describeValue(value)}`));
  }
}

export function validatePricingPeriod(value: unknown, path: string): SourceValidationIssue[] {
  const issues: SourceValidationIssue[] = [];
  if (!isPlainObject(value)) {
    issues.push(issue(path, `expected an object, received ${describeType(value)}`));
    return issues;
  }

  validateIsoDateField(value.effectiveFrom, `${path}.effectiveFrom`, issues, true);
  validateIsoDateField(value.effectiveTo, `${path}.effectiveTo`, issues, false);
  if (
    typeof value.effectiveFrom === 'string' &&
    isIsoDate(value.effectiveFrom) &&
    typeof value.effectiveTo === 'string' &&
    isIsoDate(value.effectiveTo) &&
    value.effectiveTo <= value.effectiveFrom
  ) {
    issues.push(
      issue(
        `${path}.effectiveTo`,
        `must be after effectiveFrom (${value.effectiveFrom}), received ${value.effectiveTo}`,
      ),
    );
  }

  if (value.currency !== 'USD') {
    issues.push(
      issue(`${path}.currency`, `expected "USD", received ${describeValue(value.currency)}`),
    );
  }
  if (value.unit !== 'per-million-tokens') {
    issues.push(
      issue(`${path}.unit`, `expected "per-million-tokens", received ${describeValue(value.unit)}`),
    );
  }

  validateDecimalString(value.input, `${path}.input`, issues, true);
  validateDecimalString(value.output, `${path}.output`, issues, true);
  validateDecimalString(value.cachedInput, `${path}.cachedInput`, issues, false);
  validateDecimalString(value.cacheWrite, `${path}.cacheWrite`, issues, false);
  validateDecimalString(value.reasoning, `${path}.reasoning`, issues, false);
  validateDecimalString(value.batchMultiplier, `${path}.batchMultiplier`, issues, false);

  if (value.cheapestTier !== undefined && value.cheapestTier !== true) {
    issues.push(
      issue(
        `${path}.cheapestTier`,
        `expected the literal \`true\` or to be omitted, received ${describeValue(value.cheapestTier)} — cheapestTier only ever marks a period as one tier among several, it is never explicitly \`false\``,
      ),
    );
  }

  if (
    typeof value.sourceUrl !== 'string' ||
    value.sourceUrl.length === 0 ||
    !isHttpUrl(value.sourceUrl)
  ) {
    issues.push(
      issue(
        `${path}.sourceUrl`,
        `expected a non-empty http(s) URL, received ${describeValue(value.sourceUrl)}`,
      ),
    );
  }
  validateIsoDateField(value.observedAt, `${path}.observedAt`, issues, true);

  if (value.notes !== undefined && !isStringArray(value.notes)) {
    issues.push(
      issue(`${path}.notes`, `expected a string array, received ${describeValue(value.notes)}`),
    );
  }

  return issues;
}

function validateRegistrySource(value: unknown, path: string): SourceValidationIssue[] {
  const issues: SourceValidationIssue[] = [];
  if (!isPlainObject(value)) {
    issues.push(issue(path, `expected an object, received ${describeType(value)}`));
    return issues;
  }
  if (typeof value.url !== 'string' || value.url.length === 0 || !isHttpUrl(value.url)) {
    issues.push(
      issue(
        `${path}.url`,
        `expected a non-empty http(s) URL, received ${describeValue(value.url)}`,
      ),
    );
  }
  validateIsoDateField(value.observedAt, `${path}.observedAt`, issues, true);
  if (value.notes !== undefined && !isStringArray(value.notes)) {
    issues.push(
      issue(`${path}.notes`, `expected a string array, received ${describeValue(value.notes)}`),
    );
  }
  return issues;
}

/** Periods that individually validated must not overlap in time — an instant covered by two periods is unresolvable, not just an edge case. */
function checkNoOverlappingPeriods(
  periods: readonly unknown[],
  path: string,
): SourceValidationIssue[] {
  const issues: SourceValidationIssue[] = [];
  const intervals: { fromMs: number; toMs: number; index: number }[] = [];

  periods.forEach((period, index) => {
    if (!isPlainObject(period)) return;
    if (typeof period.effectiveFrom !== 'string' || !isIsoDate(period.effectiveFrom)) return;
    if (
      period.effectiveTo !== undefined &&
      (typeof period.effectiveTo !== 'string' || !isIsoDate(period.effectiveTo))
    ) {
      return;
    }
    intervals.push({
      fromMs: Date.parse(period.effectiveFrom),
      toMs:
        period.effectiveTo === undefined
          ? Number.POSITIVE_INFINITY
          : Date.parse(period.effectiveTo),
      index,
    });
  });

  const sorted = [...intervals].sort((a, b) => a.fromMs - b.fromMs);
  for (let i = 1; i < sorted.length; i += 1) {
    const previous = sorted[i - 1];
    const current = sorted[i];
    if (previous === undefined || current === undefined) continue;
    if (current.fromMs < previous.toMs) {
      issues.push(
        issue(
          path,
          `pricing[${String(previous.index)}] and pricing[${String(current.index)}] overlap in time`,
        ),
      );
    }
  }

  return issues;
}

/** Validates one model descriptor. `expectedProvider` must equal `value.provider` — a descriptor's provider is fixed by the source file it lives in. */
export function validateModelDescriptor(
  value: unknown,
  path: string,
  expectedProvider: ProviderId,
): SourceValidationIssue[] {
  const issues: SourceValidationIssue[] = [];
  if (!isPlainObject(value)) {
    issues.push(issue(path, `expected an object, received ${describeType(value)}`));
    return issues;
  }

  if (typeof value.canonicalId !== 'string' || value.canonicalId.trim().length === 0) {
    issues.push(
      issue(
        `${path}.canonicalId`,
        `expected a non-empty string, received ${describeValue(value.canonicalId)}`,
      ),
    );
  }

  if (value.provider !== expectedProvider) {
    issues.push(
      issue(
        `${path}.provider`,
        `expected "${expectedProvider}" (must match the provider declared by the source file), received ${describeValue(value.provider)}`,
      ),
    );
  } else if (!PROVIDER_IDS.includes(value.provider as ProviderId)) {
    issues.push(
      issue(
        `${path}.provider`,
        `"${String(value.provider)}" is not a known ProviderId (${PROVIDER_IDS.join(', ')})`,
      ),
    );
  }

  if (!isStringArray(value.aliases)) {
    issues.push(
      issue(`${path}.aliases`, `expected a string array, received ${describeValue(value.aliases)}`),
    );
  } else {
    if (typeof value.canonicalId === 'string' && value.aliases.includes(value.canonicalId)) {
      issues.push(
        issue(
          `${path}.aliases`,
          `must not repeat the model's own canonicalId ("${value.canonicalId}")`,
        ),
      );
    }
    const seen = new Set<string>();
    for (const alias of value.aliases) {
      if (seen.has(alias)) {
        issues.push(issue(`${path}.aliases`, `duplicate alias ${JSON.stringify(alias)}`));
      }
      seen.add(alias);
    }
  }

  if (value.family !== undefined && typeof value.family !== 'string') {
    issues.push(
      issue(`${path}.family`, `expected a string, received ${describeValue(value.family)}`),
    );
  }
  if (value.tokenizerFamily !== undefined && typeof value.tokenizerFamily !== 'string') {
    issues.push(
      issue(
        `${path}.tokenizerFamily`,
        `expected a string, received ${describeValue(value.tokenizerFamily)}`,
      ),
    );
  }
  if (
    value.contextWindow !== undefined &&
    (typeof value.contextWindow !== 'number' ||
      !Number.isInteger(value.contextWindow) ||
      value.contextWindow <= 0)
  ) {
    issues.push(
      issue(
        `${path}.contextWindow`,
        `expected a positive integer, received ${describeValue(value.contextWindow)}`,
      ),
    );
  }
  if (value.capabilities !== undefined && !isStringArray(value.capabilities)) {
    issues.push(
      issue(
        `${path}.capabilities`,
        `expected a string array, received ${describeValue(value.capabilities)}`,
      ),
    );
  }

  if (value.pricing !== undefined) {
    if (!Array.isArray(value.pricing)) {
      issues.push(
        issue(`${path}.pricing`, `expected an array, received ${describeValue(value.pricing)}`),
      );
    } else {
      value.pricing.forEach((period, index) => {
        for (const periodIssue of validatePricingPeriod(
          period,
          `${path}.pricing[${String(index)}]`,
        )) {
          issues.push(periodIssue);
        }
      });
      for (const overlapIssue of checkNoOverlappingPeriods(value.pricing, `${path}.pricing`)) {
        issues.push(overlapIssue);
      }
    }
  }

  if (value.source !== undefined) {
    for (const sourceIssue of validateRegistrySource(value.source, `${path}.source`)) {
      issues.push(sourceIssue);
    }
  }

  return issues;
}

/**
 * Validates one provider source file (`docs/provider-data/<provider>.json`):
 * shape, every model descriptor it contains, and the within-provider
 * uniqueness rule that makes provider-qualified resolution well-defined.
 *
 * An alias reused by a *different* provider is fine — the resolver's
 * provider-qualified steps (exact canonical ID, then exact alias, each
 * scoped to the requested provider) disambiguate it.
 * An alias or canonicalId reused by two models of the *same* provider is
 * not fine: no provider qualifier could ever disambiguate it, so it must
 * fail here rather than surface as a runtime `AMBIGUOUS_ALIAS` later.
 */
export function validateProviderSourceFile(
  data: unknown,
  expectedProvider: ProviderId,
  fileLabel: string,
): ProviderSourceValidationResult {
  const issues: SourceValidationIssue[] = [];

  if (!isPlainObject(data)) {
    issues.push(
      issue(
        fileLabel,
        `expected an object with "provider" and "models", received ${describeType(data)}`,
      ),
    );
    return { provider: expectedProvider, models: [], issues };
  }

  if (data.provider !== expectedProvider) {
    issues.push(
      issue(
        `${fileLabel}.provider`,
        `expected "${expectedProvider}" to match the file name, received ${describeValue(data.provider)}`,
      ),
    );
  }

  if (!Array.isArray(data.models)) {
    issues.push(
      issue(`${fileLabel}.models`, `expected an array, received ${describeValue(data.models)}`),
    );
    return { provider: expectedProvider, models: [], issues };
  }

  if (data.omitted !== undefined && !isStringArray(data.omitted)) {
    issues.push(
      issue(
        `${fileLabel}.omitted`,
        `expected a string array, received ${describeValue(data.omitted)}`,
      ),
    );
  }

  data.models.forEach((model, index) => {
    for (const modelIssue of validateModelDescriptor(
      model,
      `${fileLabel}.models[${String(index)}]`,
      expectedProvider,
    )) {
      issues.push(modelIssue);
    }
  });

  const owners = new Map<string, Set<string>>();
  for (const model of data.models) {
    if (!isPlainObject(model) || typeof model.canonicalId !== 'string') continue;
    const identifiers = [model.canonicalId, ...(isStringArray(model.aliases) ? model.aliases : [])];
    for (const identifier of identifiers) {
      const owningIds = owners.get(identifier) ?? new Set<string>();
      owningIds.add(model.canonicalId);
      owners.set(identifier, owningIds);
    }
  }
  for (const [identifier, owningIds] of owners) {
    if (owningIds.size > 1) {
      issues.push(
        issue(
          `${fileLabel}.models`,
          `identifier "${identifier}" is used by more than one model in this provider (${[...owningIds].join(', ')}) — within one provider every canonicalId and alias must be unique, or no provider qualifier could disambiguate a lookup`,
        ),
      );
    }
  }

  if (issues.length > 0) {
    return { provider: expectedProvider, models: [], issues };
  }

  // Safe: every model in `data.models` passed `validateModelDescriptor` above
  // with no issues, so this array structurally matches `ModelDescriptor[]`.
  const models = data.models as ModelDescriptor[];
  return { provider: expectedProvider, models, issues: [] };
}
