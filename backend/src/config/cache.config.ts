import { registerAs } from '@nestjs/config';

export const cacheConfigFactory = () => ({
  enabled: process.env.CACHE_ENABLED !== 'false',
  ttlSeconds: Number(process.env.CACHE_TTL_SECONDS ?? 60),
  prefix: process.env.CACHE_PREFIX ?? 'cache:',
});

export type CacheConfig = ReturnType<typeof cacheConfigFactory>;

export default registerAs('cache', cacheConfigFactory);
