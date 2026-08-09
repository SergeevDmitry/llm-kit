import { describe, expect, it } from 'vitest';
import { extractHttpError } from '../src/extract-http-error.js';

describe('extractHttpError', () => {
  it('extracts status and headers from a real Response', () => {
    const response = new Response(null, { status: 429, headers: { 'retry-after': '2' } });
    const { status, headers } = extractHttpError(response);
    expect(status).toBe(429);
    expect(headers).toBeInstanceOf(Headers);
    expect((headers as Headers).get('retry-after')).toBe('2');
  });

  it('extracts status/headers from a top-level SDK error shape', () => {
    const { status, headers } = extractHttpError({ status: 400, headers: { 'x-id': '1' } });
    expect(status).toBe(400);
    expect(headers).toEqual({ 'x-id': '1' });
  });

  it('extracts statusCode when status is absent', () => {
    expect(extractHttpError({ statusCode: 503 }).status).toBe(503);
  });

  it('extracts a nested response.statusCode when response.status is absent', () => {
    expect(extractHttpError({ response: { statusCode: 502 } }).status).toBe(502);
  });

  it('extracts status/headers nested under response.*, the OpenAI/Anthropic SDK shape', () => {
    const error = { response: { status: 429, headers: { 'retry-after': '5' } } };
    const { status, headers } = extractHttpError(error);
    expect(status).toBe(429);
    expect(headers).toEqual({ 'retry-after': '5' });
  });

  it('prefers a top-level status/headers over a nested response.*', () => {
    const error = {
      status: 400,
      headers: { a: '1' },
      response: { status: 500, headers: { b: '2' } },
    };
    const { status, headers } = extractHttpError(error);
    expect(status).toBe(400);
    expect(headers).toEqual({ a: '1' });
  });

  it('accepts a real Headers instance nested under response.headers', () => {
    const error = { response: { status: 429, headers: new Headers({ 'retry-after': '3' }) } };
    const { headers } = extractHttpError(error);
    expect(headers).toBeInstanceOf(Headers);
  });

  it('returns undefined/undefined for a shape with no extractable status', () => {
    expect(extractHttpError({ message: 'boom' })).toEqual({
      status: undefined,
      headers: undefined,
    });
  });

  it('returns undefined/undefined for non-object errors', () => {
    expect(extractHttpError('boom')).toEqual({ status: undefined, headers: undefined });
    expect(extractHttpError(42)).toEqual({ status: undefined, headers: undefined });
    expect(extractHttpError(null)).toEqual({ status: undefined, headers: undefined });
    expect(extractHttpError(undefined)).toEqual({ status: undefined, headers: undefined });
  });

  it('ignores a headers field that is an array or a primitive', () => {
    expect(extractHttpError({ status: 429, headers: ['not', 'a', 'bag'] }).headers).toBeUndefined();
    expect(extractHttpError({ status: 429, headers: 'nope' }).headers).toBeUndefined();
  });
});
