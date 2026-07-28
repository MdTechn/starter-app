import { Injectable, OnModuleInit } from '@nestjs/common';
import { NotificationChannel, NotificationEventType } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AppLogger } from '../../common/logger/app-logger.service';
import { DEFAULT_NOTIFICATION_TEMPLATES } from './templates/default-templates';

@Injectable()
export class NotificationTemplateService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: AppLogger,
  ) {
    this.logger.setContext(NotificationTemplateService.name);
  }

  async onModuleInit() {
    try {
      await this.seedDefaults();
    } catch (err) {
      this.logger.warn(
        `Notification template seed skipped: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  async seedDefaults() {
    for (const tpl of DEFAULT_NOTIFICATION_TEMPLATES) {
      await this.prisma.notificationTemplate.upsert({
        where: {
          eventType_channel: {
            eventType: tpl.eventType,
            channel: tpl.channel,
          },
        },
        create: {
          eventType: tpl.eventType,
          channel: tpl.channel,
          subject: tpl.subject,
          bodyTemplate: tpl.bodyTemplate,
          enabled: true,
        },
        update: {
          subject: tpl.subject,
          bodyTemplate: tpl.bodyTemplate,
        },
      });
    }
    this.logger.log('Notification templates seeded');
  }

  find(eventType: NotificationEventType, channel: NotificationChannel) {
    return this.prisma.notificationTemplate.findUnique({
      where: { eventType_channel: { eventType, channel } },
    });
  }

  list() {
    return this.prisma.notificationTemplate.findMany({
      orderBy: [{ eventType: 'asc' }, { channel: 'asc' }],
    });
  }
}
