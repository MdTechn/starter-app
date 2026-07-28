import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  hasAnyPermission,
  Permission,
  UserRole,
} from '@saas-starter/shared/auth';
import { PERMISSIONS_KEY } from '../../../common/decorators/permissions.decorator';
import { AuthenticatedUser } from '../../../common/types/authenticated-user';
import { KeycloakJwtService } from '../keycloak-jwt.service';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: KeycloakJwtService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Permission[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!required?.length || !this.jwtService.isEnabled()) {
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

    const owned = new Set(user.permissions ?? []);
    const roles = user.roles as UserRole[];
    const ok =
      required.some((p) => owned.has(p)) || hasAnyPermission(roles, required);

    if (!ok) {
      throw new ForbiddenException({
        code: 'INSUFFICIENT_PERMISSION',
        message: 'Insufficient permission',
        required,
      });
    }

    return true;
  }
}
