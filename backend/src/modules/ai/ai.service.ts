import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { AiConfig, AiProviderId } from '../../config/ai.config';
import { AppLogger } from '../../common/logger/app-logger.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CmsArticlesService } from '../cms/cms-articles.service';
import { MetricsService } from '../observability/metrics.service';
import {
  AiRewriteMode,
  AiUsageQueryDto,
  RewriteDto,
  TranslateDto,
} from './dto/ai.dto';
import {
  AI_PROVIDERS,
  AIProvider,
  AiProviderName,
  AiRewriteOutput,
  AiTranslateOutput,
} from './providers/ai-provider.interface';

@Injectable()
export class AiService {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly articles: CmsArticlesService,
    private readonly logger: AppLogger,
    private readonly metrics: MetricsService,
    @Inject(AI_PROVIDERS) private readonly providers: AIProvider[],
  ) {
    this.logger.setContext(AiService.name);
  }

  private aiConfig(): AiConfig {
    return this.config.get<AiConfig>('ai')!;
  }

  /** Providers that have an API key, ordered by AI_PROVIDER_PRIORITY. */
  getAvailableProviders(): AIProvider[] {
    const priority = this.aiConfig().priority;
    const byName = new Map(this.providers.map((p) => [p.name, p]));
    const ordered: AIProvider[] = [];
    for (const id of priority) {
      const p = byName.get(id);
      if (p?.isConfigured()) ordered.push(p);
    }
    for (const p of this.providers) {
      if (p.isConfigured() && !ordered.includes(p)) ordered.push(p);
    }
    return ordered;
  }

  status() {
    const available = this.getAvailableProviders().map((p) => p.name);
    return {
      priority: this.aiConfig().priority,
      available,
      active: available[0] ?? null,
    };
  }

  /**
   * Preview translation — does NOT persist CmsTranslation.
   * Caller must upsert via CMS API after user accepts.
   */
  async translate(
    dto: TranslateDto,
    actorUserId?: string | null,
    actor?: { userId?: string; roles?: string[] },
  ) {
    await this.assertDailyTokenQuota(actorUserId);

    const sourceLocale = dto.sourceLocale.toLowerCase();
    const targetLocale = dto.targetLocale.toLowerCase();

    if (sourceLocale === targetLocale) {
      throw new BadRequestException(
        'sourceLocale and targetLocale must differ',
      );
    }

    const article = await this.articles.findById(dto.articleId, actor);
    const source = article.translations.find((t) => t.locale === sourceLocale);
    if (!source) {
      throw new BadRequestException(
        `No translation found for source locale « ${sourceLocale} »`,
      );
    }

    if (!source.title?.trim() && !source.content?.trim()) {
      throw new BadRequestException('Source translation is empty');
    }

    const max = this.aiConfig().maxInputChars;
    const title = source.title.slice(0, Math.min(500, max));
    const excerpt = (source.excerpt ?? '').slice(0, Math.min(1000, max));
    const content = source.content.slice(0, max);

    const { result, provider } = await this.runWithFallback(
      (p) =>
        p.translate({
          title,
          excerpt: excerpt || null,
          content,
          sourceLocale,
          targetLocale,
        }),
      'translate',
    );

    await this.recordUsage({
      userId: actorUserId,
      provider,
      operation: 'translate',
      tokensUsed: result.tokensUsed,
    });

    return {
      ok: true,
      preview: true,
      provider,
      sourceLocale,
      targetLocale,
      tokensUsed: result.tokensUsed,
      translation: {
        title: result.title,
        excerpt: result.excerpt,
        content: result.content,
      },
    };
  }

  async rewrite(dto: RewriteDto, actorUserId?: string | null) {
    await this.assertDailyTokenQuota(actorUserId);

    const text = dto.text.trim();
    if (!text) {
      throw new BadRequestException('text must not be empty');
    }

    const max = this.aiConfig().maxInputChars;
    const truncated = text.slice(0, max);
    if (truncated.length < 3) {
      throw new BadRequestException('text is too short to rewrite');
    }

    const mode = dto.mode as AiRewriteMode;
    const { result, provider } = await this.runWithFallback(
      (p) => p.rewrite({ text: truncated, mode }),
      `rewrite:${mode}`,
    );

    await this.recordUsage({
      userId: actorUserId,
      provider,
      operation: `rewrite:${mode}`,
      tokensUsed: result.tokensUsed,
    });

    return {
      ok: true,
      provider,
      mode,
      tokensUsed: result.tokensUsed,
      text: result.text,
      truncated: text.length > max,
    };
  }

  async getUsage(query: AiUsageQueryDto) {
    const where: Prisma.AiUsageWhereInput = {};

    if (query.userId) {
      where.userId = query.userId;
    }

    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate) {
        where.createdAt.gte = new Date(query.startDate);
      }
      if (query.endDate) {
        const end = new Date(query.endDate);
        // Inclusive end-of-day when date-only string.
        if (/^\d{4}-\d{2}-\d{2}$/.test(query.endDate)) {
          end.setUTCHours(23, 59, 59, 999);
        }
        where.createdAt.lte = end;
      }
    }

    const [totalAgg, byProvider, byOperation] = await Promise.all([
      this.prisma.aiUsage.aggregate({
        where,
        _sum: { tokensUsed: true },
        _count: { _all: true },
      }),
      this.prisma.aiUsage.groupBy({
        by: ['provider'],
        where,
        _sum: { tokensUsed: true },
        _count: { _all: true },
        orderBy: { provider: 'asc' },
      }),
      this.prisma.aiUsage.groupBy({
        by: ['operation'],
        where,
        _sum: { tokensUsed: true },
        _count: { _all: true },
        orderBy: { operation: 'asc' },
      }),
    ]);

    return {
      startDate: query.startDate ?? null,
      endDate: query.endDate ?? null,
      userId: query.userId ?? null,
      totalRequests: totalAgg._count._all,
      totalTokens: totalAgg._sum.tokensUsed ?? 0,
      byProvider: byProvider.map((row) => ({
        provider: row.provider,
        requests: row._count._all,
        tokens: row._sum.tokensUsed ?? 0,
      })),
      byOperation: byOperation.map((row) => ({
        operation: row.operation,
        requests: row._count._all,
        tokens: row._sum.tokensUsed ?? 0,
      })),
    };
  }

  /** Exposed for tests — runs provider chain with fallback. */
  async runWithFallback<T extends AiTranslateOutput | AiRewriteOutput>(
    fn: (provider: AIProvider) => Promise<T>,
    operation = 'unknown',
  ): Promise<{ result: T; provider: AiProviderName }> {
    const chain = this.getAvailableProviders();
    if (chain.length === 0) {
      throw new ServiceUnavailableException(
        'No AI provider configured. Set GROQ_API_KEY (preferred free, like HopMed), GEMINI_API_KEY, or OPENAI_API_KEY.',
      );
    }

    const errors: string[] = [];
    for (const provider of chain) {
      const started = process.hrtime.bigint();
      try {
        const result = await fn(provider);
        const seconds = Number(process.hrtime.bigint() - started) / 1e9;
        this.metrics.observeAi({
          operation,
          provider: provider.name,
          status: 'success',
          tokens: result.tokensUsed,
          seconds,
        });
        return { result, provider: provider.name };
      } catch (err) {
        const seconds = Number(process.hrtime.bigint() - started) / 1e9;
        this.metrics.observeAi({
          operation,
          provider: provider.name,
          status: 'error',
          seconds,
        });
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(`AI provider ${provider.name} failed: ${msg}`);
        errors.push(`${provider.name}: ${msg}`);
      }
    }

    throw new ServiceUnavailableException(
      `All AI providers failed. ${errors.join(' | ')}`,
    );
  }

  async assertDailyTokenQuota(userId?: string | null): Promise<void> {
    const quota = this.aiConfig().dailyTokenQuota;
    if (!quota || quota <= 0) return;

    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);

    const where: Prisma.AiUsageWhereInput = {
      createdAt: { gte: startOfDay },
      ...(userId ? { userId } : {}),
    };

    const agg = await this.prisma.aiUsage.aggregate({
      where,
      _sum: { tokensUsed: true },
    });
    const used = agg._sum.tokensUsed ?? 0;
    if (used >= quota) {
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: `Daily AI token quota exceeded (${used}/${quota}).`,
          code: 'AI_DAILY_QUOTA_EXCEEDED',
          used,
          quota,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  async recordUsage(input: {
    userId?: string | null;
    provider: AiProviderId | AiProviderName;
    operation: string;
    tokensUsed: number;
  }) {
    try {
      const organizationId = input.userId
        ? await this.resolveOrganizationId(input.userId)
        : null;
      await this.prisma.aiUsage.create({
        data: {
          organizationId,
          userId: input.userId ?? null,
          provider: input.provider,
          operation: input.operation,
          tokensUsed: Math.max(0, Math.round(input.tokensUsed)),
        },
      });
    } catch (err) {
      this.logger.warn(
        `Failed to record AiUsage: ${err instanceof Error ? err.message : 'unknown'}`,
      );
    }
  }

  private async resolveOrganizationId(userId: string): Promise<string | null> {
    const membership = await this.prisma.organizationMember.findFirst({
      where: { userId },
      orderBy: { createdAt: 'asc' },
      select: { organizationId: true },
    });
    return membership?.organizationId ?? null;
  }
}
