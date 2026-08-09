import { assertErrorShape, assertJsonSerializable } from '@llm-kit/test-utils';
import { describe, expect, it } from 'vitest';
import {
  InvalidRateError,
  InvalidTokenCountError,
  InvalidUsageError,
  NoPricingPeriodError,
} from '../src/errors.js';

describe('error shapes: extends Error, stable code, actionable message', () => {
  it('NoPricingPeriodError', () => {
    const error = new NoPricingPeriodError('claude-sonnet-5', 'anthropic', '2020-01-01');
    assertErrorShape(error, { name: 'NoPricingPeriodError', code: 'NO_PRICING_PERIOD' });
    expect(error.canonicalModel).toBe('claude-sonnet-5');
    expect(error.provider).toBe('anthropic');
  });

  it('InvalidUsageError', () => {
    const error = new InvalidUsageError('expected an object.');
    assertErrorShape(error, { name: 'InvalidUsageError', code: 'INVALID_USAGE' });
  });

  it('InvalidTokenCountError', () => {
    const error = new InvalidTokenCountError('inputTokens', -1);
    assertErrorShape(error, { name: 'InvalidTokenCountError', code: 'INVALID_TOKEN_COUNT' });
    expect(error.field).toBe('inputTokens');
    expect(error.value).toBe(-1);
  });

  it('InvalidRateError', () => {
    const error = new InvalidRateError('input', 'abc');
    assertErrorShape(error, { name: 'InvalidRateError', code: 'INVALID_RATE' });
  });

  it('every error is JSON-serializable via its own enumerable fields (message/code/name are standard Error accessors)', () => {
    const error = new NoPricingPeriodError('m', 'p', '2020-01-01');
    assertJsonSerializable({ code: error.code, name: error.name, message: error.message }, 'error');
  });
});
