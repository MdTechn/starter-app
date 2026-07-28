import { Test, TestingModule } from '@nestjs/testing';
import { AuthAuditEvent, IdentityProvider } from '@prisma/client';
import { AuthAuditService } from './auth-audit.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AppLogger } from '../../common/logger/app-logger.service';

describe('AuthAuditService', () => {
  let service: AuthAuditService;
  let prisma: { authAuditLog: { create: jest.Mock; findMany: jest.Mock } };

  beforeEach(async () => {
    prisma = {
      authAuditLog: {
        create: jest.fn().mockResolvedValue({
          id: 'a1',
          event: AuthAuditEvent.LOGIN_SUCCESS,
        }),
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthAuditService,
        { provide: PrismaService, useValue: prisma },
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

    service = module.get(AuthAuditService);
  });

  it('records audit events with provider and metadata', async () => {
    await service.record({
      event: AuthAuditEvent.LOGIN_SUCCESS,
      userId: 'u1',
      ip: '127.0.0.1',
      userAgent: 'jest',
      metadata: { path: '/api/auth/me' },
    });

    expect(prisma.authAuditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        event: AuthAuditEvent.LOGIN_SUCCESS,
        userId: 'u1',
        provider: IdentityProvider.KEYCLOAK,
        ip: '127.0.0.1',
        userAgent: 'jest',
      }),
    });
  });

  it('lists recent audit logs with capped limit', async () => {
    await service.listRecent(999);
    expect(prisma.authAuditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 200 }),
    );
  });

  it('supports all required event types', async () => {
    for (const event of Object.values(AuthAuditEvent)) {
      await service.record({ event });
    }
    expect(prisma.authAuditLog.create).toHaveBeenCalledTimes(
      Object.values(AuthAuditEvent).length,
    );
  });
});
