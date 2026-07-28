'use client';

import { getSession, signOut } from 'next-auth/react';
import { getApiBaseUrl } from '@/lib/api';

export const SESSION_EXPIRED_EVENT = 'auth:session-expired';

let logoutInFlight: Promise<void> | null = null;

/**
 * Déconnexion complète : audit API + fin SSO Keycloak + clear NextAuth + redirect.
 */
export async function forceCompleteLogout(
  redirectTo = '/login',
): Promise<void> {
  if (typeof window === 'undefined') return;
  if (logoutInFlight) return logoutInFlight;

  logoutInFlight = (async () => {
    try {
      const session = await getSession();
      if (session?.accessToken) {
        try {
          await fetch(`${getApiBaseUrl()}/auth/logout`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${session.accessToken}` },
          });
        } catch {
          // Best-effort.
        }
      }

      let keycloakLogoutUrl: string | null = null;
      try {
        const res = await fetch(
          `/api/auth/federated-logout?redirect=${encodeURIComponent(redirectTo)}`,
          { method: 'POST' },
        );
        if (res.ok) {
          const data = (await res.json()) as { logoutUrl?: string };
          keycloakLogoutUrl = data.logoutUrl ?? null;
        }
      } catch {
        // Fall through.
      }

      await signOut({ redirect: false });

      if (keycloakLogoutUrl) {
        window.location.assign(keycloakLogoutUrl);
        return;
      }

      window.location.assign(redirectTo);
    } finally {
      logoutInFlight = null;
    }
  })();

  return logoutInFlight;
}

export function emitSessionExpired(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
}
