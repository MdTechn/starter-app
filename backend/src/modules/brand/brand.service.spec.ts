import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { resolveBrandConfig } from '@saas-starter/shared';
import { BrandService } from './brand.service';
import { BrandController } from './brand.controller';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AppLogger } from '../../common/logger/app-logger.service';

describe('resolveBrandConfig', () => {
  it('loads defaults when env empty', () => {
    const brand = resolveBrandConfig({});
    expect(brand.appName).toBe('SaaS Starter');
    expect(brand.theme).toBe('light');
    expect(brand.logoUrl).toContain('/branding/');
  });

  it('maps white-label env variables', () => {
    const brand = resolveBrandConfig({
      APP_NAME: 'Acme Cloud',
      COMPANY_NAME: 'Acme Corp',
      PRIMARY_COLOR: '#ff5500',
      BRAND_THEME: 'light',
      SUPPORT_EMAIL: 'help@acme.test',
    });
    expect(brand.appName).toBe('Acme Cloud');
    expect(brand.companyName).toBe('Acme Corp');
    expect(brand.primaryColor).toBe('#ff5500');
    expect(brand.theme).toBe('light');
    expect(brand.supportEmail).toBe('help@acme.test');
  });

  it('accepts NEXT_PUBLIC_* aliases without breaking change', () => {
    const brand = resolveBrandConfig({
      NEXT_PUBLIC_APP_NAME: 'Legacy Name',
    });
    expect(brand.appName).toBe('Legacy Name');
  });
});

describe('BrandController', () => {
  let controller: BrandController;
  let service: {
    getConfig: jest.Mock;
    getPreviewPayload: jest.Mock;
    update: jest.Mock;
    uploadLogo: jest.Mock;
  };

  beforeEach(async () => {
    service = {
      getConfig: jest.fn().mockResolvedValue({ appName: 'Acme' }),
      getPreviewPayload: jest.fn().mockResolvedValue({
        brand: { appName: 'Acme' },
        cssVariables: {},
      }),
      update: jest.fn().mockResolvedValue({ appName: 'Updated' }),
      uploadLogo: jest
        .fn()
        .mockResolvedValue({ logoUrl: '/branding/logo.png' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [BrandController],
      providers: [{ provide: BrandService, useValue: service }],
    }).compile();

    controller = module.get(BrandController);
  });

  it('exposes public brand config', async () => {
    await expect(controller.getBrand()).resolves.toEqual({ appName: 'Acme' });
  });

  it('exposes admin preview', async () => {
    const preview = await controller.preview();
    expect(preview.brand.appName).toBe('Acme');
  });

  it('updates brand settings', async () => {
    await expect(
      controller.update({ appName: 'Updated', primaryColor: '#112233' }),
    ).resolves.toEqual({ appName: 'Updated' });
    expect(service.update).toHaveBeenCalled();
  });
});

describe('BrandService', () => {
  it('merges DB overrides over env config', async () => {
    const prisma = {
      brandSettings: {
        findUnique: jest.fn().mockResolvedValue({
          appName: 'FromDb',
          companyName: null,
          appUrl: null,
          logoUrl: null,
          faviconUrl: null,
          primaryColor: '#abcdef',
          secondaryColor: null,
          theme: null,
          fontFamily: null,
          iconUrl: null,
          appleTouchIconUrl: null,
          supportEmail: null,
          supportUrl: null,
          metaDescription: null,
        }),
        upsert: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BrandService,
        {
          provide: ConfigService,
          useValue: {
            get: () => ({
              appName: 'FromConfig',
              companyName: 'Co',
              appUrl: 'http://localhost:3000',
              logoUrl: '/branding/logo.svg',
              faviconUrl: '/branding/favicon.svg',
              primaryColor: '#3d9cf0',
              secondaryColor: '#1e3a5f',
              theme: 'light',
              fontFamily: 'sans-serif',
              iconUrl: '/branding/icon-192.svg',
              appleTouchIconUrl: '/branding/apple-touch-icon.svg',
              supportEmail: 'a@b.c',
              supportUrl: 'http://localhost:3000',
              metaDescription: 'desc',
            }),
          },
        },
        { provide: PrismaService, useValue: prisma },
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

    const brand = module.get(BrandService);
    const config = await brand.getConfig();
    expect(config.appName).toBe('FromDb');
    expect(config.primaryColor).toBe('#abcdef');
    expect(config.companyName).toBe('Co');
  });
});
