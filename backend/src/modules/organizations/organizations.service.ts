import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  InvitationStatus,
  OrganizationStatus,
  Prisma,
  Role,
} from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AppLogger } from '../../common/logger/app-logger.service';
import { FeatureAccessService } from '../payments/feature-access.service';
import {
  AddOrganizationMemberDto,
  CreateOrganizationDto,
  toOrgRole,
  UpdateOrganizationDto,
  UpdateOrganizationMemberRoleDto,
} from './dto/organizations.dto';

/**
 * Multi-tenant organizations — CRUD + membership; list/detail scoped by membership.
 */
@Injectable()
export class OrganizationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly features: FeatureAccessService,
    private readonly logger: AppLogger,
  ) {
    this.logger.setContext(OrganizationsService.name);
  }

  list(actorUserId?: string, roles?: string[]) {
    return this.listScoped(actorUserId, roles);
  }

  private async listScoped(actorUserId?: string, roles?: string[]) {
    const isAdmin = roles?.some((r) => r.toUpperCase() === 'ADMIN') ?? false;
    const where = isAdmin
      ? { status: { not: OrganizationStatus.DISABLED } }
      : actorUserId
        ? {
            status: { not: OrganizationStatus.DISABLED },
            members: { some: { userId: actorUserId } },
          }
        : { id: '__none__' };

    return this.prisma.organization.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { members: true } },
      },
    });
  }

  async findById(id: string, actorUserId?: string, roles?: string[]) {
    const org = await this.prisma.organization.findUnique({
      where: { id },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                name: true,
                firstName: true,
                lastName: true,
                avatarUrl: true,
                status: true,
              },
            },
          },
        },
      },
    });
    if (!org) {
      throw new NotFoundException('Organization not found');
    }
    const isAdmin = roles?.some((r) => r.toUpperCase() === 'ADMIN') ?? false;
    if (!isAdmin) {
      if (!actorUserId) {
        throw new NotFoundException('Organization not found');
      }
      const member = org.members.some((m) => m.userId === actorUserId);
      if (!member) {
        throw new NotFoundException('Organization not found');
      }
    }
    const memberLimit = await this.features.getMemberLimitForOrganization(id);
    const pendingInvites = await this.prisma.userInvitation.count({
      where: {
        organizationId: id,
        status: InvitationStatus.PENDING,
        expiresAt: { gt: new Date() },
      },
    });
    return {
      ...org,
      memberLimit,
      pendingInviteCount: pendingInvites,
    };
  }

  async create(dto: CreateOrganizationDto) {
    try {
      const org = await this.prisma.organization.create({
        data: {
          name: dto.name,
          slug: dto.slug.toLowerCase(),
          description: dto.description,
        },
      });
      this.logger.log(`Organization created id=${org.id} slug=${org.slug}`);
      return org;
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException('Organization slug already exists');
      }
      throw err;
    }
  }

  async update(id: string, dto: UpdateOrganizationDto) {
    await this.requireOrg(id);
    return this.prisma.organization.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description }
          : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
      },
    });
  }

  /**
   * Enforce Stripe plan `memberLimit` (starter default when no subscription).
   * Counts current members + optional pending invites for invitation path.
   */
  async assertMemberLimit(
    organizationId: string,
    options: { includePendingInvites?: boolean } = {},
  ): Promise<void> {
    const limit =
      await this.features.getMemberLimitForOrganization(organizationId);
    if (limit === null) return;

    const memberCount = await this.prisma.organizationMember.count({
      where: { organizationId },
    });
    let pending = 0;
    if (options.includePendingInvites) {
      pending = await this.prisma.userInvitation.count({
        where: {
          organizationId,
          status: InvitationStatus.PENDING,
          expiresAt: { gt: new Date() },
        },
      });
    }
    const used = memberCount + pending;
    if (used >= limit) {
      throw new ForbiddenException({
        code: 'ORG_MEMBER_LIMIT',
        message: `Limite de membres atteinte (${used}/${limit}). Passez au plan Pro pour des membres illimités.`,
        memberLimit: limit,
        memberCount,
        pendingInvites: pending,
        upgradePlan: 'pro',
      });
    }
  }

  async addMember(orgId: string, dto: AddOrganizationMemberDto) {
    await this.requireOrg(orgId);
    await this.assertMemberLimit(orgId);

    const user = await this.prisma.user.findUnique({
      where: { id: dto.userId },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    try {
      return await this.prisma.organizationMember.create({
        data: {
          organizationId: orgId,
          userId: dto.userId,
          role: toOrgRole(dto.role),
        },
        include: {
          user: {
            select: { id: true, email: true, name: true, status: true },
          },
        },
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException('User is already a member');
      }
      throw err;
    }
  }

  async updateMemberRole(
    orgId: string,
    userId: string,
    dto: UpdateOrganizationMemberRoleDto,
  ) {
    await this.requireOrg(orgId);
    const member = await this.prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: { organizationId: orgId, userId },
      },
    });
    if (!member) {
      throw new NotFoundException('Membership not found');
    }

    return this.prisma.organizationMember.update({
      where: { id: member.id },
      data: { role: toOrgRole(dto.role) },
    });
  }

  async removeMember(orgId: string, userId: string) {
    await this.requireOrg(orgId);
    const member = await this.prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: { organizationId: orgId, userId },
      },
    });
    if (!member) {
      throw new NotFoundException('Membership not found');
    }

    await this.prisma.organizationMember.delete({ where: { id: member.id } });
    return { ok: true };
  }

  /**
   * Accept a pending invitation by token (authenticated user must match email).
   * Creates org membership when invitation targets an organization.
   */
  async acceptInvitation(token: string, userId: string) {
    const invitation = await this.prisma.userInvitation.findUnique({
      where: { token },
      include: {
        organization: { select: { id: true, name: true, slug: true } },
      },
    });
    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }
    if (invitation.status !== InvitationStatus.PENDING) {
      throw new ConflictException(
        `Invitation is ${invitation.status.toLowerCase()}`,
      );
    }
    if (invitation.expiresAt.getTime() < Date.now()) {
      await this.prisma.userInvitation.update({
        where: { id: invitation.id },
        data: { status: InvitationStatus.EXPIRED },
      });
      throw new ConflictException('Invitation has expired');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (user.email.toLowerCase() !== invitation.email.toLowerCase()) {
      throw new ForbiddenException({
        code: 'INVITE_EMAIL_MISMATCH',
        message:
          'Connectez-vous avec l’adresse email invitée pour accepter l’invitation',
      });
    }

    if (invitation.organizationId) {
      await this.assertMemberLimit(invitation.organizationId);

      const existing = await this.prisma.organizationMember.findUnique({
        where: {
          organizationId_userId: {
            organizationId: invitation.organizationId,
            userId,
          },
        },
      });
      if (!existing) {
        await this.prisma.organizationMember.create({
          data: {
            organizationId: invitation.organizationId,
            userId,
            role: invitation.role === Role.ADMIN ? Role.ADMIN : Role.USER,
          },
        });
      }
    }

    const updated = await this.prisma.userInvitation.update({
      where: { id: invitation.id },
      data: {
        status: InvitationStatus.ACCEPTED,
        acceptedAt: new Date(),
      },
      include: {
        organization: { select: { id: true, name: true, slug: true } },
      },
    });

    this.logger.log(
      `Invitation accepted id=${invitation.id} user=${userId} org=${invitation.organizationId ?? 'none'}`,
    );
    return updated;
  }

  /** Preview invite (public-ish via auth) before accept. */
  async getInvitationByToken(token: string) {
    await this.expireStaleInvites();
    const invitation = await this.prisma.userInvitation.findUnique({
      where: { token },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        expiresAt: true,
        organizationId: true,
        organization: { select: { id: true, name: true, slug: true } },
      },
    });
    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }
    return invitation;
  }

  private async expireStaleInvites() {
    await this.prisma.userInvitation.updateMany({
      where: {
        status: InvitationStatus.PENDING,
        expiresAt: { lt: new Date() },
      },
      data: { status: InvitationStatus.EXPIRED },
    });
  }

  private async requireOrg(id: string) {
    const org = await this.prisma.organization.findUnique({ where: { id } });
    if (!org) {
      throw new NotFoundException('Organization not found');
    }
    return org;
  }
}
