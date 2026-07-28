'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Badge, Button, Input } from '@/components/ui';
import { layout } from '@/lib/components';
import { formatIdentityProvider } from '@/lib/identity-provider';
import { useAuth } from '@/hooks/use-auth';
import { usePermissions } from '@/hooks/use-permissions';
import {
  listAdminUsers,
  type AdminUser,
  type AppRole,
  type UserStatus,
} from '@/services/admin.service';

function userStatusVariant(
  status: UserStatus,
): 'success' | 'warning' | 'error' {
  if (status === 'ACTIVE') return 'success';
  if (status === 'DISABLED') return 'warning';
  return 'error';
}

export default function AdminUsersPage() {
  const { accessToken } = useAuth();
  const { canListUsers, isLoading: permLoading } = usePermissions();
  const [data, setData] = useState<{
    items: AdminUser[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  } | null>(null);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<UserStatus | ''>('');
  const [role, setRole] = useState<AppRole | ''>('');
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!accessToken || !canListUsers) return;
    setLoading(true);
    setError(null);
    try {
      const result = await listAdminUsers(accessToken, {
        page,
        pageSize: 10,
        q: q || undefined,
        status: status || undefined,
        role: role || undefined,
      });
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, [accessToken, canListUsers, page, q, status, role]);

  useEffect(() => {
    void load();
  }, [load]);

  const onSearch = (e: FormEvent) => {
    e.preventDefault();
    setPage(1);
    void load();
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
        <h1>Administration</h1>
        <p className="error" role="alert">
          Accès refusé — permission ADMIN / users:list requise.
        </p>
      </main>
    );
  }

  return (
    <main className="admin" style={layout.admin}>
      <header className="admin-header">
        <div>
          <h1>Utilisateurs</h1>
          <p>Gestion IAM — Keycloak reste la source d&apos;identité.</p>
        </div>
      </header>

      <form className="admin-filters" onSubmit={onSearch}>
        <Input
          type="search"
          placeholder="Rechercher email / nom…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Recherche"
        />
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as UserStatus | '');
            setPage(1);
          }}
          aria-label="Statut"
        >
          <option value="">Tous les statuts</option>
          <option value="ACTIVE">ACTIVE</option>
          <option value="DISABLED">DISABLED</option>
        </select>
        <select
          value={role}
          onChange={(e) => {
            setRole(e.target.value as AppRole | '');
            setPage(1);
          }}
          aria-label="Rôle"
        >
          <option value="">Tous les rôles</option>
          <option value="USER">USER</option>
          <option value="ADMIN">ADMIN</option>
        </select>
        <Button type="submit" variant="primary" disabled={loading}>
          Filtrer
        </Button>
      </form>

      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Email</th>
              <th>Nom</th>
              <th>Rôles</th>
              <th>Statut</th>
              <th>Provider</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {data?.items.map((user) => (
              <tr key={user.id}>
                <td>{user.email}</td>
                <td>
                  {user.name ||
                    [user.firstName, user.lastName].filter(Boolean).join(' ') ||
                    '—'}
                </td>
                <td>{user.roles.join(', ')}</td>
                <td>
                  <Badge variant={userStatusVariant(user.status)}>
                    {user.status}
                  </Badge>
                </td>
                <td>{formatIdentityProvider(user.provider)}</td>
                <td>
                  <Link href={`/admin/users/${user.id}`}>Détail</Link>
                </td>
              </tr>
            ))}
            {!loading && data?.items.length === 0 ? (
              <tr>
                <td colSpan={6} className="hint">
                  Aucun utilisateur.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {data && data.totalPages > 1 ? (
        <div className="pager">
          <Button
            variant="ghost"
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Précédent
          </Button>
          <span className="hint">
            Page {data.page} / {data.totalPages} ({data.total})
          </span>
          <Button
            variant="ghost"
            disabled={page >= data.totalPages || loading}
            onClick={() => setPage((p) => p + 1)}
          >
            Suivant
          </Button>
        </div>
      ) : null}
    </main>
  );
}
