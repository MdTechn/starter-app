# Stripe Billing (SaaS abonnement)

Facturation multi-tenant rattachée à **Organization** via `BillingAccount`.
Stripe reste la source de paiement — **aucune donnée carte** n’est stockée dans Prisma.

Les plans **starter / pro** passent par Checkout **`mode=subscription`**.

Par défaut, le montant vient du catalog `packages/shared/src/billing/plans.ts`
via **`price_data` + `recurring`** : Stripe crée Product/Price à la volée —
**aucune création manuelle dans le Dashboard n’est requise**.

Les `STRIPE_PRICE_*` restent **optionnels** (prod / Price IDs stables).

```
Organization ──1:1── BillingAccount ──1:1── StripeCustomer
                         │
                         ├── Subscription  (stripeSubscriptionId, status, currentPeriodEnd, …)
                         ├── Payment
                         └── Invoice
```

Le `stripeCustomerId` est stocké sur **StripeCustomer** (lié au BillingAccount),
pas en doublon sur Subscription.

## Variables d’environnement

```env
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PUBLIC_KEY=pk_test_...
# alias accepté : STRIPE_PUBLISHABLE_KEY

# Optionnel — Price IDs stables en prod (sinon price_data dynamique)
# STRIPE_PRICE_STARTER_MONTHLY=price_...
# STRIPE_PRICE_STARTER_YEARLY=price_...
# STRIPE_PRICE_PRO_MONTHLY=price_...
# STRIPE_PRICE_PRO_YEARLY=price_...
```

Optionnel :

```env
STRIPE_CHECKOUT_SUCCESS_URL=http://localhost:3000/billing/success?session_id={CHECKOUT_SESSION_ID}
STRIPE_CHECKOUT_CANCEL_URL=http://localhost:3000/billing?canceled=1
STRIPE_PORTAL_RETURN_URL=http://localhost:3000/billing
```

## Produits / prices

**Par défaut (recommandé starter) :** rien à créer dans Stripe Dashboard.
Le Checkout envoie `price_data` + `recurring` (month/year) depuis le catalog local.

**Optionnel (prod) :** créer des Prices récurrents dans le Dashboard et renseigner
`STRIPE_PRICE_*` pour des IDs stables (reporting, coupons, etc.).

Catalog applicatif (UI + entitlements) : `packages/shared/src/billing/plans.ts`
(`starter`, `pro`, `PLAN_ENTITLEMENTS`).

## Webhooks

### Endpoint

`POST /api/billing/webhooks/stripe` (public, signature Stripe obligatoire)

Événements à écouter :

| Event | Effet |
|-------|--------|
| `checkout.session.completed` | Lie StripeCustomer + sync Subscription (+ Payment projet) |
| `customer.subscription.created` | Upsert Subscription |
| `customer.subscription.updated` | Upsert statut / période / cancelAtPeriodEnd |
| `customer.subscription.deleted` | Marque CANCELED |
| `invoice.paid` | Upsert Invoice + Payment SUCCEEDED |
| `invoice.payment_failed` | Invoice OPEN + Payment FAILED + Subscription PAST_DUE |

### Local (Stripe CLI)

```bash
stripe listen --forward-to localhost:3001/api/billing/webhooks/stripe
# Copier le whsec_... affiché dans STRIPE_WEBHOOK_SECRET
```

### Production

1. Developers → Webhooks → Add endpoint  
   URL : `https://api.example.com/api/billing/webhooks/stripe`
2. Sélectionner les events ci-dessus
3. Copier le signing secret → `STRIPE_WEBHOOK_SECRET`

## API

| Méthode | Route | Permission |
|---------|-------|------------|
| GET | `/api/billing/plans` | `billing:read` |
| GET | `/api/billing/subscription` | `billing:read` |
| GET | `/api/billing/features` | `billing:read` |
| POST | `/api/billing/checkout` | `billing:write` |
| POST | `/api/billing/customer-portal` | `billing:write` |
| POST | `/api/billing/portal` | alias portal |
| POST | `/api/billing/checkout-item` | `billing:write` |
| GET | `/api/billing/payments` | `billing:read` |
| POST | `/api/billing/checkout/sync` | `billing:write` |
| POST | `/api/billing/webhooks/stripe` | public + signature |

`POST /checkout` crée une session **subscription** et rattache automatiquement
un BillingAccount (org existante de l’utilisateur, ou org personnelle `personal-{userId}`).

## Customer Portal

`POST /api/billing/customer-portal` → URL Stripe Billing Portal :

- voir / changer moyen de paiement
- annuler l’abonnement
- consulter les factures (selon config portal Stripe)

Prérequis : un `StripeCustomer` déjà créé (après un premier Checkout réussi).

## Feature gating

Service Nest `FeatureAccessService.canAccessFeature(userId, feature)` :

- basés sur abonnement **ACTIVE** / **TRIALING**
- plan **pro** : `ai`, `cms_ai_rewrite`, `priority_support`, `unlimited_members`
- plan **starter** : pas d’IA

Guards Nest (APP_GUARD, no-op sans metadata) :

- `@RequiresFeature('ai')` / `@RequiresFeature('cms_ai_rewrite')` — ex. `POST /ai/translate`, `POST /ai/rewrite`
- `@RequiresPlan('pro')` — exige un plan actif listé

Endpoint : `GET /api/billing/features` (résumé pour le frontend).

## Frontend

- `/billing` — plans, statut abo, **Gérer mon abonnement**, historique
- `/billing/success` — retour Checkout + sync

## Permissions

| Permission | Rôles |
|------------|--------|
| `billing:read` | USER, ADMIN |
| `billing:write` | USER, ADMIN |
| `billing:manage` | ADMIN |

## Sécurité

- Pas de PAN / CVC en base
- Webhook vérifié via `stripe.webhooks.constructEvent` + `rawBody`
- Customer Portal Stripe pour annulation / moyens de paiement
