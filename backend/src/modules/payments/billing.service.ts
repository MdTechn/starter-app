import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BillingInterval,
  PaymentStatus,
  Prisma,
  Role,
  SubscriptionStatus,
} from '@prisma/client';
import type Stripe from 'stripe';
import {
  AppNotificationEvent,
  BillingPlanId,
  getPayableItem,
  isSubscriptionActive,
} from '@saas-starter/shared';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AppLogger } from '../../common/logger/app-logger.service';
import { NotificationDispatcher } from '../../common/events/notification-dispatcher';
import { AuthenticatedUser } from '../../common/types/authenticated-user';
import { StripeService } from './stripe.service';

@Injectable()
export class BillingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stripe: StripeService,
    private readonly notifications: NotificationDispatcher,
    private readonly logger: AppLogger,
  ) {
    this.logger.setContext(BillingService.name);
  }

  listPlans() {
    return {
      configured: this.stripe.isConfigured(),
      publishableKey: this.stripe.getPublishableKey(),
      plans: this.stripe.listPlans(),
    };
  }

  listPayableItems() {
    return {
      configured: this.stripe.isConfigured(),
      publishableKey: this.stripe.getPublishableKey(),
      items: this.stripe.listPayableItems(),
    };
  }

  async listProjectPayments(limit = 50) {
    return this.prisma.payment.findMany({
      where: { status: PaymentStatus.SUCCEEDED },
      orderBy: [{ paidAt: 'desc' }, { createdAt: 'desc' }],
      take: Math.min(Math.max(limit, 1), 100),
      select: {
        id: true,
        amount: true,
        currency: true,
        status: true,
        description: true,
        payerName: true,
        payerEmail: true,
        paidAt: true,
        createdAt: true,
        metadata: true,
      },
    });
  }

  /**
   * Compte de facturation pour un user : org existante ou org personnelle auto.
   * Requis pour sync Subscription Prisma (lié à BillingAccount).
   */
  async ensurePersonalBillingAccount(userId: string) {
    const membership = await this.prisma.organizationMember.findFirst({
      where: { userId },
      orderBy: { createdAt: 'asc' },
      select: { organizationId: true },
    });
    if (membership) {
      return this.ensureBillingAccount(membership.organizationId);
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const slug = `personal-${userId}`;
    const existingOrg = await this.prisma.organization.findUnique({
      where: { slug },
    });
    if (existingOrg) {
      await this.prisma.organizationMember.upsert({
        where: {
          organizationId_userId: {
            organizationId: existingOrg.id,
            userId,
          },
        },
        create: {
          organizationId: existingOrg.id,
          userId,
          role: Role.ADMIN,
        },
        update: {},
      });
      return this.ensureBillingAccount(existingOrg.id);
    }

    const org = await this.prisma.organization.create({
      data: {
        name: user.name || user.email || 'Personal',
        slug,
        description: 'Personal billing workspace',
        members: {
          create: { userId, role: Role.ADMIN },
        },
      },
    });

    return this.ensureBillingAccount(org.id);
  }

  async createCheckoutSession(input: {
    planId: BillingPlanId;
    interval: BillingInterval;
    userId: string;
    customerEmail?: string;
    payerName?: string;
    cancelUrl?: string;
  }) {
    const stripe = this.stripe.requireClient();
    // Price ID env optionnel ; sinon price_data + recurring (pas de setup Dashboard).
    const priceId = this.stripe.resolvePriceId(input.planId, input.interval);
    const lineItem = priceId
      ? { price: priceId, quantity: 1 }
      : {
          price_data: this.stripe.buildSubscriptionPriceData(
            input.planId,
            input.interval,
          ),
          quantity: 1,
        };
    const account = await this.ensurePersonalBillingAccount(input.userId);
    const config = this.stripe.getConfig();
    const cancelUrl =
      input.cancelUrl ||
      `${process.env.FRONTEND_URL ?? 'http://localhost:3000'}/billing?canceled=1`;

    const customerId = account.stripeCustomer?.stripeCustomerId;
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      ...(customerId
        ? { customer: customerId }
        : { customer_email: input.customerEmail || undefined }),
      line_items: [lineItem],
      success_url: config.successUrl,
      cancel_url: cancelUrl,
      client_reference_id: account.organizationId,
      subscription_data: {
        metadata: {
          planId: input.planId,
          interval: input.interval,
          billingAccountId: account.id,
          organizationId: account.organizationId,
          userId: input.userId,
          source: 'starter-billing',
        },
      },
      metadata: {
        planId: input.planId,
        interval: input.interval,
        billingAccountId: account.id,
        organizationId: account.organizationId,
        userId: input.userId,
        source: 'starter-billing',
        payerName: input.payerName ?? '',
        payerEmail: input.customerEmail ?? '',
      },
      allow_promotion_codes: true,
    });

    this.logger.log(
      `Subscription checkout created plan=${input.planId} interval=${input.interval} ba=${account.id} via=${priceId ? 'price_id' : 'price_data'}`,
    );

    return {
      sessionId: session.id,
      url: session.url,
    };
  }

  async createItemCheckoutSession(input: {
    itemId: string;
    userId?: string;
    customerEmail?: string;
    payerName?: string;
    cancelUrl?: string;
  }) {
    const stripe = this.stripe.requireClient();
    const item = getPayableItem(input.itemId);
    if (!item) {
      throw new NotFoundException(`Payable item not found: ${input.itemId}`);
    }

    const config = this.stripe.getConfig();
    const cancelUrl =
      input.cancelUrl ||
      `${process.env.FRONTEND_URL ?? 'http://localhost:3000'}/admin/payments?canceled=1`;

    if (item.type === 'subscription' && input.userId) {
      const account = await this.ensurePersonalBillingAccount(input.userId);
      const customerId = account.stripeCustomer?.stripeCustomerId;
      const planId = item.id.includes('pro')
        ? ('pro' as const)
        : ('starter' as const);
      const interval = item.id.includes('yearly')
        ? BillingInterval.YEARLY
        : BillingInterval.MONTHLY;
      const subscriptionPriceId = this.stripe.resolvePayableSubscriptionPriceId(
        item.id,
      );
      const lineItem = subscriptionPriceId
        ? { price: subscriptionPriceId, quantity: 1 }
        : {
            price_data: this.stripe.buildPayableSubscriptionPriceData(item.id),
            quantity: 1,
          };

      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        ...(customerId
          ? { customer: customerId }
          : { customer_email: input.customerEmail || undefined }),
        line_items: [lineItem],
        success_url: config.successUrl,
        cancel_url: cancelUrl,
        client_reference_id: account.organizationId,
        subscription_data: {
          metadata: {
            planId,
            interval,
            billingAccountId: account.id,
            organizationId: account.organizationId,
            userId: input.userId,
            itemId: item.id,
            source: 'admin-payments',
          },
        },
        metadata: {
          itemId: item.id,
          itemType: item.type,
          itemName: item.name,
          planId,
          interval,
          billingAccountId: account.id,
          organizationId: account.organizationId,
          userId: input.userId,
          amount: String(item.amount),
          currency: item.currency,
          source: 'admin-payments',
          payerName: input.payerName ?? '',
          payerEmail: input.customerEmail ?? '',
        },
        allow_promotion_codes: true,
      });

      this.logger.log(
        `Item subscription checkout item=${item.id} via=${subscriptionPriceId ? 'price_id' : 'price_data'}`,
      );
      return { sessionId: session.id, url: session.url };
    }

    const priceData = this.stripe.buildPayablePriceData(input.itemId);
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: input.customerEmail || undefined,
      line_items: [{ price_data: priceData, quantity: 1 }],
      success_url: config.successUrl,
      cancel_url: cancelUrl,
      metadata: {
        itemId: item.id,
        itemType: item.type,
        itemName: item.name,
        amount: String(item.amount),
        currency: item.currency,
        source: 'admin-payments',
        payerName: input.payerName ?? '',
        payerEmail: input.customerEmail ?? '',
      },
      allow_promotion_codes: true,
    });

    this.logger.log(
      `Item checkout created item=${item.id} amount=${item.amount} ${item.currency}`,
    );

    return {
      sessionId: session.id,
      url: session.url,
    };
  }

  async createCustomerPortalSession(userId: string) {
    const stripe = this.stripe.requireClient();
    const account = await this.ensurePersonalBillingAccount(userId);
    const customerId = account.stripeCustomer?.stripeCustomerId;
    if (!customerId) {
      throw new BadRequestException({
        code: 'STRIPE_CUSTOMER_MISSING',
        message:
          'Aucun client Stripe — souscrivez d’abord via Checkout avant d’ouvrir le Customer Portal.',
      });
    }

    const config = this.stripe.getConfig();
    const portal = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: config.portalReturnUrl,
    });

    this.logger.log(`Customer portal session created ba=${account.id}`);
    return { url: portal.url };
  }

  async getSubscriptionForUser(userId: string) {
    const memberships = await this.prisma.organizationMember.findMany({
      where: { userId },
      select: { organizationId: true },
    });
    if (memberships.length === 0) {
      return { subscription: null, stripeCustomerId: null };
    }

    const accounts = await this.prisma.billingAccount.findMany({
      where: {
        organizationId: { in: memberships.map((m) => m.organizationId) },
      },
      include: {
        stripeCustomer: true,
        subscriptions: {
          orderBy: { updatedAt: 'desc' },
          take: 5,
        },
      },
    });

    const active = accounts
      .flatMap((a) =>
        a.subscriptions.map((s) => ({
          ...s,
          stripeCustomerId: a.stripeCustomer?.stripeCustomerId ?? null,
        })),
      )
      .find((s) => isSubscriptionActive(s.status));

    const latest =
      active ??
      accounts
        .flatMap((a) =>
          a.subscriptions.map((s) => ({
            ...s,
            stripeCustomerId: a.stripeCustomer?.stripeCustomerId ?? null,
          })),
        )
        .sort(
          (a, b) =>
            (b.updatedAt?.getTime() ?? 0) - (a.updatedAt?.getTime() ?? 0),
        )[0] ??
      null;

    if (!latest) {
      return { subscription: null, stripeCustomerId: null };
    }

    return {
      stripeCustomerId: latest.stripeCustomerId,
      subscription: {
        id: latest.id,
        planId: latest.planId,
        interval: latest.interval,
        status: latest.status,
        stripeSubscriptionId: latest.stripeSubscriptionId,
        stripePriceId: latest.stripePriceId,
        currentPeriodEnd: latest.currentPeriodEnd,
        cancelAtPeriodEnd: latest.cancelAtPeriodEnd,
        canceledAt: latest.canceledAt,
      },
    };
  }

  /** Enregistre un paiement starter à partir d’une Checkout Session Stripe. */
  async recordCheckoutPayment(session: Stripe.Checkout.Session) {
    if (session.payment_status !== 'paid' && session.status !== 'complete') {
      return null;
    }

    const paymentIntentId =
      typeof session.payment_intent === 'string'
        ? session.payment_intent
        : (session.payment_intent?.id ?? null);

    const payerName =
      session.customer_details?.name ||
      session.metadata?.payerName ||
      session.customer_details?.email ||
      session.customer_email ||
      'Inconnu';
    const payerEmail =
      session.customer_details?.email ||
      session.customer_email ||
      session.metadata?.payerEmail ||
      null;

    const description =
      session.metadata?.itemName ||
      (session.metadata?.planId
        ? `Plan ${session.metadata.planId}${session.metadata.interval ? ` (${session.metadata.interval})` : ''}`
        : session.metadata?.itemId) ||
      'Paiement Stripe';

    const amount = session.amount_total ?? 0;
    const currency = session.currency ?? 'eur';
    const paidAt = new Date();
    const metadata: Prisma.InputJsonValue = {
      source: session.metadata?.source ?? 'starter',
      itemId: session.metadata?.itemId ?? null,
      planId: session.metadata?.planId ?? null,
      interval: session.metadata?.interval ?? null,
      checkoutSessionId: session.id,
    };

    const alreadyNotified = await this.findExistingSucceededPayment(
      paymentIntentId,
      session.id,
    );

    const payment = paymentIntentId
      ? await this.prisma.payment.upsert({
          where: { stripePaymentIntentId: paymentIntentId },
          create: {
            stripePaymentIntentId: paymentIntentId,
            stripeCheckoutSessionId: session.id,
            amount,
            currency,
            status: PaymentStatus.SUCCEEDED,
            description,
            payerName,
            payerEmail,
            paidAt,
            metadata,
          },
          update: {
            stripeCheckoutSessionId: session.id,
            amount,
            currency,
            status: PaymentStatus.SUCCEEDED,
            description,
            payerName,
            payerEmail,
            paidAt,
            metadata,
          },
        })
      : await this.prisma.payment.upsert({
          where: { stripeCheckoutSessionId: session.id },
          create: {
            stripeCheckoutSessionId: session.id,
            amount,
            currency,
            status: PaymentStatus.SUCCEEDED,
            description,
            payerName,
            payerEmail,
            paidAt,
            metadata,
          },
          update: {
            amount,
            currency,
            status: PaymentStatus.SUCCEEDED,
            description,
            payerName,
            payerEmail,
            paidAt,
            metadata,
          },
        });

    if (!alreadyNotified) {
      await this.notifyPaymentSuccess({
        payerName,
        payerEmail,
        amount,
        currency,
        description,
      });
    }

    return payment;
  }

  private async findExistingSucceededPayment(
    paymentIntentId: string | null,
    checkoutSessionId: string,
  ) {
    if (paymentIntentId) {
      const byIntent = await this.prisma.payment.findUnique({
        where: { stripePaymentIntentId: paymentIntentId },
      });
      if (byIntent?.status === PaymentStatus.SUCCEEDED) return true;
    }
    const bySession = await this.prisma.payment.findUnique({
      where: { stripeCheckoutSessionId: checkoutSessionId },
    });
    return bySession?.status === PaymentStatus.SUCCEEDED;
  }

  private async notifyPaymentSuccess(input: {
    payerName: string;
    payerEmail: string | null;
    amount: number;
    currency: string;
    description: string;
  }) {
    if (!input.payerEmail) {
      this.logger.warn('Payment success without payer email — skip notify');
      return;
    }

    const user = await this.prisma.user.findUnique({
      where: { email: input.payerEmail },
      select: { id: true, name: true, email: true },
    });

    this.notifications.dispatch({
      eventType: AppNotificationEvent.PAYMENT_SUCCESS,
      userId: user?.id ?? null,
      email: input.payerEmail,
      data: {
        name: user?.name || input.payerName || input.payerEmail,
        amount: (input.amount / 100).toFixed(2),
        currency: input.currency.toUpperCase(),
        description: input.description,
        invoiceNumber: input.description,
      },
      channels: ['EMAIL', 'IN_APP'],
    });

    this.logger.log(
      `Payment success notification queued email=${input.payerEmail} amount=${input.amount}`,
    );
  }

  async syncCheckoutSession(sessionId: string) {
    const stripe = this.stripe.requireClient();
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription'],
    });

    if (session.mode === 'subscription') {
      const billingAccountId = session.metadata?.billingAccountId;
      if (!billingAccountId) {
        throw new NotFoundException(
          'Checkout subscription without billingAccountId metadata',
        );
      }

      if (session.customer && typeof session.customer === 'string') {
        await this.prisma.stripeCustomer.upsert({
          where: { billingAccountId },
          create: {
            billingAccountId,
            stripeCustomerId: session.customer,
            email: session.customer_details?.email ?? null,
          },
          update: {
            stripeCustomerId: session.customer,
            email: session.customer_details?.email ?? undefined,
          },
        });
      }

      const subRef = session.subscription;
      const subId = typeof subRef === 'string' ? subRef : (subRef?.id ?? null);
      if (!subId) {
        throw new NotFoundException('Checkout session has no subscription');
      }

      const sub =
        typeof subRef === 'object' && subRef && 'status' in subRef
          ? (subRef as Stripe.Subscription)
          : await stripe.subscriptions.retrieve(subId);

      const item = sub.items.data[0];
      const priceId = item?.price?.id ?? 'unknown';
      const planId =
        session.metadata?.planId ?? this.stripe.planIdFromPriceId(priceId);
      const intervalMeta = session.metadata?.interval;
      const interval =
        intervalMeta === 'YEARLY' || intervalMeta === 'MONTHLY'
          ? (intervalMeta as BillingInterval)
          : this.stripe.intervalFromPriceId(priceId) === 'YEARLY'
            ? BillingInterval.YEARLY
            : BillingInterval.MONTHLY;

      const periodStart =
        (sub as { current_period_start?: number }).current_period_start ??
        (item as { current_period_start?: number } | undefined)
          ?.current_period_start;
      const periodEnd =
        (sub as { current_period_end?: number }).current_period_end ??
        (item as { current_period_end?: number } | undefined)
          ?.current_period_end;

      const subscription = await this.upsertSubscriptionFromStripe({
        billingAccountId,
        stripeSubscriptionId: sub.id,
        stripePriceId: priceId,
        planId,
        interval,
        status: this.mapStripeSubscriptionStatus(sub.status),
        currentPeriodStart: periodStart ? new Date(periodStart * 1000) : null,
        currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
        cancelAtPeriodEnd: sub.cancel_at_period_end,
        canceledAt: sub.canceled_at ? new Date(sub.canceled_at * 1000) : null,
        trialEnd: sub.trial_end ? new Date(sub.trial_end * 1000) : null,
        metadata: {
          ...(session.metadata ?? {}),
          source: 'checkout.sync',
        },
      });

      // Enregistre aussi un paiement projet si le checkout est payé
      if (session.payment_status === 'paid' || session.status === 'complete') {
        await this.recordCheckoutPayment(session);
      }

      return subscription;
    }

    const payment = await this.recordCheckoutPayment(session);
    if (!payment) {
      throw new NotFoundException('Checkout session not paid');
    }
    return payment;
  }

  async assertOrgAccess(
    organizationId: string,
    actor: AuthenticatedUser,
    requireAdminRole = false,
  ) {
    if (actor.roles.includes('ADMIN')) {
      return;
    }
    if (!actor.userId) {
      throw new ForbiddenException('User not synced');
    }

    const membership = await this.prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId,
          userId: actor.userId,
        },
      },
    });

    if (!membership) {
      throw new ForbiddenException('Not a member of this organization');
    }
    if (requireAdminRole && membership.role !== Role.ADMIN) {
      throw new ForbiddenException('Organization admin role required');
    }
  }

  async ensureBillingAccount(organizationId: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
    });
    if (!org) {
      throw new NotFoundException('Organization not found');
    }

    const existing = await this.prisma.billingAccount.findUnique({
      where: { organizationId },
      include: { stripeCustomer: true },
    });
    if (existing) return existing;

    return this.prisma.billingAccount.create({
      data: { organizationId },
      include: { stripeCustomer: true },
    });
  }

  mapStripeSubscriptionStatus(status: string): SubscriptionStatus {
    const map: Record<string, SubscriptionStatus> = {
      trialing: SubscriptionStatus.TRIALING,
      active: SubscriptionStatus.ACTIVE,
      past_due: SubscriptionStatus.PAST_DUE,
      canceled: SubscriptionStatus.CANCELED,
      unpaid: SubscriptionStatus.UNPAID,
      incomplete: SubscriptionStatus.INCOMPLETE,
      incomplete_expired: SubscriptionStatus.INCOMPLETE_EXPIRED,
      paused: SubscriptionStatus.PAUSED,
    };
    return map[status] ?? SubscriptionStatus.INCOMPLETE;
  }

  async upsertSubscriptionFromStripe(params: {
    billingAccountId: string;
    stripeSubscriptionId: string;
    stripePriceId: string;
    planId: string;
    interval: BillingInterval;
    status: SubscriptionStatus;
    currentPeriodStart?: Date | null;
    currentPeriodEnd?: Date | null;
    cancelAtPeriodEnd?: boolean;
    canceledAt?: Date | null;
    trialEnd?: Date | null;
    metadata?: Prisma.InputJsonValue;
  }) {
    return this.prisma.subscription.upsert({
      where: { stripeSubscriptionId: params.stripeSubscriptionId },
      create: {
        billingAccountId: params.billingAccountId,
        stripeSubscriptionId: params.stripeSubscriptionId,
        stripePriceId: params.stripePriceId,
        planId: params.planId,
        interval: params.interval,
        status: params.status,
        currentPeriodStart: params.currentPeriodStart ?? null,
        currentPeriodEnd: params.currentPeriodEnd ?? null,
        cancelAtPeriodEnd: params.cancelAtPeriodEnd ?? false,
        canceledAt: params.canceledAt ?? null,
        trialEnd: params.trialEnd ?? null,
        metadata: params.metadata,
      },
      update: {
        stripePriceId: params.stripePriceId,
        planId: params.planId,
        interval: params.interval,
        status: params.status,
        currentPeriodStart: params.currentPeriodStart ?? null,
        currentPeriodEnd: params.currentPeriodEnd ?? null,
        cancelAtPeriodEnd: params.cancelAtPeriodEnd ?? false,
        canceledAt: params.canceledAt ?? null,
        trialEnd: params.trialEnd ?? null,
        metadata: params.metadata,
      },
    });
  }
}
