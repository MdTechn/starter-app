# White Label (Epic 9)

Créer une **nouvelle marque sans toucher au code** : variables d’environnement
+ assets dans `branding/`.

## BrandConfig

Type central : `@saas-starter/shared` → `BrandConfig` / `resolveBrandConfig()`.

| Champ | Variables |
|-------|-----------|
| `appName` | `APP_NAME` (alias `NEXT_PUBLIC_APP_NAME`) |
| `companyName` | `COMPANY_NAME` |
| `appUrl` | `APP_URL` / `FRONTEND_URL` |
| `logoUrl` | `LOGO_URL` (défaut `/branding/logo.svg`) |
| `faviconUrl` | `FAVICON_URL` |
| `primaryColor` | `PRIMARY_COLOR` |
| `secondaryColor` | `SECONDARY_COLOR` |
| `theme` | `BRAND_THEME` = `light` \| `dark` |
| `fontFamily` | `BRAND_FONT` / `FONT_FAMILY` |
| `iconUrl` | `ICON_URL` |
| `appleTouchIconUrl` | `APPLE_TOUCH_ICON_URL` |
| `supportEmail` | `SUPPORT_EMAIL` |
| `supportUrl` | `SUPPORT_URL` |
| `metaDescription` | `META_DESCRIPTION` |

## Assets

Dossier source : [`branding/`](../branding/) (symlink → `frontend/public/branding`).

Remplacez `logo.svg`, `favicon.svg`, `icon-*.svg`, `apple-touch-icon.svg`
ou pointez les URLs env vers un CDN.

## API

| Route | Auth | Rôle |
|-------|------|------|
| `GET /api/brand` | public | Config brand |
| `GET /api/brand/preview` | `brand:read` | Aperçu admin |

## Surfaces branchées

- Login, home, dashboard (logo + nom)
- Metadata SEO + favicon + `manifest.webmanifest`
- CSS variables (`--accent`, thème light/dark)
- Emails SMTP (from + HTML logo)
- Notifications (`{{appName}}`, support, couleurs)

## Exemple : marque « Acme Cloud »

```env
APP_NAME=Acme Cloud
COMPANY_NAME=Acme Corp
APP_URL=https://app.acme.example
LOGO_URL=/branding/logo.svg
FAVICON_URL=/branding/favicon.svg
PRIMARY_COLOR=#0ea5e9
SECONDARY_COLOR=#0f172a
BRAND_THEME=light
BRAND_FONT='Inter', system-ui, sans-serif
SUPPORT_EMAIL=hello@acme.example
SUPPORT_URL=https://help.acme.example
```

1. Remplacer les fichiers dans `branding/`
2. Mettre à jour `.env` (ci-dessus)
3. Redémarrer API + web — **aucun commit applicatif requis**

Aperçu admin : `/admin/branding`.

## Backend

`BrandModule` + `brand.config.ts` (Nest `ConfigService.get('brand')`).
`NotificationsService` / `SmtpEmailChannel` consomment `BrandService`.
