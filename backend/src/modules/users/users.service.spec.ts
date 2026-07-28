import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { IdentityProvider, Role, UserStatus } from '@prisma/client';
import { UserRole } from '@saas-starter/shared';
import { UsersService } from './users.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AppLogger } from '../../common/logger/app-logger.service';

describe('UsersService', () => {
  let service: UsersService;
  let prisma: {
    user: {
      findUnique: jest.Mock;
      findUniqueOrThrow: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    $transaction: jest.Mock;
  };

  const baseUser = {
    id: 'u1',
    keycloakSub: 'kc-1',
    email: 'user@example.com',
    name: 'Demo User',
    firstName: 'Demo',
    lastName: 'User',
    avatarUrl: null,
    roles: [Role.USER],
    status: UserStatus.ACTIVE,
    provider: IdentityProvider.KEYCLOAK,
    lastLoginAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: prisma },
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

    service = module.get(UsersService);
  });

  it('lists users with pagination', async () => {
    prisma.$transaction.mockResolvedValue([[baseUser], 1]);
    const result = await service.list({ page: 1, pageSize: 10, q: 'demo' });
    expect(result.items).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(10);
    expect(result.totalPages).toBe(1);
  });

  it('creates user without password (Keycloak sub required)', async () => {
    prisma.user.create.mockResolvedValue(baseUser);
    const user = await service.create({
      email: 'user@example.com',
      keycloakSub: 'kc-1',
      firstName: 'Demo',
      lastName: 'User',
      roles: [UserRole.USER],
    });
    expect(user.id).toBe('u1');
    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          keycloakSub: 'kc-1',
          email: 'user@example.com',
          provider: IdentityProvider.KEYCLOAK,
        }),
      }),
    );
  });

  it('updates profile fields', async () => {
    prisma.user.findUnique.mockResolvedValue(baseUser);
    prisma.user.update.mockResolvedValue({
      ...baseUser,
      firstName: 'Ada',
      lastName: 'Lovelace',
      name: 'Ada Lovelace',
    });

    const updated = await service.updateProfile('u1', {
      firstName: 'Ada',
      lastName: 'Lovelace',
    });
    expect(updated.firstName).toBe('Ada');
    expect(prisma.user.update).toHaveBeenCalled();
  });

  it('soft-deletes user via setStatus DELETED', async () => {
    prisma.user.findUnique.mockResolvedValue(baseUser);
    prisma.user.update.mockResolvedValue({
      ...baseUser,
      status: UserStatus.DELETED,
    });

    const result = await service.setStatus('u1', UserStatus.DELETED);
    expect(result.status).toBe(UserStatus.DELETED);
  });

  it('disables user via setStatus', async () => {
    prisma.user.findUnique.mockResolvedValue(baseUser);
    prisma.user.update.mockResolvedValue({
      ...baseUser,
      status: UserStatus.DISABLED,
    });

    const result = await service.setStatus('u1', UserStatus.DISABLED);
    expect(result.status).toBe(UserStatus.DISABLED);
  });

  it('throws NotFound for missing user', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(service.findById('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('maps roles including ADMIN', () => {
    expect(service.toPrismaRoles([UserRole.ADMIN])).toEqual(
      expect.arrayContaining([Role.USER, Role.ADMIN]),
    );
  });

  it('propagates unique conflict on create', async () => {
    const { Prisma } = await import('@prisma/client');
    const prismaErr = new Prisma.PrismaClientKnownRequestError('Unique', {
      code: 'P2002',
      clientVersion: '6',
    });
    prisma.user.create.mockRejectedValue(prismaErr);

    await expect(
      service.create({
        email: 'dup@example.com',
        keycloakSub: 'kc-dup',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
