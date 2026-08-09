/**
 * `finalizeResult` must not re-walk every *input* message a second time
 * (`describeContentFallbacks(plan.messages, ...)`) to build fallback
 * warnings: that would redo accounting `countMessage` already did, and
 * could name an index for a message the caller's `result.messages` no
 * longer contains, since it would be walking the input, not the output.
 *
 * Instead, the default counter records fallback reasons as a byproduct of
 * the counting it already does (`createDefaultMessageTokenCounter`'s
 * `fallbackReasons`), and `finalizeResult` reads that, restricted to
 * messages that survived selection. These tests pin both halves: no
 * warning for a dropped message, and a *kept* message with a fallback
 * still warns, by its original index, which must appear in
 * `report.keptIndexes`.
 */
import { describe, expect, it } from 'vitest';
import { fitChat } from '../src/fit-chat.js';
import type { ChatMessage } from '../src/types.js';
import { user } from './fixtures/messages.js';

function legacyFunctionCallMessage(label: string): ChatMessage {
  return {
    role: 'assistant',
    content: null,
    function_call: { name: 'search', arguments: `{"q":"${label}"}` },
  } as unknown as ChatMessage;
}

describe('content-fallback warnings only ever name messages present in the result', () => {
  it('does not warn about a dropped message even though it had an unrecognized field', () => {
    // A stale unrecognized-field message buried under enough newer filler
    // that a tight budget drops it, plus one *recent* unrecognized-field
    // message that must survive selection (newest-first).
    const messages: ChatMessage[] = [
      legacyFunctionCallMessage('stale'),
      ...Array.from({ length: 30 }, (_, i) => user(`filler message number ${String(i)}`.repeat(3))),
      legacyFunctionCallMessage('recent'),
    ];

    const result = fitChat(messages, { maxTokens: 150 });

    // Sanity: the stale message was in fact dropped, and the recent one kept.
    expect(result.report.removedIndexes).toContain(0);
    expect(result.report.keptIndexes).toContain(messages.length - 1);

    const fallbackWarnings = result.report.warnings.filter((w) => w.includes('function_call'));
    // Only the surviving message's warning appears.
    expect(fallbackWarnings).toHaveLength(1);
    expect(fallbackWarnings[0]).toContain(`message ${String(messages.length - 1)}`);
    expect(fallbackWarnings.some((w) => w.startsWith('message 0:'))).toBe(false);
  });

  it('every "message N" fallback warning names an index present in report.keptIndexes', () => {
    const messages: ChatMessage[] = [
      legacyFunctionCallMessage('a'),
      legacyFunctionCallMessage('b'),
      ...Array.from({ length: 15 }, (_, i) => user(`filler ${String(i)}`)),
      legacyFunctionCallMessage('c'),
    ];

    const result = fitChat(messages, { maxTokens: 500 });

    const indexesNamedInWarnings = result.report.warnings
      .map((w) => /^message (\d+):/.exec(w))
      .filter((m): m is RegExpExecArray => m !== null)
      .map((m) => Number(m[1]));

    expect(indexesNamedInWarnings.length).toBeGreaterThan(0);
    for (const index of indexesNamedInWarnings) {
      expect(result.report.keptIndexes).toContain(index);
    }
  });

  it('still warns about a kept message with an unrecognized field (not regressed)', () => {
    const result = fitChat([legacyFunctionCallMessage('only'), user('go')], { maxTokens: 5000 });
    expect(result.report.keptIndexes).toEqual([0, 1]);
    expect(
      result.report.warnings.some((w) => w.includes('message 0') && w.includes('function_call')),
    ).toBe(true);
  });

  it('a message dropped entirely (not just having its fallback warning suppressed) is genuinely absent from the result', () => {
    const messages: ChatMessage[] = [
      legacyFunctionCallMessage('stale'),
      ...Array.from({ length: 30 }, (_, i) => user(`filler message number ${String(i)}`.repeat(3))),
    ];
    const result = fitChat(messages, { maxTokens: 150 });
    expect(result.report.removedIndexes).toContain(0);
    expect(result.messages).toHaveLength(result.report.keptIndexes.length);
  });
});
