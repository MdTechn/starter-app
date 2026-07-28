import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { OrganizationScopeService } from './organization-scope.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AppLogger } from '../../common/logger/app-logger.service';

describe('OrganizationScopeService', () => {
  let service: OrganizationScopeService;
  let prisma: {
    organizationMember: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      findFirst: jest.Mock;
    };
    organization: { findUnique: jest.Mock };
  };

  beforeEach(() => {
    prisma = {
      organizationMember: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
      },
      organization: { findUnique: jest.fn() },
    };
    service = new OrganizationScopeService(
      prisma as unknown as PrismaService,
      {
        setContext: jest.fn(),
      } as unknown as AppLogger,
    );
  });

  it('returns null org filter for ADMIN', async () => {
    const ids = await service.getAccessibleOrganizationIds('u1', ['ADMIN']);
    expect(ids).toBeNull();
    expect(await service.orgWhere('u1', ['ADMIN'])).toEqual({});
  });

  it('returns membership org ids for users', async () => {
    prisma.organizationMember.findMany.mockResolvedValue([
      { organizationId: 'org1' },
      { organizationId: 'org2' },
    ]);
    await expect(
      service.getAccessibleOrganizationIds('u1', ['USER']),
    ).resolves.toEqual(['org1', 'org2']);
  });

  it('assertCanAccessOrganization rejects non-members', async () => {
    prisma.organizationMember.findUnique.mockResolvedValue(null);
    await expect(
      service.assertCanAccessOrganization('u1', 'org1', ['USER']),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('resolveOrganizationIdForWrite uses first membership', async () => {
    prisma.organizationMember.findFirst.mockResolvedValue({
      organizationId: 'org-a',
    });
    await expect(
      service.resolveOrganizationIdForWrite('u1', ['USER']),
    ).resolves.toBe('org-a');
  });

  it('resolveOrganizationIdForWrite validates requested org', async () => {
    prisma.organization.findUnique.mockResolvedValue(null);
    await expect(
      service.resolveOrganizationIdForWrite('u1', ['USER'], 'missing'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
