import { IdentityProvider } from '@prisma/client';

const SOCIAL_ALIASES: Record<string, IdentityProvider> = {
  google: IdentityProvider.GOOGLE,
  facebook: IdentityProvider.FACEBOOK,
  apple: IdentityProvider.APPLE,
  microsoft: IdentityProvider.MICROSOFT,
};

/** Keycloak IdP aliases considered social brokers (Epic 3). */
export const SOCIAL_IDP_ALIASES = Object.keys(SOCIAL_ALIASES);

/**
 * Map Keycloak `identity_provider` claim (broker alias) → Prisma IdentityProvider.
 * Direct Keycloak login (no broker) → KEYCLOAK.
 */
export function resolveIdentityProvider(
  identityProviderClaim?: string | null,
): IdentityProvider {
  if (!identityProviderClaim) {
    return IdentityProvider.KEYCLOAK;
  }
  const alias = identityProviderClaim.trim().toLowerCase();
  return SOCIAL_ALIASES[alias] ?? IdentityProvider.KEYCLOAK;
}

export function isSocialIdentityProvider(provider: IdentityProvider): boolean {
  return (
    provider === IdentityProvider.GOOGLE ||
    provider === IdentityProvider.FACEBOOK ||
    provider === IdentityProvider.APPLE ||
    provider === IdentityProvider.MICROSOFT
  );
}
