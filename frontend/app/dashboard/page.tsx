'use client';

import { Badge, Card } from '@/components/ui';
import { useAuth } from '@/hooks/use-auth';
import { layout } from '@/lib/components';
import {
  formatIdentityProvider,
  isSocialProvider,
} from '@/lib/identity-provider';
import { useBrand } from '@/providers';
import { apiFetch } from '@/lib/api';
import { UserRole } from '@saas-starter/shared/auth';
import { useEffect, useState } from 'react';

type Profile = {
  id: string;
  email: string;
  name: string | null;
  roles: string[];
  provider?: string;
};

export default function DashboardPage() {
  const { brand } = useBrand();
  const { session, accessToken, roles, identityProvider } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) return;

    apiFetch<Profile>('/users/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then(setProfile)
      .catch((err: Error) => setError(err.message));
  }, [accessToken]);

  const providerRaw = profile?.provider ?? identityProvider ?? 'keycloak';
  const providerLabel = formatIdentityProvider(providerRaw);

  return (
    <main style={layout.main}>
      <h1>Dashboard — {brand.appName}</h1>
      <p>Session Keycloak active · {brand.companyName}</p>
      <Card variant="flat" className="status">
        <p>
          <strong>Email :</strong> {session?.user?.email}
        </p>
        <p>
          <strong>Provider :</strong>{' '}
          <Badge
            variant={isSocialProvider(providerRaw) ? 'success' : 'secondary'}
            size="small"
          >
            {providerLabel}
          </Badge>
        </p>
        <p>
          <strong>Rôles :</strong>{' '}
          {roles.length
            ? [...roles]
                .filter(
                  (role) => role === UserRole.USER || role === UserRole.ADMIN,
                )
                .sort((a, b) =>
                  a === UserRole.ADMIN ? -1 : b === UserRole.ADMIN ? 1 : 0,
                )
                .map((role) => (
                  <Badge
                    key={role}
                    variant={role === UserRole.ADMIN ? 'primary' : 'secondary'}
                    size="small"
                    style={{ marginRight: 'var(--space-xs)' }}
                  >
                    {role}
                  </Badge>
                ))
            : '—'}
        </p>
        {profile && (
          <p>
            <strong>Profil Prisma :</strong> {profile.email} (
            {profile.roles.join(', ')})
          </p>
        )}
        {error && <p className="error">API : {error}</p>}
      </Card>
    </main>
  );
}
