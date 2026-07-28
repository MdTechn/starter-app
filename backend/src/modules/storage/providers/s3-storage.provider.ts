import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import {
  Injectable,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StorageConfig } from '../../../config/storage.config';
import { AppLogger } from '../../../common/logger/app-logger.service';
import {
  StorageObject,
  StorageProvider,
  StorageUploadInput,
} from './storage-provider';

@Injectable()
export class S3StorageProvider implements StorageProvider, OnModuleInit {
  readonly name = 's3' as const;
  private client: S3Client | null = null;
  private bucket = '';
  private region = '';
  private endpoint = '';
  private publicBaseUrl = '';

  constructor(
    private readonly configService: ConfigService,
    private readonly logger: AppLogger,
  ) {
    this.logger.setContext(S3StorageProvider.name);
  }

  onModuleInit() {
    const storage = this.configService.get<StorageConfig>('storage');
    if (!storage || storage.driver !== 's3') return;

    this.bucket = storage.s3.bucket;
    this.region = storage.s3.region;
    this.endpoint = storage.s3.endpoint;
    this.publicBaseUrl = storage.publicBaseUrl?.replace(/\/$/, '') ?? '';

    if (
      !this.bucket ||
      !storage.s3.accessKeyId ||
      !storage.s3.secretAccessKey
    ) {
      this.logger.warn('S3 driver selected but credentials/bucket incomplete');
      return;
    }

    this.client = new S3Client({
      region: this.region,
      endpoint: this.endpoint || undefined,
      forcePathStyle: storage.s3.forcePathStyle,
      credentials: {
        accessKeyId: storage.s3.accessKeyId,
        secretAccessKey: storage.s3.secretAccessKey,
      },
    });
  }

  private requireClient(): S3Client {
    if (!this.client || !this.bucket) {
      throw new ServiceUnavailableException({
        code: 'S3_NOT_CONFIGURED',
        message: 'S3 storage is not configured',
      });
    }
    return this.client;
  }

  async upload(input: StorageUploadInput): Promise<StorageObject> {
    const client = this.requireClient();
    await client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: input.key,
        Body: input.buffer,
        ContentType: input.mimeType,
      }),
    );
    this.logger.log(`S3 upload key=${input.key} bucket=${this.bucket}`);
    return { key: input.key, url: this.getPublicUrl(input.key) };
  }

  async delete(key: string): Promise<void> {
    const client = this.requireClient();
    await client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }

  getPublicUrl(key: string): string {
    const encoded = key
      .split('/')
      .map((p) => encodeURIComponent(p))
      .join('/');
    if (this.publicBaseUrl) {
      return `${this.publicBaseUrl}/${encoded}`;
    }
    if (this.endpoint) {
      return `${this.endpoint.replace(/\/$/, '')}/${this.bucket}/${encoded}`;
    }
    return `https://${this.bucket}.s3.${this.region}.amazonaws.com/${encoded}`;
  }
}
