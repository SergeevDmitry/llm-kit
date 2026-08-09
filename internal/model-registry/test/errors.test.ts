import { assertErrorShape, assertJsonSerializable } from '@llm-kit/test-utils';
import { describe, expect, it } from 'vitest';
import { ModelRegistrySchemaError, UnknownModelError } from '../src/errors.js';

describe('ModelRegistrySchemaError', () => {
  it('uses the single issue verbatim as its message', () => {
    const error = new ModelRegistrySchemaError([
      'models[0].canonicalId: expected a non-empty string',
    ]);
    assertErrorShape(error, { name: 'ModelRegistrySchemaError', code: 'SCHEMA_VALIDATION_ERROR' });
    expect(error.message).toBe('models[0].canonicalId: expected a non-empty string');
    expect(error.issues).toHaveLength(1);
  });

  it('summarizes multiple issues with a count and a bulleted list', () => {
    const issues = ['issue one', 'issue two'];
    const error = new ModelRegistrySchemaError(issues);
    assertErrorShape(error, { name: 'ModelRegistrySchemaError', code: 'SCHEMA_VALIDATION_ERROR' });
    expect(error.message).toContain('2 schema validation issue(s)');
    expect(error.message).toContain('- issue one');
    expect(error.message).toContain('- issue two');
    expect(error.issues).toEqual(issues);
  });

  it('carries a JSON-serializable issues list', () => {
    const error = new ModelRegistrySchemaError(['a', 'b']);
    assertJsonSerializable(error.issues, 'issues');
  });
});

describe('UnknownModelError', () => {
  it('has a generic message and no otherProviders when unqualified', () => {
    const error = new UnknownModelError('nonexistent');
    assertErrorShape(error, { name: 'UnknownModelError', code: 'UNKNOWN_MODEL' });
    expect(error.provider).toBeUndefined();
    expect(error.otherProviders).toBeUndefined();
    expect(error.message).not.toContain('exists under');
  });

  it('has a provider-specific message and no otherProviders when qualified but truly absent everywhere', () => {
    const error = new UnknownModelError('nonexistent', 'openai');
    assertErrorShape(error, { name: 'UnknownModelError', code: 'UNKNOWN_MODEL' });
    expect(error.provider).toBe('openai');
    expect(error.otherProviders).toBeUndefined();
    expect(error.message).not.toContain('exists under');
  });

  it('names the other provider(s) when the id exists elsewhere, and stays JSON-serializable', () => {
    const error = new UnknownModelError('claude-opus-4-6', 'groq', ['anthropic']);
    expect(error.otherProviders).toEqual(['anthropic']);
    expect(error.message).toContain('exists under anthropic');
    assertJsonSerializable(error.otherProviders, 'otherProviders');
  });

  it('an empty otherProviders array is treated the same as none supplied', () => {
    const error = new UnknownModelError('nonexistent', 'openai', []);
    expect(error.otherProviders).toBeUndefined();
    expect(error.message).not.toContain('exists under');
  });
});
