import { SetMetadata } from '@nestjs/common';
import { UserRole } from '@saas-starter/shared';

export const ROLES_KEY = 'roles';

/** Requires the authenticated user to have at least one of the given roles. */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
