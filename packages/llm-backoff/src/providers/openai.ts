/**
 * OpenAI (and OpenAI-compatible gateways: Azure OpenAI, many self-hosted
 * proxies) reset-header profile.
 *
 * `x-ratelimit-reset-requests` and `x-ratelimit-reset-tokens` are the exact
 * header names this package supports at minimum, and OpenAI documents their
 * value as a Go-style duration string — `"1s"`,
 * `"6m0s"`, `"12ms"` — never an epoch or absolute timestamp. That documented
 * format is what makes this profile safe to apply automatically under
 * `provider: 'auto'` whenever these exact header names are present: we are
 * not guessing a unit, we are applying the one format this header name is
 * known to use.
 */
import type { ProviderProfile } from './types.js';

export const openaiProfile: ProviderProfile = {
  id: 'openai',
  detectHeaderNames: [
    'x-ratelimit-reset-requests',
    'x-ratelimit-reset-tokens',
    'x-ratelimit-limit-requests',
    'x-ratelimit-limit-tokens',
  ],
  rules: [
    { headerName: 'x-ratelimit-reset-requests', resource: 'requests', format: 'duration' },
    { headerName: 'x-ratelimit-reset-tokens', resource: 'tokens', format: 'duration' },
  ],
};
