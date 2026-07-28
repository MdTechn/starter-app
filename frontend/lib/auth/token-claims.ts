import {
  mapKeycloakRolesToAppRoles,
  UserRole,
} from '@saas-starter/shared/auth';

export type AccessTokenClaims = {
  realm_access?: { roles?: string[] };
  identity_provider?: string;
  idp?: string;
};

function decodeBase64Url(payload: string): string {
  const b64 = payload.replace(/-/g, '+').replace(/_/g, '/');
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(b64, 'base64').toString('utf8');
  }
  // Edge / browser fallback (middleware-safe).
  const padded = b64.padEnd(b64.length + ((4 - (b64.length % 4)) % 4), '=');
  return atob(padded);
}

/** Decode JWT payload claims (no verify — token already issued to us). */
export function claimsFromAccessToken(
  accessToken?: string,
): AccessTokenClaims | null {
  if (!accessToken) return null;
  try {
    const [, payload] = accessToken.split('.');
    if (!payload) return null;
    return JSON.parse(decodeBase64Url(payload)) as AccessTokenClaims;
  } catch {
    return null;
  }
}

/** Decode realm roles from a Keycloak access token. */
export function rolesFromAccessToken(accessToken?: string): UserRole[] {
  const claims = claimsFromAccessToken(accessToken);
  if (!claims) return [UserRole.USER];
  return mapKeycloakRolesToAppRoles(claims.realm_access?.roles ?? []);
}

/** Keycloak broker alias (`google`, `facebook`, …) or null for direct login. */
export function identityProviderFromAccessToken(
  accessToken?: string,
): string | null {
  const claims = claimsFromAccessToken(accessToken);
  const alias = claims?.identity_provider ?? claims?.idp;
  return alias?.trim() ? alias.trim().toLowerCase() : null;
}
