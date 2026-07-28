import { SetMetadata } from '@nestjs/common';
import type { PlanFeature } from '@saas-starter/shared';

export const REQUIRES_FEATURE_KEY = 'requires_feature';

/**
 * Requires an active subscription plan that includes all listed features.
 * Checked by FeatureAccessGuard (no-op when metadata is absent).
 */
export const RequiresFeature = (...features: PlanFeature[]) =>
  SetMetadata(REQUIRES_FEATURE_KEY, features);
