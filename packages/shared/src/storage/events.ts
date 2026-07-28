import { StorageDriver } from '../enums/storage-driver.enum';

/** Upload categories with MIME + size rules. */
export enum FileUploadKind {
  IMAGE = 'IMAGE',
  DOCUMENT = 'DOCUMENT',
  AVATAR = 'AVATAR',
}

export type FileUploadRule = {
  maxBytes: number;
  mimeTypes: readonly string[];
};

export const FILE_UPLOAD_RULES: Record<FileUploadKind, FileUploadRule> = {
  [FileUploadKind.IMAGE]: {
    maxBytes: 5 * 1024 * 1024,
    mimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  },
  [FileUploadKind.DOCUMENT]: {
    maxBytes: 10 * 1024 * 1024,
    mimeTypes: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
    ],
  },
  [FileUploadKind.AVATAR]: {
    maxBytes: 2 * 1024 * 1024,
    mimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
  },
};

/** Polymorphic owner entity names (stored as string on FileAsset). */
export const FILE_OWNER_TYPES = ['User', 'Organization', 'CmsArticle'] as const;
export type FileOwnerType = (typeof FILE_OWNER_TYPES)[number] | string;

export enum AppStorageEvent {
  FILE_UPLOADED = 'FILE_UPLOADED',
  FILE_DELETED = 'FILE_DELETED',
}

/** Nest EventEmitter channel for storage domain events. */
export const STORAGE_DOMAIN_EVENT = 'app.storage.domain';

export type StorageDomainEventPayload = {
  event: AppStorageEvent;
  fileId: string;
  key: string;
  kind: FileUploadKind | string;
  driver: StorageDriver | string;
  uploadedById?: string | null;
  ownerType?: string | null;
  ownerId?: string | null;
  url?: string | null;
};
