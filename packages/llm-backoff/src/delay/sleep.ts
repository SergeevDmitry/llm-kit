/**
 * Default `sleep` implementation, used when `LlmBackoffOptions.sleep` is not
 * supplied. Platform timers only (`setTimeout`/`clearTimeout` are globals in
 * Node 20+, browsers, and Bun) — no `node:timers` import, so this stays
 * browser-safe. Tests must inject `createSleepRecorder` from
 * `@llm-kit/test-utils` instead of using this.
 */
import { toAbortError } from '../abort-utils.js';
import { MAX_SAFE_TIMEOUT_MS } from '../defaults.js';

/** A single `setTimeout`, never longer than `MAX_SAFE_TIMEOUT_MS`. */
function sleepOnce(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const onAbort = (): void => {
      clearTimeout(timer);
      reject(toAbortError(signal?.reason));
    };

    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);

    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/**
 * A delay past `MAX_SAFE_TIMEOUT_MS` (~24.8 days, `2^31 - 1`ms) overflows
 * `setTimeout`'s 32-bit signed-integer argument; Node and browsers respond by
 * clamping it to `1`ms and firing *immediately* rather than waiting or
 * throwing. This package deliberately never caps a header-derived delay (see
 * `MAX_SAFE_TIMEOUT_MS`'s doc comment in `../defaults.ts`), so a caller who
 * raises `maxElapsedMs` enough to admit one is reachable in practice, not
 * hypothetical. Chaining timers here — rather than clamping the requested
 * duration down to `MAX_SAFE_TIMEOUT_MS` — honors the exact requested delay
 * end to end instead of quietly shortening a server-mandated wait, which
 * would ignore explicit server rate-limit timing.
 */
export async function defaultSleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted === true) {
    throw toAbortError(signal.reason);
  }

  let remaining = ms;
  while (remaining > MAX_SAFE_TIMEOUT_MS) {
    await sleepOnce(MAX_SAFE_TIMEOUT_MS, signal);
    remaining -= MAX_SAFE_TIMEOUT_MS;
  }
  return sleepOnce(remaining, signal);
}
