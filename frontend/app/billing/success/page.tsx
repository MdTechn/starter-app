'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { layout } from '@/lib/components';
import { useAuth } from '@/hooks/use-auth';
import { syncCheckoutSession } from '@/services/billing.service';

function formatPaidAt(date: Date) {
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function SuccessIcon() {
  return (
    <span className="payment-success-icon" aria-hidden="true">
      <svg
        viewBox="0 0 24 24"
        width="40"
        height="40"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M20 6 9 17l-5-5" />
      </svg>
    </span>
  );
}

function SuccessContent() {
  const params = useSearchParams();
  const sessionId = params.get('session_id');
  const { accessToken } = useAuth();
  const [synced, setSynced] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const paidAt = useMemo(() => formatPaidAt(new Date()), []);

  useEffect(() => {
    if (!accessToken || !sessionId || synced) return;
    void syncCheckoutSession(accessToken, sessionId)
      .then(() => {
        setSynced(true);
        setSyncError(null);
      })
      .catch((err) => {
        setSyncError(
          err instanceof Error ? err.message : 'Sync paiement impossible',
        );
      });
  }, [accessToken, sessionId, synced]);

  return (
    <main className="payment-success" style={layout.main}>
      <div className="payment-success-card">
        <SuccessIcon />
        <h1>Paiement effectué</h1>
        <p className="payment-success-date">{paidAt}</p>
        {sessionId ? (
          <p className="payment-success-tx">
            Transaction ID&nbsp;: <span>{sessionId}</span>
          </p>
        ) : (
          <p className="payment-success-tx">Transaction confirmée par Stripe</p>
        )}

        {synced ? (
          <p className="ok payment-success-sync" role="status">
            Abonnement synchronisé.
          </p>
        ) : null}
        {syncError ? (
          <p className="hint payment-success-sync" role="status">
            Enregistrement différé : le webhook finalisera la sync.
          </p>
        ) : null}

        <div className="payment-success-actions">
          <Link href="/billing" className="payment-success-cta">
            Voir mon abonnement
          </Link>
          <Link className="payment-success-secondary" href="/dashboard">
            Retour au dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}

export default function BillingSuccessPage() {
  return (
    <Suspense
      fallback={
        <main className="payment-success" style={layout.main}>
          <p className="hint">Confirmation en cours…</p>
        </main>
      }
    >
      <SuccessContent />
    </Suspense>
  );
}
