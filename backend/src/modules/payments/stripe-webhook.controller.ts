import { Controller, Headers, Post, RawBodyRequest, Req } from '@nestjs/common';
import { ApiExcludeController, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { StripeService } from './stripe.service';
import { StripeWebhookService } from './stripe-webhook.service';

@ApiTags('billing')
@ApiExcludeController()
@Controller('billing/webhooks')
export class StripeWebhookController {
  constructor(
    private readonly stripe: StripeService,
    private readonly webhooks: StripeWebhookService,
  ) {}

  @Public()
  @Post('stripe')
  async handleStripe(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ) {
    const rawBody = req.rawBody;
    if (!rawBody || !signature) {
      return { received: false, error: 'Missing body or signature' };
    }

    const event = this.stripe.constructWebhookEvent(rawBody, signature);
    return this.webhooks.handleEvent(event);
  }
}
