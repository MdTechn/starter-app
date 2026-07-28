import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InvitationStatus, Role } from '@prisma/client';
import { InvitationsService } from './invitations.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AppLogger } from '../../common/logger/app-logger.service';
import { NotificationDispatcher } from '../../common/events/notification-dispatcher';
import { OrganizationsService } from '../organizations/organizations.service';

describe('InvitationsService', () => {
  let service: InvitationsService;
  let prisma: {
    user: { findUnique: jest.Mock };
    organization: { findUnique: jest.Mock };
    userInvitation: {
      create: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let notifications: { dispatch: jest.Mock };
  let organizations: { assertMemberLimit: jest.Mock };

  beforeEach(async () => {
    prisma = {
      user: { findUnique: jest.fn().mockResolvedValue(null) },
      organization: { findUnique: jest.fn() },
      userInvitation: {
        create: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      $transaction: jest.fn(),
    };
    notifications = { dispatch: jest.fn() };
    organizations = {
      assertMemberLimit: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvitationsService,
        { provide: PrismaService, useValue: prisma },
        { provide: NotificationDispatcher, useValue: notifications },
        { provide: OrganizationsService, useValue: organizations },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('http://localhost:3000') },
        },
        {
          provide: AppLogger,
          useValue: {
            setContext: jest.fn(),
            log: jest.fn(),
            warn: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(InvitationsService);
  });

  it('creates a pending invitation and emails inviteUrl', async () => {
    prisma.userInvitation.create.mockResolvedValue({
      id: 'inv1',
      email: 'new@example.com',
      token: 'tok-abc',
      status: InvitationStatus.PENDING,
      role: Role.USER,
    });

    const inv = await service.create({ email: 'new@example.com' }, 'admin-1');
    expect(inv.status).toBe(InvitationStatus.PENDING);
    expect(organizations.assertMemberLimit).not.toHaveBeenCalled();
    expect(notifications.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'USER_INVITED',
        email: 'new@example.com',
        channels: ['EMAIL'],
        data: expect.objectContaining({
          inviteUrl: 'http://localhost:3000/login?invite=tok-abc',
          token: 'tok-abc',
        }),
      }),
    );
  });

  it('enforces memberLimit when inviting to an organization', async () => {
    prisma.organization.findUnique.mockResolvedValue({
      id: 'org1',
      name: 'Acme',
    });
    prisma.userInvitation.create.mockResolvedValue({
      id: 'inv2',
      email: 'new@example.com',
      token: 'tok-2',
      status: InvitationStatus.PENDING,
      role: Role.USER,
      organizationId: 'org1',
    });

    await service.create(
      { email: 'new@example.com', organizationId: 'org1' },
      'admin-1',
    );
    expect(organizations.assertMemberLimit).toHaveBeenCalledWith('org1', {
      includePendingInvites: true,
    });
  });

  it('rejects invite when user already exists', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      status: 'ACTIVE',
    });

    await expect(
      service.create({ email: 'exists@example.com' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('revokes a pending invitation', async () => {
    prisma.userInvitation.findUnique.mockResolvedValue({
      id: 'inv1',
      status: InvitationStatus.PENDING,
    });
    prisma.userInvitation.update.mockResolvedValue({
      id: 'inv1',
      status: InvitationStatus.REVOKED,
    });

    const result = await service.revoke('inv1');
    expect(result.status).toBe(InvitationStatus.REVOKED);
  });
});
