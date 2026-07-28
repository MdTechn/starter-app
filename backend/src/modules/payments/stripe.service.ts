import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type Stripe from 'stripe';
import {
  BILLING_PLANS,
  BillingInterval,
  BillingPlanId,
  getBillingPlan,
  getPayableItem,
  getPlanAmount,
  PAYABLE_ITEMS,
} from '@saas-starter/shared';
import { stripeConfigFactory } from '../../config/stripe.config';
import { AppLogger } from '../../common/logger/app-logger.service';

type StripeConfig = ReturnType<typeof stripeConfigFactory>;
type StripeConstructor = new (
  key: string,
  config?: Stripe.StripeConfig,
) => Stripe;

/**
 * Stripe v22 exporte le constructeur en CJS (`module.exports = Stripe`).
 * Un `import Stripe from 'stripe'` est compilé en `require('stripe').default`
 * (undefined) — on résout donc via require.
 */
function resolveStripeConstructor(): StripeConstructor {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require('stripe') as
    StripeConstructor | { default: StripeConstructor };

  if (typeof mod === 'function') {
    return mod;
  }
  if (mod && typeof mod.default === 'function') {
    return mod.default;
  }
  throw new Error('Unable to resolve Stripe constructor');
}
@Injectable()
export class StripeService {
  private readonly config: StripeConfig;
  private client: Stripe | null = null;
  private initAttempted = false;

  constructor(
    private readonly configService: ConfigService,
    private readonly logger: AppLogger,
  ) {
    this.logger.setContext(StripeService.name);
    this.config =
      this.configService.get<StripeConfig>('stripe') ?? stripeConfigFactory();
    if (!this.config.secretKey) {
      this.logger.warn('STRIPE_SECRET_KEY missing — billing API disabled');
    }
  }

  isConfigured(): boolean {
    return Boolean(this.config.secretKey);
  }

  getPublishableKey(): string {
    return this.config.publishableKey;
  }

  getConfig(): StripeConfig {
    return this.config;
  }

  requireClient(): Stripe {
    const client = this.getClient();
    if (!client) {
      const reason = !this.config.secretKey
        ? 'STRIPE_SECRET_KEY is missing'
        : 'Stripe client failed to initialize';
      throw new ServiceUnavailableException({
        code: 'STRIPE_NOT_CONFIGURED',
        message: `Stripe is not configured (${reason})`,
      });
    }
    return client;
  }

  private getClient(): Stripe | null {
    if (this.client) return this.client;
    if (!this.config.secretKey) return null;
    if (this.initAttempted) return null;
    this.initAttempted = true;
    try {
      const StripeCtor = resolveStripeConstructor();
      this.client = new StripeCtor(this.config.secretKey);
      return this.client;
    } catch (err) {
      this.logger.error(
        `Failed to init Stripe client: ${err instanceof Error ? err.message : 'unknown'}`,
      );
      return null;
    }
  }

  /**
   * Stripe Price ID optionnel (env `STRIPE_PRICE_*`).
   * Si absent → Checkout utilise `price_data` + `recurring` (pas de création manuelle Dashboard).
   */
  resolvePriceId(
    planId: BillingPlanId,
    interval: BillingInterval,
  ): string | null {
    const { prices } = this.config;
    const priceId =
      planId === 'starter'
        ? interval === 'YEARLY'
          ? prices.starterYearly
          : prices.starterMonthly
        : interval === 'YEARLY'
          ? prices.proYearly
          : prices.proMonthly;
    return priceId || null;
  }

  /** Price ID catalogue abonnement (`sub-starter-monthly` → env), ou null. */
  resolvePayableSubscriptionPriceId(itemId: string): string | null {
    const { prices } = this.config;
    const map: Record<string, string> = {
      'sub-starter-monthly': prices.starterMonthly,
      'sub-starter-yearly': prices.starterYearly,
      'sub-pro-monthly': prices.proMonthly,
      'sub-pro-yearly': prices.proYearly,
    };
    return map[itemId] || null;
  }

