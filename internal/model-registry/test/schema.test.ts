import { describe, expect, it } from 'vitest';
import {
  validateModelDescriptor,
  validatePricingPeriod,
  validateProviderSourceFile,
} from '../src/schema.js';

const VALID_PERIOD = {
  effectiveFrom: '2026-01-01',
  currency: 'USD',
  unit: 'per-million-tokens',
  input: '3.00',
  output: '15.00',
  sourceUrl: 'https://example.com/pricing',
  observedAt: '2026-08-05',
} as const;

const VALID_MODEL = {
  canonicalId: 'demo-model',
  provider: 'anthropic',
  aliases: ['demo'],
  contextWindow: 200000,
  pricing: [VALID_PERIOD],
} as const;

describe('validatePricingPeriod', () => {
  it('accepts a well-formed period', () => {
    expect(validatePricingPeriod(VALID_PERIOD, 'p')).toEqual([]);
  });

  it('rejects a numeric rate with an actionable message explaining why', () => {
    const issues = validatePricingPeriod({ ...VALID_PERIOD, input: 3.0 }, 'p');
    expect(issues).toHaveLength(1);
    expect(issues[0]?.path).toBe('p.input');
    expect(issues[0]?.message).toMatch(/decimal string/);
    expect(issues[0]?.message).toMatch(/binary floating point/);
  });

  it('rejects a malformed decimal string', () => {
    const issues = validatePricingPeriod({ ...VALID_PERIOD, output: '15.00.1' }, 'p');
    expect(issues.map((i) => i.path)).toContain('p.output');
  });

  it('rejects a negative rate', () => {
    const issues = validatePricingPeriod({ ...VALID_PERIOD, input: '-1.00' }, 'p');
    expect(issues.map((i) => i.path)).toContain('p.input');
  });

  it('rejects an effectiveTo on or before effectiveFrom', () => {
    const issues = validatePricingPeriod(
      { ...VALID_PERIOD, effectiveFrom: '2026-06-01', effectiveTo: '2026-01-01' },
      'p',
    );
    expect(
      issues.some(
        (i) => i.path === 'p.effectiveTo' && /must be after effectiveFrom/.test(i.message),
      ),
    ).toBe(true);
  });

  it('rejects a non-ISO date', () => {
    const issues = validatePricingPeriod({ ...VALID_PERIOD, effectiveFrom: '01/01/2026' }, 'p');
    expect(issues.map((i) => i.path)).toContain('p.effectiveFrom');
  });

  it('rejects a missing sourceUrl', () => {
    const { sourceUrl: _sourceUrl, ...withoutSource } = VALID_PERIOD;
    const issues = validatePricingPeriod(withoutSource, 'p');
    expect(issues.map((i) => i.path)).toContain('p.sourceUrl');
  });

  it('rejects a non-http(s) sourceUrl', () => {
    const issues = validatePricingPeriod({ ...VALID_PERIOD, sourceUrl: 'not-a-url' }, 'p');
    expect(issues.map((i) => i.path)).toContain('p.sourceUrl');
  });

  it('rejects a missing observedAt', () => {
    const { observedAt: _observedAt, ...withoutObserved } = VALID_PERIOD;
    const issues = validatePricingPeriod(withoutObserved, 'p');
    expect(issues.map((i) => i.path)).toContain('p.observedAt');
  });

  it('rejects the wrong currency and unit literals', () => {
    const issues = validatePricingPeriod(
      { ...VALID_PERIOD, currency: 'EUR', unit: 'per-token' },
      'p',
    );
    expect(issues.map((i) => i.path)).toEqual(expect.arrayContaining(['p.currency', 'p.unit']));
  });

  it('accepts optional cache and batch fields as decimal strings, rejecting numbers', () => {
    const valid = validatePricingPeriod(
      {
        ...VALID_PERIOD,
        cachedInput: '0.30',
        cacheWrite: '3.75',
        reasoning: '15.00',
        batchMultiplier: '0.5',
      },
      'p',
    );
    expect(valid).toEqual([]);

    const invalid = validatePricingPeriod({ ...VALID_PERIOD, cachedInput: 0.3 }, 'p');
    expect(invalid.map((i) => i.path)).toContain('p.cachedInput');
  });

  it('rejects a non-object value with the type it actually received', () => {
    const issues = validatePricingPeriod('not-an-object', 'p');
    expect(issues).toHaveLength(1);
    expect(issues[0]?.message).toMatch(/expected an object, received string/);
  });
});

