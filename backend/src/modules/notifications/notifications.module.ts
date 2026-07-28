import { Module } from '@nestjs/common';
import { SmtpEmailChannel } from './channels/smtp-email.channel';
import { PushChannelStub, SmsChannelStub } from './channels/stub.channels';
import { NotificationDeliveryService } from './notification-delivery.service';
import { NotificationEventsListener } from './notification-events.listener';
import { NotificationTemplateService } from './notification-template.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { NOTIFICATION_QUEUE } from './notifications.tokens';
import { BullNotificationQueue } from './queue/bull-notification.queue';
import { SyncNotificationQueue } from './queue/sync-notification.queue';
import { BrandModule } from '../brand/brand.module';

@Module({
  imports: [BrandModule],
  controllers: [NotificationsController],
  providers: [
    NotificationTemplateService,
    NotificationsService,
    NotificationDeliveryService,
    NotificationEventsListener,
    SmtpEmailChannel,
    SmsChannelStub,
    PushChannelStub,
    SyncNotificationQueue,
    BullNotificationQueue,
    {
      provide: NOTIFICATION_QUEUE,
      useExisting: BullNotificationQueue,
    },
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
