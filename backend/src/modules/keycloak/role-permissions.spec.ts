import {
  getPermissionsForRoles,
  getPrimaryRole,
  hasPermission,
  mapKeycloakRolesToAppRoles,
  Permission,
  UserRole,
} from '@saas-starter/shared/auth';

describe('role-permissions mapping', () => {
  it('maps Keycloak roles to app roles', () => {
    expect(mapKeycloakRolesToAppRoles(['admin', 'offline_access'])).toEqual([
      UserRole.ADMIN,
      UserRole.USER,
    ]);
    expect(mapKeycloakRolesToAppRoles(['user'])).toEqual([UserRole.USER]);
    expect(
      mapKeycloakRolesToAppRoles([
        'offline_access',
        'uma_authorization',
        'default-roles-saas-realm',
      ]),
    ).toEqual([UserRole.USER]);
    expect(mapKeycloakRolesToAppRoles([])).toEqual([UserRole.USER]);
  });

  it('gives ADMIN priority as primary role', () => {
    expect(getPrimaryRole([UserRole.USER, UserRole.ADMIN])).toBe(
      UserRole.ADMIN,
    );
    expect(getPrimaryRole([UserRole.ADMIN, UserRole.USER])).toBe(
      UserRole.ADMIN,
    );
    expect(getPrimaryRole([UserRole.USER])).toBe(UserRole.USER);
    expect(getPrimaryRole([])).toBe(UserRole.USER);
  });

  it('resolves USER permissions', () => {
    const permissions = getPermissionsForRoles([UserRole.USER]);
    expect(permissions).toContain(Permission.AUTH_ME);
    expect(permissions).toContain(Permission.USERS_READ);
    expect(permissions).toContain(Permission.NOTIFICATION_READ);
    expect(permissions).toContain(Permission.UPLOAD_WRITE);
    expect(permissions).not.toContain(Permission.USERS_LIST);
    expect(permissions).not.toContain(Permission.NOTIFICATION_MANAGE);
    expect(permissions).not.toContain(Permission.UPLOAD_MANAGE);
  });

  it('resolves ADMIN permissions as a superset', () => {
    expect(hasPermission([UserRole.ADMIN], Permission.USERS_LIST)).toBe(true);
    expect(hasPermission([UserRole.ADMIN], Permission.USERS_INVITE)).toBe(true);
    expect(hasPermission([UserRole.ADMIN], Permission.ADMIN_ACCESS)).toBe(true);
    expect(hasPermission([UserRole.ADMIN], Permission.IAM_MANAGE)).toBe(true);
    expect(hasPermission([UserRole.ADMIN], Permission.AUDIT_READ)).toBe(true);
    expect(hasPermission([UserRole.ADMIN], Permission.BILLING_MANAGE)).toBe(
      true,
    );
    expect(
      hasPermission([UserRole.ADMIN], Permission.NOTIFICATION_MANAGE),
    ).toBe(true);
    expect(hasPermission([UserRole.ADMIN], Permission.UPLOAD_MANAGE)).toBe(
      true,
    );
    expect(hasPermission([UserRole.ADMIN], Permission.SYSTEM_READ)).toBe(true);
    expect(hasPermission([UserRole.ADMIN], Permission.BRAND_READ)).toBe(true);
    expect(hasPermission([UserRole.ADMIN], Permission.CMS_MANAGE)).toBe(true);
    expect(hasPermission([UserRole.USER], Permission.CMS_READ)).toBe(true);
    expect(hasPermission([UserRole.USER], Permission.CMS_PUBLISH)).toBe(false);
    expect(hasPermission([UserRole.USER], Permission.BILLING_READ)).toBe(true);
    expect(hasPermission([UserRole.USER], Permission.BILLING_MANAGE)).toBe(
      false,
    );
    expect(hasPermission([UserRole.USER], Permission.NOTIFICATION_READ)).toBe(
      true,
    );
    expect(hasPermission([UserRole.USER], Permission.UPLOAD_WRITE)).toBe(true);
    expect(hasPermission([UserRole.USER], Permission.ADMIN_ACCESS)).toBe(false);
  });
});
