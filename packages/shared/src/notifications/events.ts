/** Domain notification events — emit from feature modules, handle in Notifications. */
export enum AppNotificationEvent {
  USER_CREATED = 'USER_CREATED',
  USER_INVITED = 'USER_INVITED',
  LOGIN_SECURITY = 'LOGIN_SECURITY',
  SUBSCRIPTION_CREATED = 'SUBSCRIPTION_CREATED',
  PAYMENT_SUCCESS = 'PAYMENT_SUCCESS',
  PAYMENT_FAILED = 'PAYMENT_FAILED',
  CMS_PUBLISHED = 'CMS_PUBLISHED',
}

/** Nest EventEmitter channel name (decoupled bus). */
export const NOTIFICATION_DISPATCH_EVENT = 'app.notification.dispatch';

export type NotificationChannelCode = 'EMAIL' | 'IN_APP' | 'SMS' | 'PUSH';

export type NotificationDispatchPayload = {
  eventType: AppNotificationEvent | string;
  userId?: string | null;
  email?: string | null;
  data?: Record<string, unknown>;
  /** Force channels; otherwise templates + preferences decide. */
  channels?: NotificationChannelCode[];
};

export const ALL_NOTIFICATION_EVENTS = Object.values(AppNotificationEvent);
