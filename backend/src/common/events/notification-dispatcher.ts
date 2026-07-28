import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  NOTIFICATION_DISPATCH_EVENT,
  NotificationDispatchPayload,
} from '@saas-starter/shared';
import { AppLogger } from '../logger/app-logger.service';

/**
 * Thin emitter used by feature modules.
 * Does not import NotificationsModule — avoids circular deps.
 */
@Injectable()
export class NotificationDispatcher {
  constructor(
    private readonly events: EventEmitter2,
    private readonly logger: AppLogger,
  ) {
    this.logger.setContext(NotificationDispatcher.name);
  }

  dispatch(payload: NotificationDispatchPayload): void {
    try {
      this.events.emit(NOTIFICATION_DISPATCH_EVENT, payload);
    } catch (err) {
      this.logger.warn(
        `Failed to emit notification ${payload.eventType}: ${err instanceof Error ? err.message : 'unknown'}`,
      );
    }
  }
}
