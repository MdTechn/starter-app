import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UserRole } from '@saas-starter/shared/auth';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AppLogger } from '../../common/logger/app-logger.service';

/**
 * Resolves which organizations a user may access for multi-tenant data filters.
 * ADMIN → unrestricted (null). Others → membership org IDs only.
 */
@Injectable()
export class OrganizationScopeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: AppLogger,
  ) {
    this.logger.setContext(OrganizationScopeService.name);
  }

  isAdmin(roles: string[] | undefined): boolean {
    if (!roles?.length) return false;
    const set = new Set(roles.map((r) => r.toUpperCase()));
    return set.has(UserRole.ADMIN) || set.has('ADMIN');
  }

  /**
   * @returns `null` when the caller may see all orgs (admin).
   * @returns string[] of accessible org ids otherwise (possibly empty).
   */
  async getAccessibleOrganizationIds(
    userId: string | undefined,
    roles?: string[],
  ): Promise<string[] | null> {
    if (this.isAdmin(roles)) {
      return null;
    }
    if (!userId) {
      return [];
    }
    const memberships = await this.prisma.organizationMember.findMany({
      where: { userId },
      select: { organizationId: true },
    });
    return memberships.map((m) => m.organizationId);
  }

  /**
   * Prisma `where` fragment for models with `organizationId`.
   * Admins: no filter. Members: `organizationId in […]`.
   * No memberships: match nothing (`id: 'impossible'` style via empty in).
   */
  async orgWhere(
    userId: string | undefined,
    roles?: string[],
  ): Promise<{ organizationId?: { in: string[] } } | Record<string, never>> {
    const ids = await this.getAccessibleOrganizationIds(userId, roles);
    if (ids === null) return {};
    if (ids.length === 0) {
      return { organizationId: { in: [] } };
    }
    return { organizationId: { in: ids } };
  }

  async assertCanAccessOrganization(
    userId: string | undefined,
    organizationId: string,
    roles?: string[],
  ): Promise<void> {
    if (this.isAdmin(roles)) return;
    if (!userId) {
      throw new ForbiddenException({
        code: 'ORG_ACCESS_DENIED',
        message: 'Organization access denied',
      });
    }
    const member = await this.prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: { organizationId, userId },
      },
    });
    if (!member) {
      throw new ForbiddenException({
        code: 'ORG_ACCESS_DENIED',
        message: 'Organization access denied',
      });
    }
  }

  /**
   * Resolve org for writes: explicit id (validated) or first membership.
   * Admins may pass any existing org id; others must be members.
   */
  async resolveOrganizationIdForWrite(
    userId: string | undefined,
    roles: string[] | undefined,
    requestedOrgId?: string | null,
  ): Promise<string> {
    if (requestedOrgId) {
      const org = await this.prisma.organization.findUnique({
        where: { id: requestedOrgId },
      });
      if (!org) {
        throw new NotFoundException('Organization not found');
      }
      await this.assertCanAccessOrganization(userId, requestedOrgId, roles);
      return requestedOrgId;
    }

    if (!userId) {
      throw new ForbiddenException({
        code: 'ORG_REQUIRED',
        message: 'Organization membership required',
      });
    }

    const membership = await this.prisma.organizationMember.findFirst({
      where: { userId },
      orderBy: { createdAt: 'asc' },
      select: { organizationId: true },
    });
    if (!membership) {
      throw new ForbiddenException({
        code: 'ORG_REQUIRED',
        message:
          'Join or create an organization before writing tenant-scoped data',
      });
    }
    return membership.organizationId;
  }
}
