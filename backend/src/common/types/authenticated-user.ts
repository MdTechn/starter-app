export type AuthenticatedUser = {
  sub: string;
  email: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
  username?: string;
  /** Application roles (USER, ADMIN) derived from Keycloak token */
  roles: string[];
  /** Resolved application permissions from role mapping */
  permissions: string[];
  /** Local Prisma user id (after sync), if available */
  userId?: string;
  /**
   * Social broker alias from Keycloak (`identity_provider` claim),
   * e.g. google | facebook. Undefined for direct Keycloak login.
   */
  identityProvider?: string;
  /** Resolved app provider (keycloak | google | facebook | …) */
  provider?: string;
};
