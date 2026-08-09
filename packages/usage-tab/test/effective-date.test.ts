/**
 * Historical lookup by effective date — the mandated golden fixture: the
 * real claude-sonnet-5 introductory rate expiring 2026-08-31, exercised
 * through `calculateCost` end to end against the real generated registry.
 */
import { describe, expect, it } from 'vitest';
import { calculateCost } from '../src/calculate-cost.js';

describe('claude-sonnet-5 introductory/standard rate boundary', () => {
  it('a lookup dated 2026-08-15 gets the introductory rate: $2.00 / $10.00 per million tokens', () => {
    const result = calculateCost({
      model: 'claude-sonnet-5',
      provider: 'anthropic',
      usage: { inputTokens: 1_000_000, outputTokens: 1_000_000 },
      at: '2026-08-15',
    });
    expect(result.input.costUsdExact).toBe('2.00');
    expect(result.output.costUsdExact).toBe('10.00');
    expect(result.pricingEffectiveFrom).toBe('2026-01-01');
  });

  it('a lookup dated 2026-09-15 gets the standard rate: $3.00 / $15.00 per million tokens', () => {
    const result = calculateCost({
      model: 'claude-sonnet-5',
      provider: 'anthropic',
      usage: { inputTokens: 1_000_000, outputTokens: 1_000_000 },
      at: '2026-09-15',
    });
    expect(result.input.costUsdExact).toBe('3.00');
    expect(result.output.costUsdExact).toBe('15.00');
    expect(result.pricingEffectiveFrom).toBe('2026-09-01');
  });

  it('the boundary instant itself (2026-09-01) already belongs to the standard rate', () => {
    const result = calculateCost({
      model: 'claude-sonnet-5',
      provider: 'anthropic',
      usage: { inputTokens: 1_000_000, outputTokens: 0 },
      at: '2026-09-01',
    });
    expect(result.input.costUsdExact).toBe('3.00');
  });

  it('accepts a Date instance identically to an ISO string', () => {
    const result = calculateCost({
      model: 'claude-sonnet-5',
      provider: 'anthropic',
      usage: { inputTokens: 1_000_000, outputTokens: 0 },
      at: new Date('2026-08-15T12:00:00Z'),
    });
    expect(result.input.costUsdExact).toBe('2.00');
  });

  it('defaults `at` to the current date when omitted', () => {
    // At the time this registry snapshot was taken (2026-08-05), "now" falls
    // inside the introductory window.
    const result = calculateCost({
      model: 'claude-sonnet-5',
      provider: 'anthropic',
      usage: { inputTokens: 1_000_000, outputTokens: 0 },
    });
    expect(['2.00', '3.00']).toContain(result.input.costUsdExact);
  });
});

describe("OpenRouter's UNCERTAIN-flagged claude-sonnet-5 entry", () => {
  it('is left as recorded — matches the introductory rate, not the standard rate', () => {
    const result = calculateCost({
      model: 'anthropic/claude-sonnet-5',
      provider: 'openrouter',
      usage: { inputTokens: 1_000_000, outputTokens: 1_000_000 },
      at: '2026-08-05',
    });
    expect(result.input.costUsdExact).toBe('2.00');
    expect(result.output.costUsdExact).toBe('10.00');
  });
});
