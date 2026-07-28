import { Injectable } from '@nestjs/common';
import { IdentityProvider, Role, User, UserStatus } from '@prisma/client';
import { AppNotificationEvent } from '@saas-starter/shared';
import {
  mapKeycloakRolesToAppRoles,
  UserRole,
} from '@saas-starter/shared/auth';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AppLogger } from '../../common/logger/app-logger.service';
import { NotificationDispatcher } from '../../common/events/notification-dispatcher';
import { AuthenticatedUser } from '../../common/types/authenticated-user';
import { UserSyncError, UserSyncErrorCode } from './errors/user-sync.error';
import {
  isSocialIdentityProvider,
  resolveIdentityProvider,
} from './identity-provider.util';

/** Re-login audit window: avoid LOGIN_SUCCESS / SOCIAL_LOGIN on every API call. */
const LOGIN_EVENT_WINDOW_MS = 30 * 60 * 1000;

export type UserSyncResult = {
  user: User;
  created: boolean;
  /** True when an existing Prisma user was linked by email to a new Keycloak sub. */
  linked: boolean;
  loginEvent: boolean;
  provider: IdentityProvider;
  socialLogin: boolean;
};

@Injectable()
export class KeycloakUserSyncService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: AppLogger,
    private readonly notifications: NotificationDispatcher,
  ) {
    this.logger.setContext(KeycloakUserSyncService.name);
  }

  /**
   * Create on first login, update profile on subsequent logins.
   * Links existing email account when Keycloak broker creates a new sub.
   * Rejects DISABLED / soft-DELETED accounts.
   */
  async syncUser(authUser: AuthenticatedUser): Promise<UserSyncResult> {
    const roles = this.toPrismaRoles(authUser.roles);
    const provider = resolveIdentityProvider(authUser.identityProvider);
    const socialLogin = isSocialIdentityProvider(provider);
    const profile = this.profileData(authUser, roles, provider);

    const existing = await this.prisma.user.findUnique({
      where: { keycloakSub: authUser.sub },
    });

    if (existing) {
      this.assertActive(existing);
      const loginEvent = this.shouldRecordLogin(existing.lastLoginAt);

      const user = await this.prisma.user.update({
        where: { keycloakSub: authUser.sub },
        data: {
          ...profile,
          ...(loginEvent ? { lastLoginAt: new Date() } : {}),
        },
      });

      authUser.userId = user.id;
      this.logger.log(
        `User synced (update): sub=${authUser.sub} email=${authUser.email} provider=${provider} roles=${roles.join(',')}`,
      );
      return {
        user,
        created: false,
        linked: false,
        loginEvent,
        provider,
        socialLogin,
      };
    }

    const byEmail = await this.prisma.user.findUnique({
      where: { email: authUser.email },
    });

    if (byEmail) {
      this.assertActive(byEmail);
      const loginEvent = this.shouldRecordLogin(byEmail.lastLoginAt);

      const user = await this.prisma.user.update({
        where: { id: byEmail.id },
        data: {
          keycloakSub: authUser.sub,
          ...profile,
          ...(loginEvent ? { lastLoginAt: new Date() } : {}),
        },
      });

      authUser.userId = user.id;
      this.logger.log(
        `User synced (email link): id=${user.id} sub=${authUser.sub} email=${authUser.email} provider=${provider}`,
      );
      return {
        user,
        created: false,
        linked: true,
        loginEvent: true,
        provider,
        socialLogin,
      };
    }

    try {
      const user = await this.prisma.user.create({
        data: {
          keycloakSub: authUser.sub,
          status: UserStatus.ACTIVE,
          lastLoginAt: new Date(),
          ...profile,
        },
      });

      authUser.userId = user.id;
      this.logger.log(
        `User synced (create): sub=${authUser.sub} email=${authUser.email} provider=${provider} roles=${roles.join(',')}`,
      );
      this.notifications.dispatch({
        eventType: AppNotificationEvent.USER_CREATED,
        userId: user.id,
        email: user.email,
        data: {
          email: user.email,
          name: user.name ?? user.email,
        },
      });
      return {
        user,
        created: true,
        linked: false,
        loginEvent: true,
        provider,
        socialLogin,
      };
    } catch (err) {
      const raced = await this.prisma.user.findUnique({
        where: { keycloakSub: authUser.sub },
      });
      if (raced) {
        this.assertActive(raced);
        const loginEvent = this.shouldRecordLogin(raced.lastLoginAt);
        const user = await this.prisma.user.update({
          where: { id: raced.id },
          data: {
            ...profile,
            ...(loginEvent ? { lastLoginAt: new Date() } : {}),
          },
        });
        authUser.userId = user.id;
        return {
          user,
          created: false,
          linked: false,
          loginEvent,
          provider,
          socialLogin,
        };
      }

      const racedEmail = await this.prisma.user.findUnique({
        where: { email: authUser.email },
      });
      if (racedEmail) {
        this.assertActive(racedEmail);
        const user = await this.prisma.user.update({
          where: { id: racedEmail.id },
          data: {
            keycloakSub: authUser.sub,
            ...profile,
            lastLoginAt: new Date(),
          },
        });
        authUser.userId = user.id;
        return {
          user,
          created: false,
          linked: true,
          loginEvent: true,
          provider,
          socialLogin,
        };
      }

      this.logger.error(
        `User sync failed for sub=${authUser.sub}`,
        err instanceof Error ? err.stack : undefined,
      );
      throw new UserSyncError(
        UserSyncErrorCode.SYNC_FAILED,
        'Failed to synchronize user from Keycloak',
      );
    }
  }

  /** Soft-delete when IdP user is removed (admin / reconciliation). */
  async markDeleted(keycloakSub: string): Promise<User | null> {
    const user = await this.prisma.user.findUnique({
      where: { keycloakSub },
    });
    if (!user) return null;

    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: { status: UserStatus.DELETED },
    });
    this.logger.warn(`User marked DELETED (IdP removed): sub=${keycloakSub}`);
    return updated;
  }

  async markDisabled(keycloakSub: string): Promise<User | null> {
    const user = await this.prisma.user.findUnique({
      where: { keycloakSub },
    });
    if (!user) return null;

    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: { status: UserStatus.DISABLED },
    });
    this.logger.warn(`User marked DISABLED: sub=${keycloakSub}`);
    return updated;
  }

  async markActive(keycloakSub: string): Promise<User | null> {
    const user = await this.prisma.user.findUnique({
      where: { keycloakSub },
    });
    if (!user) return null;

    return this.prisma.user.update({
      where: { id: user.id },
      data: { status: UserStatus.ACTIVE },
    });
  }

  private profileData(
    authUser: AuthenticatedUser,
    roles: Role[],
    provider: IdentityProvider,
  ) {
    const composedName = [authUser.firstName, authUser.lastName]
      .filter(Boolean)
      .join(' ');
    const name = authUser.name ?? (composedName || undefined);

    return {
      email: authUser.email,
      name,
      firstName: authUser.firstName,
      lastName: authUser.lastName,
      avatarUrl: authUser.avatarUrl,
      roles,
      provider,
    };
  }

  private shouldRecordLogin(lastLoginAt: Date | null | undefined): boolean {
    if (!lastLoginAt) return true;
    return Date.now() - lastLoginAt.getTime() > LOGIN_EVENT_WINDOW_MS;
  }

  private assertActive(user: User): void {
    if (user.status === UserStatus.DISABLED) {
      this.logger.warn(`Login rejected — DISABLED: sub=${user.keycloakSub}`);
      throw new UserSyncError(
        UserSyncErrorCode.DISABLED,
        'User account is disabled',
      );
    }
    if (user.status === UserStatus.DELETED) {
      this.logger.warn(`Login rejected — DELETED: sub=${user.keycloakSub}`);
      throw new UserSyncError(
        UserSyncErrorCode.DELETED,
        'User account has been deleted',
      );
    }
  }

  private toPrismaRoles(tokenOrAppRoles: string[]): Role[] {
    const appRoles = mapKeycloakRolesToAppRoles(tokenOrAppRoles);
    // ADMIN first when present (Keycloak admin assignment takes priority).
    if (appRoles.includes(UserRole.ADMIN)) {
      return [Role.ADMIN, Role.USER];
    }
    return [Role.USER];
  }
}
