import { Injectable } from '@nestjs/common';
import { AppLogger } from '../../../common/logger/app-logger.service';
import { NotificationDeliveryService } from '../notification-delivery.service';
import { NotificationJob, NotificationQueue } from './notification-queue';

/** In-process fallback when BullMQ/Redis is unavailable. */
@Injectable()
export class SyncNotificationQueue implements NotificationQueue {
  constructor(
    private readonly delivery: NotificationDeliveryService,
    private readonly logger: AppLogger,
  ) {
    this.logger.setContext(SyncNotificationQueue.name);
  }

  async enqueue(job: NotificationJob): Promise<void> {
    await this.delivery.deliver(job.notificationId);
  }
}
