import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { BillingInterval, Role, SubscriptionStatus } from '@prisma/client';
import { BillingService } from './billing.service';
import { StripeService } from './stripe.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AppLogger } from '../../common/logger/app-logger.service';
import { NotificationDispatcher } from '../../common/events/notification-dispatcher';

describe('BillingService', () => {
  let service: BillingService;
  let prisma: {
    organization: { findUnique: jest.Mock; create: jest.Mock };
    billingAccount: {
      findUnique: jest.Mock;
      findMany: jest.Mock;
      create: jest.Mock;
    };
    organizationMember: {
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      findMany: jest.Mock;
      upsert: jest.Mock;
    };
    user: { findUnique: jest.Mock };
    stripeCustomer: { upsert: jest.Mock };
    subscription: { upsert: jest.Mock };
  };
  let stripe: {
    isConfigured: jest.Mock;
    getPublishableKey: jest.Mock;
    listPlans: jest.Mock;
    listPayableItems: jest.Mock;
    requireClient: jest.Mock;
    buildPriceData: jest.Mock;
    buildPayablePriceData: jest.Mock;
    resolvePriceId: jest.Mock;
    resolvePayableSubscriptionPriceId: jest.Mock;
    buildSubscriptionPriceData: jest.Mock;
    buildPayableSubscriptionPriceData: jest.Mock;
    planIdFromPriceId: jest.Mock;
    intervalFromPriceId: jest.Mock;
    getConfig: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      organization: { findUnique: jest.fn(), create: jest.fn() },
      billingAccount: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
      },
      organizationMember: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        upsert: jest.fn(),
      },
      user: { findUnique: jest.fn() },
      stripeCustomer: { upsert: jest.fn() },
      subscription: { upsert: jest.fn() },
    };

    stripe = {
      isConfigured: jest.fn().mockReturnValue(true),
      getPublishableKey: jest.fn().mockReturnValue('pk_test'),
      listPlans: jest.fn().mockReturnValue([{ id: 'starter' }]),
      listPayableItems: jest.fn().mockReturnValue([]),
      requireClient: jest.fn(),
      buildPriceData: jest.fn().mockReturnValue({
        currency: 'eur',
        unit_amount: 900,
        product_data: { name: 'Starter (mensuel)' },
      }),
      buildPayablePriceData: jest.fn().mockReturnValue({
        currency: 'eur',
        unit_amount: 500,
        product_data: { name: 'Article — Guide démarrage' },
      }),
      resolvePriceId: jest.fn().mockReturnValue('price_starter_m'),
      resolvePayableSubscriptionPriceId: jest.fn().mockReturnValue(null),
      buildSubscriptionPriceData: jest.fn().mockReturnValue({
        currency: 'eur',
        unit_amount: 900,
        recurring: { interval: 'month' },
        product_data: { name: 'Starter (mensuel)' },
      }),
      buildPayableSubscriptionPriceData: jest.fn(),
      planIdFromPriceId: jest.fn().mockReturnValue('starter'),
      intervalFromPriceId: jest.fn().mockReturnValue('MONTHLY'),
      getConfig: jest.fn().mockReturnValue({
        successUrl: 'http://ok',
        cancelUrl: 'http://cancel',
        portalReturnUrl: 'http://portal',
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BillingService,
        { provide: PrismaService, useValue: prisma },
        { provide: StripeService, useValue: stripe },
        { provide: NotificationDispatcher, useValue: { dispatch: jest.fn() } },
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

    service = module.get(BillingService);
  });

  it('lists plans', () => {
    const result = service.listPlans();
    expect(result.configured).toBe(true);
    expect(result.plans).toHaveLength(1);
  });

  it('maps stripe subscription statuses', () => {
    expect(service.mapStripeSubscriptionStatus('active')).toBe(
      SubscriptionStatus.ACTIVE,
    );
    expect(service.mapStripeSubscriptionStatus('past_due')).toBe(
      SubscriptionStatus.PAST_DUE,
    );
    expect(service.mapStripeSubscriptionStatus('canceled')).toBe(
      SubscriptionStatus.CANCELED,
    );
  });

  it('creates billing account when missing', async () => {
    prisma.organization.findUnique.mockResolvedValue({ id: 'org1' });
    prisma.billingAccount.findUnique.mockResolvedValue(null);
    prisma.billingAccount.create.mockResolvedValue({
      id: 'ba1',
      organizationId: 'org1',
      stripeCustomer: null,
    });

    const account = await service.ensureBillingAccount('org1');
    expect(account.id).toBe('ba1');
  });

  it('allows global ADMIN org access', async () => {
    await expect(
      service.assertOrgAccess('org1', {
        sub: 'x',
        email: 'a@b.c',
        roles: ['ADMIN'],
        permissions: [],
      }),
    ).resolves.toBeUndefined();
  });

  it('rejects non-member for org access', async () => {
    prisma.organizationMember.findUnique.mockResolvedValue(null);
    await expect(
      service.assertOrgAccess('org1', {
        sub: 'x',
        email: 'a@b.c',
        roles: ['USER'],
        permissions: [],
        userId: 'u1',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('requires org admin for checkout-level access', async () => {
    prisma.organizationMember.findUnique.mockResolvedValue({
      role: Role.USER,
    });
    await expect(
      service.assertOrgAccess(
        'org1',
        {
          sub: 'x',
          email: 'a@b.c',
          roles: ['USER'],
          permissions: [],
          userId: 'u1',
        },
        true,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('creates subscription checkout with Stripe Price ID', async () => {
    const create = jest.fn().mockResolvedValue({
      id: 'cs_1',
      url: 'https://checkout.stripe.com/x',
    });
    stripe.requireClient.mockReturnValue({
      checkout: { sessions: { create } },
    });
    prisma.organizationMember.findFirst.mockResolvedValue({
      organizationId: 'org1',
    });
    prisma.organization.findUnique.mockResolvedValue({ id: 'org1' });
    prisma.billingAccount.findUnique.mockResolvedValue({
      id: 'ba1',
      organizationId: 'org1',
      stripeCustomer: null,
    });

    const result = await service.createCheckoutSession({
      planId: 'starter',
      interval: BillingInterval.MONTHLY,
      userId: 'u1',
      customerEmail: 'a@b.c',
    });

    expect(result.sessionId).toBe('cs_1');
    expect(result.url).toContain('checkout.stripe.com');
    expect(stripe.resolvePriceId).toHaveBeenCalledWith(
      'starter',
      BillingInterval.MONTHLY,
    );
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'subscription',
        customer_email: 'a@b.c',
        line_items: [{ price: 'price_starter_m', quantity: 1 }],
        metadata: expect.objectContaining({
          planId: 'starter',
          billingAccountId: 'ba1',
          source: 'starter-billing',
        }),
      }),
    );
  });

  it('creates subscription checkout with dynamic price_data when no Price ID', async () => {
    const create = jest.fn().mockResolvedValue({
      id: 'cs_dyn',
      url: 'https://checkout.stripe.com/dyn',
    });
    stripe.requireClient.mockReturnValue({
      checkout: { sessions: { create } },
    });
    stripe.resolvePriceId.mockReturnValue(null);

    prisma.organizationMember.findFirst.mockResolvedValue({
      organizationId: 'org1',
    });
    prisma.organization.findUnique.mockResolvedValue({ id: 'org1' });
    prisma.billingAccount.findUnique.mockResolvedValue({
      id: 'ba1',
      organizationId: 'org1',
      stripeCustomer: null,
    });

    await service.createCheckoutSession({
      planId: 'starter',
      interval: BillingInterval.MONTHLY,
      userId: 'u1',
      customerEmail: 'a@b.c',
    });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'subscription',
        line_items: [
          expect.objectContaining({
            price_data: expect.objectContaining({
              recurring: { interval: 'month' },
              unit_amount: 900,
            }),
            quantity: 1,
          }),
        ],
      }),
    );
  });

  it('creates customer portal session', async () => {
    const create = jest.fn().mockResolvedValue({
      url: 'https://billing.stripe.com/session/x',
    });
    stripe.requireClient.mockReturnValue({
      billingPortal: { sessions: { create } },
    });
    prisma.organizationMember.findFirst.mockResolvedValue({
      organizationId: 'org1',
    });
    prisma.organization.findUnique.mockResolvedValue({ id: 'org1' });
    prisma.billingAccount.findUnique.mockResolvedValue({
      id: 'ba1',
      organizationId: 'org1',
      stripeCustomer: { stripeCustomerId: 'cus_1' },
    });

    const result = await service.createCustomerPortalSession('u1');
    expect(result.url).toContain('billing.stripe.com');
    expect(create).toHaveBeenCalledWith({
      customer: 'cus_1',
      return_url: 'http://portal',
    });
  });

  it('rejects portal without stripe customer', async () => {
    stripe.requireClient.mockReturnValue({
      billingPortal: { sessions: { create: jest.fn() } },
    });
    prisma.organizationMember.findFirst.mockResolvedValue({
      organizationId: 'org1',
    });
    prisma.organization.findUnique.mockResolvedValue({ id: 'org1' });
    prisma.billingAccount.findUnique.mockResolvedValue({
      id: 'ba1',
      organizationId: 'org1',
      stripeCustomer: null,
    });

    await expect(
      service.createCustomerPortalSession('u1'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('creates item checkout without organization (payment mode)', async () => {
    const create = jest.fn().mockResolvedValue({
      id: 'cs_item',
      url: 'https://checkout.stripe.com/item',
    });
    stripe.requireClient.mockReturnValue({
      checkout: { sessions: { create } },
    });

    const result = await service.createItemCheckoutSession({
      itemId: 'article-guide',
      customerEmail: 'admin@example.com',
      cancelUrl: 'http://localhost:3000/admin/payments?canceled=1',
    });

    expect(result.url).toContain('checkout.stripe.com');
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'payment',
        customer_email: 'admin@example.com',
        cancel_url: 'http://localhost:3000/admin/payments?canceled=1',
        metadata: expect.objectContaining({
          itemId: 'article-guide',
          source: 'admin-payments',
        }),
      }),
    );
  });
});
