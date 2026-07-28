'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { Permission } from '@saas-starter/shared';
import { Badge, Button } from '@/components/ui';
import { layout } from '@/lib/components';
import { useAuth } from '@/hooks/use-auth';
import { usePermissions } from '@/hooks/use-permissions';
import { useToast } from '@/providers';
import {
  createCheckout,
  createCustomerPortal,
  getBillingPlans,
  getUserSubscription,
  type BillingPlan,
  type UserSubscription,
} from '@/services/billing.service';

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(amount / 100);
}

function formatDate(value: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('fr-FR', {
    dateStyle: 'long',
  });
}

function planLabel(planId: string) {
  if (planId === 'pro') return 'Pro';
  if (planId === 'starter') return 'Starter';
  return planId;
}

function intervalLabel(interval: string) {
  return interval === 'YEARLY' ? 'Annuel' : 'Mensuel';
}

function statusMeta(status: string): {
  label: string;
  variant: 'success' | 'warning' | 'error' | 'secondary' | 'outline';
} {
  switch (status) {
    case 'ACTIVE':
      return { label: 'Actif', variant: 'success' };
    case 'TRIALING':
      return { label: 'Essai', variant: 'success' };
    case 'PAST_DUE':
      return { label: 'Paiement en retard', variant: 'warning' };
    case 'CANCELED':
      return { label: 'Annulé', variant: 'error' };
    case 'UNPAID':
      return { label: 'Impayé', variant: 'error' };
    case 'INCOMPLETE':
    case 'INCOMPLETE_EXPIRED':
      return { label: 'Incomplet', variant: 'warning' };
    case 'PAUSED':
      return { label: 'En pause', variant: 'secondary' };
    default:
      return { label: status, variant: 'outline' };
  }
}

function SubscriptionStatusCard({
  subscription,
  loading,
  userEmail,
  canManage,
  busy,
  configured,
  onManage,
}: {
  subscription: UserSubscription | null;
  loading: boolean;
  userEmail?: string | null;
  canManage: boolean;
  busy: boolean;
  configured: boolean;
  onManage: () => void;
}) {
  if (loading) {
    return (
      <section className="subscription-status" aria-busy="true">
        <h2>Mon abonnement</h2>
        <p className="hint">Chargement du statut…</p>
      </section>
    );
  }

  if (!subscription) {
    return (
      <section className="subscription-status">
        <div className="subscription-status-header">
          <h2>Mon abonnement</h2>
          <Badge variant="secondary">Aucun abonnement</Badge>
        </div>
        {userEmail ? <p className="hint">Compte : {userEmail}</p> : null}
        <p>
          Vous n’avez pas encore d’abonnement actif. Choisissez un plan
          ci-dessous pour démarrer.
        </p>
      </section>
    );
  }

  const status = statusMeta(subscription.status);
  const isActive =
    subscription.status === 'ACTIVE' || subscription.status === 'TRIALING';

  return (
    <section className="subscription-status" data-active={isActive ? '1' : '0'}>
      <div className="subscription-status-header">
        <h2>Mon abonnement</h2>
        <Badge variant={status.variant}>{status.label}</Badge>
      </div>
      {userEmail ? <p className="hint">Compte : {userEmail}</p> : null}
      <dl className="subscription-status-grid">
        <div>
          <dt>Plan</dt>
          <dd>{planLabel(subscription.planId)}</dd>
        </div>
        <div>
          <dt>Facturation</dt>
          <dd>{intervalLabel(subscription.interval)}</dd>
        </div>
        <div>
          <dt>Fin de période</dt>
          <dd>{formatDate(subscription.currentPeriodEnd)}</dd>
        </div>
        <div>
          <dt>Résiliation</dt>
          <dd>
            {subscription.cancelAtPeriodEnd
              ? 'Prévue en fin de période'
              : 'Non'}
          </dd>
        </div>
      </dl>
      {canManage ? (
        <div className="subscription-status-actions">
          <Button
            variant="social"
            disabled={busy || !configured}
            onClick={onManage}
          >
            Gérer mon abonnement
          </Button>
        </div>
      ) : null}
    </section>
  );
}

