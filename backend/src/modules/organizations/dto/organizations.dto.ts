import {
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { OrganizationStatus, Role } from '@prisma/client';
import { UserRole } from '@saas-starter/shared';

export class CreateOrganizationDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(80)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'slug must be lowercase alphanumeric with hyphens',
  })
  slug!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}

export class UpdateOrganizationDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string | null;

  @IsOptional()
  @IsEnum(OrganizationStatus)
  status?: OrganizationStatus;
}

export class AddOrganizationMemberDto {
  @IsString()
  @MinLength(1)
  userId!: string;

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;
}

export class UpdateOrganizationMemberRoleDto {
  @IsEnum(UserRole)
  role!: UserRole;
}

export class AcceptInvitationDto {
  @IsString()
  @MinLength(8)
  token!: string;
}

/** Map app role → Prisma Role for org membership. */
export function toOrgRole(role?: UserRole | Role | string): Role {
  return role === 'ADMIN' ? Role.ADMIN : Role.USER;
}
