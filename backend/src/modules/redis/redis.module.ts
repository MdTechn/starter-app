import {
  Global,
  Injectable,
  Module,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { RedisConfig } from '../../config/redis.config';
import { AppLogger } from '../../common/logger/app-logger.service';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client: Redis | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly logger: AppLogger,
  ) {
    this.logger.setContext(RedisService.name);
  }

  onModuleInit() {
    const redis = this.config.get<RedisConfig>('redis');
    if (!redis?.enabled) {
      this.logger.warn('Redis disabled — cache/jobs use in-process fallbacks');
      return;
    }

    try {
      this.client = redis.url
        ? new Redis(redis.url, {
            keyPrefix: redis.keyPrefix,
            maxRetriesPerRequest: null,
            lazyConnect: true,
          })
        : new Redis({
            host: redis.host,
            port: redis.port,
            password: redis.password,
            db: redis.db,
            keyPrefix: redis.keyPrefix,
            maxRetriesPerRequest: null,
            lazyConnect: true,
          });

      this.client.on('error', (err) => {
        this.logger.warn(`Redis error: ${err.message}`);
      });

      void this.client.connect().then(
        () => this.logger.log('Redis connected'),
        (err: Error) =>
          this.logger.warn(`Redis connect failed: ${err.message}`),
      );
    } catch (err) {
      this.logger.warn(
        `Redis init failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      this.client = null;
    }
  }

  async onModuleDestroy() {
    if (this.client) {
      await this.client.quit().catch(() => undefined);
      this.client = null;
    }
  }

  isReady(): boolean {
    return this.client?.status === 'ready';
  }

  getClient(): Redis | null {
    return this.client;
  }

  /** Connection options for BullMQ (without keyPrefix). */
  getBullConnection():
    | { url: string }
    | { host: string; port: number; password?: string; db: number }
    | null {
    const redis = this.config.get<RedisConfig>('redis');
    if (!redis?.enabled) return null;
    if (redis.url) return { url: redis.url };
    return {
      host: redis.host,
      port: redis.port,
      password: redis.password,
      db: redis.db,
    };
  }

  async ping(): Promise<boolean> {
    if (!this.client) return false;
    try {
      if (this.client.status !== 'ready') {
        await this.client.connect().catch(() => undefined);
      }
      const pong = await this.client.ping();
      return pong === 'PONG';
    } catch {
      return false;
    }
  }
}

@Global()
@Module({
  providers: [RedisService],
  exports: [RedisService],
})
export class RedisModule {}
