# SaaS Starter

Socle technique monorepo industrialisable : **Next.js (App Router)** · **NestJS** · **Prisma** · **PostgreSQL** · **Docker** · **Swagger**.

Template réutilisable pour démarrer un nouveau projet SaaS avec qualité de code, CI/CD, tests et conventions prêtes à l'emploi.

## Architecture

```
starter/
├── backend/                 # API NestJS
│   └── src/
│       ├── common/            # Prisma, logger, filters, interceptors
│       ├── config/            # Configurations centralisées (env, DB, JWT…)
│       └── modules/           # Modules métier (auth, users, payments…)
├── frontend/                  # Next.js App Router
│   ├── app/                   # Routes et layouts
│   ├── components/            # Composants UI
│   ├── hooks/                 # Hooks React
│   ├── lib/                   # Utilitaires (API client…)
│   ├── services/              # Appels API métier
│   ├── providers/             # Context providers
│   └── types/                 # Types frontend
├── packages/shared/           # Types, enums, DTO partagés
├── prisma/                    # Schéma & migrations PostgreSQL
└── .github/workflows/         # CI GitHub Actions
```

| Dossier | Rôle |
|---------|------|
| `frontend/` | Next.js — UI, proxy `/api` → NestJS |
| `backend/` | NestJS — API REST, Swagger, logging, erreurs globales |
| `packages/shared/` | Types, interfaces, enums, DTO communs |
| `prisma/` | Schéma PostgreSQL partagé |

Les variables d'environnement sont **centralisées** à la racine (`.env` / `.env.example`).

## Prérequis

- Node.js 22+
- npm 10+
- Docker & Docker Compose (pour PostgreSQL et Keycloak)

## Installation

```bash
# 1. Cloner et configurer l'environnement
cp .env.example .env
# Éditer .env (DATABASE_URL, AUTH_SECRET, Keycloak…)

# 2. Installer les dépendances
npm install

# 3. Démarrer PostgreSQL + Keycloak
npm run db:up

# 4. Appliquer les migrations
npm run db:migrate:deploy

# 5. Lancer les serveurs de développement
npm run dev:api    # http://localhost:3001/api — Swagger http://localhost:3001/docs
npm run dev:web    # http://localhost:3000 — Login http://localhost:3000/login
```

Ou en une commande : `npm run dev` (frontend + backend).

## Docker

```bash
# Dev : Postgres + Keycloak + API + Web (hot reload)
npm run docker:dev

# Postgres + Keycloak uniquement
npm run db:up

# Prod : images multi-stage
npm run docker:prod
```

En production, les migrations Prisma sont appliquées automatiquement au démarrage du conteneur API.

## Keycloak (IAM)

Keycloak est le **fournisseur d'identité unique** du starter (OIDC). Les logins
sociaux (Google / Facebook) passent par le **broker Keycloak** — jamais via
NextAuth directement. Procédure OAuth : [`docs/SOCIAL_LOGIN.md`](docs/SOCIAL_LOGIN.md).

### Concepts

| Concept | Description |
|---------|-------------|
| **Realm** | Isolation IAM (`saas-realm`) : users, roles, clients, IdP. |
| **Clients** | `saas-web` (Next.js OIDC) · `saas-api` (validation JWT NestJS). |
| **Identity Brokers** | Google / Facebook (actifs) · Apple / Microsoft (stubs, `enabled: false`). |
| **Roles** | Rôles applicatifs `USER` / `ADMIN` mappés depuis Keycloak. |
| **Permissions** | Droits fins dérivés des rôles (`packages/shared` → `ROLE_PERMISSIONS`). |
| **Sync User** | Create/update/link Prisma (`keycloakSub`, email, profile, provider, status). |
| **Audit** | `LOGIN_SUCCESS`, `LOGIN_FAILED`, `LOGOUT`, `TOKEN_REFRESH`, `ACCOUNT_DISABLED`, `SOCIAL_LOGIN`. |

### Démarrage local

```bash
npm run db:up          # Postgres + Keycloak (import realm automatique)
npm run db:migrate:deploy
npm run dev
```

- **Console admin** : http://localhost:8090 (admin / admin)
- **Realm** : `saas-realm` (`keycloak/realm-saas.json`)
- **Comptes démo** : `admin` / `admin` (ADMIN), `user` / `user` (USER)
- **Thème login** : `saas-light` (fond blanc) — `keycloak/themes/saas-light`

```bash
npm run db:up
npm run keycloak:bootstrap   # applique loginTheme=saas-light sur le realm
```

### Flux d'authentification

