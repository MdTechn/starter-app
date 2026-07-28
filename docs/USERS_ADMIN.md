# Gestion utilisateurs & Administration (Epic 4)

Keycloak reste la **source unique d'identité**. Aucun mot de passe n'est stocké
dans Prisma. Les utilisateurs locaux sont synchronisés / liés via `keycloakSub`.

## Capacités

| Domaine | Contenu |
|---------|---------|
| Users | CRUD, recherche, pagination, filtres, profil, statuts |
| Admin | enable/disable, rôles, audit, invitations (email SMTP) |
| Organizations | CRUD + membres ; list/CMS filtrés par orgId |

## Permissions

| Permission | Usage |
|------------|--------|
| `users:read` | Lire un utilisateur / son profil |
| `users:list` | Lister (pagination) |
| `users:write` | Créer / maj profil / statut |
| `users:invite` | Invitations |
| `iam:manage` | Actions IAM admin |
| `audit:read` | Journal d'audit |
| `org:*` | Organisations (prep) |

## Création utilisateur

`POST /api/users` exige `email` + `keycloakSub` (identité Keycloak déjà créée).
Pas de champ password.

Pour onboarding sans compte Keycloak encore : `POST /api/admin/invitations`
envoie un email SMTP (`USER_INVITED`) avec lien `{{inviteUrl}}`
(`/login?invite=<token>`). Configurer `SMTP_*` et `FRONTEND_URL`.

## Organisations (multi-tenant)

Les listes CMS / organisations sont filtrées par `organizationId` selon les
memberships (ADMIN = accès global). Création dossier/article : org résolue via
membership ou `organizationId` dans le DTO.

## Statuts

`ACTIVE` → `DISABLED` (réversible) → `DELETED` (soft-delete).
Réactivation d'un `DELETED` refusée côté enable admin (resync IdP).

## UI

- `/admin` — liste + filtres
- `/admin/users/[id]` — détail, profil, rôles, enable/disable
- `/admin/audit` — événements récents

Middleware : rôle `ADMIN` requis pour `/admin/*`.
