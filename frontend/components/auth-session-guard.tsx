'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useRef } from 'react';
import {
  SESSION_EXPIRED_EVENT,
  forceCompleteLogout,
} from '@/lib/session-logout';

const REFRESH_ERRORS = new Set([
  'RefreshAccessTokenError',
  'RefreshTokenMissing',
]);

/**
 * Surveille l’expiration / l’échec de refresh JWT et déconnecte totalement
 * vers /login.
 */
export function AuthSessionGuard({ children }: { children: React.ReactNode }) {
  const { data: session, status, update } = useSession();
  const loggingOut = useRef(false);

  useEffect(() => {
    const onExpired = () => {
      if (loggingOut.current) return;
      loggingOut.current = true;
      void forceCompleteLogout('/login');
    };

    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
  }, []);

  useEffect(() => {
    if (status !== 'authenticated' || !session) return;
    if (!session.error || !REFRESH_ERRORS.has(session.error)) return;
    if (loggingOut.current) return;
    loggingOut.current = true;
    void forceCompleteLogout('/login');
  }, [session, status]);

  // Force un refresh JWT peu avant l’expiration de l’access token.
  useEffect(() => {
    if (status !== 'authenticated' || !session?.expiresAt) return;
    if (session.error) return;

    const expiresAtMs = session.expiresAt * 1000;
    const refreshInMs = Math.max(expiresAtMs - Date.now() - 30_000, 0);

    const timer = window.setTimeout(() => {
      void update().then((next) => {
        if (
          next?.error &&
          REFRESH_ERRORS.has(next.error) &&
          !loggingOut.current
        ) {
          loggingOut.current = true;
          void forceCompleteLogout('/login');
        }
      });
    }, refreshInMs);

    return () => window.clearTimeout(timer);
  }, [session?.expiresAt, session?.error, status, update]);

  return <>{children}</>;
}
