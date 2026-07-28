# CMS Multilingue IA — Phase 1 (Epic 9)

Fondations d’un CMS réutilisable : dossiers hiérarchiques, articles,
traductions, versioning, pièces jointes via Storage, événements domaine.

> **IA CMS** — traduction / réécriture via module provider interchangeable
> (`docs/AI.md`). SEO avancé et Workflow éditorial restent préparés.

## Architecture

```
CmsController
  ├─ CmsFoldersService   (arborescence illimitée)
  └─ CmsArticlesService  (CRUD, traductions, versions, publish)
       ├─ StorageService (FileAsset ownerType=CmsArticle)
       ├─ EventEmitter2  (CMS_DOMAIN_EVENT)
       └─ NotificationDispatcher (CMS_PUBLISHED)
```

Keycloak reste l’IdP. Aucun mot de passe local. RBAC via permissions `cms:*`.
Données CMS filtrées par `organizationId` (membership ; ADMIN = global).

Éditeur frontend : **Tiptap** (`RichTextEditor`) — contenu HTML dans
`CmsTranslation.content`.

## Modèles Prisma

| Modèle | Rôle |
|--------|------|
| `CmsFolder` | Dossier — `code` unique, `parentId`, `organizationId` (filtre multi-tenant) |
| `CmsArticle` | Article — `slug` unique, `organizationId`, statut, prep SEO/AI/workflow |
| `CmsTranslation` | Une traduction par `(articleId, locale)` |
| `CmsVersion` | Snapshot JSON + numéro de version (rollback prêt) |

Pièces jointes : `FileAsset` avec `ownerType='CmsArticle'` + `ownerId=articleId`
(pas de FK dédiée — Storage interchangeable).

## Statuts article

`DRAFT` → `REVIEW` → `PUBLISHED` → `ARCHIVED`

## Permissions

| Permission | USER | ADMIN |
|------------|------|-------|
| `cms:read` | ✅ | ✅ |
| `cms:write` | ✅ | ✅ |
| `cms:publish` | ❌ | ✅ |
| `cms:manage` | ❌ | ✅ |

## API (`/api/cms`)

### Folders

| Méthode | Route | Permission |
|---------|-------|------------|
| GET | `/folders` | `cms:read` — `?tree=1` pour arbre |
| GET | `/folders/:id` | `cms:read` |
| POST | `/folders` | `cms:write` |
| PATCH | `/folders/:id` | `cms:write` |
| DELETE | `/folders/:id` | `cms:manage` (dossier vide) |

### Articles

| Méthode | Route | Permission |
|---------|-------|------------|
| GET | `/articles` | `cms:read` (pagination, `folderId`, `status`, `q`) |
| GET | `/articles/:id` | `cms:read` |
| POST | `/articles` | `cms:write` |
| PATCH | `/articles/:id` | `cms:write` |
| POST | `/articles/:id/publish` | `cms:publish` |
| POST | `/articles/:id/archive` | `cms:write` |
| DELETE | `/articles/:id` | `cms:manage` |

### Translations

| Méthode | Route | Permission |
|---------|-------|------------|
| PUT | `/articles/:id/translations/:locale` | `cms:write` |
| DELETE | `/articles/:id/translations/:locale` | `cms:write` |

### Versions

| Méthode | Route | Permission |
|---------|-------|------------|
| GET | `/articles/:id/versions` | `cms:read` |
| GET | `/articles/:id/versions/:version` | `cms:read` |
| POST | `/articles/:id/versions/:version/rollback` | `cms:manage` |

### Attachments

| Méthode | Route | Permission |
|---------|-------|------------|
| POST | `/articles/:id/attachments` | `cms:write` (`{ fileId }`) |
| DELETE | `/articles/:id/attachments/:fileId` | `cms:write` |

## Événements

Canal Nest : `app.cms.domain` (`CMS_DOMAIN_EVENT`).

| Event | Quand |
|-------|-------|
| `CMS_CREATED` | Création article |
| `CMS_UPDATED` | Maj / traduction / archive / rollback |
| `CMS_PUBLISHED` | Publication (+ notification `CMS_PUBLISHED`) |

## UI

| Route | Contenu |
|-------|---------|
| `/cms` | Explorateur dossiers + liste articles |
| `/cms/articles/[id]` | Éditeur, traductions, versions, PJ |

## IA CMS

Voir **[docs/AI.md](./AI.md)** — endpoints `/api/ai/translate` et
`/api/ai/rewrite`, providers Groq → Gemini → OpenAI, modèle `AiUsage`.

## Préparé (phases suivantes)

- **SEO** : `seoMeta` article + `seoTitle` / `seoDescription` traduction
- **Workflow** : `workflowState` (string)

## Migration

`prisma/migrations/20260723160000_cms_multilingual/`
