'use client';

import { useCallback, useEffect, useState } from 'react';
import { Permission } from '@saas-starter/shared';
import { Badge, Button } from '@/components/ui';
import { layout } from '@/lib/components';
import { useAuth } from '@/hooks/use-auth';
import { usePermissions } from '@/hooks/use-permissions';
import {
  getSystemStatus,
  type ServiceProbe,
  type SystemStatus,
} from '@/services/health.service';

function probeVariant(
  status: ServiceProbe['status'],
): 'success' | 'warning' | 'error' | 'primary' {
  if (status === 'up') return 'success';
  if (status === 'skipped') return 'primary';
  if (status === 'degraded') return 'warning';
  return 'error';
}

export default function SystemPage() {
  const { accessToken } = useAuth();
  const { can } = usePermissions();
  const canRead = can(Permission.SYSTEM_READ) || can(Permission.ADMIN_ACCESS);

  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!accessToken || !canRead) return;
    setError(null);
    try {
      setStatus(await getSystemStatus(accessToken));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur système');
    }
  }, [accessToken, canRead]);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), 30_000);
    return () => window.clearInterval(id);
  }, [load]);

  if (!canRead) {
    return (
      <main className="admin" style={layout.admin}>
        <p className="error">Accès système réservé aux administrateurs.</p>
      </main>
    );
  }

  return (
    <main className="admin" style={layout.admin}>
      <header className="admin-header">
        <div>
          <h1>Système</h1>
          <p>
            État des dépendances —{' '}
            {status ? (
              <Badge variant={probeVariant(status.ok ? 'up' : 'down')}>
                {status.status}
              </Badge>
            ) : (
              '…'
            )}
          </p>
        </div>
        <nav className="links">
          <Button variant="social" onClick={() => void load()}>
            Rafraîchir
          </Button>
        </nav>
      </header>

      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Service</th>
              <th>Statut</th>
              <th>Latence</th>
              <th>Détail</th>
            </tr>
          </thead>
          <tbody>
            {(status?.checks ?? []).map((c) => (
              <tr key={c.name}>
                <td>{c.name}</td>
                <td>
                  <Badge variant={probeVariant(c.status)}>{c.status}</Badge>
                </td>
                <td>{c.latencyMs != null ? `${c.latencyMs} ms` : '—'}</td>
                <td className="hint">{c.detail ?? '—'}</td>
              </tr>
            ))}
            {!status ? (
              <tr>
                <td colSpan={4} className="hint">
                  Chargement…
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </main>
  );
}