1. `/login` → connexion Keycloak, **inscription** (`/registrations`), ou social (`kc_idp_hint`)
2. Session JWT avec `accessToken` + refresh Keycloak avant expiration
3. API : `Authorization: Bearer <access_token>`
4. Backend : JWT (issuer, JWKS, audience/azp, exp, roles, `identity_provider`) → permissions
5. Sync Prisma + audit (`LOGIN_SUCCESS` ou `SOCIAL_LOGIN`)
6. Logout : audit API + fin de session Keycloak (SSO) puis clear NextAuth

### Social Login (Epic 3)

| Élément | Détail |
|---------|--------|
| Doc | [`docs/SOCIAL_LOGIN.md`](docs/SOCIAL_LOGIN.md) |
| Realm IdP | `keycloak/realm-saas.json` |
| Frontend | Boutons Google/Facebook → `signIn('keycloak', …, { kc_idp_hint })` |
| Env | `GOOGLE_CLIENT_ID/SECRET`, `FACEBOOK_CLIENT_ID/SECRET` |

### Users & Admin (Epic 4)

Doc : [`docs/USERS_ADMIN.md`](docs/USERS_ADMIN.md). Les listes `/api/users` et `/api/admin/users` renvoient désormais un objet paginé `{ items, total, page, pageSize, totalPages }`.

### Stripe Billing (Epic 5)

Doc : [`docs/STRIPE_BILLING.md`](docs/STRIPE_BILLING.md).

