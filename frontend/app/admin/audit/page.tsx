'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { layout } from '@/lib/components';
import { useAuth } from '@/hooks/use-auth';
import { usePermissions } from '@/hooks/use-permissions';
import { listAudit } from '@/services/admin.service';

type AuditRow = {
  id: string;
  event: string;
  provider: string;
  userId: string | null;
  createdAt: string;
  metadata?: Record<string, unknown> | null;
};

export default function AdminAuditPage() {
  const { accessToken } = useAuth();
  const { canReadAudit, isLoading } = usePermissions();
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken || !canReadAudit) return;
    listAudit(accessToken, 40)
      .then((data) => setRows(data as AuditRow[]))
      .catch((err: Error) => setError(err.message));
  }, [accessToken, canReadAudit]);

  if (isLoading) {
    return (
      <main className="admin" style={layout.admin}>
        <p>Chargement…</p>
      </main>
    );
  }

  if (!canReadAudit) {
    return (
      <main className="admin" style={layout.admin}>
        <p className="error">Accès audit refusé.</p>
      </main>
    );
  }

  return (
    <main className="admin" style={layout.admin}>
      <header className="admin-header">
        <div>
          <h1>Audit</h1>
          <p>Événements d&apos;authentification récents.</p>
        </div>
      </header>

      {error ? <p className="error">{error}</p> : null}

      <div className="table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Événement</th>
              <th>Provider</th>
              <th>User</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{new Date(row.createdAt).toLocaleString()}</td>
                <td>{row.event}</td>
                <td>{row.provider}</td>
                <td>
                  {row.userId ? (
                    <Link href={`/admin/users/${row.userId}`}>
                      {row.userId}
                    </Link>
                  ) : (
                    '—'
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="hint">
                  Aucun événement.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </main>
  );
}
