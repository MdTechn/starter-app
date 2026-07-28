import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { FileKind, StorageDriverKind } from '@prisma/client';
import { randomUUID } from 'crypto';
import {
  AppStorageEvent,
  FileUploadKind,
  STORAGE_DOMAIN_EVENT,
  StorageDomainEventPayload,
} from '@saas-starter/shared';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AppLogger } from '../../common/logger/app-logger.service';
import { FileValidationService } from './file-validation.service';
import { StorageProvider } from './providers/storage-provider';
import { STORAGE_PROVIDER } from './storage.tokens';

export type UploadFileInput = {
  buffer: Buffer;
  originalName: string;
  mimeType: string;
  size: number;
  kind: FileUploadKind | string;
  ownerType?: string | null;
  ownerId?: string | null;
  uploadedById?: string | null;
};

@Injectable()
export class StorageService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly validation: FileValidationService,
    @Inject(STORAGE_PROVIDER)
    private readonly provider: StorageProvider,
    private readonly events: EventEmitter2,
    private readonly logger: AppLogger,
  ) {
    this.logger.setContext(StorageService.name);
  }

  getDriverName() {
    return this.provider.name;
  }

  async upload(input: UploadFileInput) {
    const kind = this.validation.assertValid(
      input.kind,
      input.mimeType,
      input.size,
    );

    const ext = this.extensionFromName(input.originalName, input.mimeType);
    const filename = `${randomUUID()}${ext}`;
    const key = `${kind.toLowerCase()}/${filename}`;

    const stored = await this.provider.upload({
      key,
      buffer: input.buffer,
      mimeType: input.mimeType,
      originalName: input.originalName,
    });

    let asset = await this.prisma.fileAsset.create({
      data: {
        key: stored.key,
        filename,
        originalName: input.originalName,
        mimeType: input.mimeType,
        size: input.size,
        kind: kind as FileKind,
        driver: this.toDriverKind(this.provider.name),
        url: stored.url,
        ownerType: input.ownerType ?? null,
        ownerId: input.ownerId ?? null,
        uploadedById: input.uploadedById ?? null,
      },
    });

    if (this.provider.name === 'local') {
      const url = this.buildContentUrl(asset.id);
      asset = await this.prisma.fileAsset.update({
        where: { id: asset.id },
        data: { url },
      });
    }

    if (
      kind === FileUploadKind.AVATAR &&
      input.uploadedById &&
      (!input.ownerType || input.ownerType === 'User') &&
      (!input.ownerId || input.ownerId === input.uploadedById)
    ) {
      await this.prisma.user.update({
        where: { id: input.uploadedById },
        data: { avatarUrl: asset.url },
      });
    }

    this.emit({
      event: AppStorageEvent.FILE_UPLOADED,
      fileId: asset.id,
      key: asset.key,
      kind: asset.kind,
      driver: this.provider.name,
      uploadedById: asset.uploadedById,
      ownerType: asset.ownerType,
      ownerId: asset.ownerId,
      url: asset.url,
    });

    this.logger.log(
      `Uploaded file id=${asset.id} kind=${asset.kind} driver=${this.provider.name}`,
    );
    return asset;
  }

  async listForUser(userId: string, limit = 50) {
    return this.prisma.fileAsset.findMany({
      where: { uploadedById: userId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(limit, 1), 100),
    });
  }

  async getById(id: string) {
    const asset = await this.prisma.fileAsset.findUnique({ where: { id } });
    if (!asset) throw new NotFoundException('File not found');
    return asset;
  }

  async getByKey(key: string) {
    const asset = await this.prisma.fileAsset.findUnique({ where: { key } });
    if (!asset) throw new NotFoundException('File not found');
    return asset;
  }

  async delete(id: string, actor: { userId: string; canManage: boolean }) {
    const asset = await this.getById(id);
    const isOwner = asset.uploadedById === actor.userId;
    if (!isOwner && !actor.canManage) {
      throw new ForbiddenException('Not allowed to delete this file');
    }

    await this.provider.delete(asset.key);
    await this.prisma.fileAsset.delete({ where: { id: asset.id } });

    this.emit({
      event: AppStorageEvent.FILE_DELETED,
      fileId: asset.id,
      key: asset.key,
      kind: asset.kind,
      driver: this.provider.name,
      uploadedById: asset.uploadedById,
      ownerType: asset.ownerType,
      ownerId: asset.ownerId,
      url: asset.url,
    });

    this.logger.log(`Deleted file id=${asset.id}`);
    return { ok: true, id: asset.id };
  }

  async openReadStream(key: string) {
    if (!this.provider.openReadStream) {
      throw new NotFoundException('Streaming not supported for this driver');
    }
    return this.provider.openReadStream(key);
  }

  private emit(payload: StorageDomainEventPayload) {
    try {
      this.events.emit(STORAGE_DOMAIN_EVENT, payload);
    } catch (err) {
      this.logger.warn(
        `Failed to emit storage event: ${err instanceof Error ? err.message : 'unknown'}`,
      );
    }
  }

  private toDriverKind(name: string): StorageDriverKind {
    if (name === 's3') return StorageDriverKind.S3;
    if (name === 'cloudinary') return StorageDriverKind.CLOUDINARY;
    return StorageDriverKind.LOCAL;
  }

  private buildContentUrl(fileId: string): string {
    // Lazy inject via provider public URL base is handled in LocalStorageProvider;
    // content route is the stable public URL for local files.
    const apiPrefix = process.env.API_PREFIX ?? 'api';
    const port = process.env.PORT ?? '3001';
    const base =
      process.env.API_URL ??
      process.env.STORAGE_PUBLIC_BASE_URL ??
      `http://localhost:${port}`;
    if (process.env.STORAGE_PUBLIC_BASE_URL) {
      return `${process.env.STORAGE_PUBLIC_BASE_URL.replace(/\/$/, '')}/${fileId}`;
    }
    return `${base.replace(/\/$/, '')}/${apiPrefix}/storage/content/${fileId}`;
  }

  private extensionFromName(originalName: string, mimeType: string): string {
    const fromName = originalName.includes('.')
      ? originalName.slice(originalName.lastIndexOf('.')).toLowerCase()
      : '';
    if (fromName && fromName.length <= 8) return fromName;
    const map: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp',
      'image/gif': '.gif',
      'application/pdf': '.pdf',
      'text/plain': '.txt',
    };
    return map[mimeType] ?? '';
  }
}
