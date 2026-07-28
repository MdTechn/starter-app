import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { BillingPlanId } from '@saas-starter/shared';
import { REQUIRES_PLAN_KEY } from '../../../common/decorators/requires-plan.decorator';
import { AuthenticatedUser } from '../../../common/types/authenticated-user';
import { FeatureAccessService } from '../feature-access.service';

@Injectable()
export class PlanAccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly features: FeatureAccessService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<BillingPlanId[]>(
      REQUIRES_PLAN_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!required?.length) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<{ user?: AuthenticatedUser }>();
    const user = request.user;

    if (!user?.userId) {
      throw new ForbiddenException({
        code: 'AUTH_REQUIRED',
        message: 'Authenticated user required',
      });
    }

    const planId = await this.features.getActivePlanId(user.userId);
    if (!planId || !required.includes(planId as BillingPlanId)) {
      throw new ForbiddenException({
        code: 'PLAN_REQUIRED',
        message: `Active plan must be one of: ${required.join(', ')}`,
        required,
        current: planId,
      });
    }

    return true;
  }
}
