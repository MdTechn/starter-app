# Storage & Upload (Epic 7)

Module de stockage **indépendant du fournisseur**. Le driver actif est choisi
uniquement via `STORAGE_DRIVER` — aucun provider n’est codé en dur dans les
services métier.

```
StorageController / StorageService
  └─ STORAGE_PROVIDER (token)
       ├─ LocalStorageProvider   (STORAGE_DRIVER=local)
       ├─ S3StorageProvider      (STORAGE_DRIVER=s3)
       └─ CloudinaryStorageProvider (stub)
```

Après upload / delete, émission sur le bus :

`STORAGE_DOMAIN_EVENT` → payload `{ event: FILE_UPLOADED | FILE_DELETED, … }`

## Modèle Prisma `FileAsset`

Lien **générique** via `ownerType` + `ownerId` (`User`, `Organization`, …).
`uploadedById` référence l’uploader. Pas de FK vers chaque entité.

Kinds : `IMAGE` | `DOCUMENT` | `AVATAR`

Drivers persistés : `LOCAL` | `S3` | `CLOUDINARY`

## Permissions

| Permission | Rôles |
|------------|--------|
| `upload:read` | USER, ADMIN |
| `upload:write` | USER, ADMIN |
| `upload:delete` | USER, ADMIN (ses fichiers) |
| `upload:manage` | ADMIN (suppression globale) |

## API

| Méthode | Route | Notes |
|---------|-------|--------|
| GET | `/api/storage/driver` | Driver actif |
| GET | `/api/storage/files` | Liste de l’utilisateur |
| POST | `/api/storage/upload` | multipart `file` + `kind` |
| DELETE | `/api/storage/:id` | Owner ou `upload:manage` |
| GET | `/api/storage/content/:id` | URL publique (stream local) |

Validation MIME + taille (`FILE_UPLOAD_RULES` dans `@saas-starter/shared`).

## Configuration locale

```env
STORAGE_DRIVER=local
STORAGE_PATH=uploads
# alias : STORAGE_LOCAL_PATH
```

Fichiers écrits sous `STORAGE_PATH` (cwd process). URL publique :

`{API_URL}/{API_PREFIX}/storage/content/{fileId}`

Optionnel : `STORAGE_PUBLIC_BASE_URL` (CDN / reverse-proxy).

## Configuration S3 / MinIO

```env
STORAGE_DRIVER=s3
S3_ENDPOINT=http://localhost:9000   # vide = AWS
S3_BUCKET=saas-starter
S3_REGION=eu-west-1
S3_ACCESS_KEY=...
S3_SECRET_KEY=...
# S3_FORCE_PATH_STYLE=true   # auto si S3_ENDPOINT défini
```

Alias conservés (pas de breaking change) : `AWS_REGION`, `AWS_ACCESS_KEY_ID`,
`AWS_SECRET_ACCESS_KEY`.

## Cloudinary (stub)

```env
STORAGE_DRIVER=cloudinary
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

Le provider lève `CLOUDINARY_NOT_IMPLEMENTED` jusqu’à implémentation réelle.

## Frontend

| Route / composant | Rôle |
|-------------------|------|
| `/storage` | Liste + upload + suppression |
| `FileUpload` | Aperçu image, barre de progression, erreurs |

## Extension

1. Implémenter `StorageProvider` (ex. Cloudinary).
2. Enregistrer dans `StorageModule` `useFactory`.
3. Ajouter la valeur dans `STORAGE_DRIVER` (Zod + shared enum).
4. Ne jamais importer S3/Local depuis un autre module — injecter `STORAGE_PROVIDER`.