  /** `price_data` one-shot (articles / legacy payment). */
  buildPriceData(
    planId: BillingPlanId,
    interval: BillingInterval,
  ): Stripe.Checkout.SessionCreateParams.LineItem.PriceData {
    const plan = getBillingPlan(planId);
    const unitAmount = getPlanAmount(planId, interval);
    if (!plan || unitAmount == null) {
      throw new BadRequestException({
        code: 'BILLING_PLAN_UNKNOWN',
        message: `Unknown billing plan=${planId} interval=${interval}`,
      });
    }

    return {
      currency: plan.currency,
      unit_amount: unitAmount,
      product_data: {
        name: `${plan.name} (${interval === 'YEARLY' ? 'annuel' : 'mensuel'})`,
        description: plan.description,
        metadata: {
          planId,
          interval,
        },
      },
    };
  }

  /**
   * `price_data` récurrent pour Checkout `mode=subscription` —
   * Stripe crée Product/Price à la volée (aucun setup Dashboard requis).
   */
  buildSubscriptionPriceData(
    planId: BillingPlanId,
    interval: BillingInterval,
  ): Stripe.Checkout.SessionCreateParams.LineItem.PriceData {
    const base = this.buildPriceData(planId, interval);
    return {
      ...base,
      recurring: {
        interval: interval === 'YEARLY' ? 'year' : 'month',
      },
    };
  }

  /** `price_data` récurrent pour un item catalogue type subscription. */
  buildPayableSubscriptionPriceData(
    itemId: string,
  ): Stripe.Checkout.SessionCreateParams.LineItem.PriceData {
    const item = getPayableItem(itemId);
    if (!item || item.type !== 'subscription') {
      throw new BadRequestException({
        code: 'PAYABLE_ITEM_UNKNOWN',
        message: `Unknown subscription item=${itemId}`,
      });
    }
    const recurringInterval = itemId.includes('yearly') ? 'year' : 'month';
    return {
      currency: item.currency,
      unit_amount: item.amount,
      recurring: { interval: recurringInterval },
      product_data: {
        name: item.name,
        description: item.description,
        metadata: {
          itemId: item.id,
          type: item.type,
        },
      },
    };
  }

  listPlans() {
    return BILLING_PLANS.map((plan) => ({
      id: plan.id,
      name: plan.name,
      description: plan.description,
      features: plan.features,
      currency: plan.currency,
      amounts: plan.amounts,
    }));
  }

  listPayableItems() {
    return PAYABLE_ITEMS.map((item) => ({ ...item }));
  }

  /** `price_data` depuis le catalogue articles / abonnements. */
  buildPayablePriceData(
    itemId: string,
  ): Stripe.Checkout.SessionCreateParams.LineItem.PriceData {
    const item = getPayableItem(itemId);
    if (!item) {
      throw new BadRequestException({
        code: 'PAYABLE_ITEM_UNKNOWN',
        message: `Unknown payable item=${itemId}`,
      });
    }

    return {
      currency: item.currency,
      unit_amount: item.amount,
      product_data: {
        name: item.name,
        description: item.description,
        metadata: {
          itemId: item.id,
          type: item.type,
        },
      },
    };
  }

  planIdFromPriceId(priceId: string): BillingPlanId {
    const { prices } = this.config;
    if (priceId === prices.starterMonthly || priceId === prices.starterYearly) {
      return 'starter';
    }
    if (priceId === prices.proMonthly || priceId === prices.proYearly) {
      return 'pro';
    }
    if (priceId.includes('pro')) return 'pro';
    return 'starter';
  }

  intervalFromPriceId(priceId: string): BillingInterval {
    const { prices } = this.config;
    if (
      priceId === prices.starterYearly ||
      priceId === prices.proYearly ||
      priceId.includes('YEARLY')
    ) {
      return 'YEARLY';
    }
    return 'MONTHLY';
  }

  constructWebhookEvent(rawBody: Buffer, signature: string): Stripe.Event {
    const secret = this.config.webhookSecret;
    if (!secret) {
      throw new BadRequestException({
        code: 'STRIPE_WEBHOOK_SECRET_MISSING',
        message: 'STRIPE_WEBHOOK_SECRET is not configured',
      });
    }
    try {
      return this.requireClient().webhooks.constructEvent(
        rawBody,
        signature,
        secret,
      );
    } catch (err) {
      this.logger.warn(
        `Webhook signature verification failed: ${err instanceof Error ? err.message : 'unknown'}`,
      );
      throw new BadRequestException({
        code: 'STRIPE_WEBHOOK_INVALID',
        message: 'Invalid Stripe webhook signature',
      });
    }
  }
}
