import type { DefaultSession } from 'next-auth';
import type { UserRole } from '@saas-starter/shared/auth';

declare module 'next-auth' {
  interface Session {
    accessToken?: string;
    idToken?: string;
    roles?: UserRole[];
    /** Keycloak broker alias: google | facebook | … ; null = login direct. */
    identityProvider?: string | null;
    error?: string;
    expiresAt?: number;
    user: DefaultSession['user'] & {
      id?: string;
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    accessToken?: string;
    refreshToken?: string;
    idToken?: string;
    expiresAt?: number;
    roles?: UserRole[];
    rolesSyncedAt?: number;
    identityProvider?: string | null;
    error?: string;
  }
}
