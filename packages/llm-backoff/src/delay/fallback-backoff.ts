/**
 * The bottom tier of delay selection: used only when no header produced a
 * usable delay. Bounded exponential backoff with full jitter — the delay is
 * drawn uniformly from `[0, cap]`, where `cap` doubles every attempt up to
 * `maxDelayMs`. This is the *only* place `random` is ever consulted; an
 * explicit server delay is honored exactly and never jittered.
 */
import { MIN_FALLBACK_DELAY_MS } from '../defaults.js';

export interface FallbackBackoffParams {
  /** 1-based: the attempt that just failed. */
  readonly attempt: number;
  readonly baseDelayMs: number;
  readonly maxDelayMs: number;
  readonly random: () => number;
}

export function computeFallbackDelayMs(params: FallbackBackoffParams): number {
  const cap = Math.min(params.maxDelayMs, params.baseDelayMs * 2 ** (params.attempt - 1));
  const jittered = Math.floor(params.random() * cap);
  // Floor: a baseDelayMs:0/maxDelayMs:0 configuration must still yield
  // control between attempts rather than spinning in the same tick — see
  // benchmarks/llm-backoff.bench.ts, "zero-delay retry loop safeguard".
  return Math.max(MIN_FALLBACK_DELAY_MS, jittered);
}
