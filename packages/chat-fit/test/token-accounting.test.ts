import { approximateTokenizer } from '@llm-kit/tokenizer';
import { describe, expect, it } from 'vitest';
import {
  createDefaultMessageTokenCounter,
  describeContentFallbacks,
} from '../src/token-accounting.js';
import { openAiAssistantWithToolCalls } from './fixtures/messages.js';

describe('createDefaultMessageTokenCounter', () => {
  const counter = createDefaultMessageTokenCounter(approximateTokenizer);

  it('counts a plain string-content message', () => {
    expect(counter.countMessage({ role: 'user', content: 'hello there' })).toBeGreaterThan(0);
  });

  it('counts zero for an empty conversation without invoking the tokenizer', () => {
    expect(counter.countMessages([])).toBe(0);
  });

  it('charges conversation priming once for a multi-message conversation', () => {
    const a = counter.countMessage({ role: 'user', content: 'hi' });
    const total = counter.countMessages([
      { role: 'user', content: 'hi' },
      { role: 'user', content: 'hi' },
    ]);
    expect(total).toBeGreaterThan(a * 2); // priming adds something on top of 2x a single message
  });

  it('charges extra for a message-level name', () => {
    const withoutName = counter.countMessage({ role: 'user', content: 'hi' });
    const withName = counter.countMessage({ role: 'user', content: 'hi', name: 'alice' });
    expect(withName).toBeGreaterThan(withoutName);
  });

  it('counts OpenAI-shaped tool_calls arguments, not just overhead', () => {
    const small = counter.countMessage(
      openAiAssistantWithToolCalls('x', [{ id: 'c', name: 'f', arguments: {} }]),
    );
    const big = counter.countMessage(
      openAiAssistantWithToolCalls('x', [
        { id: 'c', name: 'f', arguments: { blob: 'a'.repeat(500) } },
      ]),
    );
    expect(big).toBeGreaterThan(small + 50);
  });

  it('counts a tool call with no name gracefully (does not throw)', () => {
    expect(() =>
      counter.countMessage({ role: 'assistant', content: 'x', toolCalls: [{ id: 'c1' }] } as never),
    ).not.toThrow();
  });

  it('exposes an id composed from the tokenizer id', () => {
    expect(counter.id).toContain(approximateTokenizer.id);
  });

  // A legacy OpenAI `function_call` (still emitted by older SDKs and
  // gateway/proxy layers) lives under a key `readMessageStructure` does not
  // read as a tool call. It must not contribute zero tokens beyond fixed
  // message overhead — that would let real, billable payload silently
  // vanish from the count.
  it('counts payload under an unrecognized structural field (legacy function_call) instead of charging zero', () => {
    const withoutPayload = counter.countMessage({
      role: 'assistant',
      content: null,
    } as never);
    const functionCallMessage = {
      role: 'assistant',
      content: null,
      function_call: { name: 'search', arguments: JSON.stringify({ query: 'x'.repeat(4000) }) },
    };
    const withPayload = counter.countMessage(functionCallMessage as never);

    // The unrecognized field alone must swamp the baseline: a 4KB argument
    // payload is at minimum several hundred tokens under any reasonable
    // estimator, not the single-digit difference a dropped field would give.
    expect(withPayload - withoutPayload).toBeGreaterThan(500);
  });

  // A consumed key (`tool_calls`, already read by `structure.toolCalls`)
  // must never also be treated as an "unrecognized field" — that would be a
  // double count, the opposite failure from an undercount.
  it('does not treat a consumed key as an unrecognized field', () => {
    const message = openAiAssistantWithToolCalls('x', [
      { id: 'c', name: 'f', arguments: { a: 1 } },
    ]);
    const flagged = describeContentFallbacks([message], approximateTokenizer);
    expect(flagged.some((f) => f.reason.includes('tool_calls'))).toBe(false);
  });

  it('does not throw when the message itself is not an object', () => {
    expect(() => counter.countMessage(null as never)).not.toThrow();
    expect(() => counter.countMessage('not a message' as never)).not.toThrow();
  });

  it('does not charge tokens for scalar extras (an id, a numeric timestamp, a finish reason)', () => {
    const withoutScalars = counter.countMessage({ role: 'user', content: 'hi' } as never);
    const withScalars = counter.countMessage({
      role: 'user',
      content: 'hi',
      id: 'msg_123',
      createdAt: 1_700_000_000,
      finishReason: 'stop',
    } as never);
    expect(withScalars).toBe(withoutScalars);
  });

  // `typeof value === 'object'` is not the same as "structural content". A
  // `Date`/`RegExp`/`Map`/`Set`/`Error`/typed
  // array is `typeof 'object'` but is the natural JS representation of
  // scalar metadata (a timestamp, most commonly) — it must be treated the
  // same as a numeric/string scalar, matching
  // `internal/tokenizer`'s `isStructuralValue`. A plain object or an array
  // is genuinely structural and must still be counted.
  describe('non-plain-object extras are treated as scalar metadata, not payload', () => {
    const baseline = counter.countMessage({ role: 'user', content: 'hi' } as never);

    it.each([
      ['Date', new Date(0)],
      ['RegExp', /abc/u],
      ['Map', new Map([['a', 1]])],
      ['Set', new Set([1, 2, 3])],
      ['Error', new Error('boom')],
      ['typed array', new Uint8Array([1, 2, 3])],
    ])('a %s-valued field is not charged and does not warn', (_label, value) => {
      const withField = counter.countMessage({
        role: 'user',
        content: 'hi',
        extra: value,
      } as never);
      expect(withField).toBe(baseline);

      const flagged = describeContentFallbacks(
        [{ role: 'user', content: 'hi', extra: value }],
        approximateTokenizer,
      );
      expect(flagged).toEqual([]);
    });

    it('an array-valued field is still counted and still warns (kept, not regressed)', () => {
      const withField = counter.countMessage({
        role: 'user',
        content: 'hi',
        citations: [{ url: 'x'.repeat(500) }],
      } as never);
      expect(withField).toBeGreaterThan(baseline + 50);

      const flagged = describeContentFallbacks(
        [{ role: 'user', content: 'hi', citations: [{ url: 'x'.repeat(500) }] }],
        approximateTokenizer,
      );
      expect(flagged).toHaveLength(1);
    });

    it('a plain object field is still counted and still warns (kept, not regressed)', () => {
      const withField = counter.countMessage({
        role: 'user',
        content: 'hi',
        extra: { blob: 'x'.repeat(500) },
      } as never);
      expect(withField).toBeGreaterThan(baseline + 50);

      const flagged = describeContentFallbacks(
        [{ role: 'user', content: 'hi', extra: { blob: 'x'.repeat(500) } }],
        approximateTokenizer,
      );
      expect(flagged).toHaveLength(1);
    });

    it('an Object.create(null) field is still counted (a plain object by prototype, not by constructor)', () => {
      const nullProtoObject = Object.create(null) as Record<string, unknown>;
      nullProtoObject.blob = 'x'.repeat(500);
      const withField = counter.countMessage({
        role: 'user',
        content: 'hi',
        extra: nullProtoObject,
      } as never);
      expect(withField).toBeGreaterThan(baseline + 50);
    });

    it('a Date placed directly in content is still real content, and still gets the conservative fallback', () => {
      // Scoping check: `isStructuralValue` only governs the extra-fields
      // pass. `content` itself keeps its existing, unrelated fallback
      // behavior — a `Date` there is not a string or a content-part array,
      // so it must still be estimated, not silently skipped as "scalar".
      const emptyContentBaseline = counter.countMessage({ role: 'user', content: '' } as never);
      const withDateContent = counter.countMessage({ role: 'user', content: new Date(0) } as never);
      expect(withDateContent).toBeGreaterThan(emptyContentBaseline);

      const flagged = describeContentFallbacks(
        [{ role: 'user', content: new Date(0) }],
        approximateTokenizer,
      );
      expect(flagged).toHaveLength(1);
    });
  });

  // `metadata` is a field chat-fit itself declares on `ChatMessage` for the
  // caller's own bookkeeping. Unlike an
  // unrecognized provider field (`function_call`, `reasoning`, …), this
  // package wrote its semantics, so it is never counted, however large —
  // it is never sent to a provider by definition. See the module doc
  // comment on `CONSUMED_KEYS` in `token-accounting.ts`.
  describe('ChatMessage.metadata is never counted', () => {
    it('does not charge tokens for a small metadata object', () => {
      const withoutMetadata = counter.countMessage({ role: 'user', content: 'hi' } as never);
      const withMetadata = counter.countMessage({
        role: 'user',
        content: 'hi',
        metadata: { traceId: 'abc-123', tenant: 'acme' },
      } as never);
      expect(withMetadata).toBe(withoutMetadata);
    });

    it('does not charge tokens even for a large metadata payload', () => {
      const withoutMetadata = counter.countMessage({ role: 'user', content: 'hi' } as never);
      const withMetadata = counter.countMessage({
        role: 'user',
        content: 'hi',
        metadata: { audit: 'x'.repeat(2000) },
      } as never);
      expect(withMetadata).toBe(withoutMetadata);
    });

    it('never warns about metadata, regardless of shape', () => {
      const flagged = describeContentFallbacks(
        [{ role: 'user', content: 'hi', metadata: { audit: 'x'.repeat(2000), nested: [1, 2, 3] } }],
        approximateTokenizer,
      );
      expect(flagged).toEqual([]);
    });
  });

  // `fallbackReasons` is `WeakMap`-backed behind a keyed-lookup-only
  // interface (`FallbackReasonLookup`), not a strong `Map`. These pin the
  // lookup's own behavior directly (`finalize.ts` is covered separately by
  // `test/content-fallback-reporting.test.ts`).
  describe('fallbackReasons', () => {
    it('returns undefined for a message that never triggered a fallback', () => {
      const c = createDefaultMessageTokenCounter(approximateTokenizer);
      const plain = { role: 'user', content: 'hello there' };
      c.countMessage(plain);
      expect(c.fallbackReasons.get(plain)).toBeUndefined();
    });

    it('returns the recorded reasons for a message that did trigger a fallback', () => {
      const c = createDefaultMessageTokenCounter(approximateTokenizer);
      const odd = { role: 'user', content: { odd: 'shape' } };
      c.countMessage(odd);
      expect(c.fallbackReasons.get(odd)).toBeDefined();
      expect(c.fallbackReasons.get(odd)?.length).toBeGreaterThan(0);
    });

    it('is safe to call with a non-object message, returning undefined', () => {
      const c = createDefaultMessageTokenCounter(approximateTokenizer);
      // `Message` is an unconstrained generic in the public API; a caller
      // could in principle instantiate it with a non-object type. The
      // `WeakMap` behind `fallbackReasons` can only key on objects, so
      // `.get` must guard rather than throw.
      expect(c.fallbackReasons.get('not-an-object' as never)).toBeUndefined();
      expect(c.fallbackReasons.get(null as never)).toBeUndefined();
    });
  });
});

