import { Global, Injectable, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CacheConfig } from '../../config/cache.config';
import { AppLogger } from '../../common/logger/app-logger.service';
import { RedisService } from '../redis/redis.module';

/**
 * Cache Redis with in-memory fallback when Redis is unavailable.
 */
@Injectable()
export class CacheService {
  private readonly memory = new Map<
    string,
    { value: string; expiresAt: number }
  >();

  constructor(
    private readonly redis: RedisService,
    private readonly config: ConfigService,
    private readonly logger: AppLogger,
  ) {
    this.logger.setContext(CacheService.name);
  }

  private cfg(): CacheConfig {
    return (
      this.config.get<CacheConfig>('cache') ?? {
        enabled: true,
        ttlSeconds: 60,
        prefix: 'cache:',
      }
    );
  }

  private key(raw: string) {
    return `${this.cfg().prefix}${raw}`;
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.cfg().enabled) return null;
    const k = this.key(key);
    const client = this.redis.getClient();

    if (client && this.redis.isReady()) {
      const raw = await client.get(k);
      if (!raw) return null;
      try {
        return JSON.parse(raw) as T;
      } catch {
        return null;
      }
    }

    const hit = this.memory.get(k);
    if (!hit) return null;
    if (hit.expiresAt < Date.now()) {
      this.memory.delete(k);
      return null;
    }
    try {
      return JSON.parse(hit.value) as T;
    } catch {
      return null;
    }
  }

  async set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    if (!this.cfg().enabled) return;
    const ttl = ttlSeconds ?? this.cfg().ttlSeconds;
    const k = this.key(key);
    const payload = JSON.stringify(value);
    const client = this.redis.getClient();

    if (client && this.redis.isReady()) {
      await client.set(k, payload, 'EX', Math.max(1, ttl));
      return;
    }

    this.memory.set(k, {
      value: payload,
      expiresAt: Date.now() + Math.max(1, ttl) * 1000,
    });
  }

  async del(key: string): Promise<void> {
    const k = this.key(key);
    const client = this.redis.getClient();
    if (client && this.redis.isReady()) {
      await client.del(k);
    }
    this.memory.delete(k);
  }

  /** Invalidate by prefix (memory always; Redis SCAN best-effort). */
  async invalidatePrefix(prefix: string): Promise<number> {
    const full = this.key(prefix);
    let count = 0;

    for (const k of [...this.memory.keys()]) {
      if (k.startsWith(full)) {
        this.memory.delete(k);
        count += 1;
      }
    }

    const client = this.redis.getClient();
    if (client && this.redis.isReady()) {
      let cursor = '0';
      do {
        const [next, keys] = await client.scan(
          cursor,
          'MATCH',
          `${full}*`,
          'COUNT',
          100,
        );
        cursor = next;
        if (keys.length) {
          // ioredis keyPrefix already applied on keys returned? Actually SCAN returns keys WITH prefix stripped when using keyPrefix option...
          // With keyPrefix, del needs the unprefixed key. get/set use keyPrefix automatically.
          // SCAN returns full keys including prefix from Redis server perspective when using ioredis keyPrefix - actually ioredis adds prefix to commands.
          // For SCAN MATCH, the pattern is also prefixed. Returned keys have prefix stripped by ioredis.
          await client.del(...keys);
          count += keys.length;
        }
      } while (cursor !== '0');
    }

    this.logger.debug(`Cache invalidate prefix=${prefix} count=${count}`);
    return count;
  }

  /** Test helper — clear memory store. */
  clearMemory() {
    this.memory.clear();
  }
}

@Global()
@Module({
  providers: [CacheService],
  exports: [CacheService],
})
export class CacheModule {}
