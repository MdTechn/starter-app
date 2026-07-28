import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { AppLogger } from '../../../common/logger/app-logger.service';
import {
  StorageObject,
  StorageProvider,
  StorageUploadInput,
} from './storage-provider';

/**
 * Cloudinary stub — interface only. Select via STORAGE_DRIVER=cloudinary
 * once a real implementation is added.
 */
@Injectable()
export class CloudinaryStorageProvider implements StorageProvider {
  readonly name = 'cloudinary' as const;

  constructor(private readonly logger: AppLogger) {
    this.logger.setContext(CloudinaryStorageProvider.name);
    this.logger.warn('CloudinaryStorageProvider is a stub (not implemented)');
  }

  private notReady(): never {
    throw new ServiceUnavailableException({
      code: 'CLOUDINARY_NOT_IMPLEMENTED',
      message: 'Cloudinary storage provider is not implemented yet',
    });
  }

  async upload(_input: StorageUploadInput): Promise<StorageObject> {
    return this.notReady();
  }

  async delete(_key: string): Promise<void> {
    return this.notReady();
  }

  getPublicUrl(key: string): string {
    return `cloudinary://stub/${key}`;
  }
}
