import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AppLogger } from '../../common/logger/app-logger.service';
import { OrganizationScopeService } from '../organizations/organization-scope.service';
import { CreateCmsFolderDto, UpdateCmsFolderDto } from './dto/cms.dto';

export type CmsFolderNode = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  parentId: string | null;
  organizationId: string | null;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
  children: CmsFolderNode[];
  _count?: { articles: number; children: number };
};

export type OrgActor = {
  userId?: string;
  roles?: string[];
};

@Injectable()
export class CmsFoldersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orgScope: OrganizationScopeService,
    private readonly logger: AppLogger,
  ) {
    this.logger.setContext(CmsFoldersService.name);
  }

  async listFlat(actor?: OrgActor) {
    const orgFilter = actor
      ? await this.orgScope.orgWhere(actor.userId, actor.roles)
      : {};
    return this.prisma.cmsFolder.findMany({
      where: orgFilter,
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: {
        _count: { select: { articles: true, children: true } },
      },
    });
  }

  async listTree(actor?: OrgActor): Promise<CmsFolderNode[]> {
    const folders = await this.listFlat(actor);
    const byId = new Map<string, CmsFolderNode>();
    for (const f of folders) {
      byId.set(f.id, { ...f, children: [] });
    }
    const roots: CmsFolderNode[] = [];
    for (const node of byId.values()) {
      if (node.parentId && byId.has(node.parentId)) {
        byId.get(node.parentId)!.children.push(node);
      } else {
        roots.push(node);
      }
    }
    return roots;
  }

  async findById(id: string, actor?: OrgActor) {
    const folder = await this.prisma.cmsFolder.findUnique({
      where: { id },
      include: {
        children: {
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
          include: { _count: { select: { articles: true, children: true } } },
        },
        _count: { select: { articles: true, children: true } },
      },
    });
    if (!folder) {
      throw new NotFoundException('CMS folder not found');
    }
    await this.assertReadable(folder.organizationId, actor);
    return folder;
  }

  async create(dto: CreateCmsFolderDto, actor?: OrgActor) {
    if (dto.parentId) {
      const parent = await this.requireFolder(dto.parentId, actor);
      if (
        dto.organizationId &&
        parent.organizationId &&
        dto.organizationId !== parent.organizationId
      ) {
        throw new BadRequestException(
          'Folder organization must match parent organization',
        );
      }
    }

    const organizationId = await this.orgScope.resolveOrganizationIdForWrite(
      actor?.userId,
      actor?.roles,
      dto.organizationId ?? undefined,
    );

    try {
      const folder = await this.prisma.cmsFolder.create({
        data: {
          code: dto.code.toLowerCase(),
          name: dto.name,
          description: dto.description,
          parentId: dto.parentId ?? null,
          organizationId,
          sortOrder: dto.sortOrder ?? 0,
        },
      });
      this.logger.log(
        `CMS folder created id=${folder.id} code=${folder.code} org=${organizationId}`,
      );
      return folder;
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException('CMS folder code already exists');
      }
      throw err;
    }
  }

  async update(id: string, dto: UpdateCmsFolderDto, actor?: OrgActor) {
    await this.requireFolder(id, actor);

    if (dto.parentId !== undefined && dto.parentId !== null) {
      if (dto.parentId === id) {
        throw new BadRequestException('Folder cannot be its own parent');
      }
      await this.requireFolder(dto.parentId);
      const isDescendant = await this.isDescendantOf(dto.parentId, id);
      if (isDescendant) {
        throw new BadRequestException(
          'Cannot move folder under one of its descendants',
        );
      }
    }

    return this.prisma.cmsFolder.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description }
          : {}),
        ...(dto.parentId !== undefined ? { parentId: dto.parentId } : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
      },
    });
  }

  async remove(id: string, actor?: OrgActor) {
    const folder = await this.prisma.cmsFolder.findUnique({
      where: { id },
      include: { _count: { select: { children: true, articles: true } } },
    });
    if (!folder) {
      throw new NotFoundException('CMS folder not found');
    }
    await this.assertReadable(folder.organizationId, actor);
    if (folder._count.children > 0 || folder._count.articles > 0) {
      throw new BadRequestException(
        'Folder must be empty (no children, no articles) before deletion',
      );
    }
    await this.prisma.cmsFolder.delete({ where: { id } });
    return { ok: true, id };
  }

  async requireFolder(id: string, actor?: OrgActor) {
    const folder = await this.prisma.cmsFolder.findUnique({ where: { id } });
    if (!folder) {
      throw new NotFoundException('CMS folder not found');
    }
    await this.assertReadable(folder.organizationId, actor);
    return folder;
  }

  private async assertReadable(
    organizationId: string | null,
    actor?: OrgActor,
  ) {
    if (!actor) return;
    if (this.orgScope.isAdmin(actor.roles)) return;
    if (!organizationId) {
      throw new ForbiddenException({
        code: 'ORG_ACCESS_DENIED',
        message: 'CMS folder is not assigned to an organization',
      });
    }
    await this.orgScope.assertCanAccessOrganization(
      actor.userId,
      organizationId,
      actor.roles,
    );
  }

  /** True if `candidateId` is under `ancestorId` in the tree. */
  private async isDescendantOf(
    candidateId: string,
    ancestorId: string,
  ): Promise<boolean> {
    let current = await this.prisma.cmsFolder.findUnique({
      where: { id: candidateId },
      select: { parentId: true },
    });
    const seen = new Set<string>();
    while (current?.parentId) {
      if (current.parentId === ancestorId) return true;
      if (seen.has(current.parentId)) break;
      seen.add(current.parentId);
      current = await this.prisma.cmsFolder.findUnique({
        where: { id: current.parentId },
        select: { parentId: true },
      });
    }
    return false;
  }
}
