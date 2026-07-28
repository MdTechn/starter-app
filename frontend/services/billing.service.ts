import { apiFetch } from '@/lib/api';

export type BillingPlan = {
  id: 'starter' | 'pro';
  name: string;
  description: string;
  features: string[];
  currency: string;
  amounts: { monthly: number; yearly: number };
};

export type PayableItem = {
  id: string;
  type: 'article' | 'subscription';
  name: string;
  description: string;
  amount: number;
  currency: string;
};

export type ProjectPayment = {
  id: string;
  amount: number;
  currency: string;
  status: string;
  description: string | null;
  payerName: string | null;
  payerEmail: string | null;
  paidAt: string | null;
  createdAt: string;
};

export type UserSubscription = {
  id: string;
  planId: string;
  interval: string;
  status: string;
  stripeSubscriptionId: string;
  stripePriceId: string;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  canceledAt: string | null;
};

export type FeatureAccessSummary = {
  planId: string | null;
  active: boolean;
  features: string[];
  memberLimit: number | null;
  canAccessAi: boolean;
  canAccessCmsAiRewrite: boolean;
};

export function getBillingPlans(token: string) {
  return apiFetch<{
    configured: boolean;
    publishableKey: string;
    plans: BillingPlan[];
  }>('/billing/plans', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function getUserSubscription(token: string) {
  return apiFetch<{
    subscription: UserSubscription | null;
    stripeCustomerId: string | null;
  }>('/billing/subscription', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function getFeatureAccess(token: string) {
  return apiFetch<FeatureAccessSummary>('/billing/features', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function createCheckout(
  token: string,
  body: {
    planId: 'starter' | 'pro';
    interval: 'MONTHLY' | 'YEARLY';
    cancelUrl?: string;
  },
) {
  return apiFetch<{ sessionId: string; url: string | null }>(
    '/billing/checkout',
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    },
  );
}

export function createCustomerPortal(token: string) {
  return apiFetch<{ url: string }>('/billing/customer-portal', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function getPayableItems(token: string) {
  return apiFetch<{
    configured: boolean;
    publishableKey: string;
    items: PayableItem[];
  }>('/billing/items', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function createItemCheckout(
  token: string,
  body: { itemId: string; cancelUrl?: string },
) {
  return apiFetch<{ sessionId: string; url: string | null }>(
    '/billing/checkout-item',
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    },
  );
}

export function listProjectPayments(token: string, limit = 50) {
  return apiFetch<ProjectPayment[]>(`/billing/payments?limit=${limit}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function syncCheckoutSession(token: string, sessionId: string) {
  return apiFetch<unknown>('/billing/checkout/sync', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ sessionId }),
  });
}
