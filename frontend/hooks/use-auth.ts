'use client';

import { signIn, useSession } from 'next-auth/react';
import { forceCompleteLogout } from '@/lib/session-logout';

export type SocialIdp = 'google' | 'facebook' | 'apple' | 'microsoft';

export function useAuth() {
  const { data: session, status } = useSession();

  const logout = () => forceCompleteLogout('/');

  /** Standard Keycloak login (username/password or IdP chooser). */
  const signInWithKeycloak = (callbackUrl = '/dashboard') =>
    signIn('keycloak', { callbackUrl });

  /** Keycloak self-registration (OIDC /registrations), then same callback as login. */
  const signUpWithKeycloak = (callbackUrl = '/dashboard') =>
    signIn('keycloak-register', { callbackUrl });

  /**
   * Social login via Keycloak broker (`kc_idp_hint`).
   * No direct Google/Facebook OAuth in NextAuth — Keycloak remains the sole IdP.
   */
  const signInWithSocial = (idp: SocialIdp, callbackUrl = '/dashboard') =>
    signIn('keycloak', { callbackUrl }, { kc_idp_hint: idp });

  return {
    session,
    status,
    isAuthenticated: status === 'authenticated' && !session?.error,
    isLoading: status === 'loading',
    accessToken: session?.error ? undefined : session?.accessToken,
    roles: session?.roles ?? [],
    identityProvider: session?.identityProvider ?? null,
    sessionError: session?.error,
    signIn: signInWithKeycloak,
    signUp: signUpWithKeycloak,
    signInWithSocial,
    signOut: logout,
  };
}