describe('describeContentFallbacks', () => {
  it('flags messages whose content used the unknown-shape fallback', () => {
    const flagged = describeContentFallbacks(
      [
        { role: 'user', content: 'plain text' },
        { role: 'user', content: { odd: 'shape' } },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'ok' },
            { type: 'image', url: 'x' },
          ],
        },
      ],
      approximateTokenizer,
    );
    expect(flagged.map((f) => f.index)).toEqual([1, 2]);
    expect(flagged[0]?.reason).toBeDefined();
  });

  it('flags nothing for an all-string-content conversation', () => {
    const flagged = describeContentFallbacks(
      [
        { role: 'user', content: 'a' },
        { role: 'assistant', content: 'b' },
      ],
      approximateTokenizer,
    );
    expect(flagged).toEqual([]);
  });

  // The visibility machinery already exists for unrecognized `content`, and
  // must apply the same way to structural fields outside `content`: the
  // reason has to name the offending key so a caller can actually act on
  // it.
  it('flags a message with an unrecognized structural field, naming the key', () => {
    const flagged = describeContentFallbacks(
      [
        {
          role: 'assistant',
          content: null,
          function_call: { name: 'search', arguments: '{"q":1}' },
        },
      ],
      approximateTokenizer,
    );
    expect(flagged).toHaveLength(1);
    expect(flagged[0]?.reason).toContain('function_call');
  });

  it('does not flag a message whose only extras are scalar', () => {
    const flagged = describeContentFallbacks(
      [{ role: 'user', content: 'hi', id: 'msg_1', createdAt: 42 }],
      approximateTokenizer,
    );
    expect(flagged).toEqual([]);
  });
});
