/** Human-readable labels for Keycloak broker aliases / Prisma IdentityProvider. */
const PROVIDER_LABELS: Record<string, string> = {
  google: 'Google',
  facebook: 'Facebook',
  apple: 'Apple',
  microsoft: 'Microsoft',
  keycloak: 'Keycloak',
};

/**
 * Format an identity provider for display.
 * Accepts Keycloak aliases (`google`) or Prisma enums (`GOOGLE`).
 */
export function formatIdentityProvider(provider?: string | null): string {
  if (!provider) return 'Keycloak';
  const key = provider.trim().toLowerCase();
  return PROVIDER_LABELS[key] ?? provider;
}

export function isSocialProvider(provider?: string | null): boolean {
  if (!provider) return false;
  const key = provider.trim().toLowerCase();
  return (
    key === 'google' ||
    key === 'facebook' ||
    key === 'apple' ||
    key === 'microsoft'
  );
}
