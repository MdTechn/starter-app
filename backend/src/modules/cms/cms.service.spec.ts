import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { CmsArticleStatus as PrismaStatus } from '@prisma/client';
import {
  AppCmsEvent,
  CMS_DOMAIN_EVENT,
  CmsArticleStatus,
  Permission,
  UserRole,
  getPermissionsForRoles,
  hasPermission,
} from '@saas-starter/shared';
import { CmsFoldersService } from './cms-folders.service';
import { CmsArticlesService } from './cms-articles.service';
import { OrganizationScopeService } from '../organizations/organization-scope.service';

const orgScopeMock = {
  isAdmin: jest.fn().mockReturnValue(true),
  orgWhere: jest.fn().mockResolvedValue({}),
  assertCanAccessOrganization: jest.fn().mockResolvedValue(undefined),
  resolveOrganizationIdForWrite: jest.fn().mockResolvedValue('org1'),
  getAccessibleOrganizationIds: jest.fn().mockResolvedValue(null),
};
import { PrismaService } from '../../common/prisma/prisma.service';
import { AppLogger } from '../../common/logger/app-logger.service';
import { NotificationDispatcher } from '../../common/events/notification-dispatcher';
import { StorageService } from '../storage/storage.service';

describe('CMS permissions mapping', () => {
  it('grants USER cms:read and cms:write', () => {
    const perms = getPermissionsForRoles([UserRole.USER]);
    expect(perms).toContain(Permission.CMS_READ);
    expect(perms).toContain(Permission.CMS_WRITE);
    expect(perms).not.toContain(Permission.CMS_PUBLISH);
    expect(perms).not.toContain(Permission.CMS_MANAGE);
  });

  it('grants ADMIN full CMS permissions', () => {
    expect(hasPermission([UserRole.ADMIN], Permission.CMS_READ)).toBe(true);
    expect(hasPermission([UserRole.ADMIN], Permission.CMS_WRITE)).toBe(true);
    expect(hasPermission([UserRole.ADMIN], Permission.CMS_PUBLISH)).toBe(true);
    expect(hasPermission([UserRole.ADMIN], Permission.CMS_MANAGE)).toBe(true);
  });
});

