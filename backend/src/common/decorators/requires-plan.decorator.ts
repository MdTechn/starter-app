import { SetMetadata } from '@nestjs/common';
import type { BillingPlanId } from '@saas-starter/shared';

export const REQUIRES_PLAN_KEY = 'requires_plan';

/**
 * Requires an active subscription on one of the listed plans.
 * Checked by PlanAccessGuard (no-op when metadata is absent).
 */
export const RequiresPlan = (...plans: BillingPlanId[]) =>
  SetMetadata(REQUIRES_PLAN_KEY, plans);
