import { Test, TestingModule } from '@nestjs/testing';
import {
  NotificationChannel,
  NotificationEventType,
  NotificationStatus,
} from '@prisma/client';
import { NotificationsService } from './notifications.service';
import { NotificationTemplateService } from './notification-template.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AppLogger } from '../../common/logger/app-logger.service';
import { NOTIFICATION_QUEUE } from './notifications.tokens';
import { AppNotificationEvent } from '@saas-starter/shared';
import { BrandService } from '../brand/brand.service';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let prisma: {
    notification: {
      create: jest.Mock;
      findMany: jest.Mock;
      findFirst: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
      count: jest.Mock;
    };
    notificationPreference: {
      findUnique: jest.Mock;
      findMany: jest.Mock;
      upsert: jest.Mock;
    };
  };
  let templates: { find: jest.Mock };
  let queue: { enqueue: jest.Mock };

  beforeEach(async () => {
    prisma = {
      notification: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        count: jest.fn(),
      },
      notificationPreference: {
        findUnique: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        upsert: jest.fn(),
      },
    };
    templates = {
      find: jest.fn().mockResolvedValue({
        enabled: true,
        subject: 'Hello {{name}}',
        bodyTemplate: 'Body {{email}} — {{appName}}',
      }),
    };
    queue = { enqueue: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: PrismaService, useValue: prisma },
        { provide: NotificationTemplateService, useValue: templates },
        { provide: NOTIFICATION_QUEUE, useValue: queue },
        {
          provide: BrandService,
          useValue: {
            getConfig: () =>
              Promise.resolve({
                appName: 'Acme SaaS',
                companyName: 'Acme',
                supportEmail: 'help@acme.test',
                supportUrl: 'https://acme.test',
                logoUrl: '/branding/logo.svg',
                primaryColor: '#112233',
              }),
          },
        },
        {
          provide: AppLogger,
          useValue: {
            setContext: jest.fn(),
            log: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(NotificationsService);
  });

  it('creates notifications and enqueues delivery', async () => {
    prisma.notification.create
      .mockResolvedValueOnce({
        id: 'n1',
        channel: NotificationChannel.EMAIL,
      })
      .mockResolvedValueOnce({
        id: 'n2',
        channel: NotificationChannel.IN_APP,
      });

    const created = await service.dispatch({
      eventType: AppNotificationEvent.USER_CREATED,
      userId: 'u1',
      email: 'a@b.c',
      data: { name: 'Ada', email: 'a@b.c' },
    });

    expect(created).toHaveLength(2);
    expect(queue.enqueue).toHaveBeenCalledTimes(2);
    expect(prisma.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          body: expect.stringContaining('Acme SaaS'),
        }),
      }),
    );
  });

  it('marks notification as read', async () => {
    prisma.notification.findFirst.mockResolvedValue({
      id: 'n1',
      userId: 'u1',
    });
    prisma.notification.update.mockResolvedValue({
      id: 'n1',
      status: NotificationStatus.READ,
    });

    const result = await service.markRead('u1', 'n1');
    expect(result?.status).toBe(NotificationStatus.READ);
  });

  it('returns unread count', async () => {
    prisma.notification.count.mockResolvedValue(3);
    await expect(service.unreadCount('u1')).resolves.toBe(3);
  });

  it('upserts preferences', async () => {
    prisma.notificationPreference.upsert.mockResolvedValue({
      eventType: NotificationEventType.PAYMENT_FAILED,
      emailEnabled: false,
    });

    const pref = await service.upsertPreference(
      'u1',
      NotificationEventType.PAYMENT_FAILED,
      { emailEnabled: false },
    );
    expect(pref.emailEnabled).toBe(false);
  });

  it('skips channel when preference disables it', async () => {
    prisma.notificationPreference.findUnique.mockResolvedValue({
      emailEnabled: false,
      inAppEnabled: true,
      smsEnabled: false,
      pushEnabled: false,
    });
    prisma.notification.create.mockResolvedValue({
      id: 'n-inapp',
      channel: NotificationChannel.IN_APP,
    });

    const created = await service.dispatch({
      eventType: AppNotificationEvent.PAYMENT_SUCCESS,
      userId: 'u1',
      email: 'a@b.c',
    });

    expect(created).toHaveLength(1);
    expect(created[0].channel).toBe(NotificationChannel.IN_APP);
  });
});