describe('CmsFoldersService', () => {
  let service: CmsFoldersService;
  let prisma: {
    cmsFolder: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      cmsFolder: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CmsFoldersService,
        { provide: PrismaService, useValue: prisma },
        { provide: OrganizationScopeService, useValue: orgScopeMock },
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

    service = module.get(CmsFoldersService);
  });

  it('builds unlimited folder tree from flat list', async () => {
    prisma.cmsFolder.findMany.mockResolvedValue([
      {
        id: 'root',
        code: 'root',
        name: 'Root',
        description: null,
        parentId: null,
        sortOrder: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        _count: { articles: 0, children: 1 },
      },
      {
        id: 'child',
        code: 'child',
        name: 'Child',
        description: null,
        parentId: 'root',
        sortOrder: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        _count: { articles: 2, children: 1 },
      },
      {
        id: 'grand',
        code: 'grand',
        name: 'Grand',
        description: null,
        parentId: 'child',
        sortOrder: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        _count: { articles: 0, children: 0 },
      },
    ]);

    const tree = await service.listTree();
    expect(tree).toHaveLength(1);
    expect(tree[0].code).toBe('root');
    expect(tree[0].children[0].code).toBe('child');
    expect(tree[0].children[0].children[0].code).toBe('grand');
  });

  it('creates folder with unique code', async () => {
    prisma.cmsFolder.create.mockResolvedValue({
      id: 'f1',
      code: 'docs',
      name: 'Docs',
    });
    const folder = await service.create({ code: 'docs', name: 'Docs' });
    expect(folder.code).toBe('docs');
    expect(prisma.cmsFolder.create).toHaveBeenCalled();
  });

  it('rejects delete when folder is not empty', async () => {
    prisma.cmsFolder.findUnique.mockResolvedValue({
      id: 'f1',
      _count: { children: 1, articles: 0 },
    });
    await expect(service.remove('f1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects moving folder under its descendant', async () => {
    prisma.cmsFolder.findUnique
      .mockResolvedValueOnce({ id: 'root', parentId: null }) // requireFolder(root)
      .mockResolvedValueOnce({ id: 'child', parentId: 'root' }) // requireFolder(child)
      .mockResolvedValueOnce({ parentId: 'root' }); // isDescendantOf walk

    await expect(
      service.update('root', { parentId: 'child' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('CmsArticlesService', () => {
  let service: CmsArticlesService;
  let prisma: Record<string, unknown>;
  let events: { emit: jest.Mock };
  let notifications: { dispatch: jest.Mock };
  let folders: { requireFolder: jest.Mock };

  const articleBase = {
    id: 'a1',
    folderId: 'f1',
    organizationId: 'org1',
    slug: 'hello',
    status: PrismaStatus.DRAFT,
    seoMeta: null,
    aiMeta: null,
    workflowState: null,
    createdById: 'u1',
    updatedById: 'u1',
    publishedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    translations: [
      {
        id: 't1',
        articleId: 'a1',
        locale: 'en',
        title: 'Hello',
        excerpt: null,
        content: 'World',
        seoTitle: null,
        seoDescription: null,
      },
    ],
    folder: { id: 'f1', code: 'docs', name: 'Docs', organizationId: 'org1' },
    versions: [],
  };

  beforeEach(async () => {
    events = { emit: jest.fn() };
    notifications = { dispatch: jest.fn() };
    folders = {
      requireFolder: jest
        .fn()
        .mockResolvedValue({ id: 'f1', organizationId: 'org1' }),
    };

    const tx = {
      cmsArticle: {
        create: jest.fn().mockResolvedValue(articleBase),
        update: jest.fn().mockResolvedValue(articleBase),
        findUnique: jest.fn().mockResolvedValue(articleBase),
        delete: jest.fn(),
      },
      cmsTranslation: {
        upsert: jest.fn(),
        deleteMany: jest.fn(),
        createMany: jest.fn(),
        findUnique: jest.fn(),
        count: jest.fn(),
        delete: jest.fn(),
      },
      cmsVersion: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
    };

    prisma = {
      cmsArticle: {
        findMany: jest.fn().mockResolvedValue([articleBase]),
        count: jest.fn().mockResolvedValue(1),
        findUnique: jest.fn().mockResolvedValue(articleBase),
        create: jest.fn(),
        update: jest.fn().mockResolvedValue({
          ...articleBase,
          status: PrismaStatus.PUBLISHED,
        }),
        delete: jest.fn(),
      },
      cmsTranslation: {
        upsert: jest.fn(),
        findUnique: jest.fn(),
        count: jest.fn(),
        delete: jest.fn(),
        deleteMany: jest.fn(),
        createMany: jest.fn(),
      },
      cmsVersion: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      fileAsset: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      $transaction: jest.fn(async (fn: (t: typeof tx) => Promise<unknown>) =>
        fn(tx),
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CmsArticlesService,
        { provide: PrismaService, useValue: prisma },
        { provide: CmsFoldersService, useValue: folders },
        {
          provide: StorageService,
          useValue: { delete: jest.fn().mockResolvedValue({ ok: true }) },
        },
        { provide: EventEmitter2, useValue: events },
        { provide: NotificationDispatcher, useValue: notifications },
        { provide: OrganizationScopeService, useValue: orgScopeMock },
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

    service = module.get(CmsArticlesService);
  });

  it('creates article with initial translation and emits CMS_CREATED', async () => {
    const result = await service.create(
      {
        folderId: 'f1',
        slug: 'hello',
        title: 'Hello',
        content: 'World',
        locale: 'en',
      },
      'u1',
    );

    expect(result.id).toBe('a1');
    expect(events.emit).toHaveBeenCalledWith(
      CMS_DOMAIN_EVENT,
      expect.objectContaining({
        event: AppCmsEvent.CMS_CREATED,
        articleId: 'a1',
        slug: 'hello',
      }),
    );
  });

  it('lists articles with pagination', async () => {
    const result = await service.list({ page: 1, pageSize: 20 });
    expect(result.total).toBe(1);
    expect(result.items).toHaveLength(1);
    expect(result.page).toBe(1);
  });

  it('upserts translation and emits CMS_UPDATED', async () => {
    await service.upsertTranslation(
      'a1',
      'fr',
      { title: 'Bonjour', content: 'Monde' },
      'u1',
    );
    expect(events.emit).toHaveBeenCalledWith(
      CMS_DOMAIN_EVENT,
      expect.objectContaining({
        event: AppCmsEvent.CMS_UPDATED,
        locale: 'fr',
      }),
    );
  });

  it('refuses deleting the last translation', async () => {
    (
      prisma.cmsTranslation as { findUnique: jest.Mock }
    ).findUnique.mockResolvedValue({ id: 't1' });
    (prisma.cmsTranslation as { count: jest.Mock }).count.mockResolvedValue(1);
    await expect(service.removeTranslation('a1', 'en')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('publishes article and emits CMS_PUBLISHED + notification', async () => {
    await service.publish('a1', 'u1');
    expect(events.emit).toHaveBeenCalledWith(
      CMS_DOMAIN_EVENT,
      expect.objectContaining({
        event: AppCmsEvent.CMS_PUBLISHED,
        status: CmsArticleStatus.PUBLISHED,
      }),
    );
    expect(notifications.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'CMS_PUBLISHED',
        userId: 'u1',
      }),
    );
  });

  it('attaches FileAsset to article via Storage owner link', async () => {
    (
      prisma.fileAsset as { findUnique: jest.Mock }
    ).findUnique.mockResolvedValue({ id: 'file1' });
    (prisma.fileAsset as { update: jest.Mock }).update.mockResolvedValue({
      id: 'file1',
      ownerType: 'CmsArticle',
      ownerId: 'a1',
    });

    const file = await service.attachFile('a1', { fileId: 'file1' }, 'u1');
    expect(file.ownerType).toBe('CmsArticle');
    expect(file.ownerId).toBe('a1');
  });
});
