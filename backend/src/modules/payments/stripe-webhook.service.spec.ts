import { Test, TestingModule } from '@nestjs/testing';
import {
  InvoiceStatus,
  PaymentStatus,
  SubscriptionStatus,
} from '@prisma/client';
import { StripeWebhookService } from './stripe-webhook.service';
import { BillingService } from './billing.service';
import { StripeService } from './stripe.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AppLogger } from '../../common/logger/app-logger.service';
import { NotificationDispatcher } from '../../common/events/notification-dispatcher';
import Stripe from 'stripe';

describe('StripeWebhookService', () => {
  let service: StripeWebhookService;
  let prisma: {
    stripeCustomer: { upsert: jest.Mock; findUnique: jest.Mock };
    subscription: {
      findUnique: jest.Mock;
      update: jest.Mock;
    };
    invoice: { upsert: jest.Mock };
    payment: { upsert: jest.Mock; create: jest.Mock };
    billingAccount: { findUnique: jest.Mock };
    processedWebhookEvent: { findUnique: jest.Mock; create: jest.Mock };
  };
  let billing: {
    ensureBillingAccount: jest.Mock;
    upsertSubscriptionFromStripe: jest.Mock;
    mapStripeSubscriptionStatus: jest.Mock;
  };
  let stripe: {
    requireClient: jest.Mock;
    planIdFromPriceId: jest.Mock;
    intervalFromPriceId: jest.Mock;
  };
  let notifications: { dispatch: jest.Mock };

  beforeEach(async () => {
    prisma = {
      stripeCustomer: { upsert: jest.fn(), findUnique: jest.fn() },
      subscription: { findUnique: jest.fn(), update: jest.fn() },
      invoice: { upsert: jest.fn() },
      payment: { upsert: jest.fn(), create: jest.fn() },
      billingAccount: { findUnique: jest.fn().mockResolvedValue(null) },
      processedWebhookEvent: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({}),
      },
    };
    billing = {
      ensureBillingAccount: jest.fn().mockResolvedValue({ id: 'ba1' }),
      upsertSubscriptionFromStripe: jest.fn(),
      mapStripeSubscriptionStatus: jest.fn().mockImplementation((s: string) => {
        if (s === 'canceled') return SubscriptionStatus.CANCELED;
        if (s === 'past_due') return SubscriptionStatus.PAST_DUE;
        return SubscriptionStatus.ACTIVE;
      }),
    };
    stripe = {
      requireClient: jest.fn(),
      planIdFromPriceId: jest.fn().mockReturnValue('starter'),
      intervalFromPriceId: jest.fn().mockReturnValue('MONTHLY'),
    };
    notifications = { dispatch: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StripeWebhookService,
        { provide: PrismaService, useValue: prisma },
        { provide: BillingService, useValue: billing },
        { provide: StripeService, useValue: stripe },
        { provide: NotificationDispatcher, useValue: notifications },
        {
          provide: AppLogger,
          useValue: {
            setContext: jest.fn(),
            log: jest.fn(),
            warn: jest.fn(),
            debug: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(StripeWebhookService);
  });

  it('handles checkout.session.completed', async () => {
    stripe.requireClient.mockReturnValue({
      subscriptions: {
        retrieve: jest.fn().mockResolvedValue({
          id: 'sub_1',
          status: 'active',
          cancel_at_period_end: false,
          canceled_at: null,
          trial_end: null,
          metadata: {},
          items: {
            data: [{ price: { id: 'price_starter_m' } }],
          },
        }),
      },
    });

    await service.handleEvent({
      id: 'evt_1',
      type: 'checkout.session.completed',
      data: {
        object: {
          mode: 'subscription',
          subscription: 'sub_1',
          customer: 'cus_1',
          metadata: {
            billingAccountId: 'ba1',
            organizationId: 'org1',
            planId: 'starter',
            interval: 'MONTHLY',
          },
          customer_details: { email: 'a@b.c' },
        },
      },
    } as unknown as Stripe.Event);

    expect(prisma.stripeCustomer.upsert).toHaveBeenCalled();
    expect(billing.upsertSubscriptionFromStripe).toHaveBeenCalled();
  });

  it('handles checkout.session.completed payment mode with price_data', async () => {
    billing.upsertSubscriptionFromStripe.mockResolvedValue({ id: 'localsub' });
    prisma.payment.upsert.mockResolvedValue({});

    await service.handleEvent({
      id: 'evt_pay_1',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_pay_1',
          mode: 'payment',
          payment_status: 'paid',
          payment_intent: 'pi_pay_1',
          amount_total: 900,
          currency: 'eur',
          customer: 'cus_1',
          metadata: {
            billingAccountId: 'ba1',
            organizationId: 'org1',
            planId: 'starter',
            interval: 'MONTHLY',
          },
          customer_details: { email: 'a@b.c' },
        },
      },
    } as unknown as Stripe.Event);

    expect(billing.upsertSubscriptionFromStripe).toHaveBeenCalledWith(
      expect.objectContaining({
        stripeSubscriptionId: 'checkout_cs_pay_1',
        planId: 'starter',
        status: SubscriptionStatus.ACTIVE,
      }),
    );
    expect(prisma.payment.upsert).toHaveBeenCalled();
  });

  it('handles invoice.paid and records payment', async () => {
    prisma.stripeCustomer.findUnique.mockResolvedValue({
      billingAccountId: 'ba1',
    });
    prisma.subscription.findUnique.mockResolvedValue({ id: 'localsub' });
    prisma.invoice.upsert.mockResolvedValue({});
    prisma.payment.upsert.mockResolvedValue({});

    await service.handleEvent({
      id: 'evt_2',
      type: 'invoice.paid',
      data: {
        object: {
          id: 'in_1',
          number: 'INV-1',
          customer: 'cus_1',
          subscription: 'sub_1',
          amount_due: 1000,
          amount_paid: 1000,
          currency: 'eur',
          payment_intent: 'pi_1',
          hosted_invoice_url: 'https://invoice',
          invoice_pdf: 'https://pdf',
          period_start: 1,
          period_end: 2,
          status_transitions: { paid_at: 3 },
          description: null,
        },
      },
    } as unknown as Stripe.Event);

    expect(prisma.invoice.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          status: InvoiceStatus.PAID,
          amountPaid: 1000,
        }),
      }),
    );
    expect(prisma.payment.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          status: PaymentStatus.SUCCEEDED,
        }),
      }),
    );
  });

  it('handles subscription.deleted', async () => {
    prisma.subscription.findUnique.mockResolvedValue({ id: 'localsub' });
    prisma.subscription.update.mockResolvedValue({});

    await service.handleEvent({
      id: 'evt_3',
      type: 'customer.subscription.deleted',
      data: {
        object: {
          id: 'sub_1',
          canceled_at: 10,
          status: 'canceled',
        },
      },
    } as unknown as Stripe.Event);

    expect(prisma.subscription.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: SubscriptionStatus.CANCELED,
        }),
      }),
    );
  });

  it('handles customer.subscription.updated', async () => {
    billing.upsertSubscriptionFromStripe.mockResolvedValue({ id: 'localsub' });

    await service.handleEvent({
      id: 'evt_sub_upd',
      type: 'customer.subscription.updated',
      data: {
        object: {
          id: 'sub_1',
          status: 'active',
          cancel_at_period_end: true,
          canceled_at: null,
          trial_end: null,
          current_period_start: 100,
          current_period_end: 200,
          metadata: { billingAccountId: 'ba1', planId: 'pro' },
          items: {
            data: [{ price: { id: 'price_pro_m' } }],
          },
        },
      },
    } as unknown as Stripe.Event);

    expect(billing.upsertSubscriptionFromStripe).toHaveBeenCalledWith(
      expect.objectContaining({
        stripeSubscriptionId: 'sub_1',
        planId: 'pro',
        cancelAtPeriodEnd: true,
        status: SubscriptionStatus.ACTIVE,
      }),
    );
  });

  it('handles invoice.payment_failed and marks PAST_DUE', async () => {
    prisma.stripeCustomer.findUnique.mockResolvedValue({
      billingAccountId: 'ba1',
    });
    prisma.subscription.findUnique.mockResolvedValue({ id: 'localsub' });
    prisma.invoice.upsert.mockResolvedValue({});
    prisma.payment.upsert.mockResolvedValue({});
    prisma.subscription.update.mockResolvedValue({});

    await service.handleEvent({
      id: 'evt_fail',
      type: 'invoice.payment_failed',
      data: {
        object: {
          id: 'in_fail',
          number: 'INV-F',
          customer: 'cus_1',
          subscription: 'sub_1',
          amount_due: 900,
          amount_paid: 0,
          currency: 'eur',
          payment_intent: 'pi_fail',
          hosted_invoice_url: null,
          invoice_pdf: null,
          period_start: 1,
          period_end: 2,
          description: null,
        },
      },
    } as unknown as Stripe.Event);

    expect(prisma.subscription.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: SubscriptionStatus.PAST_DUE,
        }),
      }),
    );
    expect(billing.mapStripeSubscriptionStatus).toHaveBeenCalledWith(
      'past_due',
    );
    expect(prisma.payment.upsert).toHaveBeenCalled();
  });

  it('ignores duplicate webhook events (idempotence)', async () => {
    prisma.processedWebhookEvent.findUnique.mockResolvedValue({
      id: 'pw1',
      eventId: 'evt_dup',
    });

    const result = await service.handleEvent({
      id: 'evt_dup',
      type: 'invoice.paid',
      data: { object: {} },
    } as unknown as Stripe.Event);

    expect(result).toEqual({ received: true, duplicate: true });
    expect(prisma.invoice.upsert).not.toHaveBeenCalled();
  });
});
