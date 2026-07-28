export type DocsEnvVar = {
  name: string;
  hint?: string;
};

export type DocsSection = {
  id: string;
  title: string;
  summary: string;
  steps?: string[];
  env?: DocsEnvVar[];
  routes?: string[];
  docs?: string;
  notes?: string[];
};

export const DOCS_SECTIONS: DocsSection[] = [
  {
    id: 'demarrage',
    title: 'Démarrage rapide',
    summary:
      'Installer le monorepo Next.js + NestJS + Prisma + Keycloak et lancer l’environnement local.',
    steps: [
      'Copier `cp .env.example .env` puis ajuster les secrets.',
      'Installer : `npm install`.',
      'Démarrer Postgres + Keycloak + Redis : `npm run db:up`.',
      'Appliquer les migrations : `npm run db:migrate:deploy`.',
      'Lancer API + Web : `npm run dev` (ou `dev:api` / `dev:web`).',
      'Optionnel : `npm run keycloak:bootstrap` pour le thème login `saas-light`.',
      'Si Keycloak ne démarre pas : vérifier que `keycloak/realm-saas.json` est du JSON valide.',
    ],
    routes: [
      'http://localhost:3000 — cette documentation',
      'http://localhost:3000/login — connexion',
      'http://localhost:3001/docs — Swagger',
      'http://localhost:8090 — console Keycloak (admin / admin)',
    ],
    notes: [
      'Comptes démo Keycloak : `admin` / `admin` (ADMIN), `user` / `user` (USER).',
      'Node.js 22+ et Docker sont requis.',
    ],
  },
  {
    id: 'environnement',
    title: 'Environnement (.env)',
    summary:
      'Toutes les variables sont centralisées à la racine du monorepo (`.env` / `.env.example`).',
    steps: [
      'Ne jamais committer `.env` (secrets).',
      'Frontend et backend lisent le même fichier via la racine.',
      'Après modification, redémarrer `dev:api` et `dev:web`.',
      'Après changement des secrets Google/Facebook/Apple/Microsoft : redémarrer Keycloak (`docker compose restart keycloak`).',
    ],
    env: [
      { name: 'NODE_ENV', hint: 'development | production' },
      { name: 'NEXT_PUBLIC_API_URL', hint: 'http://localhost:3001/api' },
      { name: 'FRONTEND_URL', hint: 'http://localhost:3000' },
      { name: 'DATABASE_URL', hint: 'PostgreSQL Prisma' },
      { name: 'PORT', hint: 'API NestJS (3001)' },
      { name: 'SWAGGER_ENABLED', hint: 'true en local' },
    ],
  },
  {
    id: 'auth-keycloak',
    title: 'Auth & Keycloak',
    summary:
      'Keycloak est le fournisseur d’identité unique (OIDC). NextAuth gère la session web ; NestJS valide les JWT.',
    steps: [
      'Activer `KEYCLOAK_ENABLED=true`.',
      'Configurer issuer / clients `saas-web` (frontend) et validation API.',
      'Générer `AUTH_SECRET` : `openssl rand -base64 32`.',
      'Vérifier le realm `saas-realm` importé depuis `keycloak/realm-saas.json`.',
      'Tester `/login` → redirection Keycloak → retour session.',
    ],
    env: [
      { name: 'KEYCLOAK_ENABLED' },
      { name: 'KEYCLOAK_URL', hint: 'http://localhost:8090' },
      { name: 'KEYCLOAK_REALM', hint: 'saas-realm' },
      { name: 'KEYCLOAK_CLIENT_ID' },
      { name: 'KEYCLOAK_CLIENT_SECRET' },
      { name: 'KEYCLOAK_AUDIENCE' },
      { name: 'AUTH_SECRET' },
      { name: 'AUTH_KEYCLOAK_ID', hint: 'saas-web' },
      { name: 'AUTH_KEYCLOAK_ISSUER' },
      {
        name: 'AUTH_KEYCLOAK_SECRET',
        hint: 'doit matcher le secret client Keycloak',
      },
    ],
    routes: ['/login', '/dashboard', '/api/auth/*'],
    notes: [
      'Rôles applicatifs : `USER` / `ADMIN` mappés depuis Keycloak.',
      'Pour CI/tests : `KEYCLOAK_ENABLED=false` désactive les guards.',
      'Erreur NextAuth `Configuration` / `fetch failed` : Keycloak down ou realm JSON invalide.',
    ],
  },
  {
    id: 'social-login',
    title: 'Social Login',
    summary:
      'Google / Facebook / Apple / Microsoft via le broker Keycloak (`kc_idp_hint`) — jamais via NextAuth directement.',
    steps: [
      'Créer les apps OAuth (Google, Facebook ; Apple / Microsoft optionnels).',
      'Configurer les Identity Providers dans Keycloak (realm `saas-realm`).',
      'Renseigner les credentials dans `.env` puis redémarrer Keycloak.',
      'Les boutons login appellent `signIn("keycloak", …, { kc_idp_hint })`.',
      'Apple / Microsoft : IdP présents dans le realm avec `enabled: false` — activer après config OAuth.',
    ],
    env: [
      { name: 'GOOGLE_CLIENT_ID' },
      { name: 'GOOGLE_CLIENT_SECRET' },
      { name: 'FACEBOOK_CLIENT_ID' },
      { name: 'FACEBOOK_CLIENT_SECRET' },
      { name: 'APPLE_CLIENT_ID', hint: 'activer l’IdP apple dans le realm' },
      { name: 'APPLE_CLIENT_SECRET' },
      {
        name: 'MICROSOFT_CLIENT_ID',
        hint: 'activer l’IdP microsoft dans le realm',
      },
      { name: 'MICROSOFT_CLIENT_SECRET' },
    ],
    routes: ['/login'],
    docs: 'docs/SOCIAL_LOGIN.md',
    notes: [
      'Redirect URI côté provider = broker Keycloak, pas Next.js.',
      'Exemple Google : `http://localhost:8090/realms/saas-realm/broker/google/endpoint`.',
      'Sync Prisma : claim `identity_provider` → `GOOGLE` | `FACEBOOK` | `APPLE` | `MICROSOFT`.',
    ],
  },
  {
    id: 'organizations',
    title: 'Organisations (multi-tenant)',
    summary:
      'Org active côté UI, filtre `organizationId` sur le CMS, invitations SMTP et limite de membres selon le plan Stripe.',
    steps: [
      'Switcher d’organisation dans la sidebar (persistance `localStorage`).',
      'Gérer membres / invitations : `/settings/organization` (alias `/admin/organization`).',
      'Inviter un email → email SMTP `USER_INVITED` avec lien `/login?invite=<token>`.',
      'Après login, l’invitation est acceptée automatiquement (email doit correspondre).',
      'Création CMS : l’`organizationId` actif est envoyé à l’API.',
    ],
    routes: [
      '/settings/organization',
      '/admin/organization',
      'GET /api/organizations',
      'POST /api/organizations/invitations/accept',
      'POST /api/admin/invitations',
    ],
    docs: 'docs/USERS_ADMIN.md',
    notes: [
      'ADMIN voit toutes les orgs ; les autres uniquement leurs memberships.',
      'Plan Starter : max 5 membres (membres + invitations pending). Pro : illimité.',
      '403 `ORG_MEMBER_LIMIT` si la limite est atteinte — upgrade via `/billing`.',
      'Guards Nest : `@RequiresFeature()` / `@RequiresPlan()` pour le gating produit.',
    ],
  },
  {
    id: 'users-admin',
    title: 'Users & Admin',
    summary:
      'Gestion IAM : listes paginées, profils, rôles, audit, invitations email SMTP.',
    steps: [
      'Se connecter avec un compte `ADMIN`.',
      'Ouvrir `/admin` pour la liste utilisateurs.',
      'Détail + actions : `/admin/users/[id]`.',
      'Audit auth : `/admin/audit`.',
      'Invitations org : préférer `/settings/organization` (ou `POST /api/admin/invitations`).',
    ],
    routes: [
      '/admin',
      '/admin/users/[id]',
      '/admin/audit',
      '/admin/ai-usage',
      '/api/admin/*',
    ],
    docs: 'docs/USERS_ADMIN.md',
    notes: [
      'Permissions : `users:*`, `iam:manage`, `audit:read`, `org:*`.',
      'Pas de mot de passe local — identité Keycloak uniquement.',
    ],
  },
  {
    id: 'billing',
    title: 'Stripe Billing',
    summary:
      'Abonnement SaaS Stripe (Checkout) + Customer Portal + feature gating par plan.',
    steps: [
      'Créer un compte Stripe et récupérer les clés.',
      'Renseigner `STRIPE_SECRET_KEY` (+ `STRIPE_WEBHOOK_SECRET` en prod).',
      'Pas besoin de créer produits/prices dans Stripe : Checkout utilise price_data.',
      'Tester `/billing` (s’abonner) puis « Gérer mon abonnement » (portal).',
      'Webhook : `POST /api/billing/webhooks/stripe`.',
      'Vérifier les entitlements : `GET /api/billing/features`.',
    ],
    env: [
      { name: 'STRIPE_SECRET_KEY' },
      { name: 'STRIPE_WEBHOOK_SECRET' },
      { name: 'STRIPE_PUBLIC_KEY' },
      {
        name: 'STRIPE_PRICE_STARTER_MONTHLY',
        hint: 'optionnel (sinon price_data)',
      },
      { name: 'STRIPE_PRICE_PRO_MONTHLY', hint: 'optionnel' },
    ],
    routes: [
      '/billing',
      '/billing/success',
      '/admin/payments',
      'GET /api/billing/features',
    ],
    docs: 'docs/STRIPE_BILLING.md',
    notes: [
      'Starter : jusqu’à 5 membres, pas d’IA.',
      'Pro : IA (`ai`, `cms_ai_rewrite`), membres illimités, support prioritaire.',
      "Endpoints protégés : `@RequiresFeature('ai')` sur translate, `@RequiresFeature('cms_ai_rewrite')` sur rewrite.",
    ],
  },
  {
    id: 'cms',
    title: 'CMS multilingue',
    summary:
      'Dossiers, articles, traductions, versions, éditeur Rich-Text Tiptap, scope multi-tenant.',
    steps: [
      'Permission `cms:read` minimum pour ouvrir `/cms`.',
      'Sélectionner l’organisation active (sidebar) avant de créer un dossier.',
      'Éditeur Tiptap : contenu HTML stocké dans `CmsTranslation.content`.',
      'Publier avec `cms:publish` ; rollback avec `cms:manage`.',
      'Sidebar IA : traduction (preview) + réécriture (plan Pro requis).',
    ],
    routes: ['/cms', '/cms/articles/[id]'],
    docs: 'docs/CMS.md',
    notes: [
      'Statuts : DRAFT, REVIEW, PUBLISHED, ARCHIVED.',
      'Filtre `organizationId` : ADMIN = global, sinon memberships.',
      'SEO (`seoMeta`) et workflow éditorial : champs préparés, UI non branchée.',
      'Pas encore de rendu public / blog.',
    ],
  },
  {
    id: 'ai',
    title: 'IA CMS',
    summary:
      'Traduction et réécriture via providers interchangeables (Groq → Gemini → OpenAI), gated par plan Pro.',
    steps: [
      'Configurer au moins une clé (`GROQ_API_KEY`, `GEMINI_API_KEY` ou `OPENAI_API_KEY`).',
      'Priorité : `AI_PROVIDER_PRIORITY=groq,gemini,openai` (défaut).',
      'Souscrire au plan Pro (`/billing`) pour débloquer les endpoints.',
      'Dans l’éditeur article : traduire (preview → accepter) ou réécrire.',
      'Suivi usage admin : `/admin/ai-usage` + métriques Prometheus.',
    ],
    env: [
      { name: 'AI_PROVIDER_PRIORITY', hint: 'groq,gemini,openai' },
      { name: 'GROQ_API_KEY' },
      { name: 'GEMINI_API_KEY' },
      { name: 'OPENAI_API_KEY' },
      { name: 'AI_DAILY_TOKEN_QUOTA', hint: 'défaut 100000' },
    ],
    routes: [
      '/cms/articles/[id]',
      '/admin/ai-usage',
      'GET /api/ai/status',
      'POST /api/ai/translate',
      'POST /api/ai/rewrite',
      'GET /api/ai/usage',
    ],
    docs: 'docs/AI.md',
    notes: [
      'Translate = preview uniquement ; persistance via upsert CMS après acceptation.',
      'Quota journalier → HTTP 429.',
      'Rate limit : 10 req/min (Throttler).',
    ],
  },
  {
    id: 'notifications',
    title: 'Notifications',
    summary:
      'Centre in-app + email SMTP (invitations, sécurité, billing, CMS). SMS / Push = stubs.',
    steps: [
      'Configurer SMTP (`SMTP_HOST`, port 587, `SMTP_SECURE=false`).',
      'Utiliser `SMTP_USER` comme expéditeur si besoin de délivrabilité.',
      'UI : `/notifications` et `/notifications/preferences`.',
      'Invitations : template `USER_INVITED` inclut `{{inviteUrl}}`.',
    ],
    env: [
      { name: 'SMTP_HOST' },
      { name: 'SMTP_PORT', hint: '587' },
      { name: 'SMTP_SECURE', hint: 'false pour STARTTLS' },
      { name: 'SMTP_USER' },
      { name: 'SMTP_PASS' },
      { name: 'SMTP_FROM' },
    ],
    routes: ['/notifications', '/notifications/preferences'],
    docs: 'docs/NOTIFICATIONS.md',
  },
  {
    id: 'storage',
    title: 'Storage & Upload',
    summary: 'Uploads fichiers via driver local, S3/MinIO, ou stub Cloudinary.',
    steps: [
      'Choisir `STORAGE_DRIVER=local` (défaut) ou `s3`.',
      'Local : dossier `STORAGE_PATH=uploads`.',
      'S3 : renseigner `S3_*` (endpoint MinIO possible).',
      'UI : `/storage` + composant `FileUpload` (aussi PJ CMS).',
    ],
    env: [
      { name: 'STORAGE_DRIVER', hint: 'local | s3 | cloudinary' },
      { name: 'STORAGE_PATH' },
      { name: 'S3_ENDPOINT' },
      { name: 'S3_BUCKET' },
      { name: 'S3_ACCESS_KEY' },
      { name: 'S3_SECRET_KEY' },
    ],
    routes: ['/storage'],
    docs: 'docs/STORAGE.md',
    notes: ['Cloudinary = stub (interface only).'],
  },
  {
    id: 'observability',
    title: 'Observabilité',
    summary:
      'Health checks, Redis/BullMQ, métriques Prometheus (HTTP + IA), OTEL optionnel.',
    steps: [
      'Démarrer Redis (`REDIS_URL`) si cache/jobs souhaités.',
      'Activer Prometheus : `PROMETHEUS_ENABLED=true` → `GET /metrics`.',
      'OTEL : `OTEL_ENABLED=true` + endpoint OTLP.',
      'UI admin : `/admin/system`.',
    ],
    env: [
      { name: 'REDIS_URL' },
      { name: 'CACHE_ENABLED' },
      { name: 'PROMETHEUS_ENABLED' },
      { name: 'PROMETHEUS_METRICS_PATH' },
      { name: 'OTEL_ENABLED' },
      { name: 'OTEL_SERVICE_NAME' },
      { name: 'OTEL_EXPORTER_OTLP_ENDPOINT' },
    ],
    routes: ['/admin/system', '/api/health', '/metrics'],
    docs: 'docs/OBSERVABILITY.md',
    notes: [
      'Métriques IA : `ai_requests_total`, `ai_tokens_total`, `ai_request_duration_seconds`.',
    ],
  },
  {
    id: 'theme',
    title: 'Thème Light / Dark',
    summary:
      'Basculer entre thème clair (défaut) et sombre. Tailwind `dark:` réagit à `data-theme="dark"` sur `<html>`.',
    steps: [
      'Le thème par défaut est `light` (`BRAND_THEME=light`).',
      'Choisir Light ou Dark dans la section ci-dessous (ou le sélecteur du header).',
      'La préférence est mémorisée dans `localStorage` (`saas-starter-theme`).',
      'Utiliser les classes Tailwind `dark:` pour les styles conditionnels.',
    ],
    env: [
      { name: 'BRAND_THEME', hint: 'light (défaut) | dark' },
      { name: 'NEXT_PUBLIC_BRAND_THEME', hint: 'miroir public' },
    ],
    notes: [
      'Les tokens CSS (`--bg`, `--fg`, `--surface`…) restent la source pour l’UI existante.',
      'Tailwind v4 est branché via `@import "tailwindcss"` dans `globals.css`.',
    ],
  },
  {
    id: 'white-label',
    title: 'White Label',
    summary:
      'Changer de marque sans toucher au code : variables d’environnement + assets `branding/`.',
    steps: [
      'Modifier `APP_NAME`, couleurs, thème, police dans `.env`.',
      'Remplacer les fichiers dans `branding/` (symlink → `frontend/public/branding`).',
      'Redémarrer API + web.',
      'Aperçu admin : `/admin/branding`.',
    ],
    env: [
      { name: 'APP_NAME' },
      { name: 'COMPANY_NAME' },
      { name: 'PRIMARY_COLOR' },
      { name: 'SECONDARY_COLOR' },
      { name: 'BRAND_THEME', hint: 'light (défaut) | dark' },
      { name: 'BRAND_FONT' },
      { name: 'LOGO_URL' },
      { name: 'FAVICON_URL' },
      { name: 'SUPPORT_EMAIL' },
    ],
    routes: ['/admin/branding', 'GET /api/brand'],
    docs: 'docs/WHITE_LABEL.md',
  },
];
