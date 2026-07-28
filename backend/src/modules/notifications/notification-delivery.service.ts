import { Injectable } from '@nestjs/common';
import { NotificationChannel, NotificationStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AppLogger } from '../../common/logger/app-logger.service';
import { SmtpEmailChannel } from './channels/smtp-email.channel';
import { SmsChannelStub, PushChannelStub } from './channels/stub.channels';

@Injectable()
export class NotificationDeliveryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly email: SmtpEmailChannel,
    private readonly sms: SmsChannelStub,
    private readonly push: PushChannelStub,
    private readonly logger: AppLogger,
  ) {
    this.logger.setContext(NotificationDeliveryService.name);
  }

  async deliver(notificationId: string): Promise<void> {
    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId },
    });
    if (!notification) {
      this.logger.warn(`Notification not found id=${notificationId}`);
      return;
    }
    if (
      notification.status === NotificationStatus.SENT ||
      notification.status === NotificationStatus.READ
    ) {
      return;
    }

    try {
      switch (notification.channel) {
        case NotificationChannel.IN_APP:
          // Already persisted — mark sent.
          break;
        case NotificationChannel.EMAIL: {
          const to = notification.email;
          if (!to) throw new Error('Missing email recipient');
          await this.email.send({
            to,
            subject: notification.title,
            body: notification.body,
          });
          break;
        }
        case NotificationChannel.SMS:
          await this.sms.send({
            to: notification.email ?? notification.userId ?? '',
            body: notification.body,
          });
          break;
        case NotificationChannel.PUSH:
          await this.push.send({
            to: notification.userId ?? '',
            body: notification.body,
          });
          break;
        default:
          throw new Error(`Unsupported channel ${notification.channel}`);
      }

      await this.prisma.notification.update({
        where: { id: notificationId },
        data: {
          status: NotificationStatus.SENT,
          sentAt: new Date(),
          error: null,
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Delivery failed';
      this.logger.warn(
        `Notification delivery failed id=${notificationId}: ${message}`,
      );
      await this.prisma.notification.update({
        where: { id: notificationId },
        data: {
          status: NotificationStatus.FAILED,
          error: message,
        },
      });
    }
  }

  /** Expose for tests */
  async sendEmailDirect(to: string, subject: string, body: string) {
    await this.email.send({ to, subject, body });
  }
}
