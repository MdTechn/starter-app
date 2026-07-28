export enum Permission {
  // Users
  USERS_READ = 'users:read',
  USERS_WRITE = 'users:write',
  USERS_LIST = 'users:list',
  USERS_INVITE = 'users:invite',

  // Auth / session
  AUTH_ME = 'auth:me',

  // Admin / IAM
  ADMIN_ACCESS = 'admin:access',
  IAM_MANAGE = 'iam:manage',
  AUDIT_READ = 'audit:read',

  // Multi-tenant
  ORG_READ = 'org:read',
  ORG_WRITE = 'org:write',
  ORG_MANAGE = 'org:manage',

  // Billing (Stripe)
  BILLING_READ = 'billing:read',
  BILLING_WRITE = 'billing:write',
  BILLING_MANAGE = 'billing:manage',

  // Notifications
  NOTIFICATION_READ = 'notification:read',
  NOTIFICATION_MANAGE = 'notification:manage',

  // Storage / upload
  UPLOAD_READ = 'upload:read',
  UPLOAD_WRITE = 'upload:write',
  UPLOAD_DELETE = 'upload:delete',
  UPLOAD_MANAGE = 'upload:manage',

  // System / observability
  SYSTEM_READ = 'system:read',

  // White-label branding
  BRAND_READ = 'brand:read',
  BRAND_WRITE = 'brand:write',

  // CMS
  CMS_READ = 'cms:read',
  CMS_WRITE = 'cms:write',
  CMS_PUBLISH = 'cms:publish',
  CMS_MANAGE = 'cms:manage',
}
