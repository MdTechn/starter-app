import { Readable } from 'stream';

export type StorageUploadInput = {
  key: string;
  buffer: Buffer;
  mimeType: string;
  originalName?: string;
};

export type StorageObject = {
  key: string;
  url: string;
};

/**
 * Provider-agnostic storage contract.
 * Selected at runtime via STORAGE_DRIVER — never hard-code a provider in services.
 */
export interface StorageProvider {
  readonly name: 'local' | 's3' | 'cloudinary';

  upload(input: StorageUploadInput): Promise<StorageObject>;

  delete(key: string): Promise<void>;

  getPublicUrl(key: string): string;

  /** Optional stream for local/authenticated serving. */
  openReadStream?(key: string): Promise<Readable>;
}
