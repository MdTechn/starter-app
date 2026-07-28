import { Injectable } from '@nestjs/common';
import {
  BillingInterval,
  InvoiceStatus,
  PaymentStatus,
  Prisma,
} from '@prisma/client';
import Stripe from 'stripe';
import { AppNotificationEvent } from '@saas-starter/shared';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AppLogger } from '../../common/logger/app-logger.service';
import { NotificationDispatcher } from '../../common/events/notification-dispatcher';
import { BillingService } from './billing.service';
import { StripeService } from './stripe.service';

@Injectable()
export class StripeWebhookService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly billing: BillingService,
    private readonly stripe: StripeService,
    private readonly notifications: NotificationDispatcher,
    private readonly logger: AppLogger,
  ) {
    this.logger.setContext(StripeWebhookService.name);
  }

  async handleEvent(
    event: Stripe.Event,
  ): Promise<{ received: true; duplicate?: boolean }> {
    const existing = await this.prisma.processedWebhookEvent.findUnique({
      where: {
        provider_eventId: { provider: 'stripe', eventId: event.id },
      },
    });
    if (existing) {
      this.logger.log(`Stripe webhook duplicate ignored id=${event.id}`);
      return { received: true, duplicate: true };
    }

    this.logger.log(`Stripe webhook: ${event.type} id=${event.id}`);

    switch (event.type) {
      case 'checkout.session.completed':
        await this.onCheckoutCompleted(
          event.data.object as Stripe.Checkout.Session,
        );
        break;
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await this.onSubscriptionUpsert(
          event.data.object as Stripe.Subscription,
        );
        break;
      case 'customer.subscription.deleted':
        await this.onSubscriptionDeleted(
          event.data.object as Stripe.Subscription,
        );
        break;
      case 'invoice.paid':
        await this.onInvoicePaid(event.data.object as Stripe.Invoice);
        break;
      case 'invoice.payment_failed':
        await this.onInvoicePaymentFailed(event.data.object as Stripe.Invoice);
        break;
      default:
        this.logger.debug(`Unhandled Stripe event type=${event.type}`);
    }

    await this.prisma.processedWebhookEvent.create({
      data: {
        provider: 'stripe',
        eventId: event.id,
        eventType: event.type,
      },
    });

    return { received: true };
  }

  private async onCheckoutCompleted(session: Stripe.Checkout.Session) {
    const billingAccountId = session.metadata?.billingAccountId;
    const organizationId =
      session.metadata?.organizationId ?? session.client_reference_id ?? null;

    if (!billingAccountId && !organizationId) {
      const source = session.metadata?.source;
      if (source === 'admin-payments' || source === 'starter-billing') {
        // One-shot articles / legacy payment checkouts without billing account
        if (session.mode === 'payment') {
          await this.billing.recordCheckoutPayment(session);
        } else if (session.mode === 'subscription') {
          this.logger.warn(
            `Subscription checkout without billingAccountId session=${session.id} — cannot sync Subscription row`,
          );
        }
        this.logger.log(
          `Starter payment recorded source=${source} item=${session.metadata?.itemId ?? session.metadata?.planId} amount=${session.amount_total} ${session.currency}`,
        );
        return;
      }
      this.logger.warn('checkout.session.completed without org metadata');
      return;
    }

    let accountId = billingAccountId;
    if (!accountId && organizationId) {
      const account = await this.billing.ensureBillingAccount(organizationId);
      accountId = account.id;
    }
    if (!accountId) return;

    if (session.customer && typeof session.customer === 'string') {
      await this.prisma.stripeCustomer.upsert({
        where: { billingAccountId: accountId },
        create: {
          billingAccountId: accountId,
          stripeCustomerId: session.customer,
          email: session.customer_details?.email ?? null,
        },
        update: {
          stripeCustomerId: session.customer,
          email: session.customer_details?.email ?? undefined,
        },
      });
    }

    if (
      session.mode === 'subscription' &&
      session.subscription &&
      typeof session.subscription === 'string'
    ) {
      const stripe = this.stripe.requireClient();
      const sub = await stripe.subscriptions.retrieve(session.subscription);
      await this.onSubscriptionUpsert(sub, accountId, session.metadata ?? {});
      // Keep project payments list populated for SaaS checkouts
      if (session.payment_status === 'paid' || session.status === 'complete') {
        await this.billing.recordCheckoutPayment(session);
      }
      return;
    }

    if (session.mode === 'payment' && session.payment_status === 'paid') {
      await this.onOneTimeCheckoutPaid(session, accountId);
    }
  }

  private async onOneTimeCheckoutPaid(
    session: Stripe.Checkout.Session,
    billingAccountId: string,
  ) {
    const planId = session.metadata?.planId ?? 'starter';
    const interval =
      (session.metadata?.interval as BillingInterval | undefined) ??
      BillingInterval.MONTHLY;
    const paymentIntentId =
      typeof session.payment_intent === 'string'
        ? session.payment_intent
        : (session.payment_intent?.id ?? null);
    const amount = session.amount_total ?? 0;
    const currency = session.currency ?? 'eur';
    const paidAt = new Date();

    const periodStart = paidAt;
    const periodEnd = new Date(paidAt);
    if (interval === BillingInterval.YEARLY) {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    } else {
      periodEnd.setMonth(periodEnd.getMonth() + 1);
    }

    const subscription = await this.billing.upsertSubscriptionFromStripe({
      billingAccountId,
      stripeSubscriptionId: `checkout_${session.id}`,
      stripePriceId: `price_data:${planId}:${interval}`,
      planId,
      interval,
      status: this.billing.mapStripeSubscriptionStatus('active'),
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: false,
      metadata: {
        source: 'checkout.payment',
        checkoutSessionId: session.id,
        planId,
        interval,
      },
    });

    await this.upsertPayment({
      billingAccountId,
      subscriptionId: subscription.id,
      stripePaymentIntentId: paymentIntentId ?? `checkout_${session.id}`,
      stripeInvoiceId: null,
      amount,
      currency,
      status: PaymentStatus.SUCCEEDED,
      description: `Checkout ${planId} (${interval})`,
      paidAt,
      metadata: {
        checkoutSessionId: session.id,
        planId,
        interval,
      },
    });

    await this.notifyBillingAccount(
      billingAccountId,
      AppNotificationEvent.PAYMENT_SUCCESS,
      {
        amount: (amount / 100).toFixed(2),
        currency: currency.toUpperCase(),
        planId,
        interval,
      },
    );
  }

  private async onSubscriptionUpsert(
    sub: Stripe.Subscription,
    knownBillingAccountId?: string,
    extraMeta?: Stripe.Metadata,
  ) {
    const meta = { ...(sub.metadata ?? {}), ...(extraMeta ?? {}) };
    const item = sub.items.data[0];
    const priceId = item?.price?.id;
    if (!priceId) {
      this.logger.warn(`Subscription ${sub.id} has no price`);
      return;
    }

    const billingAccountId =
      knownBillingAccountId ??
      meta.billingAccountId ??
      (await this.resolveBillingAccountId(sub));

    if (!billingAccountId) {
      this.logger.warn(
        `Cannot resolve billing account for subscription ${sub.id}`,
      );
      return;
    }

    const planId = meta.planId ?? this.stripe.planIdFromPriceId(priceId);
    const interval =
      (meta.interval as BillingInterval | undefined) ??
      this.stripe.intervalFromPriceId(priceId);

    const periodStart =
      (sub as { current_period_start?: number }).current_period_start ??
      (item as { current_period_start?: number } | undefined)
        ?.current_period_start;
    const periodEnd =
      (sub as { current_period_end?: number }).current_period_end ??
      (item as { current_period_end?: number } | undefined)?.current_period_end;

    await this.billing.upsertSubscriptionFromStripe({
      billingAccountId,
      stripeSubscriptionId: sub.id,
      stripePriceId: priceId,
      planId,
      interval:
        interval === 'YEARLY'
          ? BillingInterval.YEARLY
          : BillingInterval.MONTHLY,
      status: this.billing.mapStripeSubscriptionStatus(sub.status),
      currentPeriodStart: this.ts(periodStart),
      currentPeriodEnd: this.ts(periodEnd),
      cancelAtPeriodEnd: sub.cancel_at_period_end,
      canceledAt: this.ts(sub.canceled_at),
      trialEnd: this.ts(sub.trial_end),
      metadata: meta as Prisma.InputJsonValue,
    });

    if (sub.status === 'active' || sub.status === 'trialing') {
      await this.notifyBillingAccount(
        billingAccountId,
        AppNotificationEvent.SUBSCRIPTION_CREATED,
        {
          planId,
          interval,
          organizationId: meta.organizationId,
          stripeSubscriptionId: sub.id,
        },
      );
    }
  }

  private async onSubscriptionDeleted(sub: Stripe.Subscription) {
    const existing = await this.prisma.subscription.findUnique({
      where: { stripeSubscriptionId: sub.id },
    });
    if (!existing) {
      await this.onSubscriptionUpsert(sub);
      return;
    }

    await this.prisma.subscription.update({
      where: { id: existing.id },
      data: {
        status: this.billing.mapStripeSubscriptionStatus('canceled'),
        canceledAt: this.ts(sub.canceled_at) ?? new Date(),
        cancelAtPeriodEnd: true,
      },
    });
  }

  private async onInvoicePaid(invoice: Stripe.Invoice) {
    const billingAccountId =
      await this.resolveBillingAccountFromInvoice(invoice);
    if (!billingAccountId) return;

    const subscriptionId = await this.resolveLocalSubscriptionId(invoice);
    const paidAt = this.ts(invoice.status_transitions?.paid_at) ?? new Date();

    await this.prisma.invoice.upsert({
      where: { stripeInvoiceId: invoice.id },
      create: {
        billingAccountId,
        subscriptionId,
        stripeInvoiceId: invoice.id,
        number: invoice.number,
        amountDue: invoice.amount_due,
        amountPaid: invoice.amount_paid,
        currency: invoice.currency,
        status: InvoiceStatus.PAID,
        hostedInvoiceUrl: invoice.hosted_invoice_url,
        invoicePdfUrl: invoice.invoice_pdf,
        periodStart: this.ts(invoice.period_start),
        periodEnd: this.ts(invoice.period_end),
        paidAt,
      },
      update: {
        amountDue: invoice.amount_due,
        amountPaid: invoice.amount_paid,
        status: InvoiceStatus.PAID,
        hostedInvoiceUrl: invoice.hosted_invoice_url,
        invoicePdfUrl: invoice.invoice_pdf,
        paidAt,
        subscriptionId,
      },
    });

    const paymentIntentId = this.extractPaymentIntentId(invoice);

    if (paymentIntentId || invoice.amount_paid > 0) {
      await this.upsertPayment({
        billingAccountId,
        subscriptionId,
        stripePaymentIntentId: paymentIntentId ?? null,
        stripeInvoiceId: invoice.id,
        amount: invoice.amount_paid,
        currency: invoice.currency,
        status: PaymentStatus.SUCCEEDED,
        description:
          invoice.description ?? `Invoice ${invoice.number ?? invoice.id}`,
        paidAt,
      });
    }

    await this.notifyBillingAccount(
      billingAccountId,
      AppNotificationEvent.PAYMENT_SUCCESS,
      {
        amount: (invoice.amount_paid / 100).toFixed(2),
        currency: invoice.currency?.toUpperCase(),
        invoiceNumber: invoice.number ?? invoice.id,
      },
    );
  }

  private async onInvoicePaymentFailed(invoice: Stripe.Invoice) {
    const billingAccountId =
      await this.resolveBillingAccountFromInvoice(invoice);
    if (!billingAccountId) return;

    const subscriptionId = await this.resolveLocalSubscriptionId(invoice);

    await this.prisma.invoice.upsert({
      where: { stripeInvoiceId: invoice.id },
      create: {
        billingAccountId,
        subscriptionId,
        stripeInvoiceId: invoice.id,
        number: invoice.number,
        amountDue: invoice.amount_due,
        amountPaid: invoice.amount_paid ?? 0,
        currency: invoice.currency,
        status: InvoiceStatus.OPEN,
        hostedInvoiceUrl: invoice.hosted_invoice_url,
        invoicePdfUrl: invoice.invoice_pdf,
        periodStart: this.ts(invoice.period_start),
        periodEnd: this.ts(invoice.period_end),
      },
      update: {
        amountDue: invoice.amount_due,
        status: InvoiceStatus.OPEN,
        subscriptionId,
      },
    });

    const paymentIntentId = this.extractPaymentIntentId(invoice);

    await this.upsertPayment({
      billingAccountId,
      subscriptionId,
      stripePaymentIntentId: paymentIntentId ?? `failed_${invoice.id}`,
      stripeInvoiceId: invoice.id,
      amount: invoice.amount_due,
      currency: invoice.currency,
      status: PaymentStatus.FAILED,
      description:
        invoice.description ?? `Failed invoice ${invoice.number ?? invoice.id}`,
      paidAt: null,
    });

    if (subscriptionId) {
      await this.prisma.subscription.update({
        where: { id: subscriptionId },
        data: { status: this.billing.mapStripeSubscriptionStatus('past_due') },
      });
    }

    await this.notifyBillingAccount(
      billingAccountId,
      AppNotificationEvent.PAYMENT_FAILED,
      {
        amount: (invoice.amount_due / 100).toFixed(2),
        currency: invoice.currency?.toUpperCase(),
        invoiceNumber: invoice.number ?? invoice.id,
      },
    );
  }

  private async notifyBillingAccount(
    billingAccountId: string,
    eventType: AppNotificationEvent,
    data: Record<string, unknown>,
  ) {
    const account = await this.prisma.billingAccount.findUnique({
      where: { id: billingAccountId },
      include: {
        organization: {
          include: {
            members: {
              include: {
                user: { select: { id: true, email: true, name: true } },
              },
            },
          },
        },
        stripeCustomer: true,
      },
    });
    if (!account) return;

    const members = account.organization.members;
    if (members.length === 0 && account.stripeCustomer?.email) {
      this.notifications.dispatch({
        eventType,
        email: account.stripeCustomer.email,
        data: {
          ...data,
          organizationId: account.organizationId,
        },
      });
      return;
    }

    for (const member of members) {
      this.notifications.dispatch({
        eventType,
        userId: member.user.id,
        email: member.user.email,
        data: {
          ...data,
          organizationId: account.organizationId,
          name: member.user.name ?? member.user.email,
        },
      });
    }
  }

  private extractPaymentIntentId(invoice: Stripe.Invoice): string | null {
    const raw = (
      invoice as { payment_intent?: string | { id?: string } | null }
    ).payment_intent;
    if (!raw) return null;
    return typeof raw === 'string' ? raw : (raw.id ?? null);
  }

  private async upsertPayment(data: {
    billingAccountId: string | null;
    subscriptionId: string | null;
    stripePaymentIntentId: string | null;
    stripeInvoiceId: string | null;
    amount: number;
    currency: string;
    status: PaymentStatus;
    description: string;
    paidAt: Date | null;
    payerName?: string | null;
    payerEmail?: string | null;
    stripeCheckoutSessionId?: string | null;
    metadata?: Prisma.InputJsonValue;
  }) {
    if (data.stripePaymentIntentId) {
      return this.prisma.payment.upsert({
        where: { stripePaymentIntentId: data.stripePaymentIntentId },
        create: {
          billingAccountId: data.billingAccountId,
          subscriptionId: data.subscriptionId,
          stripePaymentIntentId: data.stripePaymentIntentId,
          stripeCheckoutSessionId: data.stripeCheckoutSessionId ?? null,
          stripeInvoiceId: data.stripeInvoiceId,
          amount: data.amount,
          currency: data.currency,
          status: data.status,
          description: data.description,
          payerName: data.payerName ?? null,
          payerEmail: data.payerEmail ?? null,
          paidAt: data.paidAt,
          metadata: data.metadata,
        },
        update: {
          status: data.status,
          amount: data.amount,
          paidAt: data.paidAt,
          subscriptionId: data.subscriptionId,
          stripeInvoiceId: data.stripeInvoiceId,
          payerName: data.payerName ?? undefined,
          payerEmail: data.payerEmail ?? undefined,
          metadata: data.metadata,
        },
      });
    }

    return this.prisma.payment.create({
      data: {
        billingAccountId: data.billingAccountId,
        subscriptionId: data.subscriptionId,
        stripeCheckoutSessionId: data.stripeCheckoutSessionId ?? null,
        stripeInvoiceId: data.stripeInvoiceId,
        amount: data.amount,
        currency: data.currency,
        status: data.status,
        description: data.description,
        payerName: data.payerName ?? null,
        payerEmail: data.payerEmail ?? null,
        paidAt: data.paidAt,
        metadata: data.metadata,
      },
    });
  }

  private async resolveBillingAccountId(
    sub: Stripe.Subscription,
  ): Promise<string | null> {
    if (sub.metadata?.billingAccountId) {
      return sub.metadata.billingAccountId;
    }
    if (sub.metadata?.organizationId) {
      const account = await this.billing.ensureBillingAccount(
        sub.metadata.organizationId,
      );
      return account.id;
    }
    const customerId =
      typeof sub.customer === 'string' ? sub.customer : sub.customer?.id;
    if (!customerId) return null;

    const sc = await this.prisma.stripeCustomer.findUnique({
      where: { stripeCustomerId: customerId },
    });
    return sc?.billingAccountId ?? null;
  }

  private async resolveLocalSubscriptionId(
    invoice: Stripe.Invoice,
  ): Promise<string | null> {
    const subField = (
      invoice as { subscription?: string | { id?: string } | null }
    ).subscription;
    const subId = typeof subField === 'string' ? subField : subField?.id;
    if (!subId) return null;
    const local = await this.prisma.subscription.findUnique({
      where: { stripeSubscriptionId: subId },
    });
    return local?.id ?? null;
  }

  private async resolveBillingAccountFromInvoice(
    invoice: Stripe.Invoice,
  ): Promise<string | null> {
    const customerField = (
      invoice as { customer?: string | { id?: string } | null }
    ).customer;
    const customerId =
      typeof customerField === 'string' ? customerField : customerField?.id;
    if (customerId) {
      const sc = await this.prisma.stripeCustomer.findUnique({
        where: { stripeCustomerId: customerId },
      });
      if (sc) return sc.billingAccountId;
    }

    const subField = (
      invoice as { subscription?: string | { id?: string } | null }
    ).subscription;
    const subId = typeof subField === 'string' ? subField : subField?.id;
    if (subId) {
      const local = await this.prisma.subscription.findUnique({
        where: { stripeSubscriptionId: subId },
      });
      if (local) return local.billingAccountId;
    }
    return null;
  }

  private ts(value?: number | null): Date | null {
    if (!value) return null;
    return new Date(value * 1000);
  }
}
