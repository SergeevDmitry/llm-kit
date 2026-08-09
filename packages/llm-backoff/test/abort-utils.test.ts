import { afterEach, describe, expect, it, vi } from 'vitest';
import { combineSignals, isAbortError, throwIfAborted, toAbortError } from '../src/abort-utils.js';

describe('toAbortError', () => {
  it('returns an Error reason unchanged', () => {
    const reason = new Error('custom reason');
    expect(toAbortError(reason)).toBe(reason);
  });

  it('wraps a non-Error reason in a DOMException named AbortError', () => {
    const wrapped = toAbortError('just a string');
    expect(wrapped).toBeInstanceOf(DOMException);
    expect(wrapped.name).toBe('AbortError');
  });

  it('wraps undefined the same way', () => {
    expect(toAbortError(undefined).name).toBe('AbortError');
  });
});

describe('isAbortError', () => {
  it('recognizes a DOMException named AbortError', () => {
    expect(isAbortError(new DOMException('x', 'AbortError'))).toBe(true);
  });

  it('recognizes a plain Error named AbortError', () => {
    const error = new Error('x');
    error.name = 'AbortError';
    expect(isAbortError(error)).toBe(true);
  });

  it('rejects a DOMException with a different name', () => {
    expect(isAbortError(new DOMException('x', 'TimeoutError'))).toBe(false);
  });

  it('rejects an unrelated value', () => {
    expect(isAbortError(new Error('boom'))).toBe(false);
    expect(isAbortError('boom')).toBe(false);
    expect(isAbortError(null)).toBe(false);
  });
});

describe('throwIfAborted', () => {
  it('does nothing when the signal is undefined', () => {
    expect(() => throwIfAborted(undefined)).not.toThrow();
  });

  it('does nothing when the signal is not aborted', () => {
    expect(() => throwIfAborted(new AbortController().signal)).not.toThrow();
  });

  it('throws the abort reason when aborted', () => {
    const controller = new AbortController();
    const reason = new Error('stop');
    controller.abort(reason);
    expect(() => throwIfAborted(controller.signal)).toThrow(reason);
  });
});

describe('combineSignals', () => {
  it('returns undefined for zero signals, with a no-op dispose', () => {
    const combined = combineSignals([undefined, undefined]);
    expect(combined.signal).toBeUndefined();
    expect(() => combined.dispose()).not.toThrow();
  });

  it('returns the single signal unchanged when only one is present, with a no-op dispose', () => {
    const controller = new AbortController();
    const combined = combineSignals([undefined, controller.signal]);
    expect(combined.signal).toBe(controller.signal);
    expect(() => combined.dispose()).not.toThrow();
  });

  it('aborts the combined signal when either input aborts', () => {
    const a = new AbortController();
    const b = new AbortController();
    const combined = combineSignals([a.signal, b.signal]);
    expect(combined.signal?.aborted).toBe(false);
    b.abort(new Error('b stopped'));
    expect(combined.signal?.aborted).toBe(true);
  });

  it('is already aborted if one of the inputs already was', () => {
    const a = new AbortController();
    const reason = new Error('already gone');
    a.abort(reason);
    const b = new AbortController();
    const combined = combineSignals([a.signal, b.signal]);
    expect(combined.signal?.aborted).toBe(true);
  });

  describe('without AbortSignal.any (manual-combination fallback)', () => {
    const originalAny = AbortSignal.any;

    afterEach(() => {
      AbortSignal.any = originalAny;
    });

    it('still combines two not-yet-aborted signals', () => {
      // @ts-expect-error -- deliberately simulating a runtime without AbortSignal.any.
      delete AbortSignal.any;
      const a = new AbortController();
      const b = new AbortController();
      const combined = combineSignals([a.signal, b.signal]);
      expect(combined.signal?.aborted).toBe(false);
      a.abort(new Error('a stopped'));
      expect(combined.signal?.aborted).toBe(true);
    });

    it('still reflects an input that was already aborted before combining', () => {
      // @ts-expect-error -- deliberately simulating a runtime without AbortSignal.any.
      delete AbortSignal.any;
      const a = new AbortController();
      a.abort(new Error('already gone'));
      const b = new AbortController();
      const combined = combineSignals([a.signal, b.signal]);
      expect(combined.signal?.aborted).toBe(true);
    });

    // The fallback attaches a real `addEventListener('abort', ...)` to each
    // input signal; without `dispose()` it is never removed on the success
    // path (`{ once: true }` only removes it if it actually fires).
    it('dispose() detaches listeners: an input aborting afterward no longer propagates (normal completion)', () => {
      // @ts-expect-error -- deliberately simulating a runtime without AbortSignal.any.
      delete AbortSignal.any;
      const a = new AbortController();
      const b = new AbortController();
      const combined = combineSignals([a.signal, b.signal]);
      combined.dispose(); // as fetchWithLlmBackoff does once the call settles successfully
      a.abort(new Error('too late — listener should be gone'));
      expect(combined.signal?.aborted).toBe(false);
    });

    it('dispose() detaches listeners after the combined signal itself already aborted', () => {
      // @ts-expect-error -- deliberately simulating a runtime without AbortSignal.any.
      delete AbortSignal.any;
      const a = new AbortController();
      const b = new AbortController();
      const combined = combineSignals([a.signal, b.signal]);
      a.abort(new Error('a stopped'));
      expect(combined.signal?.aborted).toBe(true);
      // Calling dispose() after the fact must not throw and must still detach
      // the listener on the input that did NOT fire (b).
      expect(() => combined.dispose()).not.toThrow();
      expect(() => b.abort(new Error('late'))).not.toThrow();
    });

    it('dispose() is idempotent — safe to call more than once', () => {
      // @ts-expect-error -- deliberately simulating a runtime without AbortSignal.any.
      delete AbortSignal.any;
      const a = new AbortController();
      const b = new AbortController();
      const combined = combineSignals([a.signal, b.signal]);
      combined.dispose();
      expect(() => combined.dispose()).not.toThrow();
    });

    it('a long-lived signal reused across many combineSignals() calls does not accumulate listeners when disposed each time', () => {
      // @ts-expect-error -- deliberately simulating a runtime without AbortSignal.any.
      delete AbortSignal.any;
      const longLived = new AbortController();
      const addListenerSpy = vi.spyOn(longLived.signal, 'addEventListener');
      const removeListenerSpy = vi.spyOn(longLived.signal, 'removeEventListener');

      for (let i = 0; i < 20; i += 1) {
        const perCall = new AbortController();
        const combined = combineSignals([longLived.signal, perCall.signal]);
        combined.dispose();
      }

      expect(addListenerSpy).toHaveBeenCalledTimes(20);
      expect(removeListenerSpy).toHaveBeenCalledTimes(20);
    });
  });
});
