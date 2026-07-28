import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@saas-starter/shared/auth';
import { ROLES_KEY } from '../../../common/decorators/roles.decorator';
import { AuthenticatedUser } from '../../../common/types/authenticated-user';
import { KeycloakJwtService } from '../keycloak-jwt.service';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: KeycloakJwtService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles?.length || !this.jwtService.isEnabled()) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<{ user?: AuthenticatedUser }>();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException({
        code: 'AUTH_REQUIRED',
        message: 'Authenticated user required',
      });
    }

    const userRoles = new Set(user.roles.map((r) => r.toUpperCase()));
    const hasRole = requiredRoles.some((role) => userRoles.has(role));
    if (!hasRole) {
      throw new ForbiddenException({
        code: 'INSUFFICIENT_ROLE',
        message: 'Insufficient role',
        required: requiredRoles,
      });
    }

    return true;
  }
}
