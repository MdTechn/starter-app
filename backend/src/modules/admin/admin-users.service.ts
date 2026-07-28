import { Injectable, BadRequestException } from '@nestjs/common';
import {
  AuthAuditEvent,
  IdentityProvider,
  Role,
  User,
  UserStatus,
} from '@prisma/client';
import {
  getPermissionsForRoles,
  mapKeycloakRolesToAppRoles,
  UserRole,
} from '@saas-starter/shared';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AppLogger } from '../../common/logger/app-logger.service';
import { AuthAuditService } from '../auth/auth-audit.service';
import { UsersService } from '../users/users.service';
import { ListUsersQueryDto } from '../users/dto/users.dto';

@Injectable()
export class AdminUsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly audit: AuthAuditService,
    private readonly logger: AppLogger,
  ) {
    this.logger.setContext(AdminUsersService.name);
  }

  listUsers(query: ListUsersQueryDto = {}) {
    return this.users.list(query);
  }

  async getUser(id: string) {
    const user = await this.users.findById(id, true);
    return {
      ...user,
      permissions: getPermissionsForRoles(user.roles.map((r) => r as UserRole)),
    };
  }

  async disableUser(id: string, actorUserId?: string): Promise<User> {
    const user = await this.users.requireUser(id);
    if (user.status === UserStatus.DISABLED) {
      return user;
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: { status: UserStatus.DISABLED },
    });

    await this.audit.record({
      event: AuthAuditEvent.ACCOUNT_DISABLED,
      userId: updated.id,
      provider: IdentityProvider.KEYCLOAK,
      metadata: { action: 'disable', by: actorUserId ?? null },
    });

    this.logger.warn(`IAM disable user id=${id} by=${actorUserId ?? 'system'}`);
    return updated;
  }

  async enableUser(id: string, actorUserId?: string): Promise<User> {
    const user = await this.users.requireUser(id, true);
    if (user.status === UserStatus.ACTIVE) {
      return user;
    }
    if (user.status === UserStatus.DELETED) {
      throw new BadRequestException(
        'Cannot enable a deleted user — reactivate via IdP sync first',
      );
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: { status: UserStatus.ACTIVE },
    });

    this.logger.log(`IAM enable user id=${id} by=${actorUserId ?? 'system'}`);
    return updated;
  }

  /** Soft-delete local row when Keycloak user was removed. */
  async markDeletedFromIdp(id: string, actorUserId?: string): Promise<User> {
    const user = await this.users.requireUser(id, true);
    const updated = await this.prisma.user.update({
      where: { id },
      data: { status: UserStatus.DELETED },
    });

    await this.audit.record({
      event: AuthAuditEvent.ACCOUNT_DISABLED,
      userId: updated.id,
      provider: IdentityProvider.KEYCLOAK,
      metadata: {
        action: 'deleted_from_idp',
        by: actorUserId ?? null,
        keycloakSub: user.keycloakSub,
      },
    });

    this.logger.warn(
      `IAM mark deleted (IdP removed) id=${id} sub=${user.keycloakSub}`,
    );
    return updated;
  }

  async setRoles(
    id: string,
    roles: UserRole[],
    actorUserId?: string,
  ): Promise<User> {
    await this.users.requireUser(id);
    const normalized = mapKeycloakRolesToAppRoles(roles);
    const prismaRoles = normalized.includes(UserRole.ADMIN)
      ? [Role.ADMIN, Role.USER]
      : [Role.USER];

    const updated = await this.prisma.user.update({
      where: { id },
      data: { roles: prismaRoles },
    });

    this.logger.log(
      `IAM set roles id=${id} roles=${prismaRoles.join(',')} by=${actorUserId ?? 'system'}`,
    );
    return updated;
  }

  listRolePermissions() {
    return {
      roles: Object.values(UserRole),
      mapping: {
        [UserRole.USER]: getPermissionsForRoles([UserRole.USER]),
        [UserRole.ADMIN]: getPermissionsForRoles([UserRole.ADMIN]),
      },
    };
  }
}
