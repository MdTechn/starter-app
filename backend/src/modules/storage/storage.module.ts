import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StorageConfig } from '../../config/storage.config';
import { AppLogger } from '../../common/logger/app-logger.service';
import { FileValidationService } from './file-validation.service';
import { CloudinaryStorageProvider } from './providers/cloudinary.provider';
import { LocalStorageProvider } from './providers/local-storage.provider';
import { S3StorageProvider } from './providers/s3-storage.provider';
import { StorageProvider } from './providers/storage-provider';
import { StorageController } from './storage.controller';
import { StorageService } from './storage.service';
import { STORAGE_PROVIDER } from './storage.tokens';

@Module({
  controllers: [StorageController],
  providers: [
    FileValidationService,
    LocalStorageProvider,
    S3StorageProvider,
    CloudinaryStorageProvider,
    {
      provide: STORAGE_PROVIDER,
      inject: [
        ConfigService,
        LocalStorageProvider,
        S3StorageProvider,
        CloudinaryStorageProvider,
        AppLogger,
      ],
      useFactory: (
        config: ConfigService,
        local: LocalStorageProvider,
        s3: S3StorageProvider,
        cloudinary: CloudinaryStorageProvider,
        logger: AppLogger,
      ): StorageProvider => {
        const storage = config.get<StorageConfig>('storage');
        const driver = storage?.driver ?? 'local';
        logger.setContext('StorageProviderFactory');
        logger.log(`Storage driver selected: ${driver}`);
        if (driver === 's3') return s3;
        if (driver === 'cloudinary') return cloudinary;
        return local;
      },
    },
    StorageService,
  ],
  exports: [StorageService, STORAGE_PROVIDER],
})
export class StorageModule {}
