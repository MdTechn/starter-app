import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job, Queue, Worker } from 'bullmq';
import { AppLogger } from '../../common/logger/app-logger.service';
import { RedisService } from '../redis/redis.module';

export const JOB_QUEUES = {
  NOTIFICATIONS: 'notifications',
  DEFAULT: 'default',
} as const;

export type JobQueueName = (typeof JOB_QUEUES)[keyof typeof JOB_QUEUES];

export type EnqueueOptions = {
  attempts?: number;
  backoffMs?: number;
  delayMs?: number;
  jobId?: string;
};

/**
 * BullMQ facade — no-ops / sync handlers when Redis is unavailable.
 */
@Injectable()
export class JobsService implements OnModuleInit, OnModuleDestroy {
  private queues = new Map<string, Queue>();
  private workers: Worker[] = [];
  private handlers = new Map<
    string,
    (data: unknown, job?: Job) => Promise<void>
  >();
  private enabled = false;

  constructor(
    private readonly redis: RedisService,
    private readonly config: ConfigService,
    private readonly logger: AppLogger,
  ) {
    this.logger.setContext(JobsService.name);
  }

  onModuleInit() {
    const connection = this.redis.getBullConnection();
    if (!connection) {
      this.logger.warn('BullMQ disabled — Redis not configured');
      return;
    }
    this.enabled = true;
    this.logger.log('BullMQ ready (queues lazy-initialized)');
  }

  async onModuleDestroy() {
    await Promise.all(this.workers.map((w) => w.close()));
    await Promise.all([...this.queues.values()].map((q) => q.close()));
    this.workers = [];
    this.queues.clear();
  }

  isEnabled() {
    return this.enabled;
  }

  registerHandler(
    queueName: string,
    handler: (data: unknown, job?: Job) => Promise<void>,
  ) {
    this.handlers.set(queueName, handler);
    if (this.enabled) {
      this.ensureWorker(queueName);
    }
  }

  async enqueue(
    queueName: string,
    name: string,
    data: unknown,
    options: EnqueueOptions = {},
  ): Promise<{ id: string; mode: 'bullmq' | 'sync' }> {
    const attempts = options.attempts ?? 3;
    const backoffMs = options.backoffMs ?? 2000;

    if (!this.enabled) {
      const handler = this.handlers.get(queueName);
      if (handler) await handler(data);
      return { id: `sync-${Date.now()}`, mode: 'sync' };
    }

    const queue = this.ensureQueue(queueName);
    this.ensureWorker(queueName);
    const job = await queue.add(name, data, {
      jobId: options.jobId,
      delay: options.delayMs,
      attempts,
      backoff: { type: 'exponential', delay: backoffMs },
      removeOnComplete: 1000,
      removeOnFail: 5000,
    });
    return { id: String(job.id), mode: 'bullmq' };
  }

  private ensureQueue(name: string): Queue {
    let queue = this.queues.get(name);
    if (queue) return queue;
    const connection = this.redis.getBullConnection();
    if (!connection) {
      throw new Error('BullMQ connection unavailable');
    }
    queue = new Queue(name, { connection });
    this.queues.set(name, queue);
    return queue;
  }

  private ensureWorker(name: string) {
    if (this.workers.some((w) => w.name === name)) return;
    const connection = this.redis.getBullConnection();
    const handler = this.handlers.get(name);
    if (!connection || !handler) return;

    const worker = new Worker(
      name,
      async (job) => {
        this.logger.debug(`Job ${name}/${job.name} id=${job.id}`);
        await handler(job.data, job);
      },
      {
        connection,
        concurrency: Number(process.env.BULLMQ_CONCURRENCY ?? 5),
      },
    );

    worker.on('failed', (job, err) => {
      this.logger.warn(
        `Job failed queue=${name} id=${job?.id}: ${err.message}`,
      );
    });

    this.workers.push(worker);
    this.logger.log(`Worker started for queue=${name}`);
  }
}
