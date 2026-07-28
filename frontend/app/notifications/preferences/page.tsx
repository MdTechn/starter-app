'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Permission } from '@saas-starter/shared';
import { useAuth } from '@/hooks/use-auth';
import { usePermissions } from '@/hooks/use-permissions';
import { layout } from '@/lib/components';
import { useToast } from '@/providers';
import {
  getNotificationPreferences,
  updateNotificationPreference,
  type NotificationPreference,
} from '@/services/notifications.service';

const EVENT_LABELS: Record<string, string> = {
  USER_CREATED: 'Compte créé',
  USER_INVITED: 'Invitation utilisateur',
  LOGIN_SECURITY: 'Sécurité de connexion',
  SUBSCRIPTION_CREATED: 'Abonnement créé',
  PAYMENT_SUCCESS: 'Paiement réussi',
  PAYMENT_FAILED: 'Paiement échoué',
};

export default function NotificationPreferencesPage() {
  const { accessToken } = useAuth();
  const { can } = usePermissions();
  const toast = useToast();
  const canRead = can(Permission.NOTIFICATION_READ);

  const [prefs, setPrefs] = useState<NotificationPreference[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!accessToken || !canRead) return;
    try {
      setPrefs(await getNotificationPreferences(accessToken));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur préférences');
    }
  }, [accessToken, canRead, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggle = async (
    eventType: string,
    field: 'emailEnabled' | 'inAppEnabled',
    value: boolean,
  ) => {
    if (!accessToken) return;
    setBusy(true);
    try {
      const updated = await updateNotificationPreference(accessToken, {
        eventType,
        [field]: value,
      });
      setPrefs((prev) =>
        prev.map((p) => (p.eventType === eventType ? { ...p, ...updated } : p)),
      );
      toast.success('Préférence mise à jour.');
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Mise à jour impossible',
      );
    } finally {
      setBusy(false);
    }
  };

  if (!canRead) {
    return (
      <main className="admin" style={layout.admin}>
        <p className="error">Accès préférences refusé.</p>
      </main>
    );
  }

  return (
    <main className="admin notifications" style={layout.admin}>
      <header className="admin-header">
        <div>
          <h1>Préférences</h1>
          <p>Email et in-app. SMS / Push préparés, non actifs.</p>
        </div>
        <nav className="links">
          <Link href="/notifications">Centre</Link>
        </nav>
      </header>

      <div className="table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Événement</th>
              <th>Email</th>
              <th>In-app</th>
              <th>SMS</th>
              <th>Push</th>
            </tr>
          </thead>
          <tbody>
            {prefs.map((p) => (
              <tr key={p.eventType}>
                <td>{EVENT_LABELS[p.eventType] ?? p.eventType}</td>
                <td>
                  <input
                    type="checkbox"
                    checked={p.emailEnabled}
                    disabled={busy}
                    onChange={(e) =>
                      void toggle(p.eventType, 'emailEnabled', e.target.checked)
                    }
                  />
                </td>
                <td>
                  <input
                    type="checkbox"
                    checked={p.inAppEnabled}
                    disabled={busy}
                    onChange={(e) =>
                      void toggle(p.eventType, 'inAppEnabled', e.target.checked)
                    }
                  />
                </td>
                <td>
                  <input type="checkbox" checked={p.smsEnabled} disabled />
                </td>
                <td>
                  <input type="checkbox" checked={p.pushEnabled} disabled />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
