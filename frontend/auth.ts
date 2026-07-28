import NextAuth from 'next-auth';
import Keycloak from 'next-auth/providers/keycloak';
import { authConfig } from './auth.config';

/**
 * Full Auth.js instance with Keycloak providers.
 * Route handlers and server components import from here.
 * Middleware uses `auth.config` only (no Keycloak provider bundle).
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Keycloak({
      clientId: process.env.AUTH_KEYCLOAK_ID!,
      clientSecret: process.env.AUTH_KEYCLOAK_SECRET || '',
      issuer: process.env.AUTH_KEYCLOAK_ISSUER!,
    }),
    // Registration uses Keycloak OIDC /registrations endpoint (same callback as login).
    Keycloak({
      id: 'keycloak-register',
      name: 'Keycloak Register',
      clientId: process.env.AUTH_KEYCLOAK_ID!,
      clientSecret: process.env.AUTH_KEYCLOAK_SECRET || '',
      issuer: process.env.AUTH_KEYCLOAK_ISSUER!,
      authorization: {
        url: `${process.env.AUTH_KEYCLOAK_ISSUER}/protocol/openid-connect/registrations`,
        params: { scope: 'openid email profile' },
      },
    }),
  ],
});
