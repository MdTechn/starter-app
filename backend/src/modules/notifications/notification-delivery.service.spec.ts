import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { NotificationDeliveryService } from './notification-delivery.service';
import { SmtpEmailChannel } from './channels/smtp-email.channel';
import { SmsChannelStub, PushChannelStub } from './channels/stub.channels';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AppLogger } from '../../common/logger/app-logger.service';
import { BrandService } from '../brand/brand.service';
import { NotificationChannel, NotificationStatus } from '@prisma/client';

describe('NotificationDeliveryService', () => {
  let service: NotificationDeliveryService;
  let prisma: {
    notification: { findUnique: jest.Mock; update: jest.Mock };
  };
  let email: { send: jest.Mock; isConfigured: jest.Mock };

  beforeEach(async () => {
    prisma = {
      notification: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };
    email = {
      send: jest.fn().mockResolvedValue(undefined),
      isConfigured: jest.fn().mockReturnValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationDeliveryService,
        { provide: PrismaService, useValue: prisma },
        { provide: SmtpEmailChannel, useValue: email },
        {
          provide: SmsChannelStub,
          useValue: { send: jest.fn(), isConfigured: () => false },
        },
        {
          provide: PushChannelStub,
          useValue: { send: jest.fn(), isConfigured: () => false },
        },
        {
          provide: AppLogger,
          useValue: {
            setContext: jest.fn(),
            log: jest.fn(),
            warn: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(NotificationDeliveryService);
  });

  it('sends email and marks SENT', async () => {
    prisma.notification.findUnique.mockResolvedValue({
      id: 'n1',
      channel: NotificationChannel.EMAIL,
      status: NotificationStatus.PENDING,
      email: 'a@b.c',
      title: 'Hi',
      body: 'Hello',
    });
    prisma.notification.update.mockResolvedValue({});

    await service.deliver('n1');
    expect(email.send).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'a@b.c', subject: 'Hi' }),
    );
    expect(prisma.notification.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: NotificationStatus.SENT }),
      }),
    );
  });

  it('marks in-app as SENT without external send', async () => {
    prisma.notification.findUnique.mockResolvedValue({
      id: 'n2',
      channel: NotificationChannel.IN_APP,
      status: NotificationStatus.PENDING,
    });
    prisma.notification.update.mockResolvedValue({});

    await service.deliver('n2');
    expect(email.send).not.toHaveBeenCalled();
    expect(prisma.notification.update).toHaveBeenCalled();
  });

  it('marks FAILED when email send throws', async () => {
    prisma.notification.findUnique.mockResolvedValue({
      id: 'n3',
      channel: NotificationChannel.EMAIL,
      status: NotificationStatus.PENDING,
      email: 'a@b.c',
      title: 'Hi',
      body: 'Hello',
    });
    email.send.mockRejectedValue(new Error('SMTP down'));
    prisma.notification.update.mockResolvedValue({});

    await service.deliver('n3');
    expect(prisma.notification.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: NotificationStatus.FAILED,
          error: 'SMTP down',
        }),
      }),
    );
  });
});

describe('SmtpEmailChannel', () => {
  it('reports not configured without host/from', async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SmtpEmailChannel,
        {
          provide: ConfigService,
          useValue: {
            get: () => ({
              host: '',
              port: 587,
              secure: false,
              user: '',
              pass: '',
              from: '',
            }),
          },
        },
        {
          provide: BrandService,
          useValue: {
            getConfig: () =>
              Promise.resolve({ appName: 'Test', logoUrl: '/logo.svg' }),
          },
        },
        {
          provide: AppLogger,
          useValue: {
            setContext: jest.fn(),
            warn: jest.fn(),
            log: jest.fn(),
          },
        },
      ],
    }).compile();

    const channel = module.get(SmtpEmailChannel);
    expect(channel.isConfigured()).toBe(false);
  });
});
