'use client';

import { useSearchParams } from 'next/navigation';
import {
  FormEvent,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Permission } from '@saas-starter/shared';
import { Button, Input } from '@/components/ui';
import { layout } from '@/lib/components';
import { useAuth } from '@/hooks/use-auth';
import { usePermissions } from '@/hooks/use-permissions';
import { useToast } from '@/providers';
import {
  createItemCheckout,
  getPayableItems,
  listProjectPayments,
  type PayableItem,
  type ProjectPayment,
} from '@/services/billing.service';

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(amount / 100);
}

function formatDateTime(value: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleString('fr-FR', {
    dateStyle: 'short',
    timeStyle: 'medium',
  });
}

function AdminPaymentsContent() {
  const { accessToken } = useAuth();
  const { can } = usePermissions();
  const toast = useToast();
  const searchParams = useSearchParams();
  const canceled = searchParams.get('canceled');

  const [items, setItems] = useState<PayableItem[]>([]);
  const [payments, setPayments] = useState<ProjectPayment[]>([]);
  const [configured, setConfigured] = useState(false);
  const [itemId, setItemId] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const canRead = can(Permission.BILLING_READ);
  const canWrite = can(Permission.BILLING_WRITE);

  const selected = useMemo(
    () => items.find((item) => item.id === itemId) ?? null,
    [items, itemId],
  );

  const load = useCallback(async () => {
    if (!accessToken || !canRead) return;
    setLoading(true);
    try {
      const [catalog, pays] = await Promise.all([
        getPayableItems(accessToken),
        listProjectPayments(accessToken).catch(() => []),
      ]);
      setItems(catalog.items);
      setConfigured(catalog.configured);
      setPayments(pays);
      if (!itemId && catalog.items[0]) {
        setItemId(catalog.items[0].id);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, [accessToken, canRead, itemId, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (canceled) {
      toast.warning('Checkout annulé.');
    }
  }, [canceled, toast]);

  const onPay = async (e: FormEvent) => {
    e.preventDefault();
    if (!accessToken || !itemId || !selected) return;
    setBusy(true);
    try {
      const session = await createItemCheckout(accessToken, {
        itemId,
        cancelUrl: `${window.location.origin}/admin/payments?canceled=1`,
      });
      if (!session.url) throw new Error('URL checkout manquante');
      toast.info('Redirection vers Stripe…');
      window.location.href = session.url;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Checkout impossible');
      setBusy(false);
    }
  };

  if (!canRead) {
    return (
      <main className="admin" style={layout.admin}>
        <p className="error">Accès paiements refusé.</p>
      </main>
    );
  }

  return (
    <main className="admin" style={layout.admin}>
      <header className="admin-header">
        <div>
          <h1>Paiements</h1>
          <p>
            Articles et abonnements du projet — redirection Stripe Checkout
            dynamique.
          </p>
        </div>
      </header>

      {!configured ? (
        <p className="hint">Stripe non configuré (`STRIPE_SECRET_KEY`).</p>
      ) : null}

      {loading ? (
        <p>Chargement du catalogue…</p>
      ) : (
        <form className="admin-form" onSubmit={(e) => void onPay(e)}>
          <h2>Nouvel article / abonnement à payer</h2>

          <label>
            Type de produit
            <select
              value={itemId}
              onChange={(e) => setItemId(e.target.value)}
              required
              aria-label="Produit à payer"
            >
              {items.map((item) => (
                <option key={item.id} value={item.id}>
                  [{item.type === 'article' ? 'Article' : 'Abonnement'}]{' '}
                  {item.name} — {formatMoney(item.amount, item.currency)}
                </option>
              ))}
            </select>
          </label>

          {selected ? (
            <>
              <label>
                Description
                <Input value={selected.description} readOnly />
              </label>
              <label>
                Montant
                <Input
                  value={formatMoney(selected.amount, selected.currency)}
                  readOnly
                />
              </label>
            </>
          ) : null}

          {canWrite ? (
            <Button
              type="submit"
              variant="primary"
              disabled={busy || !configured || !itemId}
            >
              {busy ? 'Redirection…' : 'Payer avec Stripe'}
            </Button>
          ) : (
            <p className="hint">
              Permission `billing:write` requise pour payer.
            </p>
          )}
        </form>
      )}

      <section>
        <h2>Paiements effectués</h2>
        <div className="table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Date &amp; heure</th>
                <th>Payeur</th>
                <th>Description</th>
                <th>Montant</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id}>
                  <td>{formatDateTime(p.paidAt ?? p.createdAt)}</td>
                  <td>
                    <strong>{p.payerName ?? '—'}</strong>
                    {p.payerEmail ? (
                      <>
                        <br />
                        <span className="hint">{p.payerEmail}</span>
                      </>
                    ) : null}
                  </td>
                  <td>{p.description ?? '—'}</td>
                  <td>{formatMoney(p.amount, p.currency)}</td>
                </tr>
              ))}
              {payments.length === 0 ? (
                <tr>
                  <td colSpan={4} className="hint">
                    Aucun paiement effectué pour le moment.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

export default function AdminPaymentsPage() {
  return (
    <Suspense
      fallback={
        <main style={layout.admin}>
          <p>Chargement…</p>
        </main>
      }
    >
      <AdminPaymentsContent />
    </Suspense>
  );
}
