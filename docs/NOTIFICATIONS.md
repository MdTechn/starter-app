# Notifications (Epic 6)

Infrastructure de notifications **découplée par événements**. Les modules
métier (Users, Auth, Stripe) émettent via `NotificationDispatcher` — ils
n’importent **jamais** `NotificationsModule`.

```
Feature modules
  └─ NotificationDispatcher.emit(NOTIFICATION_DISPATCH_EVENT)
       └─ EventEmitter2
            └─ NotificationEventsListener
                 └─ NotificationsService.dispatch
                      ├─ Notification (+ template + préférences)
                      └─ NotificationQueue (sync; BullMQ prêt si REDIS_URL)
                           └─ NotificationDeliveryService
                                ├─ SmtpEmailChannel
                                ├─ In-app (marque SENT)
                                ├─ SmsChannelStub (interface only)
                                └─ PushChannelStub (interface only)
```

## Modèles Prisma

| Modèle | Rôle |
|--------|------|
| `Notification` | Instance (PENDING / SENT / FAILED / READ) |
| `NotificationTemplate` | Sujet + corps par événement × canal |
| `NotificationPreference` | Opt-in email / in-app (SMS/Push désactivés par défaut) |

Canaux : `EMAIL`, `IN_APP`, `SMS`, `PUSH` (SMS/PUSH non livrés).

## Événements

| Event | Émetteur typique |
|-------|------------------|
| `USER_CREATED` | Sync Keycloak (création utilisateur) |
| `USER_INVITED` | Invitations admin (email invitee + in-app inviter) |
| `LOGIN_SECURITY` | Guard auth (échecs sync / sécurité) |
| `SUBSCRIPTION_CREATED` | Webhook Stripe subscription |
| `PAYMENT_SUCCESS` | Webhook `invoice.paid` |
| `PAYMENT_FAILED` | Webhook `invoice.payment_failed` |

Payload partagé : `NotificationDispatchPayload` (`@saas-starter/shared`).

Constante d’événement Nest : `NOTIFICATION_DISPATCH_EVENT` (`app.notification.dispatch`).

## Permissions

| Permission | Rôles |
|------------|--------|
| `notification:read` | USER, ADMIN |
| `notification:manage` | ADMIN (templates) |

## API

| Méthode | Route | Permission |
|---------|-------|------------|
| GET | `/api/notifications` | read |
| GET | `/api/notifications/unread-count` | read |
| PATCH | `/api/notifications/read-all` | read |
| PATCH | `/api/notifications/:id/read` | read |
| GET/PATCH | `/api/notifications/preferences` | read |
| GET | `/api/notifications/templates` | manage |

## Configuration SMTP

```env
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
SMTP_FROM=SaaS Starter <noreply@example.com>
# alias accepté : EMAIL_FROM
```

Sans `SMTP_HOST` + `SMTP_FROM`, les emails restent `PENDING` → `FAILED` (ou skip selon canal) ; les notifications **in-app** fonctionnent toujours.

Config Nest : `backend/src/config/mail.config.ts` (`ConfigService.get('mail')`).

## File d’attente

`SyncNotificationQueue` traite immédiatement en process. Si `REDIS_URL` est
défini, un log indique qu’un worker **BullMQ** peut remplacer l’implémentation
sans changer le contrat `NotificationQueue` (`NOTIFICATION_QUEUE` token).

## Frontend

| Route | Contenu |
|-------|---------|
| `/notifications` | Centre + marquage lu |
| `/notifications/preferences` | Opt-in email / in-app |
| Dashboard | Badge non lues (`NotificationBadge`) |

## Extension (SMS / Push)

Implémenter `NotificationChannelHandler` dans :

- `channels/stub.channels.ts` → remplacants concrets
- Brancher dans `NotificationDeliveryService`
- Activer le canal dans `NotificationsService.dispatch` (aujourd’hui skip SMS/PUSH)

Ne pas importer le module Users/Stripe depuis Notifications — garder le flux
événementiel unidirectionnel.
