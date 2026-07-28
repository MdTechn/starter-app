export type BillingInterval = 'MONTHLY' | 'YEARLY';

export type SubscriptionStatus =
  | 'TRIALING'
  | 'ACTIVE'
  | 'PAST_DUE'
  | 'CANCELED'
  | 'UNPAID'
  | 'INCOMPLETE'
  | 'INCOMPLETE_EXPIRED'
  | 'PAUSED';

export type BillingPlanId = 'starter' | 'pro';

/** Features product gated by active subscription plan. */
export type PlanFeature =
  'ai' | 'cms_ai_rewrite' | 'priority_support' | 'unlimited_members';

export type PlanEntitlements = {
  features: readonly PlanFeature[];
  /** Max org members; null = unlimited */
  memberLimit: number | null;
};

export type BillingPlan = {
  id: BillingPlanId;
  name: string;
  description: string;
  features: string[];
  currency: string;
  /** Montants en centimes (affichage UI ; Checkout SaaS utilise STRIPE_PRICE_*_ID). */
  amounts: {
    monthly: number;
    yearly: number;
  };
};

/** Catalog réutilisable — montants pour UI ; Stripe Price IDs via env. */
export const BILLING_PLANS: readonly BillingPlan[] = [
  {
    id: 'starter',
    name: 'Starter',
    description: 'Pour démarrer un SaaS solo ou petite équipe.',
    features: ['1 organisation', 'Jusqu’à 5 membres', 'Support email'],
    currency: 'eur',
    amounts: {
      monthly: 900,
      yearly: 9000,
    },
  },
  {
    id: 'pro',
    name: 'Pro',
    description: 'Pour les équipes en croissance.',
    features: [
      'Organisations illimitées*',
      'Membres illimités',
      'Support prioritaire',
      'Accès IA',
    ],
    currency: 'eur',
    amounts: {
      monthly: 2900,
      yearly: 29000,
    },
  },
] as const;

/** Entitlements utilisés par `canAccessFeature` / limites plan. */
export const PLAN_ENTITLEMENTS: Record<BillingPlanId, PlanEntitlements> = {
  starter: {
    features: [],
    memberLimit: 5,
  },
  pro: {
    features: ['ai', 'cms_ai_rewrite', 'priority_support', 'unlimited_members'],
    memberLimit: null,
  },
};

export function getPlanEntitlements(
  planId: string,
): PlanEntitlements | undefined {
  if (planId === 'starter' || planId === 'pro') {
    return PLAN_ENTITLEMENTS[planId];
  }
  return undefined;
}

export function planHasFeature(planId: string, feature: PlanFeature): boolean {
  const entitlements = getPlanEntitlements(planId);
  if (!entitlements) return false;
  return entitlements.features.includes(feature);
}

export function getPlanAmount(
  planId: BillingPlanId,
  interval: BillingInterval,
): number | undefined {
  const plan = getBillingPlan(planId);
  if (!plan) return undefined;
  return interval === 'YEARLY' ? plan.amounts.yearly : plan.amounts.monthly;
}

export function getBillingPlan(planId: string): BillingPlan | undefined {
  return BILLING_PLANS.find((p) => p.id === planId);
}

/** Statuts considérés comme abonnement « actif » pour l’accès produit. */
export const ACTIVE_SUBSCRIPTION_STATUSES: readonly SubscriptionStatus[] = [
  'TRIALING',
  'ACTIVE',
] as const;

export function isSubscriptionActive(
  status?: SubscriptionStatus | string | null,
): boolean {
  if (!status) return false;
  return (ACTIVE_SUBSCRIPTION_STATUSES as readonly string[]).includes(status);
}

/** Articles / abonnements payables (catalogue projet — Checkout `price_data`). */
export type PayableItemType = 'article' | 'subscription';

export type PayableItem = {
  id: string;
  type: PayableItemType;
  name: string;
  description: string;
  /** Montant en centimes */
  amount: number;
  currency: string;
};

export const PAYABLE_ITEMS: readonly PayableItem[] = [
  {
    id: 'article-guide',
    type: 'article',
    name: 'Article — Guide démarrage',
    description: 'Accès unique au guide de démarrage du starter.',
    amount: 500,
    currency: 'eur',
  },
  {
    id: 'article-premium',
    type: 'article',
    name: 'Article — Contenu premium',
    description: 'Pack d’articles premium du projet.',
    amount: 1500,
    currency: 'eur',
  },
  {
    id: 'sub-starter-monthly',
    type: 'subscription',
    name: 'Abonnement Starter (mensuel)',
    description: 'Accès Starter pour 1 mois.',
    amount: 900,
    currency: 'eur',
  },
  {
    id: 'sub-starter-yearly',
    type: 'subscription',
    name: 'Abonnement Starter (annuel)',
    description: 'Accès Starter pour 1 an.',
    amount: 9000,
    currency: 'eur',
  },
  {
    id: 'sub-pro-monthly',
    type: 'subscription',
    name: 'Abonnement Pro (mensuel)',
    description: 'Accès Pro pour 1 mois.',
    amount: 2900,
    currency: 'eur',
  },
  {
    id: 'sub-pro-yearly',
    type: 'subscription',
    name: 'Abonnement Pro (annuel)',
    description: 'Accès Pro pour 1 an.',
    amount: 29000,
    currency: 'eur',
  },
] as const;

export function getPayableItem(itemId: string): PayableItem | undefined {
  return PAYABLE_ITEMS.find((item) => item.id === itemId);
}
