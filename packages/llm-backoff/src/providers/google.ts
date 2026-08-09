/**
 * Google (Gemini API) reset-header profile.
 *
 * Deliberately empty. At the time of writing, Google does not publish a
 * documented `x-ratelimit-reset-*`-style header with a confirmed format the
 * way OpenAI and Anthropic do — only `Retry-After`, which every provider
 * already gets through `delay/retry-after.ts` regardless of `provider`.
 * Recognizing every undocumented provider header is an explicit non-goal, and
 * this profile is what that looks like for Google: nothing, rather than a
 * guess at a header shape nobody has confirmed. If Google documents one, add
 * it here the same way
 * `openai.ts`/`anthropic.ts` do — never infer a format from an observed raw
 * value alone.
 */
import type { ProviderProfile } from './types.js';

export const googleProfile: ProviderProfile = {
  id: 'google',
  detectHeaderNames: [],
  rules: [],
};
