# Social Login via Keycloak (Epic 3)

Keycloak reste l’**unique Identity Provider** de l’application. Google / Facebook /
Apple / Microsoft sont des **Identity Brokers** configurés dans Keycloak.
NextAuth n’utilise **pas** de providers sociaux directs.

```
App (Next.js) ──OIDC──▶ Keycloak ──broker──▶ Google / Facebook / Apple / Microsoft
                              │
                              └── JWT ──▶ NestJS (sync Prisma + audit)
```

## Prérequis

1. Client ID / Secret du broker dans `.env` (`GOOGLE_*`, `FACEBOOK_*`, `APPLE_*`, `MICROSOFT_*`)
2. Redémarrer Keycloak après modification des secrets (`npm run db:up`)
3. Realm import : `keycloak/realm-saas.json` (IdP + mappers)
4. Apple / Microsoft : `enabled: false` dans le realm — passer à `true` après config OAuth

## Redirect URI à déclarer chez les providers

Keycloak agit comme client OAuth. Les redirect URI **ne pointent pas** vers
Next.js, mais vers Keycloak :

| Provider  | Redirect URI |
|-----------|--------------|
| Google    | `http://localhost:8090/realms/saas-realm/broker/google/endpoint` |
| Facebook  | `http://localhost:8090/realms/saas-realm/broker/facebook/endpoint` |
| Apple     | `http://localhost:8090/realms/saas-realm/broker/apple/endpoint` |
| Microsoft | `http://localhost:8090/realms/saas-realm/broker/microsoft/endpoint` |

\* Apple / Microsoft : stubs dans le realm (`enabled: false`) — activer après configuration.

En production, remplacer `http://localhost:8090` par l’URL publique Keycloak
et `saas-realm` par le realm déployé.

### NextAuth / frontend (inchangé)

| Client   | Redirect URI |
|----------|--------------|
| saas-web | `http://localhost:3000/api/auth/callback/keycloak` |

## Créer une app OAuth Google

1. [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials
2. Create credentials → **OAuth client ID** → type **Web application**
3. Authorized redirect URIs : ajouter l’URI Google du tableau ci-dessus
4. Copier Client ID / Client Secret dans `.env` :
   ```
   GOOGLE_CLIENT_ID=....apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=...
   ```
5. (Optionnel) OAuth consent screen → scopes `email`, `profile`, `openid`
6. Redémarrer Keycloak pour recharger `${env.GOOGLE_*}`

## Créer une app OAuth Facebook

1. [Meta for Developers](https://developers.facebook.com/) → My Apps → Create App
2. Ajouter le produit **Facebook Login** → Web
3. Valid OAuth Redirect URIs : URI Facebook du tableau
4. Settings → Basic : App ID / App Secret → `.env` :
   ```
   FACEBOOK_CLIENT_ID=...
   FACEBOOK_CLIENT_SECRET=...
   ```
5. Activer le mode Live (ou ajouter des test users) pour les emails
6. Redémarrer Keycloak

## Flux applicatif

1. `/login` → bouton Google / Facebook / Apple / Microsoft
2. NextAuth `signIn('keycloak', …, { kc_idp_hint: 'google' | 'facebook' | 'apple' | 'microsoft' })`
3. Keycloak redirige vers l’IdP social (broker)
4. Retour Keycloak → callback NextAuth → session JWT
5. Appels API : `Authorization: Bearer <access_token>`
6. Backend :
   - valide le JWT Keycloak
   - lit `identity_provider`, `picture`, `given_name`, `family_name`
   - sync Prisma (`provider` = `GOOGLE` | `FACEBOOK` | `APPLE` | `MICROSOFT`)
   - audit `SOCIAL_LOGIN` (au lieu de `LOGIN_SUCCESS`)

## Mappers Keycloak

Par IdP (Google, Facebook, Apple, Microsoft) :

| Mapper   | Claim source        | Attribut utilisateur |
|----------|---------------------|----------------------|
| email    | `email`             | `email`              |
| firstname| `given_name` / …    | `firstName`          |
| lastname | `family_name` / …   | `lastName`           |
| username | `email` (ou equiv.) | `username`           |
| avatar   | `picture`           | `avatar`             |
| role     | hardcoded           | realm role `USER`    |

Le client `saas-web` expose aussi `identity_provider` et `picture` dans le token
(access + ID + userinfo).

## Rôles & permissions

Après login social, les rôles Keycloak (au minimum `USER` via mapper hardcoded)
sont mappés comme pour un login direct :

- JWT `realm_access.roles` → rôles app (`USER` / `ADMIN`)
- permissions via `ROLE_PERMISSIONS` (`packages/shared`)
- Guards auth / roles / permissions inchangés

## Prisma

Champs utilisateur : `provider` (`GOOGLE` | `FACEBOOK` | …), `firstName`,
`lastName`, `avatarUrl`, plus `keycloakSub` / email existants.

Compte existant : si l’email existe déjà (autre `keycloak_sub`), le compte est
**lié** (mise à jour du sub) — le linking fin est aussi géré par le flow
« first broker login » Keycloak.

## Variables d’environnement

Voir `.env.example` :

- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`
- `FACEBOOK_CLIENT_ID` / `FACEBOOK_CLIENT_SECRET`
- `APPLE_CLIENT_ID` / `APPLE_CLIENT_SECRET` (activer l’IdP dans le realm)
- `MICROSOFT_CLIENT_ID` / `MICROSOFT_CLIENT_SECRET` (idem)

Ces variables sont injectées dans le conteneur Keycloak (`docker-compose.yml`)
et substituées dans `realm-saas.json` via `${env.VAR:}`.

## Dépannage

| Symptôme | Piste |
|----------|--------|
| Bouton Google → erreur Keycloak | Client ID/Secret vides ou redirect URI incorrecte |
| Retour `/login?error=…` | Annulation IdP (`access_denied`) ou callback NextAuth |
| Pas de `SOCIAL_LOGIN` en audit | Claim `identity_provider` absent (mapper session note) |
| Roles vides | Mapper `oidc-hardcoded-role-idp-mapper` / `defaultRoles` |
