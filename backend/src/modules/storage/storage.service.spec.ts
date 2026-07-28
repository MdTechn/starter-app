import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { FileKind, StorageDriverKind } from '@prisma/client';
import {
  AppStorageEvent,
  FileUploadKind,
  Permission,
  STORAGE_DOMAIN_EVENT,
} from '@saas-starter/shared';
import { StorageService } from './storage.service';
import { FileValidationService } from './file-validation.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AppLogger } from '../../common/logger/app-logger.service';
import { STORAGE_PROVIDER } from './storage.tokens';

describe('FileValidationService', () => {
  const service = new FileValidationService();

  it('accepts valid image', () => {
    expect(service.assertValid(FileUploadKind.IMAGE, 'image/png', 1024)).toBe(
      FileUploadKind.IMAGE,
    );
  });

  it('rejects invalid mime', () => {
    expect(() =>
      service.assertValid(FileUploadKind.AVATAR, 'application/pdf', 100),
    ).toThrow();
  });

  it('rejects oversized file', () => {
    expect(() =>
      service.assertValid(FileUploadKind.AVATAR, 'image/jpeg', 3 * 1024 * 1024),
    ).toThrow();
  });
});

describe('StorageService', () => {
  let service: StorageService;
  let prisma: {
    fileAsset: {
      create: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      delete: jest.Mock;
      update: jest.Mock;
    };
    user: { update: jest.Mock };
  };
  let provider: {
    name: string;
    upload: jest.Mock;
    delete: jest.Mock;
    getPublicUrl: jest.Mock;
  };
  let events: { emit: jest.Mock };

  beforeEach(async () => {
    prisma = {
      fileAsset: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        delete: jest.fn(),
        update: jest.fn(),
      },
      user: { update: jest.fn() },
    };
    provider = {
      name: 'local',
      upload: jest.fn().mockResolvedValue({
        key: 'image/abc.png',
        url: 'http://localhost/api/storage/files/image/abc.png',
      }),
      delete: jest.fn().mockResolvedValue(undefined),
      getPublicUrl: jest.fn(),
    };
    events = { emit: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StorageService,
        FileValidationService,
        { provide: PrismaService, useValue: prisma },
        { provide: STORAGE_PROVIDER, useValue: provider },
        { provide: EventEmitter2, useValue: events },
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

    service = module.get(StorageService);
  });

  it('uploads and emits FILE_UPLOADED', async () => {
    const created = {
      id: 'f1',
      key: 'image/abc.png',
      kind: FileKind.IMAGE,
      driver: StorageDriverKind.LOCAL,
      url: 'http://localhost/file',
      uploadedById: 'u1',
      ownerType: null,
      ownerId: null,
    };
    prisma.fileAsset.create.mockResolvedValue(created);
    prisma.fileAsset.update.mockResolvedValue({
      ...created,
      url: 'http://localhost:3001/api/storage/content/f1',
    });

    const asset = await service.upload({
      buffer: Buffer.from('png'),
      originalName: 'pic.png',
      mimeType: 'image/png',
      size: 3,
      kind: FileUploadKind.IMAGE,
      uploadedById: 'u1',
    });

    expect(asset.id).toBe('f1');
    expect(provider.upload).toHaveBeenCalled();
    expect(prisma.fileAsset.update).toHaveBeenCalled();
    expect(events.emit).toHaveBeenCalledWith(
      STORAGE_DOMAIN_EVENT,
      expect.objectContaining({ event: AppStorageEvent.FILE_UPLOADED }),
    );
  });

  it('updates avatarUrl on avatar upload', async () => {
    const created = {
      id: 'f2',
      key: 'avatar/x.jpg',
      kind: FileKind.AVATAR,
      driver: StorageDriverKind.LOCAL,
      url: 'http://cdn/avatar.jpg',
      uploadedById: 'u1',
      ownerType: 'User',
      ownerId: 'u1',
    };
    prisma.fileAsset.create.mockResolvedValue(created);
    prisma.fileAsset.update.mockResolvedValue({
      ...created,
      url: 'http://localhost:3001/api/storage/content/f2',
    });
    prisma.user.update.mockResolvedValue({});

    await service.upload({
      buffer: Buffer.from('jpg'),
      originalName: 'me.jpg',
      mimeType: 'image/jpeg',
      size: 10,
      kind: FileUploadKind.AVATAR,
      uploadedById: 'u1',
      ownerType: 'User',
      ownerId: 'u1',
    });

    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'u1' },
        data: {
          avatarUrl: 'http://localhost:3001/api/storage/content/f2',
        },
      }),
    );
  });

  it('deletes file for owner and emits FILE_DELETED', async () => {
    prisma.fileAsset.findUnique.mockResolvedValue({
      id: 'f1',
      key: 'image/abc.png',
      kind: FileKind.IMAGE,
      uploadedById: 'u1',
      ownerType: null,
      ownerId: null,
      url: 'http://x',
    });
    prisma.fileAsset.delete.mockResolvedValue({});

    await service.delete('f1', { userId: 'u1', canManage: false });
    expect(provider.delete).toHaveBeenCalledWith('image/abc.png');
    expect(events.emit).toHaveBeenCalledWith(
      STORAGE_DOMAIN_EVENT,
      expect.objectContaining({ event: AppStorageEvent.FILE_DELETED }),
    );
  });

  it('forbids delete for non-owner without manage', async () => {
    prisma.fileAsset.findUnique.mockResolvedValue({
      id: 'f1',
      key: 'image/abc.png',
      kind: FileKind.IMAGE,
      uploadedById: 'other',
    });

    await expect(
      service.delete('f1', { userId: 'u1', canManage: false }),
    ).rejects.toThrow();
  });
});

describe('upload permissions mapping', () => {
  it('exposes upload permissions constants', () => {
    expect(Permission.UPLOAD_WRITE).toBe('upload:write');
    expect(Permission.UPLOAD_DELETE).toBe('upload:delete');
    expect(Permission.UPLOAD_MANAGE).toBe('upload:manage');
  });
});
