import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createReadStream, promises as fs } from 'fs';
import { dirname, join, resolve } from 'path';
import { Readable } from 'stream';
import { StorageConfig } from '../../../config/storage.config';
import { AppLogger } from '../../../common/logger/app-logger.service';
import {
  StorageObject,
  StorageProvider,
  StorageUploadInput,
} from './storage-provider';

@Injectable()
export class LocalStorageProvider implements StorageProvider {
  readonly name = 'local' as const;
  private readonly root: string;
  private readonly publicBaseUrl: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly logger: AppLogger,
  ) {
    this.logger.setContext(LocalStorageProvider.name);
    const storage =
      this.configService.get<StorageConfig>('storage') ??
      ({ localPath: 'uploads', publicBaseUrl: '' } as StorageConfig);
    this.root = resolve(process.cwd(), storage.localPath);
    this.publicBaseUrl = storage.publicBaseUrl?.replace(/\/$/, '') ?? '';
  }

  async upload(input: StorageUploadInput): Promise<StorageObject> {
    const fullPath = join(this.root, input.key);
    await fs.mkdir(dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, input.buffer);
    this.logger.log(
      `Local upload key=${input.key} bytes=${input.buffer.length}`,
    );
    return { key: input.key, url: this.getPublicUrl(input.key) };
  }

  async delete(key: string): Promise<void> {
    const fullPath = join(this.root, key);
    try {
      await fs.unlink(fullPath);
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code !== 'ENOENT') throw err;
    }
  }

  getPublicUrl(key: string): string {
    const encoded = key
      .split('/')
      .map((p) => encodeURIComponent(p))
      .join('/');
    if (this.publicBaseUrl) {
      return `${this.publicBaseUrl}/${encoded}`;
    }
    const apiPrefix = this.configService.get<string>('API_PREFIX', 'api');
    const port = this.configService.get<number>('PORT', 3001);
    const base =
      this.configService.get<string>('API_URL') ?? `http://localhost:${port}`;
    return `${base.replace(/\/$/, '')}/${apiPrefix}/storage/files/${encoded}`;
  }

  async openReadStream(key: string): Promise<Readable> {
    const fullPath = join(this.root, key);
    try {
      await fs.access(fullPath);
    } catch {
      throw new NotFoundException('File not found on disk');
    }
    return createReadStream(fullPath);
  }
}
