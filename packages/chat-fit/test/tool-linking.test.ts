import { describe, expect, it } from 'vitest';
import { fitChat } from '../src/fit-chat.js';
import { assistant, assistantWithToolCalls, toolResult, user } from './fixtures/messages.js';

describe('tool-call linking diagnostics and conservative grouping', () => {
  it('links a tool result that arrives out of order (before other unrelated turns)', () => {
    const call = assistantWithToolCalls('call it', [{ id: 'c1', name: 'search' }]);
    const result = toolResult('c1', { ok: true });
    // Result placed several messages later, with unrelated turns in between.
    const messages = [user('start'), call, user('unrelated 1'), user('unrelated 2'), result];

    const fit = fitChat(messages, { maxTokens: 5000 });
    expect(fit.messages).toContain(call);
    expect(fit.messages).toContain(result);

    const group = fit.report.toolCallGroups.find((g) => g.toolCallIds.includes('c1'));
    expect([...(group?.indexes ?? [])].sort((a, b) => a - b)).toEqual([1, 4]);
  });

  it('groups multiple results resolving calls out of declaration order', () => {
    const call = assistantWithToolCalls('two calls', [
      { id: 'a', name: 'first' },
      { id: 'b', name: 'second' },
    ]);
    const resultB = toolResult('b', { done: 'b' });
    const resultA = toolResult('a', { done: 'a' });
    const messages = [call, resultB, resultA];

    const fit = fitChat(messages, { maxTokens: 5000 });
    expect(fit.messages).toEqual(messages);
    const group = fit.report.toolCallGroups.find((g) => g.toolCallIds.includes('a'));
    expect([...(group?.toolCallIds ?? [])].sort()).toEqual(['a', 'b']);
    expect(group?.indexes).toEqual([0, 1, 2]);
  });

  it('falls back to adjacency grouping when a tool result has no id at all', () => {
    const call = assistantWithToolCalls('call it', [{ id: 'x1', name: 'lookup' }]);
    const unlinkedResult = { role: 'tool', content: { ok: true } }; // no toolCallId
    const messages = [call, unlinkedResult];

    const fit = fitChat(messages, { maxTokens: 5000 });
    expect(fit.messages).toEqual(messages);
    const warnings = fit.report.warnings.join('\n');
    expect(warnings).toMatch(/adjacency/);
  });

  it('flags an orphan tool result (no id, no open preceding call) but still keeps it as its own group', () => {
    const orphan = { role: 'tool', content: 'stray' };
    const messages = [user('hi'), orphan];

    const fit = fitChat(messages, { maxTokens: 5000 });
    expect(fit.messages).toEqual(messages);
    expect(fit.report.warnings.join('\n')).toMatch(/no open preceding tool call/);
  });

  it('flags a tool call with a missing id, assigns a synthetic one, and keeps its group intact', () => {
    const call = { role: 'assistant', content: 'x', toolCalls: [{ name: 'no-id-tool' }] };
    const result = { role: 'tool', content: 'ok' }; // adjacency-linked
    const messages = [call, result];

    const fit = fitChat(messages, { maxTokens: 5000 });
    expect(fit.messages).toEqual(messages);
    expect(fit.report.warnings.join('\n')).toMatch(/no id/);
  });

  it('flags a duplicate tool-call id across two different assistant messages and unions them conservatively', () => {
    const first = assistantWithToolCalls('first', [{ id: 'dup', name: 'a' }]);
    const second = assistantWithToolCalls('second', [{ id: 'dup', name: 'b' }]);
    const result = toolResult('dup', 'result for dup');
    const messages = [first, second, result];

    const fit = fitChat(messages, { maxTokens: 5000 });
    // All three end up in one group: kept or dropped together.
    const containsAny = messages.some((m) => fit.messages.includes(m));
    const containsAll = messages.every((m) => fit.messages.includes(m));
    expect(containsAny).toBe(containsAll);
    expect(fit.report.warnings.join('\n')).toMatch(/duplicate/i);
  });

  it('flags an unresolved tool result whose id matches no known call', () => {
    const strayResult = toolResult('never-called', { data: 1 });
    const messages = [user('hi'), strayResult];

    const fit = fitChat(messages, { maxTokens: 5000 });
    expect(fit.messages).toEqual(messages);
    expect(fit.report.warnings.join('\n')).toMatch(/no message declares/);
  });

  it('flags an unresolved tool call whose result never arrives, keeps the call as its own group', () => {
    const call = assistantWithToolCalls('dangling', [{ id: 'never-answered', name: 'x' }]);
    const messages = [user('hi'), call, assistant('moving on without a result')];

    const fit = fitChat(messages, { maxTokens: 5000 });
    expect(fit.messages).toEqual(messages);
    expect(fit.report.warnings.join('\n')).toMatch(/no matching tool result/);
  });

  it('one atomic tool group larger than the whole budget is dropped as a unit, never partially', () => {
    const hugeArgs = { blob: 'y'.repeat(4000) };
    const call = assistantWithToolCalls('big call', [
      { id: 'big', name: 'huge', arguments: hugeArgs },
    ]);
    const result = toolResult('big', { blob: 'z'.repeat(4000) });
    const messages = [user('recent, small'), call, result];

    const fit = fitChat(messages, { maxTokens: 60 });
    const hasCall = fit.messages.includes(call);
    const hasResult = fit.messages.includes(result);
    expect(hasCall).toBe(hasResult);
  });
});
