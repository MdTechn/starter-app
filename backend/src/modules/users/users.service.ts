import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  IdentityProvider,
  Prisma,
  Role,
  User,
  UserStatus,
} from '@prisma/client';
import {
  mapKeycloakRolesToAppRoles,
  normalizePagination,
  toPaginated,
  UserRole,
} from '@saas-starter/shared';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AppLogger } from '../../common/logger/app-logger.service';
import {
  CreateUserDto,
  ListUsersQueryDto,
  UpdateUserProfileDto,
} from './dto/users.dto';

export const USER_PUBLIC_SELECT = {
  id: true,
  keycloakSub: true,
  email: true,
  name: true,
  firstName: true,
  lastName: true,
  avatarUrl: true,
  roles: true,
  status: true,
  provider: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: AppLogger,
  ) {
    this.logger.setContext(UsersService.name);
  }

  async findMe(keycloakSub: string) {
    return this.prisma.user.findUniqueOrThrow({
      where: { keycloakSub },
      select: {
        ...USER_PUBLIC_SELECT,
        memberships: {
          select: {
            id: true,
            role: true,
            organization: {
              select: { id: true, name: true, slug: true, status: true },
            },
          },
        },
      },
    });
  }

  async updateMe(keycloakSub: string, dto: UpdateUserProfileDto) {
    const user = await this.prisma.user.findUnique({ where: { keycloakSub } });
    if (!user || user.status === UserStatus.DELETED) {
      throw new NotFoundException('User not found');
    }
    return this.updateProfile(user.id, dto);
  }

  async list(query: ListUsersQueryDto = {}) {
    const { page, pageSize, skip, take, sortOrder } =
      normalizePagination(query);
    const where = this.buildWhere(query);

    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        select: USER_PUBLIC_SELECT,
        orderBy: { createdAt: sortOrder },
        skip,
        take,
      }),
      this.prisma.user.count({ where }),
    ]);

    return toPaginated(items, total, page, pageSize);
  }

  async findById(id: string, includeDeleted = false) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        ...USER_PUBLIC_SELECT,
        memberships: {
          select: {
            id: true,
            role: true,
            createdAt: true,
            organization: {
              select: {
                id: true,
                name: true,
                slug: true,
                status: true,
              },
            },
          },
        },
      },
    });

    if (!user || (!includeDeleted && user.status === UserStatus.DELETED)) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  /**
   * Create a local Prisma user linked to an existing Keycloak identity.
   * Never stores a password — Keycloak remains the identity source.
   */
  async create(dto: CreateUserDto): Promise<User> {
    const roles = this.toPrismaRoles(dto.roles ?? [UserRole.USER]);
    const composed =
      [dto.firstName, dto.lastName].filter(Boolean).join(' ') || undefined;
    const name = dto.name ?? composed;

    try {
      const user = await this.prisma.user.create({
        data: {
          email: dto.email.toLowerCase().trim(),
          keycloakSub: dto.keycloakSub,
          name,
          firstName: dto.firstName,
          lastName: dto.lastName,
          avatarUrl: dto.avatarUrl,
          roles,
          status: UserStatus.ACTIVE,
          provider: IdentityProvider.KEYCLOAK,
        },
      });
      this.logger.log(
        `User created id=${user.id} email=${user.email} sub=${user.keycloakSub}`,
      );
      return user;
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException(
          'User already exists (email or keycloakSub)',
        );
      }
      throw err;
    }
  }

  async updateProfile(id: string, dto: UpdateUserProfileDto) {
    await this.requireUser(id);

    const data: Prisma.UserUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.firstName !== undefined) data.firstName = dto.firstName;
    if (dto.lastName !== undefined) data.lastName = dto.lastName;
    if (dto.avatarUrl !== undefined) data.avatarUrl = dto.avatarUrl;

    if (
      dto.name === undefined &&
      (dto.firstName !== undefined || dto.lastName !== undefined)
    ) {
      const current = await this.prisma.user.findUniqueOrThrow({
        where: { id },
      });
      const first = dto.firstName ?? current.firstName;
      const last = dto.lastName ?? current.lastName;
      data.name = [first, last].filter(Boolean).join(' ') || current.name;
    }

    return this.prisma.user.update({
      where: { id },
      data,
      select: USER_PUBLIC_SELECT,
    });
  }

  async setStatus(id: string, status: UserStatus): Promise<User> {
    if (status === UserStatus.DELETED) {
      return this.softDelete(id);
    }

    const user = await this.requireUser(id, true);
    if (user.status === UserStatus.DELETED && status === UserStatus.ACTIVE) {
      throw new BadRequestException(
        'Cannot reactivate a deleted user via status — use IdP sync / enable carefully',
      );
    }

    return this.prisma.user.update({
      where: { id },
      data: { status },
    });
  }

  async softDelete(id: string): Promise<User> {
    await this.requireUser(id, true);
    const updated = await this.prisma.user.update({
      where: { id },
      data: { status: UserStatus.DELETED },
    });
    this.logger.warn(`User soft-deleted id=${id}`);
    return updated;
  }

  toPrismaRoles(roles: UserRole[] | string[]): Role[] {
    const normalized = mapKeycloakRolesToAppRoles(roles);
    if (normalized.includes(UserRole.ADMIN)) {
      return [Role.ADMIN, Role.USER];
    }
    return [Role.USER];
  }

  async requireUser(id: string, allowDeleted = false): Promise<User> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (!allowDeleted && user.status === UserStatus.DELETED) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  private buildWhere(query: ListUsersQueryDto): Prisma.UserWhereInput {
    const where: Prisma.UserWhereInput = {};

    if (query.status) {
      where.status = query.status;
    } else if (!query.includeDeleted) {
      where.status = { not: UserStatus.DELETED };
    }

    if (query.role) {
      where.roles = { has: query.role };
    }

    if (query.provider) {
      where.provider = query.provider;
    }

    const q = query.q?.trim();
    if (q) {
      where.OR = [
        { email: { contains: q, mode: 'insensitive' } },
        { name: { contains: q, mode: 'insensitive' } },
        { firstName: { contains: q, mode: 'insensitive' } },
        { lastName: { contains: q, mode: 'insensitive' } },
      ];
    }

    return where;
  }
}
