import { Test, TestingModule } from '@nestjs/testing';
import { SubscriptionStatus } from '@prisma/client';
import { FeatureAccessService } from './feature-access.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AppLogger } from '../../common/logger/app-logger.service';

describe('FeatureAccessService', () => {
  let service: FeatureAccessService;
  let prisma: {
    organizationMember: { findMany: jest.Mock };
    billingAccount: { findMany: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      organizationMember: { findMany: jest.fn() },
      billingAccount: { findMany: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FeatureAccessService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: AppLogger,
          useValue: {
            setContext: jest.fn(),
            debug: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(FeatureAccessService);
  });

  it('denies feature without active subscription', async () => {
    prisma.organizationMember.findMany.mockResolvedValue([]);
    await expect(service.canAccessFeature('u1', 'ai')).resolves.toBe(false);
  });

  it('denies AI on starter plan', async () => {
    prisma.organizationMember.findMany.mockResolvedValue([
      { organizationId: 'org1' },
    ]);
    prisma.billingAccount.findMany.mockResolvedValue([
      {
        subscriptions: [
          {
            planId: 'starter',
            status: SubscriptionStatus.ACTIVE,
            currentPeriodEnd: new Date(Date.now() + 86_400_000),
          },
        ],
      },
    ]);

    await expect(service.canAccessFeature('u1', 'ai')).resolves.toBe(false);
    await expect(service.getAccessSummary('u1')).resolves.toEqual(
      expect.objectContaining({
        planId: 'starter',
        active: true,
        canAccessAi: false,
      }),
    );
  });

  it('allows AI on pro plan after payment', async () => {
    prisma.organizationMember.findMany.mockResolvedValue([
      { organizationId: 'org1' },
    ]);
    prisma.billingAccount.findMany.mockResolvedValue([
      {
        subscriptions: [
          {
            planId: 'pro',
            status: SubscriptionStatus.ACTIVE,
            currentPeriodEnd: new Date(Date.now() + 86_400_000),
          },
        ],
      },
    ]);

    await expect(service.canAccessFeature('u1', 'ai')).resolves.toBe(true);
    await expect(
      service.canAccessFeature('u1', 'cms_ai_rewrite'),
    ).resolves.toBe(true);
  });
});
