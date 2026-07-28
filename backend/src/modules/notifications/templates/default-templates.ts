import { NotificationChannel, NotificationEventType } from '@prisma/client';

export type DefaultTemplate = {
  eventType: NotificationEventType;
  channel: NotificationChannel;
  subject?: string;
  bodyTemplate: string;
};

export const DEFAULT_NOTIFICATION_TEMPLATES: DefaultTemplate[] = [
  {
    eventType: NotificationEventType.USER_CREATED,
    channel: NotificationChannel.EMAIL,
    subject: 'Bienvenue {{name}}',
    bodyTemplate:
      'Bonjour {{name}},\n\nVotre compte {{email}} est prêt. Connectez-vous pour commencer.\n\n— {{appName}}',
  },
  {
    eventType: NotificationEventType.USER_CREATED,
    channel: NotificationChannel.IN_APP,
    bodyTemplate: 'Bienvenue {{name}} ! Votre compte a été créé.',
  },
  {
    eventType: NotificationEventType.USER_INVITED,
    channel: NotificationChannel.EMAIL,
    subject: 'Invitation — {{appName}}',
    bodyTemplate:
      'Bonjour,\n\nVous êtes invité(e) à rejoindre {{appName}}.\nOrganisation : {{organizationName}}\nAdresse : {{email}}\nL’invitation expire le {{expiresAt}}.\n\nCréer votre compte : {{inviteUrl}}\n\n— {{appName}}',
  },
  {
    eventType: NotificationEventType.USER_INVITED,
    channel: NotificationChannel.IN_APP,
    bodyTemplate: 'Invitation envoyée à {{email}}.',
  },
  {
    eventType: NotificationEventType.LOGIN_SECURITY,
    channel: NotificationChannel.EMAIL,
    subject: 'Alerte sécurité — tentative de connexion',
    bodyTemplate:
      'Bonjour,\n\nUne tentative de connexion a échoué pour {{email}}.\nIP : {{ip}}\nRaison : {{reason}}\n\nSi ce n’était pas vous, sécurisez votre compte.\n\n— {{appName}}',
  },
  {
    eventType: NotificationEventType.LOGIN_SECURITY,
    channel: NotificationChannel.IN_APP,
    bodyTemplate: 'Alerte sécurité : connexion échouée ({{reason}}).',
  },
  {
    eventType: NotificationEventType.SUBSCRIPTION_CREATED,
    channel: NotificationChannel.EMAIL,
    subject: 'Abonnement activé — {{planId}}',
    bodyTemplate:
      'Bonjour,\n\nVotre abonnement {{planId}} ({{interval}}) est actif pour l’organisation {{organizationId}}.\n\n— {{appName}}',
  },
  {
    eventType: NotificationEventType.SUBSCRIPTION_CREATED,
    channel: NotificationChannel.IN_APP,
    bodyTemplate: 'Abonnement {{planId}} activé.',
  },
  {
    eventType: NotificationEventType.PAYMENT_SUCCESS,
    channel: NotificationChannel.EMAIL,
    subject: 'Confirmation de paiement {{amount}} {{currency}}',
    bodyTemplate:
      'Bonjour {{name}},\n\nNous confirmons la réception de votre paiement.\n\nMontant : {{amount}} {{currency}}\nDétail : {{description}}\n\nCet e-mail fait office de reçu.\n\nCordialement,\nL’équipe {{appName}}',
  },
  {
    eventType: NotificationEventType.PAYMENT_SUCCESS,
    channel: NotificationChannel.IN_APP,
    bodyTemplate:
      'Paiement confirmé : {{amount}} {{currency}} — {{description}}.',
  },
  {
    eventType: NotificationEventType.PAYMENT_FAILED,
    channel: NotificationChannel.EMAIL,
    subject: 'Échec de paiement',
    bodyTemplate:
      'Bonjour,\n\nUn paiement de {{amount}} {{currency}} a échoué.\nVeuillez vérifier votre moyen de paiement.\n\n— {{appName}}',
  },
  {
    eventType: NotificationEventType.PAYMENT_FAILED,
    channel: NotificationChannel.IN_APP,
    bodyTemplate: 'Échec de paiement : {{amount}} {{currency}}.',
  },
  {
    eventType: NotificationEventType.CMS_PUBLISHED,
    channel: NotificationChannel.EMAIL,
    subject: 'Article publié — {{slug}}',
    bodyTemplate:
      'Bonjour,\n\nL’article « {{slug}} » ({{articleId}}) a été publié.\n\n— {{appName}}',
  },
  {
    eventType: NotificationEventType.CMS_PUBLISHED,
    channel: NotificationChannel.IN_APP,
    bodyTemplate: 'Article publié : {{slug}}.',
  },
];

export function renderTemplate(
  template: string,
  data: Record<string, unknown> = {},
): string {
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key: string) => {
    const value = data[key];
    return value === undefined || value === null ? '' : String(value);
  });
}
