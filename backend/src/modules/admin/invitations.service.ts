import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InvitationStatus, Role, UserInvitation } from '@prisma/client';
import {
  normalizePagination,
  toPaginated,
  UserRole,
  AppNotificationEvent,
} from '@saas-starter/shared';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AppLogger } from '../../common/logger/app-logger.service';
import { NotificationDispatcher } from '../../common/events/notification-dispatcher';
import { OrganizationsService } from '../organizations/organizations.service';
import { CreateInvitationDto, ListInvitationsQueryDto } from './dto/admin.dto';

const DEFAULT_EXPIRY_DAYS = 7;

@Injectable()
export class InvitationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: AppLogger,
    private readonly notifications: NotificationDispatcher,
    private readonly config: ConfigService,
    private readonly organizations: OrganizationsService,
  ) {
    this.logger.setContext(InvitationsService.name);
  }

  /**
   * Create a user invitation and send email via NotificationDispatcher → SMTP.
   * When `organizationId` is set, enforces plan `memberLimit`.
   */
  async create(
    dto: CreateInvitationDto,
    invitedById?: string,
  ): Promise<UserInvitation> {
    const email = dto.email.toLowerCase().trim();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing && existing.status !== 'DELETED') {
      throw new BadRequestException('A user with this email already exists');
    }

    let organizationName: string | undefined;
    if (dto.organizationId) {
      const org = await this.prisma.organization.findUnique({
        where: { id: dto.organizationId },
      });
      if (!org) {
        throw new NotFoundException('Organization not found');
      }
      organizationName = org.name;
      await this.organizations.assertMemberLimit(dto.organizationId, {
        includePendingInvites: true,
      });
    }

    const days = dto.expiresInDays ?? DEFAULT_EXPIRY_DAYS;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + days);

    const role = dto.role === UserRole.ADMIN ? Role.ADMIN : Role.USER;

    const invitation = await this.prisma.userInvitation.create({
      data: {
        email,
        role,
        organizationId: dto.organizationId,
        invitedById,
        expiresAt,
        status: InvitationStatus.PENDING,
      },
    });

    const frontendUrl = (
      this.config.get<string>('FRONTEND_URL') ??
      process.env.FRONTEND_URL ??
      'http://localhost:3000'
    ).replace(/\/$/, '');
    const inviteUrl = `${frontendUrl}/login?invite=${encodeURIComponent(invitation.token)}`;

    this.logger.log(
      `Invitation created id=${invitation.id} email=${email} by=${invitedById ?? 'system'} — email queued`,
    );
    this.notifications.dispatch({
      eventType: AppNotificationEvent.USER_INVITED,
      email,
      data: {
        email,
        expiresAt: expiresAt.toISOString(),
        invitationId: invitation.id,
        organizationId: dto.organizationId,
        organizationName: organizationName ?? '',
        inviteUrl,
        token: invitation.token,
      },
      channels: ['EMAIL'],
    });
    if (invitedById) {
      this.notifications.dispatch({
        eventType: AppNotificationEvent.USER_INVITED,
        userId: invitedById,
        data: {
          email,
          expiresAt: expiresAt.toISOString(),
          invitationId: invitation.id,
          organizationId: dto.organizationId,
          organizationName: organizationName ?? '',
          inviteUrl,
        },
        channels: ['IN_APP'],
      });
    }
    return invitation;
  }

  async list(query: ListInvitationsQueryDto = {}) {
    await this.expireStale();
    const { page, pageSize, skip, take } = normalizePagination(query);
    const where =
      query.status &&
      Object.values(InvitationStatus).includes(query.status as InvitationStatus)
        ? { status: query.status as InvitationStatus }
        : {};

    const [items, total] = await this.prisma.$transaction([
      this.prisma.userInvitation.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        include: {
          organization: { select: { id: true, name: true, slug: true } },
          invitedBy: { select: { id: true, email: true, name: true } },
        },
      }),
      this.prisma.userInvitation.count({ where }),
    ]);

    return toPaginated(items, total, page, pageSize);
  }

  async revoke(id: string): Promise<UserInvitation> {
    const invitation = await this.prisma.userInvitation.findUnique({
      where: { id },
    });
    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }
    if (invitation.status !== InvitationStatus.PENDING) {
      throw new BadRequestException(
        `Cannot revoke invitation in status ${invitation.status}`,
      );
    }

    return this.prisma.userInvitation.update({
      where: { id },
      data: { status: InvitationStatus.REVOKED },
    });
  }

  private async expireStale(): Promise<void> {
    await this.prisma.userInvitation.updateMany({
      where: {
        status: InvitationStatus.PENDING,
        expiresAt: { lt: new Date() },
      },
      data: { status: InvitationStatus.EXPIRED },
    });
  }
}
