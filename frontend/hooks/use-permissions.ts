'use client';

import {
  Permission,
  UserRole,
  getPrimaryRole,
  hasPermission,
} from '@saas-starter/shared/auth';
import { useAuth } from './use-auth';

export function usePermissions() {
  const { roles, isAuthenticated, isLoading } = useAuth();
  const appRoles = roles as UserRole[];
  const primaryRole = getPrimaryRole(appRoles);

  const can = (permission: Permission) =>
    isAuthenticated && hasPermission(appRoles, permission);

  return {
    roles: appRoles,
    primaryRole,
    isLoading,
    isAuthenticated,
    isAdmin: primaryRole === UserRole.ADMIN,
    can,
    canListUsers: can(Permission.USERS_LIST) || can(Permission.IAM_MANAGE),
    canManageIam: can(Permission.IAM_MANAGE),
    canReadAudit: can(Permission.AUDIT_READ),
    canInvite: can(Permission.USERS_INVITE),
    canBillingRead: can(Permission.BILLING_READ),
    canBillingWrite: can(Permission.BILLING_WRITE),
    canBillingManage: can(Permission.BILLING_MANAGE),
    canNotificationRead: can(Permission.NOTIFICATION_READ),
    canNotificationManage: can(Permission.NOTIFICATION_MANAGE),
    canUploadRead: can(Permission.UPLOAD_READ),
    canUploadWrite: can(Permission.UPLOAD_WRITE),
    canUploadDelete: can(Permission.UPLOAD_DELETE),
    canUploadManage: can(Permission.UPLOAD_MANAGE),
    canSystemRead: can(Permission.SYSTEM_READ),
    canBrandRead: can(Permission.BRAND_READ),
    canBrandWrite: can(Permission.BRAND_WRITE),
    canCmsRead: can(Permission.CMS_READ),
    canCmsWrite: can(Permission.CMS_WRITE),
    canCmsPublish: can(Permission.CMS_PUBLISH),
    canCmsManage: can(Permission.CMS_MANAGE),
  };
}
