'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Permission } from '@saas-starter/shared';
import { Button, Input } from '@/components/ui';
import { layout } from '@/lib/components';
import { useAuth } from '@/hooks/use-auth';
import { usePermissions } from '@/hooks/use-permissions';
import { useToast } from '@/providers';
import { getAiUsage, type AiUsageReport } from '@/services/ai.service';

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoIso(days: number) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

export default function AdminAiUsagePage() {
  const { accessToken } = useAuth();
  const { can, isAdmin } = usePermissions();
  const toast = useToast();
  const canRead = isAdmin || can(Permission.ADMIN_ACCESS);

  const [startDate, setStartDate] = useState(() => daysAgoIso(30));
  const [endDate, setEndDate] = useState(() => todayIso());
  const [userId, setUserId] = useState('');
  const [report, setReport] = useState<AiUsageReport | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!accessToken || !canRead) return;
    setLoading(true);
    try {
      const data = await getAiUsage(accessToken, {
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        userId: userId.trim() || undefined,
      });
      setReport(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur usage IA');
    } finally {
      setLoading(false);
    }
  }, [accessToken, canRead, startDate, endDate, userId, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const onFilter = (e: FormEvent) => {
    e.preventDefault();
    void load();
  };

  if (!canRead) {
    return (
      <main className="admin" style={layout.admin}>
        <p className="error">Accès admin requis.</p>
      </main>
    );
  }

  return (
    <main className="admin" style={layout.admin}>
      <header className="admin-header">
        <div>
          <h1>Usage IA</h1>
          <p className="hint">
            Tokens et requêtes agrégés (`GET /api/ai/usage`).
          </p>
        </div>
      </header>

      <form className="admin-filters status" onSubmit={onFilter}>
        <Input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          aria-label="Date début"
        />
        <Input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          aria-label="Date fin"
        />
        <Input
          placeholder="userId (optionnel)"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          aria-label="Filtrer userId"
        />
        <Button type="submit" disabled={loading}>
          {loading ? 'Chargement…' : 'Filtrer'}
        </Button>
      </form>

      {report ? (
        <>
          <section className="status" style={{ marginTop: '1rem' }}>
            <div className="admin-filters">
              <p>
                <strong>{report.totalRequests}</strong> requêtes
              </p>
              <p>
                <strong>{report.totalTokens}</strong> tokens
              </p>
            </div>
          </section>

          <section className="status" style={{ marginTop: '1rem' }}>
            <h2>Par provider</h2>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Provider</th>
                    <th>Requêtes</th>
                    <th>Tokens</th>
                  </tr>
                </thead>
                <tbody>
                  {report.byProvider.length === 0 ? (
                    <tr>
                      <td colSpan={3}>Aucune donnée</td>
                    </tr>
                  ) : (
                    report.byProvider.map((row) => (
                      <tr key={row.provider}>
                        <td>
                          <code>{row.provider}</code>
                        </td>
                        <td>{row.requests}</td>
                        <td>{row.tokens}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="status" style={{ marginTop: '1rem' }}>
            <h2>Par opération</h2>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Opération</th>
                    <th>Requêtes</th>
                    <th>Tokens</th>
                  </tr>
                </thead>
                <tbody>
                  {report.byOperation.length === 0 ? (
                    <tr>
                      <td colSpan={3}>Aucune donnée</td>
                    </tr>
                  ) : (
                    report.byOperation.map((row) => (
                      <tr key={row.operation}>
                        <td>
                          <code>{row.operation}</code>
                        </td>
                        <td>{row.requests}</td>
                        <td>{row.tokens}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}
    </main>
  );
}
