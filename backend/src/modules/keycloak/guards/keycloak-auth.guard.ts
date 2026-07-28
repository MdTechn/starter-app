import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthAuditEvent, IdentityProvider } from '@prisma/client';
import { Request } from 'express';
import { AppNotificationEvent } from '@saas-starter/shared';
import { IS_PUBLIC_KEY } from '../../../common/decorators/public.decorator';
import { AppLogger } from '../../../common/logger/app-logger.service';
import { NotificationDispatcher } from '../../../common/events/notification-dispatcher';
import { AuthenticatedUser } from '../../../common/types/authenticated-user';
import {
  extractClientIp,
  extractUserAgent,
} from '../../../common/utils/request-meta';
import { AuthAuditService } from '../../auth/auth-audit.service';
import {
  isJwtValidationError,
  JwtErrorCode,
} from '../errors/jwt-validation.error';
import { isUserSyncError, UserSyncErrorCode } from '../errors/user-sync.error';
import { KeycloakJwtService } from '../keycloak-jwt.service';
import { KeycloakUserSyncService } from '../keycloak-user-sync.service';

@Injectable()
export class KeycloakAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: KeycloakJwtService,
    private readonly userSyncService: KeycloakUserSyncService,
    private readonly audit: AuthAuditService,
    private readonly notifications: NotificationDispatcher,
    private readonly logger: AppLogger,
  ) {
    this.logger.setContext(KeycloakAuthGuard.name);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic || !this.jwtService.isEnabled()) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthenticatedUser }>();
    const ip = extractClientIp(request);
    const userAgent = extractUserAgent(request);
    const token = this.extractBearerToken(request);

    if (!token) {
      this.logger.warn(
        `Auth rejected: missing bearer token path=${request.url}`,
      );
      await this.safeAudit({
        event: AuthAuditEvent.LOGIN_FAILED,
        ip,
        userAgent,
        metadata: { reason: 'MISSING_TOKEN', path: request.url },
      });
      throw new UnauthorizedException({
        code: 'MISSING_TOKEN',
        message: 'Missing bearer token',
      });
    }

    let verifiedUser: AuthenticatedUser | undefined;

    try {
      verifiedUser = await this.jwtService.verifyToken(token);
      const sync = await this.userSyncService.syncUser(verifiedUser);
      request.user = verifiedUser;

      if (sync.loginEvent) {
        await this.safeAudit({
          event: sync.socialLogin
            ? AuthAuditEvent.SOCIAL_LOGIN
            : AuthAuditEvent.LOGIN_SUCCESS,
          userId: sync.user.id,
          provider: sync.provider,
          ip,
          userAgent,
          metadata: {
            created: sync.created,
            linked: sync.linked,
            sub: verifiedUser.sub,
            roles: verifiedUser.roles,
            identityProvider: verifiedUser.identityProvider,
            socialLogin: sync.socialLogin,
          },
        });
      }

      this.logger.debug(
        `Auth ok: sub=${verifiedUser.sub} roles=${verifiedUser.roles.join(',')} path=${request.url}`,
      );
      return true;
    } catch (err) {
      if (isUserSyncError(err)) {
        this.logger.warn(
          `Auth rejected (sync): code=${err.code} path=${request.url}`,
        );
        await this.safeAudit({
          event:
            err.code === UserSyncErrorCode.DISABLED ||
            err.code === UserSyncErrorCode.DELETED
              ? AuthAuditEvent.ACCOUNT_DISABLED
              : AuthAuditEvent.LOGIN_FAILED,
          ip,
          userAgent,
          metadata: { reason: err.code, path: request.url },
        });
        if (
          verifiedUser &&
          (err.code === UserSyncErrorCode.DISABLED ||
            err.code === UserSyncErrorCode.DELETED ||
            err.code === UserSyncErrorCode.SYNC_FAILED)
        ) {
          this.notifications.dispatch({
            eventType: AppNotificationEvent.LOGIN_SECURITY,
            email: verifiedUser.email,
            userId: verifiedUser.userId,
            data: {
              email: verifiedUser.email,
              reason: err.code,
              ip,
            },
          });
        }
        throw err.toHttpException();
      }

      if (isJwtValidationError(err)) {
        this.logger.warn(
          `Auth rejected (jwt): code=${err.code} path=${request.url}`,
        );
        await this.safeAudit({
          event: AuthAuditEvent.LOGIN_FAILED,
          ip,
          userAgent,
          metadata: { reason: err.code, path: request.url },
        });
        throw new UnauthorizedException({
          code: err.code,
          message: this.publicJwtMessage(err.code),
        });
      }

      this.logger.warn(
        `Auth rejected: ${err instanceof Error ? err.message : 'unknown'} path=${request.url}`,
      );
      await this.safeAudit({
        event: AuthAuditEvent.LOGIN_FAILED,
        ip,
        userAgent,
        metadata: { reason: 'UNKNOWN', path: request.url },
      });
      throw new UnauthorizedException({
        code: JwtErrorCode.INVALID_TOKEN,
        message: 'Invalid or expired token',
      });
    }
  }

  private extractBearerToken(request: Request): string | undefined {
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      return undefined;
    }
    return header.slice(7).trim() || undefined;
  }

  private publicJwtMessage(code: JwtErrorCode): string {
    switch (code) {
      case JwtErrorCode.EXPIRED:
        return 'Token has expired';
      case JwtErrorCode.INVALID_ISSUER:
        return 'Invalid token issuer';
      case JwtErrorCode.INVALID_AUDIENCE:
        return 'Invalid token audience';
      case JwtErrorCode.INVALID_AZP:
        return 'Invalid authorized party';
      case JwtErrorCode.NOT_CONFIGURED:
        return 'Authentication is not configured';
      default:
        return 'Invalid or expired token';
    }
  }

  private async safeAudit(
    input: Parameters<AuthAuditService['record']>[0],
  ): Promise<void> {
    try {
      await this.audit.record({
        provider: IdentityProvider.KEYCLOAK,
        ...input,
      });
    } catch (err) {
      this.logger.error(
        'Failed to persist auth audit log',
        err instanceof Error ? err.stack : undefined,
      );
    }
  }
}