describe('validateModelDescriptor', () => {
  it('accepts a well-formed model', () => {
    expect(validateModelDescriptor(VALID_MODEL, 'm', 'anthropic')).toEqual([]);
  });

  it('rejects an empty canonicalId', () => {
    const issues = validateModelDescriptor({ ...VALID_MODEL, canonicalId: '' }, 'm', 'anthropic');
    expect(issues.map((i) => i.path)).toContain('m.canonicalId');
  });

  it('rejects a provider mismatched against the file it lives in', () => {
    const issues = validateModelDescriptor(VALID_MODEL, 'm', 'openai');
    expect(issues.map((i) => i.path)).toContain('m.provider');
    expect(issues[0]?.message).toMatch(/must match the provider declared by the source file/);
  });

  it("rejects an alias that duplicates the model's own canonicalId", () => {
    const issues = validateModelDescriptor(
      { ...VALID_MODEL, aliases: ['demo-model'] },
      'm',
      'anthropic',
    );
    expect(issues.map((i) => i.path)).toContain('m.aliases');
  });

  it('rejects duplicate aliases within one model', () => {
    const issues = validateModelDescriptor(
      { ...VALID_MODEL, aliases: ['x', 'x'] },
      'm',
      'anthropic',
    );
    expect(issues.some((i) => i.path === 'm.aliases' && /duplicate alias/.test(i.message))).toBe(
      true,
    );
  });

  it('rejects a non-positive-integer contextWindow', () => {
    const issues = validateModelDescriptor({ ...VALID_MODEL, contextWindow: -1 }, 'm', 'anthropic');
    expect(issues.map((i) => i.path)).toContain('m.contextWindow');
  });

  it('rejects overlapping pricing periods', () => {
    const overlapping = validateModelDescriptor(
      {
        ...VALID_MODEL,
        pricing: [
          { ...VALID_PERIOD, effectiveFrom: '2026-01-01', effectiveTo: '2026-06-01' },
          { ...VALID_PERIOD, effectiveFrom: '2026-03-01' },
        ],
      },
      'm',
      'anthropic',
    );
    expect(overlapping.some((i) => /overlap/.test(i.message))).toBe(true);
  });

  it('accepts adjacent, non-overlapping pricing periods (the Sonnet-5 shape)', () => {
    const adjacent = validateModelDescriptor(
      {
        ...VALID_MODEL,
        pricing: [
          {
            ...VALID_PERIOD,
            effectiveFrom: '2026-01-01',
            effectiveTo: '2026-09-01',
            input: '2.00',
            output: '10.00',
          },
          { ...VALID_PERIOD, effectiveFrom: '2026-09-01', input: '3.00', output: '15.00' },
        ],
      },
      'm',
      'anthropic',
    );
    expect(adjacent).toEqual([]);
  });

  it('rejects a non-string family, tokenizerFamily, and a non-string-array capabilities', () => {
    const issues = validateModelDescriptor(
      { ...VALID_MODEL, family: 42, tokenizerFamily: 7, capabilities: [1, 2] },
      'm',
      'anthropic',
    );
    expect(issues.map((i) => i.path)).toEqual(
      expect.arrayContaining(['m.family', 'm.tokenizerFamily', 'm.capabilities']),
    );
  });

  it('accepts well-formed family, tokenizerFamily, and capabilities', () => {
    const issues = validateModelDescriptor(
      {
        ...VALID_MODEL,
        family: 'sonnet',
        tokenizerFamily: 'claude',
        capabilities: ['chat', 'vision'],
      },
      'm',
      'anthropic',
    );
    expect(issues).toEqual([]);
  });

  it('rejects a non-array pricing field', () => {
    const issues = validateModelDescriptor({ ...VALID_MODEL, pricing: 'nope' }, 'm', 'anthropic');
    expect(issues.map((i) => i.path)).toContain('m.pricing');
  });

  it('propagates a bad nested pricing period with its full path', () => {
    const issues = validateModelDescriptor(
      { ...VALID_MODEL, pricing: [{ ...VALID_PERIOD, input: 3 }] },
      'm',
      'anthropic',
    );
    expect(issues.map((i) => i.path)).toContain('m.pricing[0].input');
  });
});

