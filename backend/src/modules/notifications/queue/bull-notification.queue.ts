import { Injectable, OnModuleInit } from '@nestjs/common';
import { AppLogger } from '../../../common/logger/app-logger.service';
import { JOB_QUEUES, JobsService } from '../../jobs/jobs.service';
import { NotificationDeliveryService } from '../notification-delivery.service';
import { NotificationJob, NotificationQueue } from './notification-queue';

/**
 * BullMQ-backed notification queue when Redis/Jobs are enabled.
 * Retries with exponential backoff.
 */
@Injectable()
export class BullNotificationQueue implements NotificationQueue, OnModuleInit {
  constructor(
    private readonly jobs: JobsService,
    private readonly delivery: NotificationDeliveryService,
    private readonly logger: AppLogger,
  ) {
    this.logger.setContext(BullNotificationQueue.name);
  }

  onModuleInit() {
    this.jobs.registerHandler(JOB_QUEUES.NOTIFICATIONS, async (data) => {
      const job = data as NotificationJob;
      await this.delivery.deliver(job.notificationId);
    });
    if (this.jobs.isEnabled()) {
      this.logger.log('BullMQ notification worker registered');
    }
  }

  async enqueue(job: NotificationJob): Promise<void> {
    await this.jobs.enqueue(JOB_QUEUES.NOTIFICATIONS, 'deliver', job, {
      attempts: 3,
      backoffMs: 2000,
      jobId: `notif-${job.notificationId}`,
    });
  }
}
