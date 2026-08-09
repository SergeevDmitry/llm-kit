import { createFakeClock, createSleepRecorder } from '@llm-kit/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { toAbortError } from '../src/abort-utils.js';
import { LlmBackoffError } from '../src/errors.js';
import { fetchWithLlmBackoff } from '../src/fetch-with-llm-backoff.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubFetch(impl: typeof fetch): void {
  vi.stubGlobal('fetch', vi.fn(impl));
}

describe('fetchWithLlmBackoff — status handling matches plain fetch outside retryable statuses', () => {
  it('returns a 2xx response normally, without retrying', async () => {
    let calls = 0;
    stubFetch(async () => {
      calls += 1;
      return new Response('ok', { status: 200 });
    });
    const response = await fetchWithLlmBackoff('https://example.test/resource');
    expect(response.status).toBe(200);
    expect(calls).toBe(1);
  });

  it('returns a 400 response normally — response.ok/status behave exactly like plain fetch', async () => {
    let calls = 0;
    stubFetch(async () => {
      calls += 1;
      return new Response('bad request', { status: 400 });
    });
    const response = await fetchWithLlmBackoff('https://example.test/resource');
    expect(response.status).toBe(400);
    expect(response.ok).toBe(false);
    expect(calls).toBe(1); // never retried
  });

  it('returns a 401 response normally, never retried', async () => {
    let calls = 0;
    stubFetch(async () => {
      calls += 1;
      return new Response(null, { status: 401 });
    });
    const response = await fetchWithLlmBackoff('https://example.test/resource');
    expect(response.status).toBe(401);
    expect(calls).toBe(1);
  });
});

