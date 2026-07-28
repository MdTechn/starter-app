import { UserRole } from '../enums/user-role.enum';
import { Permission } from '../enums/permission.enum';

/** Application roles only — never Keycloak technical roles. */
export const APP_ROLES = [UserRole.USER, UserRole.ADMIN] as const;

export type AppRole = (typeof APP_ROLES)[number];

/**
 * Central mapping: Keycloak / app roles → application permissions.
 * Extend this map when adding features — do not scatter permission checks.
 */
export const ROLE_PERMISSIONS: Record<UserRole, readonly Permission[]> = {
  [UserRole.USER]: [
    Permission.AUTH_ME,
    Permission.USERS_READ,
    Permission.ORG_READ,
    Permission.BILLING_READ,
    Permission.BILLING_WRITE,
    Permission.NOTIFICATION_READ,
    Permission.UPLOAD_READ,
    Permission.UPLOAD_WRITE,
    Permission.UPLOAD_DELETE,
    Permission.CMS_READ,
    Permission.CMS_WRITE,
  ],
  [UserRole.ADMIN]: [
    Permission.AUTH_ME,
    Permission.USERS_READ,
    Permission.USERS_WRITE,
    Permission.USERS_LIST,
    Permission.USERS_INVITE,
    Permission.ADMIN_ACCESS,
    Permission.IAM_MANAGE,
    Permission.AUDIT_READ,
    Permission.ORG_READ,
    Permission.ORG_WRITE,
    Permission.ORG_MANAGE,
    Permission.BILLING_READ,
    Permission.BILLING_WRITE,
    Permission.BILLING_MANAGE,
    Permission.NOTIFICATION_READ,
    Permission.NOTIFICATION_MANAGE,
    Permission.UPLOAD_READ,
    Permission.UPLOAD_WRITE,
    Permission.UPLOAD_DELETE,
    Permission.UPLOAD_MANAGE,
    Permission.SYSTEM_READ,
    Permission.BRAND_READ,
    Permission.BRAND_WRITE,
    Permission.CMS_READ,
    Permission.CMS_WRITE,
    Permission.CMS_PUBLISH,
    Permission.CMS_MANAGE,
  ],
};

export function isAppRole(value: string): value is UserRole {
  const role = value.toUpperCase();
  return role === UserRole.USER || role === UserRole.ADMIN;
}

/**
 * Normalize Keycloak realm/client role names to application roles.
 * ADMIN takes priority when assigned in Keycloak (listed first).
 * Always includes USER as base role. Technical KC roles are dropped.
 */
export function mapKeycloakRolesToAppRoles(tokenRoles: string[]): UserRole[] {
  const hasAdmin = tokenRoles.some((raw) => {
    const role = raw.toUpperCase();
    return role === UserRole.ADMIN || role === 'REALM-ADMIN';
  });

  return hasAdmin ? [UserRole.ADMIN, UserRole.USER] : [UserRole.USER];
}

/** Effective role for UI / routing — ADMIN wins over USER. */
export function getPrimaryRole(roles: readonly string[]): UserRole {
  const normalized = roles.map((r) => r.toUpperCase());
  return normalized.includes(UserRole.ADMIN) ? UserRole.ADMIN : UserRole.USER;
}

export function getPermissionsForRoles(roles: UserRole[]): Permission[] {
  const permissions = new Set<Permission>();
  for (const role of roles) {
    if (!isAppRole(role)) continue;
    const mapped = ROLE_PERMISSIONS[role];
    if (mapped) {
      mapped.forEach((p) => permissions.add(p));
    }
  }
  return Array.from(permissions);
}

export function hasPermission(
  roles: UserRole[],
  permission: Permission,
): boolean {
  return getPermissionsForRoles(roles).includes(permission);
}

export function hasAnyPermission(
  roles: UserRole[],
  required: Permission[],
): boolean {
  if (!required.length) return true;
  const owned = new Set(getPermissionsForRoles(roles));
  return required.some((p) => owned.has(p));
}

export function hasAllPermissions(
  roles: UserRole[],
  required: Permission[],
): boolean {
  if (!required.length) return true;
  const owned = new Set(getPermissionsForRoles(roles));
  return required.every((p) => owned.has(p));
}
