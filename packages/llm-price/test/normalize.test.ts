/**
 * Provider usage-adapter fixtures — structural only, no SDK types involved.
 */
import { describe, expect, it } from 'vitest';
import { InvalidUsageError } from '../src/errors.js';
import { normalizeAnthropicUsage } from '../src/normalize/anthropic.js';
import { normalizeGoogleUsage } from '../src/normalize/google.js';
import { normalizeOpenAICompatibleUsage } from '../src/normalize/openai-compatible.js';
import { normalizeOpenAIUsage } from '../src/normalize/openai.js';
import { calculateCost } from '../src/calculate-cost.js';

describe('normalizeOpenAIUsage', () => {
  it('normalizes a Chat Completions usage object, with cached/reasoning as subsets of prompt/completion', () => {
    const { usage, warnings } = normalizeOpenAIUsage({
      prompt_tokens: 1000,
      completion_tokens: 500,
      total_tokens: 1500,
      prompt_tokens_details: { cached_tokens: 200 },
      completion_tokens_details: { reasoning_tokens: 100 },
    });
    expect(usage).toEqual({
      inputTokens: 1000,
      outputTokens: 500,
      cachedInputTokens: 200,
      reasoningTokens: 100,
    });
    expect(warnings).toEqual([]);
  });

  it('normalizes the Responses API shape (input_tokens/output_tokens)', () => {
    const { usage } = normalizeOpenAIUsage({
      input_tokens: 800,
      output_tokens: 400,
      input_tokens_details: { cached_tokens: 50 },
      output_tokens_details: { reasoning_tokens: 20 },
    });
    expect(usage).toEqual({
      inputTokens: 800,
      outputTokens: 400,
      cachedInputTokens: 50,
      reasoningTokens: 20,
    });
  });

  it('warns on an unrecognized top-level field and an unrecognized nested detail field', () => {
    const { warnings } = normalizeOpenAIUsage({
      prompt_tokens: 10,
      completion_tokens: 10,
      completion_tokens_details: { audio_tokens: 5, made_up_field: 1 },
      some_future_field: true,
    });
    expect(warnings.some((w) => w.field === 'some_future_field')).toBe(true);
    expect(warnings.some((w) => w.field === 'completion_tokens_details.made_up_field')).toBe(true);
    expect(warnings.some((w) => w.field === 'completion_tokens_details.audio_tokens')).toBe(false);
  });

  it('throws InvalidUsageError when neither shape is present', () => {
    expect(() => normalizeOpenAIUsage({})).toThrow(InvalidUsageError);
  });

  it('round-trips through calculateCost end to end', () => {
    const result = calculateCost({
      model: 'gpt-5',
      provider: 'openai',
      usage: normalizeOpenAIUsage({ prompt_tokens: 1000, completion_tokens: 500 }).usage,
      at: '2026-08-05',
    });
    expect(result.input.tokens).toBe(1000);
    expect(result.output.tokens).toBe(500);
  });
});

describe('normalizeAnthropicUsage', () => {
  it('sums cache_read/cache_creation into inputTokens (Anthropic reports them additively, not as a subset)', () => {
    const { usage } = normalizeAnthropicUsage({
      input_tokens: 700,
      output_tokens: 300,
      cache_read_input_tokens: 200,
      cache_creation_input_tokens: 100,
    });
    expect(usage).toEqual({
      inputTokens: 1000, // 700 + 200 + 100
      outputTokens: 300,
      cachedInputTokens: 200,
      cacheWriteTokens: 100,
    });
  });

  it('sums the newer per-TTL cache_creation shape into one cacheWriteTokens value', () => {
    const { usage, warnings } = normalizeAnthropicUsage({
      input_tokens: 500,
      output_tokens: 100,
      cache_creation: { ephemeral_5m_input_tokens: 40, ephemeral_1h_input_tokens: 10 },
    });
    expect(usage.cacheWriteTokens).toBe(50);
    expect(usage.inputTokens).toBe(550);
    expect(warnings).toEqual([]);
  });

  it('warns on an unrecognized field inside cache_creation', () => {
    const { warnings } = normalizeAnthropicUsage({
      input_tokens: 1,
      output_tokens: 1,
      cache_creation: { ephemeral_5m_input_tokens: 1, made_up: 2 },
    });
    expect(warnings.some((w) => w.field === 'cache_creation.made_up')).toBe(true);
  });

  it('still warns on an unrecognized cache_creation field when cache_creation_input_tokens is ALSO present', () => {
    // Anthropic's prompt-caching docs confirm both fields routinely co-occur
    // (`cache_creation_input_tokens` documented as the sum of `cache_creation`'s
    // values — https://platform.claude.com/docs/en/build-with-claude/prompt-caching).
    // The aggregate field takes precedence for `cacheWriteTokens`, but the
    // unknown-key scan over `cache_creation` must still run.
    const { usage, warnings } = normalizeAnthropicUsage({
      input_tokens: 500,
      output_tokens: 100,
      cache_creation_input_tokens: 50,
      cache_creation: {
        ephemeral_5m_input_tokens: 40,
        ephemeral_1h_input_tokens: 10,
        ephemeral_7d_input_tokens: 5, // hypothetical future TTL bucket
      },
    });
    expect(usage.cacheWriteTokens).toBe(50); // the aggregate field, not re-derived from the buckets
    expect(warnings.some((w) => w.field === 'cache_creation.ephemeral_7d_input_tokens')).toBe(true);
  });

  it('recovers exactly the ordinary input portion after calculateCost subtracts the subsets', () => {
    const { usage } = normalizeAnthropicUsage({
      input_tokens: 700,
      output_tokens: 300,
      cache_read_input_tokens: 200,
      cache_creation_input_tokens: 100,
    });
    const result = calculateCost({
      model: 'claude-sonnet-5',
      provider: 'anthropic',
      usage,
      at: '2026-08-05',
    });
    expect(result.input.tokens).toBe(700);
    expect(result.cachedInput?.tokens).toBe(200);
    expect(result.cacheWrite?.tokens).toBe(100);
  });

  it('throws InvalidUsageError without input_tokens/output_tokens', () => {
    expect(() => normalizeAnthropicUsage({ input_tokens: 1 })).toThrow(InvalidUsageError);
  });
});

