import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Permission } from '@saas-starter/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { AuthenticatedUser } from '../../common/types/authenticated-user';
import { BillingService } from './billing.service';
import { FeatureAccessService } from './feature-access.service';
import {
  CreateCheckoutDto,
  CreateItemCheckoutDto,
  SyncCheckoutDto,
} from './dto/billing.dto';

@ApiTags('billing')
@ApiBearerAuth()
@Controller('billing')
export class BillingController {
  constructor(
    private readonly billing: BillingService,
    private readonly features: FeatureAccessService,
  ) {}

  @Get('plans')
  @Permissions(Permission.BILLING_READ)
  @ApiOperation({ summary: 'List billing plans + Stripe config status' })
  plans() {
    return this.billing.listPlans();
  }

  @Get('items')
  @Permissions(Permission.BILLING_READ)
  @ApiOperation({
    summary: 'List payable articles / subscriptions (project catalog)',
  })
  items() {
    return this.billing.listPayableItems();
  }

  @Get('subscription')
  @Permissions(Permission.BILLING_READ)
  @ApiOperation({ summary: 'Current user subscription status' })
  async subscription(@CurrentUser() actor: AuthenticatedUser) {
    if (!actor.userId) {
      throw new ForbiddenException('User not synced');
    }
    return this.billing.getSubscriptionForUser(actor.userId);
  }

  @Get('features')
  @Permissions(Permission.BILLING_READ)
  @ApiOperation({
    summary: 'Feature access summary for the current user (plan gating)',
  })
  async featureAccess(@CurrentUser() actor: AuthenticatedUser) {
    if (!actor.userId) {
      throw new ForbiddenException('User not synced');
    }
    return this.features.getAccessSummary(actor.userId);
  }

  @Get('payments')
  @Permissions(Permission.BILLING_READ)
  @ApiOperation({
    summary: 'List completed project payments (date, amount, payer)',
  })
  async payments(@Query('limit') limit?: string) {
    const parsed = limit ? Number(limit) : 50;
    return this.billing.listProjectPayments(
      Number.isFinite(parsed) ? parsed : 50,
    );
  }

  @Post('checkout')
  @Permissions(Permission.BILLING_WRITE)
  @ApiOperation({
    summary:
      'Create Stripe Checkout (mode=subscription) for a starter/pro plan',
  })
  async checkout(
    @Body() dto: CreateCheckoutDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    if (!actor.userId) {
      throw new ForbiddenException('User not synced');
    }
    return this.billing.createCheckoutSession({
      planId: dto.planId,
      interval: dto.interval,
      userId: actor.userId,
      customerEmail: actor.email,
      payerName: actor.name ?? actor.username ?? actor.email,
      cancelUrl: dto.cancelUrl,
    });
  }

  @Post('checkout-item')
  @Permissions(Permission.BILLING_WRITE)
  @ApiOperation({
    summary:
      'Create Stripe Checkout for a catalog item (subscription items use mode=subscription when Price IDs are set)',
  })
  async checkoutItem(
    @Body() dto: CreateItemCheckoutDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.billing.createItemCheckoutSession({
      itemId: dto.itemId,
      userId: actor.userId,
      customerEmail: actor.email,
      payerName: actor.name ?? actor.username ?? actor.email,
      cancelUrl: dto.cancelUrl,
    });
  }

  /**
   * Customer Portal Stripe — gérer moyen de paiement / annuler / voir abo.
   * Alias documenté aussi comme `/billing/portal`.
   */
  @Post('customer-portal')
  @Permissions(Permission.BILLING_WRITE)
  @ApiOperation({
    summary:
      'Create Stripe Customer Portal session (manage / cancel subscription)',
  })
  async customerPortal(@CurrentUser() actor: AuthenticatedUser) {
    if (!actor.userId) {
      throw new ForbiddenException('User not synced');
    }
    return this.billing.createCustomerPortalSession(actor.userId);
  }

  @Post('portal')
  @Permissions(Permission.BILLING_WRITE)
  @ApiOperation({
    summary: 'Alias of POST /billing/customer-portal',
  })
  async portal(@CurrentUser() actor: AuthenticatedUser) {
    return this.customerPortal(actor);
  }

  @Post('checkout/sync')
  @Permissions(Permission.BILLING_WRITE)
  @ApiOperation({
    summary:
      'Sync a completed Checkout session (payment or subscription) into Prisma',
  })
  async syncCheckout(@Body() body: SyncCheckoutDto) {
    return this.billing.syncCheckoutSession(body.sessionId);
  }
}
