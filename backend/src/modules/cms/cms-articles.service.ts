import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CmsArticleStatus as PrismaCmsStatus, Prisma } from '@prisma/client';
import {
  AppCmsEvent,
  AppNotificationEvent,
  CMS_DOMAIN_EVENT,
  CmsArticleStatus,
  CmsDomainEventPayload,
  normalizePagination,
} from '@saas-starter/shared';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AppLogger } from '../../common/logger/app-logger.service';
import { NotificationDispatcher } from '../../common/events/notification-dispatcher';
import { OrganizationScopeService } from '../organizations/organization-scope.service';
import { StorageService } from '../storage/storage.service';
import { CmsFoldersService, OrgActor } from './cms-folders.service';
import {
  AttachCmsFileDto,
  CreateCmsArticleDto,
  ListCmsArticlesQueryDto,
  RollbackCmsVersionDto,
  UpdateCmsArticleDto,
  UpsertCmsTranslationDto,
} from './dto/cms.dto';

const ARTICLE_INCLUDE = {
  translations: { orderBy: { locale: 'asc' as const } },
  folder: {
    select: { id: true, code: true, name: true, organizationId: true },
  },
  versions: {
    orderBy: { version: 'desc' as const },
    take: 10,
    select: {
      id: true,
      version: true,
      note: true,
      createdById: true,
      createdAt: true,
    },
  },
} satisfies Prisma.CmsArticleInclude;

