'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Badge, Button, Input } from '@/components/ui';
import { layout } from '@/lib/components';
import { formatIdentityProvider } from '@/lib/identity-provider';
import { useAuth } from '@/hooks/use-auth';
import { usePermissions } from '@/hooks/use-permissions';
import { useToast } from '@/providers';
import {
  disableUser,
  enableUser,
  getAdminUser,
  setUserRoles,
  updateUserProfile,
  type AdminUser,
  type AppRole,
} from '@/services/admin.service';

function userStatusVariant(
  status: AdminUser['status'],
): 'success' | 'warning' | 'error' {
  if (status === 'ACTIVE') return 'success';
  if (status === 'DISABLED') return 'warning';
  return 'error';
}

export default function AdminUserDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { accessToken } = useAuth();
  const {
    canManageIam,
    canListUsers,
    isLoading: permLoading,
  } = usePermissions();
  const toast = useToast();
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [roles, setRoles] = useState<AppRole[]>(['USER']);

  const load = useCallback(async () => {
    if (!accessToken || !id) return;
    setLoadError(null);
    try {
      const data = await getAdminUser(accessToken, id);
      setUser(data);
      setFirstName(data.firstName ?? '');
      setLastName(data.lastName ?? '');
      setAvatarUrl(data.avatarUrl ?? '');
      setRoles(data.roles.includes('ADMIN') ? ['USER', 'ADMIN'] : ['USER']);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur';
      setLoadError(msg);
      toast.error(msg);
    }
  }, [accessToken, id, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const run = async (action: () => Promise<unknown>, okMsg: string) => {
    if (!accessToken) return;
    setBusy(true);
    try {
      await action();
      toast.success(okMsg);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Action échouée');
    } finally {
      setBusy(false);
    }
  };

  const onSaveProfile = (e: FormEvent) => {
    e.preventDefault();
    if (!accessToken || !id) return;
    void run(
      () =>
        updateUserProfile(accessToken, id, {
          firstName: firstName || undefined,
          lastName: lastName || undefined,
          avatarUrl: avatarUrl || null,
        }),
      'Profil mis à jour',
    );
  };

  const onSaveRoles = (e: FormEvent) => {
    e.preventDefault();
    if (!accessToken || !id) return;
    void run(() => setUserRoles(accessToken, id, roles), 'Rôles mis à jour');
  };

  if (permLoading) {
    return (
      <main className="admin" style={layout.admin}>
        <p>Chargement…</p>
      </main>
    );
  }

  if (!canListUsers) {
    return (
      <main className="admin" style={layout.admin}>
        <p className="error">Accès refusé.</p>
      </main>
    );
  }

  return (
    <main className="admin" style={layout.admin}>
      <header className="admin-header">
        <div>
          <h1>Utilisateur</h1>
          <p>{user?.email ?? '…'}</p>
        </div>
        <nav className="links">
          <Link href="/admin">Liste</Link>
        </nav>
      </header>

      {loadError && !user ? (
        <p className="error" role="alert">
          {loadError}
        </p>
      ) : null}

      {!user ? (
        <p className="hint">Chargement du profil…</p>
      ) : (
        <>
          <section className="status">
            <p>
              <strong>Statut :</strong>{' '}
              <Badge variant={userStatusVariant(user.status)}>
                {user.status}
              </Badge>
            </p>
            <p>
              <strong>Provider :</strong>{' '}
              {formatIdentityProvider(user.provider)}
            </p>
            <p>
              <strong>Keycloak sub :</strong> <code>{user.keycloakSub}</code>
            </p>
            <p>
              <strong>Permissions :</strong>{' '}
              {(user.permissions ?? []).join(', ') || '—'}
            </p>
            <p>
              <strong>Dernière connexion :</strong>{' '}
              {user.lastLoginAt
                ? new Date(user.lastLoginAt).toLocaleString()
                : '—'}
            </p>
          </section>

          {canManageIam ? (
            <section className="admin-actions">
              <h2>Actions IAM</h2>
              <div className="links">
                {user.status === 'ACTIVE' ? (
                  <Button
                    variant="ghost"
                    disabled={busy}
                    onClick={() =>
                      run(
                        () => disableUser(accessToken!, id),
                        'Compte désactivé',
                      )
                    }
                  >
                    Désactiver
                  </Button>
                ) : null}
                {user.status === 'DISABLED' ? (
                  <Button
                    variant="ghost"
                    disabled={busy}
                    onClick={() =>
                      run(() => enableUser(accessToken!, id), 'Compte réactivé')
                    }
                  >
                    Réactiver
                  </Button>
                ) : null}
              </div>

              <form className="admin-form" onSubmit={onSaveRoles}>
                <h3>Rôles</h3>
                <label>
                  <input
                    type="checkbox"
                    checked={roles.includes('ADMIN')}
                    onChange={(e) =>
                      setRoles(e.target.checked ? ['USER', 'ADMIN'] : ['USER'])
                    }
                  />{' '}
                  ADMIN
                </label>
                <Button type="submit" variant="primary" disabled={busy}>
                  Enregistrer les rôles
                </Button>
              </form>
            </section>
          ) : null}

          <form className="admin-form" onSubmit={onSaveProfile}>
            <h2>Profil</h2>
            <label>
              Prénom
              <Input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
            </label>
            <label>
              Nom
              <Input
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
            </label>
            <label>
              Avatar URL
              <Input
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
              />
            </label>
            <Button type="submit" variant="primary" disabled={busy}>
              Enregistrer le profil
            </Button>
          </form>
        </>
      )}
    </main>
  );
}
