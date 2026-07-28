import { SessionProvider } from 'next-auth/react';
import type { ReactNode } from 'react';
import { AuthSessionGuard } from '@/components/auth-session-guard';

export function AuthProvider({ children }: { children: ReactNode }) {
  return (
    <SessionProvider refetchInterval={60} refetchOnWindowFocus>
      <AuthSessionGuard>{children}</AuthSessionGuard>
    </SessionProvider>
  );
}
