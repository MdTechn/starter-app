import { Injectable } from '@nestjs/common';
import {
  AuthAuditEvent,
  AuthAuditLog,
  IdentityProvider,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AppLogger } from '../../common/logger/app-logger.service';

export type AuthAuditInput = {
  event: AuthAuditEvent;
  userId?: string | null;
  provider?: IdentityProvider;
  ip?: string | null;
  userAgent?: string | null;
  metadata?: Prisma.InputJsonValue;
};

@Injectable()
export class AuthAuditService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: AppLogger,
  ) {
    this.logger.setContext(AuthAuditService.name);
  }

  async record(input: AuthAuditInput): Promise<AuthAuditLog> {
    const provider = input.provider ?? IdentityProvider.KEYCLOAK;

    this.logger.log({
      msg: 'security_audit',
      event: input.event,
      userId: input.userId ?? null,
      provider,
      ip: input.ip ?? null,
    });

    return this.prisma.authAuditLog.create({
      data: {
        event: input.event,
        userId: input.userId ?? null,
        provider,
        ip: input.ip ?? null,
        userAgent: input.userAgent ?? null,
        metadata: input.metadata ?? undefined,
      },
    });
  }

  async listRecent(limit = 50): Promise<AuthAuditLog[]> {
    return this.prisma.authAuditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(limit, 1), 200),
    });
  }
}
