import { ForbiddenException } from '@nestjs/common';
import { OrganizationsService } from './organizations.service';
import { FeatureAccessService } from '../payments/feature-access.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AppLogger } from '../../common/logger/app-logger.service';

describe('OrganizationsService memberLimit', () => {
  let service: OrganizationsService;
  let prisma: {
    organization: { findUnique: jest.Mock };
    organizationMember: {
      count: jest.Mock;
      create: jest.Mock;
      findUnique: jest.Mock;
    };
    userInvitation: { count: jest.Mock };
    user: { findUnique: jest.Mock };
  };
  let features: { getMemberLimitForOrganization: jest.Mock };

  beforeEach(() => {
    prisma = {
      organization: { findUnique: jest.fn().mockResolvedValue({ id: 'org1' }) },
      organizationMember: {
        count: jest.fn(),
        create: jest.fn(),
        findUnique: jest.fn(),
      },
      userInvitation: { count: jest.fn() },
      user: { findUnique: jest.fn() },
    };
    features = {
      getMemberLimitForOrganization: jest.fn(),
    };
    service = new OrganizationsService(
      prisma as unknown as PrismaService,
      features as unknown as FeatureAccessService,
      {
        setContext: jest.fn(),
        log: jest.fn(),
      } as unknown as AppLogger,
    );
  });

  it('allows add when under limit', async () => {
    features.getMemberLimitForOrganization.mockResolvedValue(5);
    prisma.organizationMember.count.mockResolvedValue(2);
    prisma.user.findUnique.mockResolvedValue({ id: 'u2' });
    prisma.organizationMember.create.mockResolvedValue({
      id: 'm1',
      userId: 'u2',
    });

    await expect(service.addMember('org1', { userId: 'u2' })).resolves.toEqual(
      expect.objectContaining({ id: 'm1' }),
    );
  });

  it('rejects add when memberLimit reached', async () => {
    features.getMemberLimitForOrganization.mockResolvedValue(5);
    prisma.organizationMember.count.mockResolvedValue(5);

    await expect(
      service.addMember('org1', { userId: 'u2' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('counts pending invites when includePendingInvites', async () => {
    features.getMemberLimitForOrganization.mockResolvedValue(5);
    prisma.organizationMember.count.mockResolvedValue(4);
    prisma.userInvitation.count.mockResolvedValue(1);

    await expect(
      service.assertMemberLimit('org1', { includePendingInvites: true }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'ORG_MEMBER_LIMIT' }),
    });
  });

  it('skips check when unlimited (pro)', async () => {
    features.getMemberLimitForOrganization.mockResolvedValue(null);
    await expect(service.assertMemberLimit('org1')).resolves.toBeUndefined();
    expect(prisma.organizationMember.count).not.toHaveBeenCalled();
  });
});