@Injectable()
export class CmsArticlesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly folders: CmsFoldersService,
    private readonly storage: StorageService,
    private readonly events: EventEmitter2,
    private readonly notifications: NotificationDispatcher,
    private readonly orgScope: OrganizationScopeService,
    private readonly logger: AppLogger,
  ) {
    this.logger.setContext(CmsArticlesService.name);
  }

  async list(query: ListCmsArticlesQueryDto = {}, actor?: OrgActor) {
    const { page, pageSize, skip, take } = normalizePagination(query);
    const orgFilter = actor
      ? await this.orgScope.orgWhere(actor.userId, actor.roles)
      : {};
    const where: Prisma.CmsArticleWhereInput = {
      ...orgFilter,
      ...(query.folderId ? { folderId: query.folderId } : {}),
      ...(query.status ? { status: query.status as PrismaCmsStatus } : {}),
      ...(query.q
        ? {
            OR: [
              { slug: { contains: query.q, mode: 'insensitive' } },
              {
                translations: {
                  some: {
                    OR: [
                      { title: { contains: query.q, mode: 'insensitive' } },
                      { excerpt: { contains: query.q, mode: 'insensitive' } },
                    ],
                  },
                },
              },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.cmsArticle.findMany({
        where,
        skip,
        take,
        orderBy: { updatedAt: 'desc' },
        include: {
          translations: {
            select: { id: true, locale: true, title: true },
            orderBy: { locale: 'asc' },
          },
          folder: { select: { id: true, code: true, name: true } },
          _count: { select: { versions: true } },
        },
      }),
      this.prisma.cmsArticle.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  async findById(id: string, actor?: OrgActor) {
    const article = await this.prisma.cmsArticle.findUnique({
      where: { id },
      include: ARTICLE_INCLUDE,
    });
    if (!article) {
      throw new NotFoundException('CMS article not found');
    }
    await this.assertReadable(article.organizationId, actor);
    const attachments = await this.prisma.fileAsset.findMany({
      where: { ownerType: 'CmsArticle', ownerId: id },
      orderBy: { createdAt: 'desc' },
    });
    return { ...article, attachments };
  }

  async create(
    dto: CreateCmsArticleDto,
    actorUserId?: string | null,
    actor?: OrgActor,
  ) {
    const folder = await this.folders.requireFolder(dto.folderId, actor);
    const locale = (dto.locale ?? 'en').toLowerCase();
    const organizationId =
      dto.organizationId ??
      folder.organizationId ??
      (await this.orgScope.resolveOrganizationIdForWrite(
        actor?.userId ?? actorUserId ?? undefined,
        actor?.roles,
        dto.organizationId,
      ));

    if (actor) {
      await this.orgScope.assertCanAccessOrganization(
        actor.userId,
        organizationId,
        actor.roles,
      );
    }

    try {
      const article = await this.prisma.$transaction(async (tx) => {
        const created = await tx.cmsArticle.create({
          data: {
            folderId: dto.folderId,
            organizationId,
            slug: dto.slug.toLowerCase(),
            status: (dto.status ?? CmsArticleStatus.DRAFT) as PrismaCmsStatus,
            createdById: actorUserId ?? null,
            updatedById: actorUserId ?? null,
            translations: {
              create: {
                locale,
                title: dto.title,
                excerpt: dto.excerpt,
                content: dto.content,
              },
            },
          },
          include: ARTICLE_INCLUDE,
        });

        await this.createVersionSnapshot(
          tx,
          created.id,
          actorUserId,
          'Initial version',
        );
        return created;
      });

      this.emit({
        event: AppCmsEvent.CMS_CREATED,
        articleId: article.id,
        slug: article.slug,
        folderId: article.folderId,
        status: article.status,
        actorUserId,
        locale,
      });

      this.logger.log(
        `CMS article created id=${article.id} slug=${article.slug} org=${organizationId}`,
      );
      return this.findById(article.id, actor);
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException('CMS article slug already exists');
      }
      throw err;
    }
  }

  async update(
    id: string,
    dto: UpdateCmsArticleDto,
    actorUserId?: string | null,
    actor?: OrgActor,
  ) {
    const existing = await this.requireArticle(id, actor);
    if (dto.folderId) {
      await this.folders.requireFolder(dto.folderId, actor);
    }

    try {
      const article = await this.prisma.$transaction(async (tx) => {
        const updated = await tx.cmsArticle.update({
          where: { id },
          data: {
            ...(dto.folderId !== undefined ? { folderId: dto.folderId } : {}),
            ...(dto.slug !== undefined ? { slug: dto.slug.toLowerCase() } : {}),
            ...(dto.status !== undefined
              ? { status: dto.status as PrismaCmsStatus }
              : {}),
            updatedById: actorUserId ?? null,
            ...(dto.status === CmsArticleStatus.PUBLISHED &&
            existing.status !== PrismaCmsStatus.PUBLISHED
              ? { publishedAt: new Date() }
              : {}),
          },
          include: ARTICLE_INCLUDE,
        });
        await this.createVersionSnapshot(
          tx,
          id,
          actorUserId,
          'Article updated',
        );
        return updated;
      });

      this.emit({
        event: AppCmsEvent.CMS_UPDATED,
        articleId: article.id,
        slug: article.slug,
        folderId: article.folderId,
        status: article.status,
        actorUserId,
      });

      if (
        dto.status === CmsArticleStatus.PUBLISHED &&
        existing.status !== PrismaCmsStatus.PUBLISHED
      ) {
        this.emitPublish(
          article.id,
          article.slug,
          article.folderId,
          actorUserId,
        );
      }

      return this.findById(id, actor);
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException('CMS article slug already exists');
      }
      throw err;
    }
  }

  async publish(id: string, actorUserId?: string | null, actor?: OrgActor) {
    const existing = await this.requireArticle(id, actor);
    const article = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.cmsArticle.update({
        where: { id },
        data: {
          status: PrismaCmsStatus.PUBLISHED,
          publishedAt: existing.publishedAt ?? new Date(),
          updatedById: actorUserId ?? null,
        },
        include: ARTICLE_INCLUDE,
      });
      await this.createVersionSnapshot(tx, id, actorUserId, 'Published');
      return updated;
    });

    this.emitPublish(article.id, article.slug, article.folderId, actorUserId);
    return this.findById(id, actor);
  }

  async archive(id: string, actorUserId?: string | null, actor?: OrgActor) {
    await this.requireArticle(id, actor);
    await this.prisma.cmsArticle.update({
      where: { id },
      data: {
        status: PrismaCmsStatus.ARCHIVED,
        updatedById: actorUserId ?? null,
      },
    });
    this.emit({
      event: AppCmsEvent.CMS_UPDATED,
      articleId: id,
      status: CmsArticleStatus.ARCHIVED,
      actorUserId,
    });
    return this.findById(id, actor);
  }

  async remove(id: string, actor?: OrgActor) {
    await this.requireArticle(id, actor);
    const files = await this.prisma.fileAsset.findMany({
      where: { ownerType: 'CmsArticle', ownerId: id },
      select: { id: true },
    });
    for (const file of files) {
      try {
        await this.storage.delete(file.id, {
          userId: '',
          canManage: true,
        });
      } catch {
        // Best-effort cleanup — article delete must not fail on orphaned files.
      }
    }
    await this.prisma.cmsArticle.delete({ where: { id } });
    return { ok: true, id };
  }

  async upsertTranslation(
    articleId: string,
    locale: string,
    dto: UpsertCmsTranslationDto,
    actorUserId?: string | null,
    actor?: OrgActor,
  ) {
    await this.requireArticle(articleId, actor);
    const normalized = locale.toLowerCase();

    await this.prisma.$transaction(async (tx) => {
      await tx.cmsTranslation.upsert({
        where: {
          articleId_locale: { articleId, locale: normalized },
        },
        create: {
          articleId,
          locale: normalized,
          title: dto.title,
          excerpt: dto.excerpt ?? null,
          content: dto.content,
          seoTitle: dto.seoTitle ?? null,
          seoDescription: dto.seoDescription ?? null,
        },
        update: {
          title: dto.title,
          excerpt: dto.excerpt ?? null,
          content: dto.content,
          ...(dto.seoTitle !== undefined ? { seoTitle: dto.seoTitle } : {}),
          ...(dto.seoDescription !== undefined
            ? { seoDescription: dto.seoDescription }
            : {}),
        },
      });
      await tx.cmsArticle.update({
        where: { id: articleId },
        data: { updatedById: actorUserId ?? null },
      });
      await this.createVersionSnapshot(
        tx,
        articleId,
        actorUserId,
        `Translation ${normalized}`,
      );
    });

    this.emit({
      event: AppCmsEvent.CMS_UPDATED,
      articleId,
      actorUserId,
      locale: normalized,
    });

    return this.findById(articleId, actor);
  }

  async removeTranslation(articleId: string, locale: string, actor?: OrgActor) {
    await this.requireArticle(articleId, actor);
    const normalized = locale.toLowerCase();
    const translation = await this.prisma.cmsTranslation.findUnique({
      where: {
        articleId_locale: { articleId, locale: normalized },
      },
    });
    if (!translation) {
      throw new NotFoundException('Translation not found');
    }
    const count = await this.prisma.cmsTranslation.count({
      where: { articleId },
    });
    if (count <= 1) {
      throw new ConflictException(
        'Cannot delete the last translation of an article',
      );
    }
    await this.prisma.cmsTranslation.delete({ where: { id: translation.id } });
    return this.findById(articleId, actor);
  }

  async listVersions(articleId: string, actor?: OrgActor) {
    await this.requireArticle(articleId, actor);
    return this.prisma.cmsVersion.findMany({
      where: { articleId },
      orderBy: { version: 'desc' },
      select: {
        id: true,
        version: true,
        note: true,
        createdById: true,
        createdAt: true,
      },
    });
  }

  async getVersion(articleId: string, version: number, actor?: OrgActor) {
    await this.requireArticle(articleId, actor);
    const row = await this.prisma.cmsVersion.findUnique({
      where: { articleId_version: { articleId, version } },
    });
    if (!row) {
      throw new NotFoundException('CMS version not found');
    }
    return row;
  }

  /**
   * Rollback prepared — restores slug/status/translations from snapshot
   * and creates a new version entry.
   */
  async rollback(
    articleId: string,
    version: number,
    dto: RollbackCmsVersionDto = {},
    actorUserId?: string | null,
    actor?: OrgActor,
  ) {
    const snapshotRow = await this.getVersion(articleId, version, actor);
    const snapshot = snapshotRow.snapshot as {
      slug?: string;
      status?: string;
      folderId?: string;
      translations?: Array<{
        locale: string;
        title: string;
        excerpt?: string | null;
        content: string;
        seoTitle?: string | null;
        seoDescription?: string | null;
      }>;
    };

    await this.prisma.$transaction(async (tx) => {
      if (snapshot.folderId) {
        await this.folders.requireFolder(snapshot.folderId, actor);
      }

      await tx.cmsArticle.update({
        where: { id: articleId },
        data: {
          ...(snapshot.slug ? { slug: snapshot.slug } : {}),
          ...(snapshot.status
            ? { status: snapshot.status as PrismaCmsStatus }
            : {}),
          ...(snapshot.folderId ? { folderId: snapshot.folderId } : {}),
          updatedById: actorUserId ?? null,
        },
      });

      if (snapshot.translations?.length) {
        await tx.cmsTranslation.deleteMany({ where: { articleId } });
        await tx.cmsTranslation.createMany({
          data: snapshot.translations.map((t) => ({
            articleId,
            locale: t.locale,
            title: t.title,
            excerpt: t.excerpt ?? null,
            content: t.content,
            seoTitle: t.seoTitle ?? null,
            seoDescription: t.seoDescription ?? null,
          })),
        });
      }

      await this.createVersionSnapshot(
        tx,
        articleId,
        actorUserId,
        dto.note ?? `Rollback to v${version}`,
      );
    });

    this.emit({
      event: AppCmsEvent.CMS_UPDATED,
      articleId,
      actorUserId,
    });

    return this.findById(articleId, actor);
  }

  async attachFile(
    articleId: string,
    dto: AttachCmsFileDto,
    actorUserId?: string | null,
    actor?: OrgActor,
  ) {
    await this.requireArticle(articleId, actor);
    const file = await this.prisma.fileAsset.findUnique({
      where: { id: dto.fileId },
    });
    if (!file) {
      throw new NotFoundException('File not found');
    }
    const updated = await this.prisma.fileAsset.update({
      where: { id: dto.fileId },
      data: {
        ownerType: 'CmsArticle',
        ownerId: articleId,
      },
    });
    this.emit({
      event: AppCmsEvent.CMS_UPDATED,
      articleId,
      actorUserId,
    });
    return updated;
  }

  async detachFile(articleId: string, fileId: string, actor?: OrgActor) {
    await this.requireArticle(articleId, actor);
    const file = await this.prisma.fileAsset.findFirst({
      where: { id: fileId, ownerType: 'CmsArticle', ownerId: articleId },
    });
    if (!file) {
      throw new NotFoundException('Attachment not found');
    }
    await this.storage.delete(fileId, { userId: '', canManage: true });
    return { ok: true, id: fileId };
  }

  private async requireArticle(id: string, actor?: OrgActor) {
    const article = await this.prisma.cmsArticle.findUnique({ where: { id } });
    if (!article) {
      throw new NotFoundException('CMS article not found');
    }
    await this.assertReadable(article.organizationId, actor);
    return article;
  }

  private async assertReadable(
    organizationId: string | null,
    actor?: OrgActor,
  ) {
    if (!actor) return;
    if (this.orgScope.isAdmin(actor.roles)) return;
    if (!organizationId) {
      throw new ForbiddenException({
        code: 'ORG_ACCESS_DENIED',
        message: 'CMS article is not assigned to an organization',
      });
    }
    await this.orgScope.assertCanAccessOrganization(
      actor.userId,
      organizationId,
      actor.roles,
    );
  }

  private async createVersionSnapshot(
    tx: Prisma.TransactionClient,
    articleId: string,
    actorUserId?: string | null,
    note?: string,
  ) {
    const article = await tx.cmsArticle.findUnique({
      where: { id: articleId },
      include: { translations: true },
    });
    if (!article) return;

    const last = await tx.cmsVersion.findFirst({
      where: { articleId },
      orderBy: { version: 'desc' },
      select: { version: true },
    });
    const nextVersion = (last?.version ?? 0) + 1;

    await tx.cmsVersion.create({
      data: {
        articleId,
        version: nextVersion,
        note: note ?? null,
        createdById: actorUserId ?? null,
        snapshot: {
          slug: article.slug,
          status: article.status,
          folderId: article.folderId,
          seoMeta: article.seoMeta,
          aiMeta: article.aiMeta,
          workflowState: article.workflowState,
          publishedAt: article.publishedAt,
          translations: article.translations.map((t) => ({
            locale: t.locale,
            title: t.title,
            excerpt: t.excerpt,
            content: t.content,
            seoTitle: t.seoTitle,
            seoDescription: t.seoDescription,
          })),
        } as Prisma.InputJsonValue,
      },
    });
  }

  private emitPublish(
    articleId: string,
    slug: string,
    folderId: string,
    actorUserId?: string | null,
  ) {
    this.emit({
      event: AppCmsEvent.CMS_PUBLISHED,
      articleId,
      slug,
      folderId,
      status: CmsArticleStatus.PUBLISHED,
      actorUserId,
    });
    this.notifications.dispatch({
      eventType: AppNotificationEvent.CMS_PUBLISHED,
      userId: actorUserId,
      data: { articleId, slug, folderId },
    });
  }

  private emit(payload: CmsDomainEventPayload) {
    try {
      this.events.emit(CMS_DOMAIN_EVENT, payload);
    } catch (err) {
      this.logger.warn(
        `Failed to emit CMS event ${payload.event}: ${err instanceof Error ? err.message : 'unknown'}`,
      );
    }
  }
}
