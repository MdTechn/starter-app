import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { CacheService } from './cache.module';
import { RedisService } from '../redis/redis.module';
import { AppLogger } from '../../common/logger/app-logger.service';

describe('CacheService', () => {
  let cache: CacheService;
  let redis: { getClient: jest.Mock; isReady: jest.Mock };

  beforeEach(async () => {
    redis = {
      getClient: jest.fn().mockReturnValue(null),
      isReady: jest.fn().mockReturnValue(false),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CacheService,
        { provide: RedisService, useValue: redis },
        {
          provide: ConfigService,
          useValue: {
            get: () => ({
              enabled: true,
              ttlSeconds: 60,
              prefix: 'cache:',
            }),
          },
        },
        {
          provide: AppLogger,
          useValue: {
            setContext: jest.fn(),
            debug: jest.fn(),
            log: jest.fn(),
            warn: jest.fn(),
          },
        },
      ],
    }).compile();

    cache = module.get(CacheService);
    cache.clearMemory();
  });

  it('stores and reads from memory fallback', async () => {
    await cache.set('user:1', { id: '1' }, 30);
    await expect(cache.get<{ id: string }>('user:1')).resolves.toEqual({
      id: '1',
    });
  });

  it('invalidates by prefix', async () => {
    await cache.set('list:a', 1);
    await cache.set('list:b', 2);
    await cache.set('other', 3);
    const n = await cache.invalidatePrefix('list:');
    expect(n).toBeGreaterThanOrEqual(2);
    await expect(cache.get('list:a')).resolves.toBeNull();
    await expect(cache.get('other')).resolves.toBe(3);
  });

  it('deletes a key', async () => {
    await cache.set('x', 'y');
    await cache.del('x');
    await expect(cache.get('x')).resolves.toBeNull();
  });
});