| Élément | Détail |
|---------|--------|
| Modèles | `BillingAccount` ↔ Organization, `StripeCustomer`, `Subscription`, `Payment`, `Invoice` |
| Checkout | `POST /api/billing/checkout` (mensuel / annuel) |
| Portal | `POST /api/billing/portal` |
| Webhook | `POST /api/billing/webhooks/stripe` (signature vérifiée) |
| UI | `/billing`, `/billing/success` |
| Env | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PUBLIC_KEY`, `STRIPE_PRICE_*` |

### Notifications (Epic 6)

Doc : [`docs/NOTIFICATIONS.md`](docs/NOTIFICATIONS.md).

| Élément | Détail |
|---------|--------|
| Modèles | `Notification`, `NotificationTemplate`, `NotificationPreference` |
| Canaux | Email + in-app (SMS/Push stubs) |
| Événements | `USER_CREATED`, `USER_INVITED`, `LOGIN_SECURITY`, `SUBSCRIPTION_*`, `PAYMENT_*` |
| UI | `/notifications`, `/notifications/preferences` |
| Permissions | `notification:read`, `notification:manage` |
| Env | `SMTP_HOST`, `SMTP_PORT`, `SMTP_FROM`, … |

### Storage & Upload (Epic 7)

Doc : [`docs/STORAGE.md`](docs/STORAGE.md).

| Élément | Détail |
|---------|--------|
| Modèle | `FileAsset` (ownerType + ownerId génériques) |
| Providers | Local, S3, Cloudinary (stub) via `STORAGE_DRIVER` |
| API | `/api/storage/upload`, `/files`, `/content/:id` |
| UI | `/storage`, composant `FileUpload` |
| Permissions | `upload:read\|write\|delete\|manage` |
| Env | `STORAGE_DRIVER`, `STORAGE_PATH`, `S3_*` |

### Observabilité (Epic 8)

Doc : [`docs/OBSERVABILITY.md`](docs/OBSERVABILITY.md).

| Élément | Détail |
|---------|--------|
| Redis / BullMQ | Cache + jobs (fallback sync) |
| Health | `/api/health/live`, `/ready`, `/status` (admin) |
| Métriques | `GET /metrics` (Prometheus) |
| OTEL | structure minimale (`OTEL_ENABLED`) |
| UI | `/admin/system` |
| Env | `REDIS_*`, `CACHE_*`, `PROMETHEUS_*`, `OTEL_*` |

### CMS Multilingue (Epic 9 — Phase 1)

Doc : [`docs/CMS.md`](docs/CMS.md).

| Élément | Détail |
|---------|--------|
| Modèles | `CmsFolder`, `CmsArticle`, `CmsTranslation`, `CmsVersion` |
| Statuts | `DRAFT`, `REVIEW`, `PUBLISHED`, `ARCHIVED` |
| API | `/api/cms/folders`, `/api/cms/articles`, traductions, versions |
| UI | `/cms`, `/cms/articles/[id]` |
| Permissions | `cms:read`, `cms:write`, `cms:publish`, `cms:manage` |
| Événements | `CMS_CREATED`, `CMS_UPDATED`, `CMS_PUBLISHED` |
| Prep | IA / SEO / Workflow (colonnes présentes, non branchées) |

### White Label (Epic 11)

Doc : [`docs/WHITE_LABEL.md`](docs/WHITE_LABEL.md).

| Élément | Détail |
|---------|--------|
| Config | `BrandConfig` via env (`APP_NAME`, `PRIMARY_COLOR`, …) |
| Assets | dossier `branding/` |
| API | `GET /api/brand`, `/api/brand/preview` |
| UI | login/dashboard + `/admin/branding` |
| Emails | from + HTML brandés |

### Administration IAM

Endpoints `ADMIN` + permissions `iam:manage` / `users:*` / `audit:read` :

| Méthode | Route | Action |
|---------|-------|--------|
| GET | `/api/users` | Liste paginée (recherche, filtres) |
| GET | `/api/users/:id` | Détail |
| POST | `/api/users` | Créer (lié à un `keycloakSub` existant — **pas de mot de passe**) |
| PATCH | `/api/users/me` | Profil courant |
| PATCH | `/api/users/:id` | Profil (nom, prénom, avatar) |
| PATCH | `/api/users/:id/status` | Statut ACTIVE / DISABLED / DELETED |
| DELETE | `/api/users/:id` | Soft-delete |
| GET | `/api/admin/users` | Liste admin (mêmes filtres) |
| GET | `/api/admin/users/:id` | Détail + permissions résolues |
| PATCH | `/api/admin/users/:id/disable` | Désactiver |
| PATCH | `/api/admin/users/:id/enable` | Réactiver |
| PATCH | `/api/admin/users/:id/deleted-from-idp` | Soft-delete si user Keycloak supprimé |
| PATCH | `/api/admin/users/:id/roles` | Mettre à jour rôles |
| GET | `/api/admin/roles/permissions` | Mapping rôles → permissions |
| GET | `/api/admin/audit` | Journal d'audit |
| GET/POST | `/api/admin/invitations` | Invitations (préparation, sans envoi email) |
| PATCH | `/api/admin/invitations/:id/revoke` | Révoquer invitation |
| GET/POST | `/api/organizations` | Organisations (multi-tenant **préparé**, non branché auth) |

### UI Admin

| Page | Route |
|------|-------|
| Liste utilisateurs | `/admin` |
| Détail + actions | `/admin/users/[id]` |
| Audit | `/admin/audit` |

Accès UI réservé au rôle `ADMIN` (middleware + permissions API).

### Multi-tenant (préparation)

Modèles `Organization`, `OrganizationMember` (rôle **par org**), `UserInvitation`.
APIs CRUD disponibles — **non activées** sur le flux d'auth / session.

### Backend (référence)

| Élément | Emplacement |
|---------|-------------|
| Validation JWT | `modules/keycloak/keycloak-jwt.service.ts` |
| Sync Prisma | `modules/keycloak/keycloak-user-sync.service.ts` |
| Guards | auth / roles / permissions |
| Audit | `modules/auth/auth-audit.service.ts` |
| Users CRUD | `modules/users/` |
| Admin IAM | `modules/admin/` |
| Organizations (prep) | `modules/organizations/` |
| Billing Stripe | `modules/payments/` |
| Mapping permissions | `packages/shared/src/auth/role-permissions.ts` |

Routes publiques : `@Public()` (ex. `/api/health`). Sinon token requis si `KEYCLOAK_ENABLED=true`.

### Frontend

| Élément | Fichier |
|---------|---------|
| NextAuth + refresh | `frontend/auth.ts` |
| Provider | `frontend/providers/auth-provider.tsx` |
| Hook (+ logout audit) | `frontend/hooks/use-auth.ts` |
| Permissions UI | `frontend/hooks/use-permissions.ts` |
| Admin pages | `frontend/app/admin/` |
| Middleware | `frontend/middleware.ts` |

### Variables clés

```
KEYCLOAK_ENABLED=true
KEYCLOAK_URL=http://localhost:8080
KEYCLOAK_REALM=saas-realm
KEYCLOAK_CLIENT_ID=saas-api
KEYCLOAK_AUDIENCE=saas-web
AUTH_KEYCLOAK_ID=saas-web
AUTH_KEYCLOAK_ISSUER=http://localhost:8080/realms/saas-realm
AUTH_SECRET=<openssl rand -base64 32>
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
FACEBOOK_CLIENT_ID=
FACEBOOK_CLIENT_SECRET=
```

### Désactiver Keycloak (tests / CI)

```
KEYCLOAK_ENABLED=false
```

Les guards sont alors inactifs ; health et Swagger restent accessibles.

## Prisma

| Commande | Description |
|----------|-------------|
| `npm run db:up` | Démarrer PostgreSQL + Keycloak (Docker) |
| `npm run keycloak:bootstrap` | Appliquer le thème login `saas-light` (fond blanc) |
| `npm run db:down` | Arrêter les conteneurs |
| `npm run db:migrate` | Créer/appliquer une migration (dev) |
| `npm run db:migrate:deploy` | Appliquer les migrations (CI/prod) |
| `npm run db:studio` | Ouvrir Prisma Studio |
| `npm run db:generate` | Régénérer le client Prisma |

## Scripts

| Commande | Description |
|----------|-------------|
| `npm run dev` | Frontend + backend en parallèle |
| `npm run dev:web` | Frontend seul (port 3000) |
| `npm run dev:api` | Backend seul (port 3001) |
| `npm run build` | Build backend + frontend |
| `npm run lint` | ESLint sur tous les workspaces |
| `npm run test` | Tests backend (Jest) |
| `npm run format` | Prettier sur tout le monorepo |
| `npm run format:check` | Vérifier le formatage |

## Qualité de code

- **ESLint** + **Prettier** : formatage et linting unifiés
- **Husky** + **lint-staged** : vérifications avant chaque commit
- **Commitlint** : conventions [Conventional Commits](https://www.conventionalcommits.org/)

Exemples de messages de commit :

```
feat(auth): add keycloak integration
fix(api): handle prisma connection errors
docs(readme): update deployment section
chore(ci): add github actions workflow
```

## Modules backend (préparés)

Les modules suivants sont créés vides, prêts à être implémentés :

| Module | Rôle prévu |
|--------|------------|
| `auth` | Authentification |
| `users` | Gestion utilisateurs |
| `keycloak` | Intégration IAM Keycloak |
| `payments` | Paiements Stripe |
| `notifications` | Emails / notifications |
| `storage` | Fichiers (local / S3 / Cloudinary stub) |
| `health` | Probes liveness/readiness |

## Configurations backend

Fichiers dans `backend/src/config/` :

| Fichier | Variables |
|---------|-----------|
| `database.config.ts` | `DATABASE_URL` |
| `jwt.config.ts` | `JWT_SECRET`, `JWT_EXPIRES_IN` |
| `keycloak.config.ts` | `KEYCLOAK_*` |
| `stripe.config.ts` | `STRIPE_*` |
| `mail.config.ts` | `SMTP_*`, `EMAIL_FROM` |
| `storage.config.ts` | `STORAGE_*`, `AWS_*`, `S3_*` |
| `redis.config.ts` | `REDIS_*` |
| `cache.config.ts` | `CACHE_*` |
| `observability.config.ts` | `PROMETHEUS_*`, `OTEL_*`, `HTTP_*`, `API_VERSION` |
| `oauth.config.ts` | `GOOGLE_*`, `FACEBOOK_*` |

Validation Zod au démarrage via `env.validation.ts`.

## Variables d'environnement

Voir `.env.example` pour la liste complète. Variables obligatoires au minimum :

- `DATABASE_URL` — connexion PostgreSQL

Les autres variables (Keycloak, Stripe, SMTP, Storage, Redis, OAuth) sont optionnelles et documentées dans `.env.example`.

## Tests

```bash
npm run test           # Tous les tests backend
npm run test -w backend -- --watch   # Mode watch
npm run test -w backend -- --coverage # Couverture
```

Tests couverts :
- Validation de configuration (`env.validation`)
- Configurations nommées (database, jwt, keycloak…)
- Health check controller
- Filtre global d'exceptions
- Validation JWT Keycloak, guards auth/rôles
- Synchronisation utilisateur Keycloak → Prisma

## CI/CD

GitHub Actions (`.github/workflows/ci.yml`) exécute sur chaque push/PR :

1. `npm ci`
2. `npm run lint`
3. `npm run test`
4. `npm run build`

## Déploiement

### Docker Compose (recommandé)

```bash
cp .env.example .env
# Configurer les variables de production
npm run docker:prod
```

### Manuel

```bash
npm ci
npm run db:migrate:deploy
npm run build
npm run start:prod -w backend
npm run start -w frontend
```

## Créer un nouveau projet à partir de ce starter

1. **Cloner** le dépôt ou utiliser « Use this template » sur GitHub
2. **Renommer** le projet dans `package.json` (racine, frontend, backend, shared)
3. **Configurer** `.env` à partir de `.env.example`
4. **Adapter** le schéma Prisma (`prisma/schema.prisma`) à votre domaine
5. **Implémenter** les modules métier dans `backend/src/modules/`
6. **Développer** l'UI dans `frontend/`
7. **Partager** types/DTO via `packages/shared/`

## API

- **Health** (public) : `GET /api/health`, `/live`, `/ready`, `/db` — admin : `/status`
- **Metrics** : `GET /metrics`
- **Auth** (protégé) : `GET /api/auth/me`, `POST /api/auth/logout`
- **Users** : `GET/PATCH /api/users/me`, CRUD admin `/api/users`
- **Admin** : `/api/admin/users`, `/api/admin/audit`, `/api/admin/invitations`
- **Organizations** (prep) : `/api/organizations`
- **Billing** : `/api/billing/plans`, checkout, portal, payments, invoices ; webhook `/api/billing/webhooks/stripe`
- **Swagger** : `http://localhost:3001/docs` (si `SWAGGER_ENABLED=true`)

## Licence

UNLICENSED — usage interne / template.
