import { registerAs } from '@nestjs/config';

export const stripeConfigFactory = () => ({
  secretKey: process.env.STRIPE_SECRET_KEY ?? '',
  webhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? '',
  /** Prefer STRIPE_PUBLIC_KEY; keep STRIPE_PUBLISHABLE_KEY as alias. */
  publishableKey:
    process.env.STRIPE_PUBLIC_KEY ?? process.env.STRIPE_PUBLISHABLE_KEY ?? '',
  prices: {
    starterMonthly: process.env.STRIPE_PRICE_STARTER_MONTHLY ?? '',
    starterYearly: process.env.STRIPE_PRICE_STARTER_YEARLY ?? '',
    proMonthly: process.env.STRIPE_PRICE_PRO_MONTHLY ?? '',
    proYearly: process.env.STRIPE_PRICE_PRO_YEARLY ?? '',
  },
  successUrl:
    process.env.STRIPE_CHECKOUT_SUCCESS_URL ??
    `${process.env.FRONTEND_URL ?? 'http://localhost:3000'}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
  cancelUrl:
    process.env.STRIPE_CHECKOUT_CANCEL_URL ??
    `${process.env.FRONTEND_URL ?? 'http://localhost:3000'}/billing?canceled=1`,
  portalReturnUrl:
    process.env.STRIPE_PORTAL_RETURN_URL ??
    `${process.env.FRONTEND_URL ?? 'http://localhost:3000'}/billing`,
});

export default registerAs('stripe', stripeConfigFactory);