describe('validateProviderSourceFile', () => {
  it('accepts a well-formed file and returns the parsed models', () => {
    const result = validateProviderSourceFile(
      { provider: 'anthropic', models: [VALID_MODEL] },
      'anthropic',
      'f',
    );
    expect(result.issues).toEqual([]);
    expect(result.models).toHaveLength(1);
    expect(result.models[0]?.canonicalId).toBe('demo-model');
  });

  it('rejects a provider field that does not match the file name', () => {
    const result = validateProviderSourceFile({ provider: 'openai', models: [] }, 'anthropic', 'f');
    expect(result.issues.map((i) => i.path)).toContain('f.provider');
  });

  it('rejects two models within the same provider sharing an identifier — never resolvable, so it must fail generation', () => {
    const result = validateProviderSourceFile(
      {
        provider: 'anthropic',
        models: [
          { ...VALID_MODEL, canonicalId: 'model-a', aliases: ['shared'] },
          { ...VALID_MODEL, canonicalId: 'model-b', aliases: ['shared'] },
        ],
      },
      'anthropic',
      'f',
    );
    expect(result.models).toEqual([]);
    expect(
      result.issues.some((i) =>
        /identifier "shared" is used by more than one model/.test(i.message),
      ),
    ).toBe(true);
  });

  it("rejects an alias colliding with another model's canonicalId in the same provider", () => {
    const result = validateProviderSourceFile(
      {
        provider: 'anthropic',
        models: [
          { ...VALID_MODEL, canonicalId: 'model-a', aliases: [] },
          { ...VALID_MODEL, canonicalId: 'model-b', aliases: ['model-a'] },
        ],
      },
      'anthropic',
      'f',
    );
    expect(
      result.issues.some((i) =>
        /identifier "model-a" is used by more than one model/.test(i.message),
      ),
    ).toBe(true);
  });

  it('does not reject the same alias reused by a different provider (that is a runtime ambiguity, not a generation failure)', () => {
    const anthropicResult = validateProviderSourceFile(
      {
        provider: 'anthropic',
        models: [{ ...VALID_MODEL, canonicalId: 'model-a', aliases: ['shared'] }],
      },
      'anthropic',
      'anthropic.json',
    );
    const openaiResult = validateProviderSourceFile(
      {
        provider: 'openai',
        models: [
          { ...VALID_MODEL, provider: 'openai', canonicalId: 'model-b', aliases: ['shared'] },
        ],
      },
      'openai',
      'openai.json',
    );
    expect(anthropicResult.issues).toEqual([]);
    expect(openaiResult.issues).toEqual([]);
  });

  it('rejects a non-array models field', () => {
    const result = validateProviderSourceFile(
      { provider: 'anthropic', models: 'nope' },
      'anthropic',
      'f',
    );
    expect(result.issues.map((i) => i.path)).toContain('f.models');
  });

  it('rejects a non-object source file', () => {
    const result = validateProviderSourceFile('not-an-object', 'anthropic', 'f');
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]?.path).toBe('f');
    expect(result.models).toEqual([]);
  });

  it('rejects a malformed "omitted" field', () => {
    const result = validateProviderSourceFile(
      { provider: 'anthropic', models: [], omitted: [1, 2] },
      'anthropic',
      'f',
    );
    expect(result.issues.map((i) => i.path)).toContain('f.omitted');
  });

  it('accepts an empty models array with a well-formed "omitted" note', () => {
    const result = validateProviderSourceFile(
      { provider: 'openai', models: [], omitted: ['no verified source yet'] },
      'openai',
      'f',
    );
    expect(result.issues).toEqual([]);
    expect(result.models).toEqual([]);
  });
});

// `issues.push(...someArray)` blows the engine's call-argument stack (~125k
// on Node 24) once `someArray`'s length depends on caller-supplied input.
// `validateModelDescriptor` is exported and reachable on caller-supplied
// override descriptors (`usage-tab`'s `options.overrides` is passed straight
// through), so its input size is not under this package's control. These pin
// the fixed loop-based accumulation at a scale well past the point a spread
// would have thrown `RangeError`.
describe('validateModelDescriptor / validateProviderSourceFile — unbounded input', () => {
  const STRESS_COUNT = 150_000;

  it('does not throw when one model carries a huge, entirely-overlapping pricing array (checkNoOverlappingPeriods spread site)', () => {
    const hugePricingModel = {
      ...VALID_MODEL,
      pricing: Array.from({ length: STRESS_COUNT }, () => ({ ...VALID_PERIOD })),
    };
    let issues: ReturnType<typeof validateModelDescriptor> = [];
    expect(() => {
      issues = validateModelDescriptor(hugePricingModel, 'm', 'anthropic');
    }).not.toThrow();
    // Every period after the first overlaps its predecessor (same
    // effectiveFrom, both open-ended) — one overlap issue per adjacent pair.
    expect(issues.length).toBeGreaterThanOrEqual(STRESS_COUNT - 1);
  });

  it('does not throw when one model carries a huge duplicate-alias array (validateModelDescriptor result spread into validateProviderSourceFile)', () => {
    const hugeAliasModel = {
      ...VALID_MODEL,
      aliases: Array.from({ length: STRESS_COUNT }, () => 'dup-alias'),
    };
    let result: ReturnType<typeof validateProviderSourceFile> | undefined;
    expect(() => {
      result = validateProviderSourceFile(
        { provider: 'anthropic', models: [hugeAliasModel] },
        'anthropic',
        'f',
      );
    }).not.toThrow();
    // One "duplicate alias" issue per repeat past the first, plus the
    // single "identifier used by more than one model" issue.
    expect(result?.issues.length).toBeGreaterThanOrEqual(STRESS_COUNT - 1);
  });
});
