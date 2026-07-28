/**
 * Channel ports — SMS / Push préparés sans implémentation métier.
 */
export type OutboundMessage = {
  to: string;
  subject?: string;
  body: string;
  metadata?: Record<string, unknown>;
};

export interface EmailChannel {
  readonly channel: 'EMAIL';
  isConfigured(): boolean;
  send(message: OutboundMessage): Promise<void>;
}

export interface InAppChannel {
  readonly channel: 'IN_APP';
  /** In-app is persisted as Notification rows — no external send. */
  deliver(): Promise<void>;
}

/** Interface only — no provider wired. */
export interface SmsChannel {
  readonly channel: 'SMS';
  isConfigured(): boolean;
  send(message: OutboundMessage): Promise<void>;
}

/** Interface only — no provider wired. */
export interface PushChannel {
  readonly channel: 'PUSH';
  isConfigured(): boolean;
  send(message: OutboundMessage): Promise<void>;
}
