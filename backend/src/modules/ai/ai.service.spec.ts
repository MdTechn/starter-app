import { HttpException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { MetricsService } from '../observability/metrics.service';
import { AiService } from './ai.service';
import { AI_PROVIDERS, AIProvider } from './providers/ai-provider.interface';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AppLogger } from '../../common/logger/app-logger.service';
import { CmsArticlesService } from '../cms/cms-articles.service';
import { AiRewriteMode } from './dto/ai.dto';

function mockProvider(
  name: 'groq' | 'gemini' | 'openai',
  opts: {
    configured?: boolean;
    translate?: jest.Mock;
    rewrite?: jest.Mock;
  } = {},
): AIProvider {
  return {
    name,
    isConfigured: () => opts.configured ?? true,
    translate:
      opts.translate ??
      jest.fn().mockResolvedValue({
        title: 'T',
        excerpt: null,
        content: 'C',
        tokensUsed: 10,
      }),
    rewrite:
      opts.rewrite ??
      jest.fn().mockResolvedValue({ text: 'rewritten', tokensUsed: 5 }),
  };
}

describe('AiService', () => {
  let service: AiService;
  let prisma: {
    aiUsage: {
      create: jest.Mock;
      aggregate: jest.Mock;
      groupBy: jest.Mock;
    };
    organizationMember: { findFirst: jest.Mock };
  };
  let articles: { findById: jest.Mock };
  let providers: AIProvider[];
  let metrics: { observeAi: jest.Mock };

  const aiConfig = {
    priority: ['groq', 'gemini', 'openai'] as const,
    dailyTokenQuota: 1000,
    maxInputChars: 12_000,
    timeoutMs: 30_000,
  };

  beforeEach(async () => {
    prisma = {
      aiUsage: {
        create: jest.fn().mockResolvedValue({ id: 'u1' }),
        aggregate: jest.fn().mockResolvedValue({
          _sum: { tokensUsed: 0 },
          _count: { _all: 0 },
        }),
        groupBy: jest.fn().mockResolvedValue([]),
      },
      organizationMember: {
        findFirst: jest.fn().mockResolvedValue({ organizationId: 'org1' }),
      },
    };
    articles = {
      findById: jest.fn().mockResolvedValue({
        id: 'art1',
        translations: [
          {
            locale: 'fr',
            title: 'Bonjour',
            excerpt: 'Extrait',
            content: 'Contenu FR',
            seoTitle: null,
            seoDescription: null,
          },
        ],
      }),
    };
    metrics = { observeAi: jest.fn() };

    const groq = mockProvider('groq');
    const gemini = mockProvider('gemini');
    const openai = mockProvider('openai', { configured: false });
    providers = [gemini, groq, openai];

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiService,
        { provide: PrismaService, useValue: prisma },
        { provide: CmsArticlesService, useValue: articles },
        { provide: MetricsService, useValue: metrics },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue(aiConfig) },
        },
        {
          provide: AppLogger,
          useValue: {
            setContext: jest.fn(),
            log: jest.fn(),
            warn: jest.fn(),
          },
        },
        { provide: AI_PROVIDERS, useValue: providers },
      ],
    }).compile();

    service = module.get(AiService);
  });

  describe('provider fallback', () => {
    it('uses first configured provider in priority order (groq)', async () => {
      const { provider } = await service.runWithFallback((p) =>
        p.rewrite({ text: 'hello', mode: 'ameliorer' }),
      );
      expect(provider).toBe('groq');
      expect(
        providers.find((p) => p.name === 'groq')!.rewrite,
      ).toHaveBeenCalled();
    });

    it('falls back to next provider when first fails', async () => {
      const groq = providers.find((p) => p.name === 'groq')!;
      const gemini = providers.find((p) => p.name === 'gemini')!;
      (groq.rewrite as jest.Mock).mockRejectedValueOnce(new Error('timeout'));
      (gemini.rewrite as jest.Mock).mockResolvedValueOnce({
        text: 'ok',
        tokensUsed: 3,
      });

      const { provider, result } = await service.runWithFallback((p) =>
        p.rewrite({ text: 'hello', mode: 'ameliorer' }),
      );

      expect(provider).toBe('gemini');
      expect(result.text).toBe('ok');
    });

    it('throws when all providers fail (timeouts)', async () => {
      for (const p of providers.filter((x) => x.isConfigured())) {
        (p.rewrite as jest.Mock).mockRejectedValue(new Error('timeout'));
      }
      await expect(
        service.runWithFallback((p) =>
          p.rewrite({ text: 'hello', mode: 'ameliorer' }),
        ),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
    });
  });

  describe('daily quota', () => {
    it('blocks with 429 when daily AiUsage tokens exceed quota', async () => {
      prisma.aiUsage.aggregate.mockResolvedValue({
        _sum: { tokensUsed: 1500 },
        _count: { _all: 10 },
      });

      await expect(
        service.assertDailyTokenQuota('user-1'),
      ).rejects.toBeInstanceOf(HttpException);

      try {
        await service.assertDailyTokenQuota('user-1');
        fail('expected HttpException');
      } catch (err) {
        expect(err).toBeInstanceOf(HttpException);
        expect((err as HttpException).getStatus()).toBe(429);
      }
    });
  });

  describe('AiUsage recording', () => {
    it('records usage with userId and organizationId after rewrite', async () => {
      await service.rewrite(
        { text: 'Hello world text', mode: AiRewriteMode.AMELIORER },
        'user-1',
      );

      expect(prisma.aiUsage.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-1',
          organizationId: 'org1',
          provider: 'groq',
          operation: 'rewrite:ameliorer',
          tokensUsed: 5,
        }),
      });
    });

    it('records usage after translate preview without persisting article', async () => {
      const result = await service.translate(
        {
          articleId: 'art1',
          sourceLocale: 'fr',
          targetLocale: 'en',
        },
        'user-1',
      );

      expect(result.preview).toBe(true);
      expect(result.translation).toEqual({
        title: 'T',
        excerpt: null,
        content: 'C',
      });
      expect(prisma.aiUsage.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-1',
          operation: 'translate',
          tokensUsed: 10,
        }),
      });
      // No CMS upsert side-effect via articles service beyond findById
      expect(articles.findById).toHaveBeenCalledWith('art1', undefined);
    });
  });

  describe('getUsage', () => {
    it('aggregates tokens and requests with filters', async () => {
      prisma.aiUsage.aggregate.mockResolvedValueOnce({
        _sum: { tokensUsed: 42 },
        _count: { _all: 3 },
      });
      prisma.aiUsage.groupBy
        .mockResolvedValueOnce([
          { provider: 'groq', _sum: { tokensUsed: 40 }, _count: { _all: 2 } },
        ])
        .mockResolvedValueOnce([
          {
            operation: 'translate',
            _sum: { tokensUsed: 40 },
            _count: { _all: 2 },
          },
        ]);

      const usage = await service.getUsage({
        userId: 'user-1',
        startDate: '2026-07-01',
        endDate: '2026-07-28',
      });

      expect(usage.totalRequests).toBe(3);
      expect(usage.totalTokens).toBe(42);
      expect(usage.byProvider[0]).toEqual({
        provider: 'groq',
        requests: 2,
        tokens: 40,
      });
    });
  });
});
