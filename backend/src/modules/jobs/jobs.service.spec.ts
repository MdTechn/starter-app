import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JobsService, JOB_QUEUES } from './jobs.service';
import { RedisService } from '../redis/redis.module';
import { AppLogger } from '../../common/logger/app-logger.service';

describe('JobsService', () => {
  let jobs: JobsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JobsService,
        {
          provide: RedisService,
          useValue: { getBullConnection: () => null },
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn() },
        },
        {
          provide: AppLogger,
          useValue: {
            setContext: jest.fn(),
            log: jest.fn(),
            warn: jest.fn(),
            debug: jest.fn(),
          },
        },
      ],
    }).compile();

    jobs = module.get(JobsService);
    jobs.onModuleInit();
  });

  it('runs sync when BullMQ disabled', async () => {
    const handler = jest.fn().mockResolvedValue(undefined);
    jobs.registerHandler(JOB_QUEUES.DEFAULT, handler);
    const result = await jobs.enqueue(JOB_QUEUES.DEFAULT, 'ping', { ok: true });
    expect(result.mode).toBe('sync');
    expect(handler).toHaveBeenCalledWith({ ok: true });
  });

  it('reports disabled without Redis', () => {
    expect(jobs.isEnabled()).toBe(false);
  });
});
