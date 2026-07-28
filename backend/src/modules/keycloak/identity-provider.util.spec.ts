import { IdentityProvider } from '@prisma/client';
import {
  isSocialIdentityProvider,
  resolveIdentityProvider,
} from './identity-provider.util';

describe('identity-provider.util', () => {
  it('maps known social aliases', () => {
    expect(resolveIdentityProvider('google')).toBe(IdentityProvider.GOOGLE);
    expect(resolveIdentityProvider('Facebook')).toBe(IdentityProvider.FACEBOOK);
    expect(resolveIdentityProvider('APPLE')).toBe(IdentityProvider.APPLE);
    expect(resolveIdentityProvider('microsoft')).toBe(
      IdentityProvider.MICROSOFT,
    );
  });

  it('defaults to KEYCLOAK when claim missing or unknown', () => {
    expect(resolveIdentityProvider(undefined)).toBe(IdentityProvider.KEYCLOAK);
    expect(resolveIdentityProvider(null)).toBe(IdentityProvider.KEYCLOAK);
    expect(resolveIdentityProvider('ldap')).toBe(IdentityProvider.KEYCLOAK);
  });

  it('detects social providers', () => {
    expect(isSocialIdentityProvider(IdentityProvider.GOOGLE)).toBe(true);
    expect(isSocialIdentityProvider(IdentityProvider.APPLE)).toBe(true);
    expect(isSocialIdentityProvider(IdentityProvider.MICROSOFT)).toBe(true);
    expect(isSocialIdentityProvider(IdentityProvider.KEYCLOAK)).toBe(false);
  });
});