describe('normalizeGoogleUsage', () => {
  it('adds thoughtsTokenCount into outputTokens (Gemini reports it additively, not as a subset)', () => {
    const { usage } = normalizeGoogleUsage({
      promptTokenCount: 1000,
      candidatesTokenCount: 400,
      totalTokenCount: 1450,
      cachedContentTokenCount: 100,
      thoughtsTokenCount: 50,
    });
    expect(usage).toEqual({
      inputTokens: 1000,
      outputTokens: 450, // 400 + 50
      cachedInputTokens: 100,
      reasoningTokens: 50,
    });
  });

  it('cachedContentTokenCount is a genuine subset of promptTokenCount — inputTokens is unchanged', () => {
    const { usage } = normalizeGoogleUsage({
      promptTokenCount: 1000,
      candidatesTokenCount: 400,
      cachedContentTokenCount: 300,
    });
    expect(usage.inputTokens).toBe(1000);
  });

  it('recovers exactly candidatesTokenCount as ordinary output after calculateCost subtracts thoughts', () => {
    const { usage } = normalizeGoogleUsage({
      promptTokenCount: 1000,
      candidatesTokenCount: 400,
      thoughtsTokenCount: 50,
    });
    const result = calculateCost({
      model: 'gemini-2.5-flash',
      provider: 'google',
      usage,
      at: '2026-08-05',
    });
    expect(result.output.tokens).toBe(400);
    expect(result.reasoning?.tokens).toBe(50);
  });

  it('throws InvalidUsageError without promptTokenCount/candidatesTokenCount', () => {
    expect(() => normalizeGoogleUsage({ promptTokenCount: 1 })).toThrow(InvalidUsageError);
  });
});

describe('normalizeOpenAICompatibleUsage', () => {
  it('normalizes the plain OpenAI-shape fields', () => {
    const { usage } = normalizeOpenAICompatibleUsage({ prompt_tokens: 100, completion_tokens: 50 });
    expect(usage).toEqual({ inputTokens: 100, outputTokens: 50 });
  });

  it('accepts a flat top-level cached_tokens field some providers use instead of nested details', () => {
    const { usage } = normalizeOpenAICompatibleUsage({
      prompt_tokens: 100,
      completion_tokens: 50,
      cached_tokens: 10,
    });
    expect(usage.cachedInputTokens).toBe(10);
  });

  it('accepts DeepSeek-style prompt_cache_hit_tokens', () => {
    const { usage } = normalizeOpenAICompatibleUsage({
      prompt_tokens: 100,
      completion_tokens: 50,
      prompt_cache_hit_tokens: 20,
    });
    expect(usage.cachedInputTokens).toBe(20);
  });

  it('prefers nested prompt_tokens_details.cached_tokens when both are present', () => {
    const { usage } = normalizeOpenAICompatibleUsage({
      prompt_tokens: 100,
      completion_tokens: 50,
      prompt_tokens_details: { cached_tokens: 5 },
      cached_tokens: 999,
    });
    expect(usage.cachedInputTokens).toBe(5);
  });

  it('throws InvalidUsageError without prompt_tokens/completion_tokens', () => {
    expect(() => normalizeOpenAICompatibleUsage({})).toThrow(InvalidUsageError);
  });
});
