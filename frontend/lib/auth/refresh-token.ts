import type { JWT } from 'next-auth/jwt';
import {
  identityProviderFromAccessToken,
  rolesFromAccessToken,
} from './token-claims';

type RefreshableToken = JWT & {
  refreshToken?: string;
  accessToken?: string;
  idToken?: string;
  expiresAt?: number;
};

export async function refreshKeycloakAccessToken(
  token: RefreshableToken,
): Promise<JWT> {
  const issuer = process.env.AUTH_KEYCLOAK_ISSUER;
  const clientId = process.env.AUTH_KEYCLOAK_ID;
  if (!issuer || !clientId || !token.refreshToken) {
    return {
      ...token,
      accessToken: undefined,
      refreshToken: undefined,
      idToken: undefined,
      expiresAt: 0,
      error: 'RefreshTokenMissing',
    };
  }

  try {
    const response = await fetch(`${issuer}/protocol/openid-connect/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        ...(process.env.AUTH_KEYCLOAK_SECRET
          ? { client_secret: process.env.AUTH_KEYCLOAK_SECRET }
          : {}),
        grant_type: 'refresh_token',
        refresh_token: token.refreshToken,
      }),
    });

    const refreshed = (await response.json()) as {
      access_token?: string;
      expires_in?: number;
      refresh_token?: string;
      id_token?: string;
      error?: string;
    };

    if (!response.ok || !refreshed.access_token) {
      return {
        ...token,
        accessToken: undefined,
        refreshToken: undefined,
        idToken: undefined,
        expiresAt: 0,
        error: 'RefreshAccessTokenError',
      };
    }

    const accessToken = refreshed.access_token;
    return {
      ...token,
      accessToken,
      idToken: refreshed.id_token ?? token.idToken,
      expiresAt: Math.floor(Date.now() / 1000) + (refreshed.expires_in ?? 300),
      refreshToken: refreshed.refresh_token ?? token.refreshToken,
      roles: rolesFromAccessToken(accessToken),
      rolesSyncedAt: Math.floor(Date.now() / 1000),
      identityProvider: identityProviderFromAccessToken(accessToken),
      error: undefined,
    };
  } catch {
    return {
      ...token,
      accessToken: undefined,
      refreshToken: undefined,
      idToken: undefined,
      expiresAt: 0,
      error: 'RefreshAccessTokenError',
    };
  }
}
