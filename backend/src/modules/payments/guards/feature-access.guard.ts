import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { PlanFeature } from '@saas-starter/shared';
import { REQUIRES_FEATURE_KEY } from '../../../common/decorators/requires-feature.decorator';
import { AuthenticatedUser } from '../../../common/types/authenticated-user';
import { FeatureAccessService } from '../feature-access.service';

@Injectable()
export class FeatureAccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly features: FeatureAccessService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<PlanFeature[]>(
      REQUIRES_FEATURE_KEY,
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

    for (const feature of required) {
      const allowed = await this.features.canAccessFeature(
        user.userId,
        feature,
      );
      if (!allowed) {
        throw new ForbiddenException({
          code: 'FEATURE_NOT_AVAILABLE',
          message: `Plan does not include feature: ${feature}`,
          required: required,
          feature,
        });
      }
    }

    return true;
  }
}
