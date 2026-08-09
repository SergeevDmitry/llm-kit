/**
 * Anthropic reset-header profile.
 *
 * `anthropic-ratelimit-{requests,tokens,input-tokens,output-tokens}-reset`
 * are documented as RFC 3339 timestamps (e.g. `"2024-01-01T00:00:00Z"`) —
 * absolute, never a duration — so interpreting them requires a clock
 * (`ParseHeadersOptions.now`) but no unit guessing: the format is fixed by
 * the header name itself.
 */
import type { ProviderProfile } from './types.js';

export const anthropicProfile: ProviderProfile = {
  id: 'anthropic',
  detectHeaderNames: [
    'anthropic-ratelimit-requests-reset',
    'anthropic-ratelimit-tokens-reset',
    'anthropic-ratelimit-input-tokens-reset',
    'anthropic-ratelimit-output-tokens-reset',
  ],
  rules: [
    {
      headerName: 'anthropic-ratelimit-requests-reset',
      resource: 'requests',
      format: 'iso-timestamp',
    },
    { headerName: 'anthropic-ratelimit-tokens-reset', resource: 'tokens', format: 'iso-timestamp' },
    {
      headerName: 'anthropic-ratelimit-input-tokens-reset',
      resource: 'input-tokens',
      format: 'iso-timestamp',
    },
    {
      headerName: 'anthropic-ratelimit-output-tokens-reset',
      resource: 'output-tokens',
      format: 'iso-timestamp',
    },
  ],
};