describe('fetchWithLlmBackoff — retries', () => {
  it('retries a 429 honoring Retry-After, then returns the eventual success', async () => {
    const clock = createFakeClock();
    const sleep = createSleepRecorder(clock);
    let calls = 0;
    stubFetch(async () => {
      calls += 1;
      if (calls === 1) {
        return new Response(null, { status: 429, headers: { 'retry-after': '4' } });
      }
      return new Response('ok', { status: 200 });
    });

    const response = await fetchWithLlmBackoff('https://example.test/resource', undefined, {
      sleep: sleep.sleep,
      now: clock.nowFn,
    });

    expect(response.status).toBe(200);
    expect(calls).toBe(2);
    expect(sleep.durations()).toEqual([4000]);
  });

  it('retries 529 by default', async () => {
    const clock = createFakeClock();
    const sleep = createSleepRecorder(clock);
    let calls = 0;
    stubFetch(async () => {
      calls += 1;
      return new Response(null, { status: calls === 1 ? 529 : 200 });
    });

    const response = await fetchWithLlmBackoff('https://example.test/resource', undefined, {
      sleep: sleep.sleep,
      now: clock.nowFn,
    });
    expect(response.status).toBe(200);
    expect(calls).toBe(2);
  });

  it('throws LlmBackoffError with a FetchRetryableStatusError cause after exhausting retries on a persistent 429', async () => {
    const clock = createFakeClock();
    const sleep = createSleepRecorder(clock);
    stubFetch(async () => new Response(null, { status: 429, headers: { 'retry-after': '1' } }));

    let caught: unknown;
    try {
      await fetchWithLlmBackoff('https://example.test/resource', undefined, {
        sleep: sleep.sleep,
        now: clock.nowFn,
        maxAttempts: 2,
      });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(LlmBackoffError);
    const backoffError = caught as LlmBackoffError;
    expect(backoffError.code).toBe('MAX_ATTEMPTS_EXCEEDED');
    expect((backoffError.cause as { status?: number }).status).toBe(429);
    expect((backoffError.cause as { response?: Response }).response).toBeInstanceOf(Response);
  });

  // See `with-llm-backoff.test.ts`'s matching describe block for the full
  // reasoning. `parseRetryAfterHeader` treats a digit string dense enough to
  // overflow `Number()` to `Infinity` as malformed, so a 429 carrying one
  // falls back to ordinary
  // bounded backoff here too, through the real `fetch`-shaped path (not just
  // the generic `withLlmBackoff` operation callback).
  it('a 429 carrying an overflowing Retry-After falls back to bounded backoff instead of an unbounded/Infinity delay', async () => {
    const clock = createFakeClock();
    const sleep = createSleepRecorder(clock);
    const huge = '9'.repeat(400);
    let calls = 0;
    stubFetch(async () => {
      calls += 1;
      if (calls === 1) {
        return new Response(null, { status: 429, headers: { 'retry-after': huge } });
      }
      return new Response('ok', { status: 200 });
    });

    const response = await fetchWithLlmBackoff('https://example.test/resource', undefined, {
      sleep: sleep.sleep,
      now: clock.nowFn,
      maxElapsedMs: 60_000,
      baseDelayMs: 100,
      maxDelayMs: 10_000,
    });

    expect(response.status).toBe(200);
    expect(calls).toBe(2);
    expect(sleep.durations()).toHaveLength(1);
    expect(Number.isFinite(sleep.durations()[0])).toBe(true);
    expect(sleep.durations()[0]).toBeLessThanOrEqual(100); // bounded fallback, not the malformed header
  });
});

describe('fetchWithLlmBackoff — response body lifetime', () => {
  it('cancels the body of every retried-away response, and leaves the final success response readable', async () => {
    const clock = createFakeClock();
    const sleep = createSleepRecorder(clock);
    const responses: Response[] = [];
    let calls = 0;
    stubFetch(async () => {
      calls += 1;
      const response =
        calls < 3
          ? new Response(JSON.stringify({ error: 'rate limited' }), {
              status: 429,
              headers: { 'retry-after': '1' },
            })
          : new Response('final ok body', { status: 200 });
      responses.push(response);
      return response;
    });

    const result = await fetchWithLlmBackoff('https://example.test/resource', undefined, {
      sleep: sleep.sleep,
      now: clock.nowFn,
    });

    expect(calls).toBe(3);
    expect(result).toBe(responses[2]);
    // Every discarded response's body was cancelled...
    expect(responses[0]?.bodyUsed).toBe(true);
    expect(responses[1]?.bodyUsed).toBe(true);
    // ...but the final one the caller actually got is untouched and readable.
    expect(result.bodyUsed).toBe(false);
    await expect(result.text()).resolves.toBe('final ok body');
  });

  it('leaves the final response readable via LlmBackoffError.cause when maxAttempts is exhausted, and cancels every earlier one', async () => {
    const clock = createFakeClock();
    const sleep = createSleepRecorder(clock);
    const responses: Response[] = [];
    stubFetch(async () => {
      const response = new Response(JSON.stringify({ error: 'still limited' }), {
        status: 429,
        headers: { 'retry-after': '1' },
      });
      responses.push(response);
      return response;
    });

    let caught: unknown;
    try {
      await fetchWithLlmBackoff('https://example.test/resource', undefined, {
        sleep: sleep.sleep,
        now: clock.nowFn,
        maxAttempts: 3,
      });
    } catch (error) {
      caught = error;
    }

    expect(responses).toHaveLength(3);
    const backoffError = caught as LlmBackoffError;
    expect(backoffError.code).toBe('MAX_ATTEMPTS_EXCEEDED');
    const finalResponse = (backoffError.cause as { response: Response }).response;
    expect(finalResponse).toBe(responses[2]);

    // The two responses that never reached the caller are cancelled...
    expect(responses[0]?.bodyUsed).toBe(true);
    expect(responses[1]?.bodyUsed).toBe(true);
    // ...but the one attached to the error is still fully readable.
    expect(finalResponse.bodyUsed).toBe(false);
    await expect(finalResponse.text()).resolves.toBe(JSON.stringify({ error: 'still limited' }));
  });

  it('leaves the final response readable when maxElapsedMs is exceeded before a next attempt would start', async () => {
    const clock = createFakeClock();
    const sleep = createSleepRecorder(clock);
    let calls = 0;
    let response: Response | undefined;
    stubFetch(async () => {
      calls += 1;
      response = new Response('rate limited', {
        status: 429,
        headers: { 'retry-after': '3600' }, // far beyond maxElapsedMs below
      });
      return response;
    });

    let caught: unknown;
    try {
      await fetchWithLlmBackoff('https://example.test/resource', undefined, {
        sleep: sleep.sleep,
        now: clock.nowFn,
        maxElapsedMs: 1000,
      });
    } catch (error) {
      caught = error;
    }

    expect(calls).toBe(1); // never got a second attempt — cut off by maxElapsedMs, not maxAttempts
    const backoffError = caught as LlmBackoffError;
    expect(backoffError.code).toBe('MAX_ELAPSED_EXCEEDED');
    expect((backoffError.cause as { response: Response }).response).toBe(response);
    // This is the one response that ever existed — it must stay readable,
    // even though it happened on an attempt well short of maxAttempts.
    expect(response?.bodyUsed).toBe(false);
    await expect(response?.text()).resolves.toBe('rate limited');
  });

  it('cancels the response body when a throwing onRetry callback cuts the loop short', async () => {
    const clock = createFakeClock();
    const sleep = createSleepRecorder(clock);
    let response: Response | undefined;
    stubFetch(async () => {
      response = new Response('will never be seen', {
        status: 429,
        headers: { 'retry-after': '1' },
      });
      return response;
    });

    let caught: unknown;
    try {
      await fetchWithLlmBackoff('https://example.test/resource', undefined, {
        sleep: sleep.sleep,
        now: clock.nowFn,
        onRetry: () => {
          throw new Error('onRetry blew up');
        },
      });
    } catch (error) {
      caught = error;
    }

    const backoffError = caught as LlmBackoffError;
    expect(backoffError.code).toBe('ON_RETRY_CALLBACK_FAILED');
    // The onRetry failure is the cause, not the FetchRetryableStatusError —
    // so nothing in the thrown error reaches this response. It must be
    // released rather than stranded.
    expect(backoffError.cause).toBeInstanceOf(Error);
    expect((backoffError.cause as Error).message).toBe('onRetry blew up');
    expect(response?.bodyUsed).toBe(true);
  });

  it('cancels the response body when an abort fires during the sleep between attempts', async () => {
    const clock = createFakeClock();
    let response: Response | undefined;
    stubFetch(async () => {
      response = new Response('will never be seen', {
        status: 429,
        headers: { 'retry-after': '5' },
      });
      return response;
    });
    const controller = new AbortController();

    // A `sleep` that never resolves on its own — it settles only when this
    // test tells it to (`releaseSleep`) or when the signal aborts — so the
    // abort below is guaranteed to land *while the loop is sleeping*, with no
    // reliance on real-timer polling to win a race.
    let sleepInvoked: (() => void) | undefined;
    const sleepInvokedPromise = new Promise<void>((resolve) => {
      sleepInvoked = resolve;
    });
    let releaseSleep: (() => void) | undefined;
    const manualSleep = (_ms: number, signal?: AbortSignal): Promise<void> => {
      sleepInvoked?.();
      return new Promise<void>((resolve, reject) => {
        releaseSleep = resolve;
        signal?.addEventListener('abort', () => reject(toAbortError(signal.reason)), {
          once: true,
        });
      });
    };

    const promise = fetchWithLlmBackoff('https://example.test/resource', undefined, {
      sleep: manualSleep,
      now: clock.nowFn,
      signal: controller.signal,
    });
    await sleepInvokedPromise; // the loop is now awaiting cfg.sleep(...)
    controller.abort(new Error('cancelled mid-sleep'));

    await expect(promise).rejects.toThrow();
    expect(response?.bodyUsed).toBe(true);
    releaseSleep?.(); // avoid leaving a dangling unresolved promise
  });

  it('a response with a null body (e.g. a HEAD-shaped 429) is handled without throwing', async () => {
    const clock = createFakeClock();
    const sleep = createSleepRecorder(clock);
    let calls = 0;
    stubFetch(async () => {
      calls += 1;
      return new Response(null, {
        status: calls === 1 ? 429 : 200,
        headers: { 'retry-after': '1' },
      });
    });

    const response = await fetchWithLlmBackoff('https://example.test/resource', undefined, {
      sleep: sleep.sleep,
      now: clock.nowFn,
    });

    expect(response.status).toBe(200);
    expect(calls).toBe(2);
  });
});

describe('fetchWithLlmBackoff — non-replayable request bodies', () => {
  it('refuses upfront when init.body is a ReadableStream and more than one attempt is allowed', async () => {
    stubFetch(async () => new Response('unreachable'));
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('hello'));
        controller.close();
      },
    });

    let caught: unknown;
    try {
      await fetchWithLlmBackoff('https://example.test/resource', {
        method: 'POST',
        body: stream,
        duplex: 'half',
      });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(LlmBackoffError);
    expect((caught as LlmBackoffError).code).toBe('REQUEST_BODY_NOT_REPLAYABLE');
  });

  it('allows a ReadableStream body when maxAttempts is 1 (no retry is ever attempted)', async () => {
    let calls = 0;
    stubFetch(async () => {
      calls += 1;
      return new Response('ok', { status: 200 });
    });
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('hello'));
        controller.close();
      },
    });

    const response = await fetchWithLlmBackoff(
      'https://example.test/resource',
      { method: 'POST', body: stream, duplex: 'half' },
      { maxAttempts: 1 },
    );

    expect(response.status).toBe(200);
    expect(calls).toBe(1);
  });

  it('a string/Blob/Uint8Array body is treated as replayable and retries normally', async () => {
    const clock = createFakeClock();
    const sleep = createSleepRecorder(clock);
    let calls = 0;
    stubFetch(async () => {
      calls += 1;
      return new Response(null, {
        status: calls === 1 ? 429 : 200,
        headers: { 'retry-after': '1' },
      });
    });

    const response = await fetchWithLlmBackoff(
      'https://example.test/resource',
      { method: 'POST', body: 'plain text body' },
      { sleep: sleep.sleep, now: clock.nowFn },
    );

    expect(response.status).toBe(200);
    expect(calls).toBe(2);
  });

  it('a Request instance carrying its own stream body is refused the same way', async () => {
    stubFetch(async () => new Response('unreachable'));
    const stream = new ReadableStream({
      start(controller) {
        controller.close();
      },
    });
    const request = new Request('https://example.test/resource', {
      method: 'POST',
      body: stream,
      duplex: 'half',
    });

    await expect(fetchWithLlmBackoff(request)).rejects.toMatchObject({
      code: 'REQUEST_BODY_NOT_REPLAYABLE',
    });
  });
});

