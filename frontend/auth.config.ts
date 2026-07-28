import type { NextAuthConfig } from 'next-auth';
import {
  mapKeycloakRolesToAppRoles,
  UserRole,
} from '@saas-starter/shared/auth';
import { refreshKeycloakAccessToken } from '@/lib/auth/refresh-token';
import {
  identityProviderFromAccessToken,
  rolesFromAccessToken,
} from '@/lib/auth/token-claims';

/**
 * Edge-safe Auth.js config (no Keycloak provider).
 * Used by middleware so the OAuth provider client is not bundled on the edge.
 */
export const authConfig = {
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  providers: [],
  session: {
    strategy: 'jwt',
    // Align session max age with typical Keycloak SSO; refresh handles shorter AT.
    maxAge: 30 * 24 * 60 * 60,
  },
  pages: {
    signIn: '/login',
  },
  callbacks: {
    async jwt({ token, account, profile }) {
      const now = Math.floor(Date.now() / 1000);

      if (account?.access_token) {
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.idToken = account.id_token;
        token.expiresAt = account.expires_at;
        token.roles = rolesFromAccessToken(account.access_token);
        token.rolesSyncedAt = now;
        token.identityProvider = identityProviderFromAccessToken(
          account.access_token,
        );
        token.error = undefined;
      } else if (
        token.error === 'RefreshAccessTokenError' ||
        token.error === 'RefreshTokenMissing'
      ) {
        // Keep session marked expired until client completes logout.
        return {
          ...token,
          accessToken: undefined,
          refreshToken: undefined,
          idToken: undefined,
          expiresAt: 0,
        };
      } else if (profile) {
        const realmAccess = (profile as { realm_access?: { roles?: string[] } })
          .realm_access;
        token.roles = mapKeycloakRolesToAppRoles(realmAccess?.roles ?? []);
        const idp =
          (profile as { identity_provider?: string; idp?: string })
            .identity_provider ?? (profile as { idp?: string }).idp;
        if (idp) token.identityProvider = idp.trim().toLowerCase();
      }

      // Keep roles / IdP in sync with Keycloak access token (ADMIN takes priority).
      if (token.accessToken) {
        token.roles = rolesFromAccessToken(String(token.accessToken));
        token.identityProvider = identityProviderFromAccessToken(
          String(token.accessToken),
        );
      } else {
        token.roles = (token.roles as UserRole[] | undefined) ?? [
          UserRole.USER,
        ];
      }

      const expiresAt = token.expiresAt as number | undefined;
      const lastSync = (token.rolesSyncedAt as number | undefined) ?? 0;
      const nearExpiry = !expiresAt || now >= expiresAt - 60;
      // Re-fetch AT ~every 60s so Keycloak Admin role changes (e.g. ADMIN) apply quickly.
      const roleSyncDue = now - lastSync >= 60;

      if ((nearExpiry || roleSyncDue) && token.refreshToken) {
        return refreshKeycloakAccessToken(token);
      }

      return token;
    },
    async session({ session, token }) {
      // Session invalide après échec de refresh — le client déconnecte.
      if (token.error) {
        session.accessToken = undefined;
        session.idToken = undefined;
        session.error = token.error as string;
        session.expiresAt = 0;
        session.roles = [];
        session.identityProvider = null;
        return session;
      }

      session.accessToken = token.accessToken as string | undefined;
      session.idToken = token.idToken as string | undefined;
      session.error = undefined;
      session.expiresAt = token.expiresAt as number | undefined;
      session.roles = (token.roles as UserRole[] | undefined) ?? [
        UserRole.USER,
      ];
      session.identityProvider =
        (token.identityProvider as string | null | undefined) ?? null;
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
  },
  trustHost: true,
} satisfies NextAuthConfig;
