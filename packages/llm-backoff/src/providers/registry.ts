/**
 * Every provider profile in one place, plus `'auto'` detection.
 */
import { anthropicProfile } from './anthropic.js';
import { googleProfile } from './google.js';
import { openaiProfile } from './openai.js';
import type { ProviderProfile } from './types.js';
import type { ProviderId } from '../types.js';

export const PROVIDER_PROFILES: Readonly<Record<ProviderId, ProviderProfile>> = {
  openai: openaiProfile,
  anthropic: anthropicProfile,
  google: googleProfile,
};

function isProviderId(value: string): value is ProviderId {
  return value === 'openai' || value === 'anthropic' || value === 'google';
}

/** Detects a provider from which reset headers are actually present, for `provider: 'auto'`. */
export function detectProvider(headerNames: ReadonlySet<string>): ProviderId | undefined {
  for (const profile of Object.values(PROVIDER_PROFILES)) {
    if (profile.detectHeaderNames.some((name) => headerNames.has(name))) {
      return profile.id;
    }
  }
  return undefined;
}

/**
 * Resolves the profile to apply. `undefined` or `'auto'` detects from the
 * headers present; an explicit `ProviderId` forces that profile even if its
 * detection headers are absent (its `rules` will simply find nothing to
 * match); any other string is treated as an unrecognized provider — no
 * profile, so only `Retry-After` and the generic tier apply.
 */
export function resolveProviderProfile(
  provider: ProviderId | 'auto' | string | undefined,
  headerNames: ReadonlySet<string>,
): ProviderProfile | undefined {
  if (provider === undefined || provider === 'auto') {
    const detected = detectProvider(headerNames);
    return detected === undefined ? undefined : PROVIDER_PROFILES[detected];
  }
  return isProviderId(provider) ? PROVIDER_PROFILES[provider] : undefined;
}
