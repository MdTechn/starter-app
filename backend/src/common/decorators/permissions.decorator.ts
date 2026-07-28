import { SetMetadata } from '@nestjs/common';
import { Permission } from '@saas-starter/shared';

export const PERMISSIONS_KEY = 'permissions';

/**
 * Requires the authenticated user to have at least one of the given permissions.
 * Permissions are derived from Keycloak roles via the shared role→permission map.
 */
export const Permissions = (...permissions: Permission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
