import { registerAs } from '@nestjs/config';

export const keycloakConfigFactory = () => {
  const url = (process.env.KEYCLOAK_URL ?? '').replace(/\/$/, '');
  const realm = process.env.KEYCLOAK_REALM ?? 'saas-realm';
  const issuer =
    process.env.KEYCLOAK_ISSUER ?? (url ? `${url}/realms/${realm}` : '');

  return {
    enabled:
      process.env.KEYCLOAK_ENABLED === 'true' ||
      process.env.KEYCLOAK_ENABLED === '1',
    url,
    realm,
    issuer,
    clientId: process.env.KEYCLOAK_CLIENT_ID ?? 'saas-web',
    clientSecret: process.env.KEYCLOAK_CLIENT_SECRET ?? '',
    audience: process.env.KEYCLOAK_AUDIENCE ?? 'saas-web',
    jwksUri:
      process.env.KEYCLOAK_JWKS_URI ??
      (issuer ? `${issuer}/protocol/openid-connect/certs` : ''),
    adminUrl: process.env.KEYCLOAK_ADMIN_URL ?? url,
    adminUser: process.env.KEYCLOAK_ADMIN_USER ?? '',
    adminPassword: process.env.KEYCLOAK_ADMIN_PASSWORD ?? '',
  };
};

export default registerAs('keycloak', keycloakConfigFactory);