function BillingContent() {
  const { accessToken, session } = useAuth();
  const { can } = usePermissions();
  const toast = useToast();
  const searchParams = useSearchParams();
  const canceled = searchParams.get('canceled');

  const [plans, setPlans] = useState<BillingPlan[]>([]);
  const [subscription, setSubscription] = useState<UserSubscription | null>(
    null,
  );
  const [hasStripeCustomer, setHasStripeCustomer] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [interval, setInterval] = useState<'MONTHLY' | 'YEARLY'>('MONTHLY');
  const [busy, setBusy] = useState(false);
  const [subLoading, setSubLoading] = useState(true);

  const canRead = can(Permission.BILLING_READ);
  const canWrite = can(Permission.BILLING_WRITE);
  const userEmail = session?.user?.email ?? null;
  const activePlanId =
    subscription &&
    (subscription.status === 'ACTIVE' || subscription.status === 'TRIALING')
      ? subscription.planId
      : null;

  const load = useCallback(async () => {
    if (!accessToken || !canRead) return;
    setSubLoading(true);
    try {
      const [planData, subData] = await Promise.all([
        getBillingPlans(accessToken),
        getUserSubscription(accessToken).catch(() => ({
          subscription: null,
          stripeCustomerId: null,
        })),
      ]);
      setPlans(planData.plans);
      setConfigured(planData.configured);
      setSubscription(subData.subscription);
      setHasStripeCustomer(Boolean(subData.stripeCustomerId));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur billing');
    } finally {
      setSubLoading(false);
    }
  }, [accessToken, canRead, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (canceled) {
      toast.warning('Checkout annulé.');
    }
  }, [canceled, toast]);

  const startCheckout = async (planId: 'starter' | 'pro') => {
    if (!accessToken) return;
    setBusy(true);
    try {
      const checkout = await createCheckout(accessToken, {
        planId,
        interval,
        cancelUrl: `${window.location.origin}/billing?canceled=1`,
      });
      if (!checkout.url) throw new Error('URL checkout manquante');
      toast.info('Redirection vers Stripe…');
      window.location.href = checkout.url;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Checkout impossible');
      setBusy(false);
    }
  };

  const openPortal = async () => {
    if (!accessToken) return;
    setBusy(true);
    try {
      const portal = await createCustomerPortal(accessToken);
      if (!portal.url) throw new Error('URL portal manquante');
      toast.info('Ouverture du portail client…');
      window.location.href = portal.url;
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Ouverture du portal impossible',
      );
      setBusy(false);
    }
  };

  if (!canRead) {
    return (
      <main className="admin" style={layout.main}>
        <p className="error">Accès billing refusé.</p>
      </main>
    );
  }

  return (
    <main className="admin billing" style={layout.main}>
      <header className="admin-header">
        <div>
          <h1>Abonnement</h1>
          <p>
            Consultez votre statut, souscrivez un plan, ou gérez votre
            abonnement Stripe.
          </p>
        </div>
      </header>

      {!configured ? (
        <p className="hint">
          Stripe non configuré (`STRIPE_SECRET_KEY`). Voir{' '}
          <code>docs/STRIPE_BILLING.md</code>.
        </p>
      ) : null}

      <SubscriptionStatusCard
        subscription={subscription}
        loading={subLoading}
        userEmail={userEmail}
        canManage={Boolean(canWrite && (hasStripeCustomer || subscription))}
        busy={busy}
        configured={configured}
        onManage={() => void openPortal()}
      />

      <section className="plan-grid">
        <div className="admin-filters">
          <Button
            variant={interval === 'MONTHLY' ? 'primary' : 'social'}
            onClick={() => setInterval('MONTHLY')}
          >
            Mensuel
          </Button>
          <Button
            variant={interval === 'YEARLY' ? 'primary' : 'social'}
            onClick={() => setInterval('YEARLY')}
          >
            Annuel
          </Button>
        </div>

        {plans.map((plan) => {
          const amount =
            interval === 'MONTHLY' ? plan.amounts.monthly : plan.amounts.yearly;
          const isCurrent = activePlanId === plan.id;
          return (
            <article
              key={plan.id}
              className={`plan-card${isCurrent ? ' plan-card-current' : ''}`}
            >
              <div className="plan-card-title">
                <h2>{plan.name}</h2>
                {isCurrent ? (
                  <Badge variant="success" size="small">
                    Plan actuel
                  </Badge>
                ) : null}
              </div>
              <p className="plan-price">
                {formatMoney(amount, plan.currency)}
                <span> / {interval === 'MONTHLY' ? 'mois' : 'an'}</span>
              </p>
              <p>{plan.description}</p>
              <ul>
                {plan.features.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
              {canWrite ? (
                <Button
                  variant="primary"
                  disabled={busy || !configured || isCurrent}
                  onClick={() => void startCheckout(plan.id)}
                >
                  {isCurrent ? 'Plan actuel' : "S'abonner avec Stripe"}
                </Button>
              ) : null}
            </article>
          );
        })}
      </section>
    </main>
  );
}

export default function BillingPage() {
  return (
    <Suspense
      fallback={
        <main style={layout.main}>
          <p>Chargement…</p>
        </main>
      }
    >
      <BillingContent />
    </Suspense>
  );
}