describe('fetchWithLlmBackoff — cancellation', () => {
  it('honors options.signal alone when init has no signal of its own', async () => {
    stubFetch(async () => new Response('ok', { status: 200 }));
    const controller = new AbortController();
    controller.abort(new Error('cancelled up front'));

    await expect(
      fetchWithLlmBackoff('https://example.test/resource', undefined, {
        signal: controller.signal,
      }),
    ).rejects.toThrow();
  });

  it('honors both options.signal and init.signal together', async () => {
    stubFetch(async () => new Response(null, { status: 429, headers: { 'retry-after': '1' } }));
    const optionsController = new AbortController();
    const initController = new AbortController();
    const clock = createFakeClock();
    const sleep = createSleepRecorder(clock);

    const promise = fetchWithLlmBackoff(
      'https://example.test/resource',
      { signal: initController.signal },
      { sleep: sleep.sleep, now: clock.nowFn, signal: optionsController.signal },
    );
    optionsController.abort(new Error('cancelled via options.signal'));

    await expect(promise).rejects.toThrow();
  });

  it('combines options.signal and init.signal: either aborting stops the retry', async () => {
    const clock = createFakeClock();
    const sleep = createSleepRecorder(clock);
    stubFetch(async () => new Response(null, { status: 429, headers: { 'retry-after': '1' } }));
    const controller = new AbortController();
    const reason = new Error('cancelled');

    const promise = fetchWithLlmBackoff(
      'https://example.test/resource',
      { signal: controller.signal },
      {
        sleep: sleep.sleep,
        now: clock.nowFn,
      },
    );
    controller.abort(reason);

    await expect(promise).rejects.toThrow();
  });
});

