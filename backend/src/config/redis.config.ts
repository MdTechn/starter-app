import { registerAs } from '@nestjs/config';

/**
 * Redis connection — REDIS_URL preferred; discrete REDIS_* also supported.
 */
export const redisConfigFactory = () => {
  const host = process.env.REDIS_HOST ?? '127.0.0.1';
  const port = Number(process.env.REDIS_PORT ?? 6379);
  const password = process.env.REDIS_PASSWORD ?? '';
  const db = Number(process.env.REDIS_DB ?? 0);
  const url =
    process.env.REDIS_URL ||
    (process.env.REDIS_HOST
      ? `redis://${password ? `:${encodeURIComponent(password)}@` : ''}${host}:${port}/${db}`
      : '');

  return {
    url,
    host,
    port,
    password: password || undefined,
    db,
    keyPrefix: process.env.REDIS_KEY_PREFIX ?? 'saas:',
    enabled: Boolean(url || process.env.REDIS_HOST),
  };
};

export type RedisConfig = ReturnType<typeof redisConfigFactory>;

export default registerAs('redis', redisConfigFactory);
