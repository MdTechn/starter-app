import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  NOTIFICATION_DISPATCH_EVENT,
  NotificationDispatchPayload,
} from '@saas-starter/shared';
import { AppLogger } from '../../common/logger/app-logger.service';
import { NotificationsService } from './notifications.service';

/**
 * Listens to the internal notification bus.
 * Feature modules emit — they never import NotificationsModule services.
 */
@Injectable()
export class NotificationEventsListener {
  constructor(
    private readonly notifications: NotificationsService,
    private readonly logger: AppLogger,
  ) {
    this.logger.setContext(NotificationEventsListener.name);
  }

  @OnEvent(NOTIFICATION_DISPATCH_EVENT, { async: true })
  async handleDispatch(payload: NotificationDispatchPayload) {
    try {
      await this.notifications.dispatch(payload);
    } catch (err) {
      this.logger.error(
        `Failed to handle notification event ${payload.eventType}`,
        err instanceof Error ? err.stack : undefined,
      );
    }
  }
}
