import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { FeatureAccessService } from './feature-access.service';
import { FeatureAccessGuard } from './guards/feature-access.guard';
import { PlanAccessGuard } from './guards/plan-access.guard';
import { StripeService } from './stripe.service';
import { StripeWebhookController } from './stripe-webhook.controller';
import { StripeWebhookService } from './stripe-webhook.service';

@Module({
  controllers: [BillingController, StripeWebhookController],
  providers: [
    StripeService,
    BillingService,
    StripeWebhookService,
    FeatureAccessService,
    FeatureAccessGuard,
    PlanAccessGuard,
    { provide: APP_GUARD, useClass: FeatureAccessGuard },
    { provide: APP_GUARD, useClass: PlanAccessGuard },
  ],
  exports: [
    StripeService,
    BillingService,
    FeatureAccessService,
    FeatureAccessGuard,
    PlanAccessGuard,
  ],
})
export class PaymentsModule {}
