import { describe, expect, it } from 'vitest';
import { assertJsonSerializable } from '@llm-kit/test-utils';
import { mendJson } from '../src/index.js';
import { createJsonMender } from '../src/create-json-mender.js';

describe('diagnostics', () => {
  it('is empty for a fully valid, complete document', () => {
    const r = mendJson('{"a":1}');
    expect(r.diagnostics).toEqual([]);
  });

  it('records "string-closed" for an open string with no dangling escape', () => {
    const r = mendJson('{"a":"hel');
    expect(r.diagnostics.map((d) => d.code)).toContain('string-closed');
  });

  it('records "escape-truncated" for a dangling escape', () => {
    const r = mendJson('{"a":"hel\\');
    expect(r.diagnostics.map((d) => d.code)).toContain('escape-truncated');
  });

  it('records "scalar-omitted" for an incomplete number under the default policy', () => {
    const r = mendJson('[1,2,3.');
    expect(r.diagnostics.map((d) => d.code)).toContain('scalar-omitted');
  });

  it('records "number-truncated" for a best-effort-trimmed number', () => {
    const r = mendJson('[1,2,3.', { incompleteScalarPolicy: 'best-effort' });
    expect(r.diagnostics.map((d) => d.code)).toContain('number-truncated');
  });

  it('records "scalar-completed" for a best-effort-completed literal', () => {
    const r = mendJson('[tru', { incompleteScalarPolicy: 'best-effort' });
    expect(r.diagnostics.map((d) => d.code)).toContain('scalar-completed');
  });

  it('records "member-removed" for a dangling comma / incomplete member', () => {
    const r = mendJson('{"a":1,');
    expect(r.diagnostics.map((d) => d.code)).toContain('member-removed');
  });

  it('records "closers-appended" whenever structure remains open', () => {
    const r = mendJson('{"a":[1,2');
    expect(r.diagnostics.map((d) => d.code)).toContain('closers-appended');
  });

  it('records "duplicate-key-skipped" under duplicateKeyPolicy "first"', () => {
    const r = mendJson('{"a":1,"a":2}', { duplicateKeyPolicy: 'first' });
    expect(r.diagnostics.map((d) => d.code)).toContain('duplicate-key-skipped');
  });

  it('records "trailing-data-ignored" for non-whitespace after an already-complete document, and preserves the committed value', () => {
    const r = mendJson('{"a":1}garbage');
    expect(r.diagnostics.map((d) => d.code)).toContain('trailing-data-ignored');
    expect(r.value).toEqual({ a: 1 }); // the committed value must survive, not vanish
  });

  it('"trailing-data-ignored" message never contains input content', () => {
    const r = mendJson('{"a":1}SECRET_TOKEN_abc123');
    const diagnostic = r.diagnostics.find((d) => d.code === 'trailing-data-ignored');
    expect(diagnostic).toBeDefined();
    expect(diagnostic?.message).not.toContain('SECRET_TOKEN_abc123');
  });

  it('every diagnostic carries a non-empty message and a numeric offset', () => {
    const r = mendJson('{"a":"hel');
    for (const diagnostic of r.diagnostics) {
      expect(typeof diagnostic.message).toBe('string');
      expect(diagnostic.message.length).toBeGreaterThan(0);
      expect(typeof diagnostic.offset).toBe('number');
    }
  });

  it('is always JSON-serializable', () => {
    const r = mendJson('{"a":[1,2,{"b":"unterminated', { incompleteScalarPolicy: 'best-effort' });
    assertJsonSerializable(r.diagnostics, 'diagnostics');
  });

  it('includeDiagnostics: false skips diagnostics but keeps repairedJson/value correct', () => {
    const withDiagnostics = mendJson('{"a":"hel', { includeDiagnostics: true });
    const without = mendJson('{"a":"hel', { includeDiagnostics: false });
    expect(without.diagnostics).toEqual([]);
    expect(without.value).toEqual(withDiagnostics.value);
    expect(without.repairedJson).toBe(withDiagnostics.repairedJson);
    expect(without.complete).toBe(withDiagnostics.complete);
  });

  it('a permanent diagnostic (duplicate-key-skipped) keeps appearing in every later snapshot', () => {
    const mender = createJsonMender({ duplicateKeyPolicy: 'first' });
    const afterDuplicate = mender.push('{"a":1,"a":2,');
    expect(afterDuplicate.diagnostics.map((d) => d.code)).toContain('duplicate-key-skipped');
    const afterMore = mender.push('"b":3}');
    expect(afterMore.diagnostics.map((d) => d.code)).toContain('duplicate-key-skipped');
  });
});
