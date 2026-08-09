/**
 * Regression fixtures modeled on real LLM tool-call argument streams.
 * Providers stream a JSON-encoded `arguments` string token-by-token in
 * irregular, sub-word chunks — these fixtures replay
 * representative chunk sequences of that shape and check the headline
 * invariant holds throughout, plus that the fully reassembled document is
 * exactly what the model "meant".
 */
import { describe, expect, it } from 'vitest';
import { createJsonMender } from '../src/create-json-mender.js';

function replay(chunks: readonly string[]): {
  finalValue: unknown;
  complete: boolean;
} {
  const mender = createJsonMender();
  for (const chunk of chunks) {
    const snap = mender.push(chunk);
    if (snap.value !== undefined) {
      expect(() => JSON.parse(snap.repairedJson as string)).not.toThrow();
    }
  }
  const final = mender.finish();
  return { finalValue: final.value, complete: final.complete };
}

describe('regression: tool-call argument streams', () => {
  it('OpenAI-style function-call arguments, split into small token fragments', () => {
    // Simulates `{"city": "San Francisco", "unit": "celsius", "days": 3}`
    // arriving as short streaming deltas.
    const chunks = [
      '{"',
      'city',
      '":',
      ' "',
      'San',
      ' Francisco',
      '",',
      ' "unit',
      '":',
      ' "',
      'celsius',
      '",',
      ' "days',
      '":',
      ' 3',
      '}',
    ];
    const { finalValue, complete } = replay(chunks);
    expect(complete).toBe(true);
    expect(finalValue).toEqual({ city: 'San Francisco', unit: 'celsius', days: 3 });
  });

  it('Anthropic-style nested tool input with an array field, chunked arbitrarily', () => {
    const full = '{"query":"weather in Tokyo","filters":["temperature","humidity"],"limit":5}';
    // Deliberately irregular chunk sizes, including one landing mid-escape-free string.
    const sizes = [3, 1, 7, 2, 15, 4, 1, 1, 9, 12, 6, 3];
    const chunks: string[] = [];
    let offset = 0;
    for (const size of sizes) {
      if (offset >= full.length) break;
      chunks.push(full.slice(offset, offset + size));
      offset += size;
    }
    if (offset < full.length) chunks.push(full.slice(offset));

    const { finalValue, complete } = replay(chunks);
    expect(complete).toBe(true);
    expect(finalValue).toEqual({
      query: 'weather in Tokyo',
      filters: ['temperature', 'humidity'],
      limit: 5,
    });
  });

  it('a stream that renders progressively still reflects each prefix faithfully', () => {
    const mender = createJsonMender();
    const seen: unknown[] = [];
    for (const chunk of ['{"step":1,"message":"Analyzing', ' request', '..."}']) {
      const snap = mender.push(chunk);
      seen.push(snap.value);
    }
    expect(seen[0]).toEqual({ step: 1, message: 'Analyzing' });
    expect(seen[1]).toEqual({ step: 1, message: 'Analyzing request' });
    expect(seen[2]).toEqual({ step: 1, message: 'Analyzing request...' });
  });

  it('a multi-tool-call array streams progressively without ever exposing invalid JSON', () => {
    const full =
      '[{"name":"search","arguments":{"q":"cats"}},{"name":"lookup","arguments":{"id":42}}]';
    const mender = createJsonMender();
    for (let offset = 0; offset < full.length; offset += 3) {
      const chunk = full.slice(offset, offset + 3);
      const snap = mender.push(chunk);
      if (snap.value !== undefined) {
        expect(() => JSON.parse(snap.repairedJson as string)).not.toThrow();
      }
    }
    const final = mender.finish();
    expect(final.complete).toBe(true);
    expect(final.value).toEqual([
      { name: 'search', arguments: { q: 'cats' } },
      { name: 'lookup', arguments: { id: 42 } },
    ]);
  });

  it('a stream that gets cut off entirely (connection drop) still yields the best-known partial state', () => {
    const mender = createJsonMender();
    mender.push('{"status":"in_progress","result":{"partial_answer":"The capital of France is Par');
    const final = mender.finish();
    expect(final.complete).toBe(false);
    expect(final.value).toEqual({
      status: 'in_progress',
      result: { partial_answer: 'The capital of France is Par' },
    });
  });
});
