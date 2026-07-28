import { Test, TestingModule } from '@nestjs/testing';
import {
  AuthAuditEvent,
  IdentityProvider,
  Role,
  UserStatus,
} from '@prisma/client';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Permission, UserRole } from '@saas-starter/shared';
import { AdminUsersService } from './admin-users.service';
import { UsersService } from '../users/users.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuthAuditService } from '../auth/auth-audit.service';
import { AppLogger } from '../../common/logger/app-logger.service';

describe('AdminUsersService', () => {
  let service: AdminUsersService;
  let prisma: {
    user: {
      update: jest.Mock;
    };
  };
  let users: {
    list: jest.Mock;
    findById: jest.Mock;
    requireUser: jest.Mock;
  };
  let audit: { record: jest.Mock };

  const activeUser = {
    id: 'u1',
    email: 'user@example.com',
    keycloakSub: 'kc-1',
    roles: [Role.USER],
    status: UserStatus.ACTIVE,
    provider: IdentityProvider.KEYCLOAK,
  };

  beforeEach(async () => {
    prisma = {
      user: {
        update: jest.fn(),
      },
    };
    users = {
      list: jest.fn().mockResolvedValue({
        items: [activeUser],
        total: 1,
        page: 1,
        pageSize: 20,
        totalPages: 1,
      }),
      findById: jest.fn().mockResolvedValue(activeUser),
      requireUser: jest.fn().mockResolvedValue(activeUser),
    };
    audit = { record: jest.fn().mockResolvedValue({}) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminUsersService,
        { provide: PrismaService, useValue: prisma },
        { provide: UsersService, useValue: users },
        { provide: AuthAuditService, useValue: audit },
        {
          provide: AppLogger,
          useValue: {
            setContext: jest.fn(),
            log: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(AdminUsersService);
  });

  it('lists users via UsersService', async () => {
    const result = await service.listUsers({ q: 'user' });
    expect(users.list).toHaveBeenCalledWith({ q: 'user' });
    expect(result.total).toBe(1);
  });

  it('returns user with resolved permissions', async () => {
    users.findById.mockResolvedValue({
      ...activeUser,
      roles: [Role.USER, Role.ADMIN],
    });
    const result = await service.getUser('u1');
    expect(result.permissions).toContain(Permission.IAM_MANAGE);
  });

  it('disables an active user and audits ACCOUNT_DISABLED', async () => {
    prisma.user.update.mockResolvedValue({
      ...activeUser,
      status: UserStatus.DISABLED,
    });

    const result = await service.disableUser('u1', 'admin-1');
    expect(result.status).toBe(UserStatus.DISABLED);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        event: AuthAuditEvent.ACCOUNT_DISABLED,
        userId: 'u1',
      }),
    );
  });

  it('enables a disabled user', async () => {
    users.requireUser.mockResolvedValue({
      ...activeUser,
      status: UserStatus.DISABLED,
    });
    prisma.user.update.mockResolvedValue(activeUser);

    const result = await service.enableUser('u1', 'admin-1');
    expect(result.status).toBe(UserStatus.ACTIVE);
  });

  it('rejects enabling a deleted user', async () => {
    users.requireUser.mockResolvedValue({
      ...activeUser,
      status: UserStatus.DELETED,
    });

    await expect(service.enableUser('u1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('marks user deleted from IdP', async () => {
    prisma.user.update.mockResolvedValue({
      ...activeUser,
      status: UserStatus.DELETED,
    });

    const result = await service.markDeletedFromIdp('u1', 'admin-1');
    expect(result.status).toBe(UserStatus.DELETED);
    expect(audit.record).toHaveBeenCalled();
  });

  it('sets roles and exposes permission mapping', async () => {
    prisma.user.update.mockResolvedValue({
      ...activeUser,
      roles: [Role.USER, Role.ADMIN],
    });

    await service.setRoles('u1', [UserRole.ADMIN], 'admin-1');
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { roles: expect.arrayContaining([Role.USER, Role.ADMIN]) },
      }),
    );

    const mapping = service.listRolePermissions();
    expect(mapping.mapping[UserRole.ADMIN]).toContain(Permission.IAM_MANAGE);
    expect(mapping.mapping[UserRole.ADMIN]).toContain(Permission.USERS_INVITE);
  });

  it('throws when user is missing', async () => {
    users.findById.mockRejectedValue(new NotFoundException('User not found'));
    await expect(service.getUser('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
