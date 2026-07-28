import { Injectable, Inject } from '@nestjs/common';
import {
  NotificationChannel,
  NotificationEventType,
  NotificationStatus,
  Prisma,
} from '@prisma/client';
import {
  ALL_NOTIFICATION_EVENTS,
  NotificationDispatchPayload,
} from '@saas-starter/shared';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AppLogger } from '../../common/logger/app-logger.service';
import { NotificationTemplateService } from './notification-template.service';
import { renderTemplate } from './templates/default-templates';
import { NotificationQueue } from './queue/notification-queue';
import { NOTIFICATION_QUEUE } from './notifications.tokens';
import { BrandService } from '../brand/brand.service';

const DEFAULT_CHANNELS: NotificationChannel[] = [
  NotificationChannel.EMAIL,
  NotificationChannel.IN_APP,
];

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly templates: NotificationTemplateService,
    @Inject(NOTIFICATION_QUEUE)
    private readonly queue: NotificationQueue,
    private readonly brand: BrandService,
    private readonly logger: AppLogger,
  ) {
    this.logger.setContext(NotificationsService.name);
  }

  async dispatch(payload: NotificationDispatchPayload) {
    const eventType = this.toEventType(payload.eventType);
    if (!eventType) {
      this.logger.warn(`Unknown notification event: ${payload.eventType}`);
      return [];
    }

    const brand = await this.brand.getConfig();
    const data: Record<string, unknown> = {
      appName: brand.appName,
      companyName: brand.companyName,
      supportEmail: brand.supportEmail,
      supportUrl: brand.supportUrl,
      logoUrl: brand.logoUrl,
      primaryColor: brand.primaryColor,
      ...(payload.data ?? {}),
      email: payload.email ?? payload.data?.email,
      name: payload.data?.name ?? payload.email,
    };

    const channels =
      payload.channels?.map((c) => c as NotificationChannel) ??
      DEFAULT_CHANNELS;

    const created = [];

    for (const channel of channels) {
      if (
        channel === NotificationChannel.SMS ||
        channel === NotificationChannel.PUSH
      ) {
        // Prepared only — skip unless explicitly forced later.
        continue;
      }

      const allowed = await this.isChannelAllowed(
        payload.userId,
        eventType,
        channel,
      );
      if (!allowed) continue;

      const template = await this.templates.find(eventType, channel);
      if (!template?.enabled) continue;

      const title =
        channel === NotificationChannel.EMAIL
          ? renderTemplate(template.subject ?? eventType, data)
          : renderTemplate(
              template.subject ?? template.bodyTemplate.slice(0, 80),
              data,
            );
      const body = renderTemplate(template.bodyTemplate, data);

      const notification = await this.prisma.notification.create({
        data: {
          userId: payload.userId ?? null,
          email: payload.email ?? null,
          eventType,
          channel,
          status: NotificationStatus.PENDING,
          title,
          body,
          payload: data as Prisma.InputJsonValue,
        },
      });

      await this.queue.enqueue({ notificationId: notification.id });
      created.push(notification);
    }

    this.logger.log(
      `Dispatched ${created.length} notification(s) event=${eventType} user=${payload.userId ?? 'n/a'}`,
    );
    return created;
  }

  async listForUser(userId: string, limit = 50) {
    return this.prisma.notification.findMany({
      where: {
        userId,
        channel: NotificationChannel.IN_APP,
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(limit, 1), 100),
    });
  }

  async unreadCount(userId: string) {
    return this.prisma.notification.count({
      where: {
        userId,
        channel: NotificationChannel.IN_APP,
        status: { in: [NotificationStatus.PENDING, NotificationStatus.SENT] },
        readAt: null,
      },
    });
  }

  async markRead(userId: string, id: string) {
    const notification = await this.prisma.notification.findFirst({
      where: { id, userId, channel: NotificationChannel.IN_APP },
    });
    if (!notification) return null;

    return this.prisma.notification.update({
      where: { id },
      data: {
        status: NotificationStatus.READ,
        readAt: new Date(),
      },
    });
  }

  async markAllRead(userId: string) {
    await this.prisma.notification.updateMany({
      where: {
        userId,
        channel: NotificationChannel.IN_APP,
        readAt: null,
      },
      data: {
        status: NotificationStatus.READ,
        readAt: new Date(),
      },
    });
    return { ok: true };
  }

  async getPreferences(userId: string) {
    const existing = await this.prisma.notificationPreference.findMany({
      where: { userId },
    });
    const byEvent = new Map(existing.map((p) => [p.eventType, p]));

    return ALL_NOTIFICATION_EVENTS.map((eventType) => {
      const row = byEvent.get(eventType as NotificationEventType);
      return {
        eventType,
        emailEnabled: row?.emailEnabled ?? true,
        inAppEnabled: row?.inAppEnabled ?? true,
        smsEnabled: row?.smsEnabled ?? false,
        pushEnabled: row?.pushEnabled ?? false,
      };
    });
  }

  async upsertPreference(
    userId: string,
    eventType: NotificationEventType,
    data: {
      emailEnabled?: boolean;
      inAppEnabled?: boolean;
      smsEnabled?: boolean;
      pushEnabled?: boolean;
    },
  ) {
    return this.prisma.notificationPreference.upsert({
      where: { userId_eventType: { userId, eventType } },
      create: {
        userId,
        eventType,
        emailEnabled: data.emailEnabled ?? true,
        inAppEnabled: data.inAppEnabled ?? true,
        smsEnabled: data.smsEnabled ?? false,
        pushEnabled: data.pushEnabled ?? false,
      },
      update: {
        ...(data.emailEnabled !== undefined
          ? { emailEnabled: data.emailEnabled }
          : {}),
        ...(data.inAppEnabled !== undefined
          ? { inAppEnabled: data.inAppEnabled }
          : {}),
        ...(data.smsEnabled !== undefined
          ? { smsEnabled: data.smsEnabled }
          : {}),
        ...(data.pushEnabled !== undefined
          ? { pushEnabled: data.pushEnabled }
          : {}),
      },
    });
  }

  private async isChannelAllowed(
    userId: string | null | undefined,
    eventType: NotificationEventType,
    channel: NotificationChannel,
  ): Promise<boolean> {
    if (!userId) {
      // Email-only paths (invitee without account yet)
      return channel === NotificationChannel.EMAIL;
    }

    const pref = await this.prisma.notificationPreference.findUnique({
      where: { userId_eventType: { userId, eventType } },
    });
    if (!pref) return true;

    if (channel === NotificationChannel.EMAIL) return pref.emailEnabled;
    if (channel === NotificationChannel.IN_APP) return pref.inAppEnabled;
    if (channel === NotificationChannel.SMS) return pref.smsEnabled;
    if (channel === NotificationChannel.PUSH) return pref.pushEnabled;
    return false;
  }

  private toEventType(raw: string): NotificationEventType | null {
    if (
      Object.values(NotificationEventType).includes(
        raw as NotificationEventType,
      )
    ) {
      return raw as NotificationEventType;
    }
    return null;
  }
}
