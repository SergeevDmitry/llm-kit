/**
 * Effective-date pricing-period selection — a thin wrapper over
 * `@llm-kit/model-registry`'s `selectPricingPeriod` that turns "no period
 * covers this date" into a thrown, stable error instead of a silent
 * `undefined` a caller could accidentally treat as zero cost — including a
 * lookup date that precedes the first known period for a model.
 *
 * Also passes `descriptor.canonicalId`/`descriptor.provider` through as
 * `selectPricingPeriod`'s optional identity argument — `selectPricingPeriod`
 * itself only ever sees a bare `PricingPeriod[]`, but this function already
 * holds the full descriptor, so a thrown `AmbiguousPricingPeriodError` (an
 * `effectiveFrom` tie in `descriptor.pricing`, reachable only through a
 * caller-supplied override that skipped `validateModelDescriptor`) names
 * which model's override is broken instead of just "some period tied."
 */
import {
  selectPricingPeriod,
  type ModelDescriptor,
  type PricingPeriod,
} from '@llm-kit/model-registry';
import { NoPricingPeriodError } from './errors.js';

export function selectPeriodOrThrow(descriptor: ModelDescriptor, at: Date | string): PricingPeriod {
  const period = selectPricingPeriod(descriptor.pricing ?? [], at, {
    canonicalId: descriptor.canonicalId,
    provider: descriptor.provider,
  });
  if (period === undefined) {
    const atLabel = at instanceof Date ? at.toISOString() : at;
    throw new NoPricingPeriodError(descriptor.canonicalId, descriptor.provider, atLabel);
  }
  return period;
}
