/**
 * Internal shape for a provider's header profile. Not part of the public
 * surface — `providers/registry.ts` is the only consumer outside this
 * directory.
 */
import type { ProviderId, RateLimitResource } from '../types.js';

/**
 * Formats a *shipped* provider profile currently binds a header to.
 * `parseEpochSeconds`/`parseEpochMilliseconds` (`../delay/reset-value.ts`)
 * exist and are directly tested — epoch-seconds/epoch-milliseconds support
 * is only meant to apply when a provider profile specifies that
 * interpretation — but no current profile does, so they are deliberately
 * not wired into a `ProviderHeaderRule` here. Add the format here alongside
 * a real profile rule when one is confirmed, rather than carrying an
 * unreachable branch.
 */
export type ProviderHeaderFormat = 'duration' | 'iso-timestamp';

export interface ProviderHeaderRule {
  /** Canonical lowercase header name this rule reads. */
  readonly headerName: string;
  readonly resource: RateLimitResource;
  readonly format: ProviderHeaderFormat;
}

export interface ProviderProfile {
  readonly id: ProviderId;
  /** Reset-header rules this provider defines. Empty is valid — see `google.ts`. */
  readonly rules: readonly ProviderHeaderRule[];
  /**
   * Header names (lowercase) whose mere presence identifies this provider,
   * used only when `provider` is `'auto'` or omitted.
   */
  readonly detectHeaderNames: readonly string[];
}