describe('fetchWithLlmBackoff — mid-operation abort', () => {
  // `fetch` itself is the only await point inside the operation callback, so
  // a signal firing "mid-operation" here means firing while the in-flight
  // `fetch(...)` call is pending — exactly the case native `fetch` uses for
  // custom abort reasons. `stubFetch` below abort the controller and then
  // rejects, simulating that without a real network call or a real timer.

  it('an options.signal custom Error reason surfaces unwrapped, identity preserved', async () => {
    const controller = new AbortController();
    const reason = new Error('user navigated away');
    stubFetch(async () => {
      controller.abort(reason);
      return Promise.reject(reason);
    });

    await expect(
      fetchWithLlmBackoff('https://example.test/resource', undefined, {
        signal: controller.signal,
      }),
    ).rejects.toBe(reason);
  });

  it('a non-Error abort reason is normalized to a DOMException named AbortError, never an LlmBackoffError', async () => {
    const controller = new AbortController();
    stubFetch(async () => {
      controller.abort('cancelled: navigated away');
      return Promise.reject(new Error('fetch-internal rejection, unrelated to the string reason'));
    });

    let caught: unknown;
    try {
      await fetchWithLlmBackoff('https://example.test/resource', undefined, {
        signal: controller.signal,
      });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(DOMException);
    expect((caught as DOMException).name).toBe('AbortError');
    expect(caught).not.toBeInstanceOf(LlmBackoffError);
  });

  it('AbortSignal.timeout()’s TimeoutError surfaces by name, unwrapped', async () => {
    const controller = new AbortController();
    const timeoutReason = new DOMException('The operation timed out.', 'TimeoutError');
    stubFetch(async () => {
      controller.abort(timeoutReason);
      return Promise.reject(timeoutReason);
    });

    let caught: unknown;
    try {
      await fetchWithLlmBackoff('https://example.test/resource', undefined, {
        signal: controller.signal,
      });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBe(timeoutReason);
    expect((caught as DOMException).name).toBe('TimeoutError');
  });

  it('the reason surfaced is the caller’s original object, not a synthetic one from combining options.signal and init.signal', async () => {
    // This is the case most likely to break: fetchWithLlmBackoff combines
    // options.signal and init.signal into one signal via combineSignals
    // before ever calling fetch. The identity contract must survive that
    // combination — the thrown value must be the *original* reason the
    // caller passed to abort(), not the combined AbortController's own.
    const optionsController = new AbortController();
    const initController = new AbortController();
    const reason = new Error('caller-specific cancellation reason');
    stubFetch(async (_input, init) => {
      // Simulate the signal firing mid-fetch and fetch rejecting with the
      // *combined* signal's reason, exactly like a real fetch would.
      initController.abort(reason);
      return Promise.reject((init?.signal as AbortSignal).reason);
    });

    await expect(
      fetchWithLlmBackoff(
        'https://example.test/resource',
        { signal: initController.signal },
        { signal: optionsController.signal },
      ),
    ).rejects.toBe(reason);
  });

  it('an unrelated fetch rejection racing the abort loses to the abort', async () => {
    const controller = new AbortController();
    const abortReason = new Error('cancelled by caller');
    const unrelatedFetchError = Object.assign(new Error('network error'), { code: 'ECONNRESET' });
    stubFetch(async () => {
      controller.abort(abortReason);
      return Promise.reject(unrelatedFetchError);
    });

    await expect(
      fetchWithLlmBackoff('https://example.test/resource', undefined, {
        signal: controller.signal,
      }),
    ).rejects.toBe(abortReason);
  });

  it('a retryable-status-shaped rejection racing an abort never reaches onRetry', async () => {
    const clock = createFakeClock();
    const sleep = createSleepRecorder(clock);
    const controller = new AbortController();
    const reason = new Error('cancelled mid-operation');
    let onRetryCalls = 0;
    stubFetch(async () => {
      controller.abort(reason);
      return Promise.reject(
        Object.assign(new Error('rate limited'), { status: 429, headers: { 'retry-after': '1' } }),
      );
    });

    await expect(
      fetchWithLlmBackoff('https://example.test/resource', undefined, {
        sleep: sleep.sleep,
        now: clock.nowFn,
        signal: controller.signal,
        onRetry: () => {
          onRetryCalls += 1;
        },
      }),
    ).rejects.toBe(reason);
    expect(onRetryCalls).toBe(0);
  });
});
