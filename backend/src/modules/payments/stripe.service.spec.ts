import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BadRequestException } from '@nestjs/common';
import { StripeService } from './stripe.service';
import { AppLogger } from '../../common/logger/app-logger.service';

describe('StripeService', () => {
  const logger = {
    setContext: jest.fn(),
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };

  const build = async (env: Record<string, string> = {}) => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StripeService,
        {
          provide: ConfigService,
          useValue: {
            get: () => ({
              secretKey: env.secretKey ?? '',
              webhookSecret: env.webhookSecret ?? '',
              publishableKey: env.publishableKey ?? '',
              prices: {
                starterMonthly: env.starterMonthly ?? 'price_starter_m',
                starterYearly: env.starterYearly ?? 'price_starter_y',
                proMonthly: env.proMonthly ?? 'price_pro_m',
                proYearly: env.proYearly ?? 'price_pro_y',
              },
              successUrl: 'http://localhost:3000/billing/success',
              cancelUrl: 'http://localhost:3000/billing',
              portalReturnUrl: 'http://localhost:3000/billing',
            }),
          },
        },
        { provide: AppLogger, useValue: logger },
      ],
    }).compile();
    return module.get(StripeService);
  };

  it('isConfigured is false without secret key', async () => {
    const service = await build();
    expect(service.isConfigured()).toBe(false);
  });

  it('isConfigured is true with secret key', async () => {
    const service = await build({ secretKey: 'sk_test_123' });
    expect(service.isConfigured()).toBe(true);
  });

  it('builds dynamic price_data for plans', async () => {
    const service = await build({ secretKey: 'sk_test' });
    expect(service.buildPriceData('starter', 'MONTHLY')).toEqual(
      expect.objectContaining({
        currency: 'eur',
        unit_amount: 900,
        product_data: expect.objectContaining({
          name: expect.stringContaining('Starter'),
        }),
      }),
    );
    expect(service.buildPriceData('pro', 'YEARLY').unit_amount).toBe(29000);
  });

  it('maps price id back to plan and interval', async () => {
    const service = await build({ secretKey: 'sk_test' });
    expect(service.planIdFromPriceId('price_pro_m')).toBe('pro');
    expect(service.intervalFromPriceId('price_starter_y')).toBe('YEARLY');
  });

  it('resolves configured Stripe Price IDs for subscription checkout', async () => {
    const service = await build({ secretKey: 'sk_test' });
    expect(service.resolvePriceId('starter', 'MONTHLY')).toBe(
      'price_starter_m',
    );
    expect(service.resolvePriceId('pro', 'YEARLY')).toBe('price_pro_y');
  });

  it('returns null when Stripe Price ID is not configured', async () => {
    const service = await build({
      secretKey: 'sk_test',
      starterMonthly: '',
    });
    expect(service.resolvePriceId('starter', 'MONTHLY')).toBeNull();
  });

  it('builds subscription price_data with recurring', async () => {
    const service = await build({ secretKey: 'sk_test' });
    expect(service.buildSubscriptionPriceData('starter', 'MONTHLY')).toEqual(
      expect.objectContaining({
        currency: 'eur',
        unit_amount: 900,
        recurring: { interval: 'month' },
      }),
    );
    expect(
      service.buildSubscriptionPriceData('pro', 'YEARLY').recurring,
    ).toEqual({ interval: 'year' });
  });

  it('lists plans with amounts', async () => {
    const service = await build({ secretKey: 'sk_test' });
    const plans = service.listPlans();
    expect(plans[0].id).toBe('starter');
    expect(plans[0].amounts.monthly).toBe(900);
  });

  it('lists payable items and builds price_data', async () => {
    const service = await build({ secretKey: 'sk_test' });
    const items = service.listPayableItems();
    expect(items.length).toBeGreaterThan(0);
    expect(service.buildPayablePriceData(items[0].id)).toEqual(
      expect.objectContaining({
        currency: items[0].currency,
        unit_amount: items[0].amount,
      }),
    );
  });

  it('rejects webhook without secret', async () => {
    const service = await build({ secretKey: 'sk_test' });
    expect(() =>
      service.constructWebhookEvent(Buffer.from('{}'), 'sig'),
    ).toThrow(BadRequestException);
  });
});
