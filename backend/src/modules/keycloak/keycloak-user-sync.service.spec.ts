import { Test, TestingModule } from '@nestjs/testing';
import { IdentityProvider, Role, UserStatus } from '@prisma/client';
import { KeycloakUserSyncService } from './keycloak-user-sync.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AppLogger } from '../../common/logger/app-logger.service';
import { NotificationDispatcher } from '../../common/events/notification-dispatcher';
import { AuthenticatedUser } from '../../common/types/authenticated-user';
import { UserSyncError, UserSyncErrorCode } from './errors/user-sync.error';

describe('KeycloakUserSyncService', () => {
  let service: KeycloakUserSyncService;
  let prisma: {
    user: {
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
  };
  let notifications: { dispatch: jest.Mock };

  const logger = {
    setContext: jest.fn(),
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };
    notifications = { dispatch: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KeycloakUserSyncService,
        { provide: PrismaService, useValue: prisma },
        { provide: NotificationDispatcher, useValue: notifications },
        { provide: AppLogger, useValue: logger },
      ],
    }).compile();

    service = module.get(KeycloakUserSyncService);
  });

  const authUser = (
    overrides: Partial<AuthenticatedUser> = {},
  ): AuthenticatedUser => ({
    sub: 'kc-1',
    email: 'admin@example.com',
    name: 'Admin',
    roles: ['ADMIN', 'USER'],
    permissions: [],
    ...overrides,
  });

  it('creates user on first login with loginEvent', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({
      id: 'u1',
      keycloakSub: 'kc-1',
      email: 'admin@example.com',
      roles: [Role.ADMIN, Role.USER],
      status: UserStatus.ACTIVE,
      provider: IdentityProvider.KEYCLOAK,
    });

    const result = await service.syncUser(authUser());
    expect(result.created).toBe(true);
    expect(result.loginEvent).toBe(true);
    expect(result.socialLogin).toBe(false);
    expect(result.provider).toBe(IdentityProvider.KEYCLOAK);
    expect(result.user.id).toBe('u1');
  });

  it('creates social user with GOOGLE provider and profile fields', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({
      id: 'u2',
      keycloakSub: 'kc-google',
      email: 'social@example.com',
      provider: IdentityProvider.GOOGLE,
      firstName: 'Soc',
      lastName: 'User',
      avatarUrl: 'https://lh3.googleusercontent.com/a/x',
    });

    const result = await service.syncUser(
      authUser({
        sub: 'kc-google',
        email: 'social@example.com',
        identityProvider: 'google',
        firstName: 'Soc',
        lastName: 'User',
        avatarUrl: 'https://lh3.googleusercontent.com/a/x',
        roles: ['USER'],
      }),
    );

    expect(result.created).toBe(true);
    expect(result.socialLogin).toBe(true);
    expect(result.provider).toBe(IdentityProvider.GOOGLE);
    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          provider: IdentityProvider.GOOGLE,
          firstName: 'Soc',
          lastName: 'User',
          avatarUrl: 'https://lh3.googleusercontent.com/a/x',
        }),
      }),
    );
  });

  it('creates social user with APPLE provider', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({
      id: 'u-apple',
      keycloakSub: 'kc-apple',
      email: 'apple@example.com',
      provider: IdentityProvider.APPLE,
      firstName: 'A',
      lastName: 'User',
    });

    const result = await service.syncUser(
      authUser({
        sub: 'kc-apple',
        email: 'apple@example.com',
        identityProvider: 'apple',
        firstName: 'A',
        lastName: 'User',
        roles: ['USER'],
      }),
    );

    expect(result.created).toBe(true);
    expect(result.socialLogin).toBe(true);
    expect(result.provider).toBe(IdentityProvider.APPLE);
    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          provider: IdentityProvider.APPLE,
        }),
      }),
    );
  });

  it('creates social user with MICROSOFT provider', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({
      id: 'u-ms',
      keycloakSub: 'kc-ms',
      email: 'ms@example.com',
      provider: IdentityProvider.MICROSOFT,
    });

    const result = await service.syncUser(
      authUser({
        sub: 'kc-ms',
        email: 'ms@example.com',
        identityProvider: 'microsoft',
        roles: ['USER'],
      }),
    );

    expect(result.provider).toBe(IdentityProvider.MICROSOFT);
    expect(result.socialLogin).toBe(true);
  });

  it('links existing email account to new keycloak sub', async () => {
    prisma.user.findUnique
      .mockResolvedValueOnce(null) // by sub
      .mockResolvedValueOnce({
        id: 'u-existing',
        keycloakSub: 'old-sub',
        email: 'admin@example.com',
        status: UserStatus.ACTIVE,
        lastLoginAt: null,
      }); // by email
    prisma.user.update.mockResolvedValue({
      id: 'u-existing',
      keycloakSub: 'kc-1',
      email: 'admin@example.com',
      provider: IdentityProvider.FACEBOOK,
    });

    const result = await service.syncUser(
      authUser({ identityProvider: 'facebook' }),
    );

    expect(result.created).toBe(false);
    expect(result.linked).toBe(true);
    expect(result.loginEvent).toBe(true);
    expect(result.socialLogin).toBe(true);
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'u-existing' },
        data: expect.objectContaining({
          keycloakSub: 'kc-1',
          provider: IdentityProvider.FACEBOOK,
        }),
      }),
    );
  });

  it('updates profile without loginEvent when recent lastLoginAt', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      keycloakSub: 'kc-1',
      status: UserStatus.ACTIVE,
      lastLoginAt: new Date(),
    });
    prisma.user.update.mockResolvedValue({
      id: 'u1',
      keycloakSub: 'kc-1',
      email: 'admin@example.com',
      roles: [Role.USER, Role.ADMIN],
      status: UserStatus.ACTIVE,
      provider: IdentityProvider.KEYCLOAK,
    });

    const result = await service.syncUser(authUser());
    expect(result.created).toBe(false);
    expect(result.loginEvent).toBe(false);
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('rejects DISABLED users', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      keycloakSub: 'kc-1',
      status: UserStatus.DISABLED,
    });

    await expect(service.syncUser(authUser())).rejects.toMatchObject({
      code: UserSyncErrorCode.DISABLED,
    });
  });

  it('rejects DELETED users', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      keycloakSub: 'kc-1',
      status: UserStatus.DELETED,
    });

    await expect(service.syncUser(authUser())).rejects.toBeInstanceOf(
      UserSyncError,
    );
  });

  it('markDeleted soft-deletes by keycloak sub', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      keycloakSub: 'kc-1',
      status: UserStatus.ACTIVE,
    });
    prisma.user.update.mockResolvedValue({
      id: 'u1',
      status: UserStatus.DELETED,
    });

    const user = await service.markDeleted('kc-1');
    expect(user?.status).toBe(UserStatus.DELETED);
  });
});
