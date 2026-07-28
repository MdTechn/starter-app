import { registerAs } from '@nestjs/config';

/**
 * Storage driver selected only via config (STORAGE_DRIVER).
 * Env aliases keep AWS_* / STORAGE_LOCAL_PATH working (no breaking change).
 */
export const storageConfigFactory = () => {
  const driver = (process.env.STORAGE_DRIVER ?? 'local').toLowerCase() as
    'local' | 's3' | 'cloudinary';

  return {
    driver,
    localPath:
      process.env.STORAGE_PATH ?? process.env.STORAGE_LOCAL_PATH ?? 'uploads',
    publicBaseUrl: process.env.STORAGE_PUBLIC_BASE_URL ?? '',
    s3: {
      endpoint: process.env.S3_ENDPOINT ?? '',
      bucket: process.env.S3_BUCKET ?? '',
      region: process.env.S3_REGION ?? process.env.AWS_REGION ?? 'eu-west-1',
      accessKeyId:
        process.env.S3_ACCESS_KEY ?? process.env.AWS_ACCESS_KEY_ID ?? '',
      secretAccessKey:
        process.env.S3_SECRET_KEY ?? process.env.AWS_SECRET_ACCESS_KEY ?? '',
      forcePathStyle:
        process.env.S3_FORCE_PATH_STYLE === 'true' ||
        Boolean(process.env.S3_ENDPOINT),
    },
    cloudinary: {
      cloudName: process.env.CLOUDINARY_CLOUD_NAME ?? '',
      apiKey: process.env.CLOUDINARY_API_KEY ?? '',
      apiSecret: process.env.CLOUDINARY_API_SECRET ?? '',
    },
  };
};

export type StorageConfig = ReturnType<typeof storageConfigFactory>;

export default registerAs('storage', storageConfigFactory);
