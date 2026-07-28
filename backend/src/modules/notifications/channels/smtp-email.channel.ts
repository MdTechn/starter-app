import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Transporter } from 'nodemailer';
import { randomBytes } from 'crypto';
import { mailConfigFactory } from '../../../config/mail.config';
import { AppLogger } from '../../../common/logger/app-logger.service';
import { BrandService } from '../../brand/brand.service';
import { EmailChannel, OutboundMessage } from './channel.types';

type MailConfig = ReturnType<typeof mailConfigFactory>;

type NodemailerModule = {
  createTransport: (options: Record<string, unknown>) => Transporter;
};

/**
 * nodemailer CJS : `import nm from 'nodemailer'` → `.default` undefined sous Nest.
 */
function resolveNodemailer(): NodemailerModule {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require('nodemailer') as NodemailerModule & {
    default?: NodemailerModule;
  };
  if (typeof mod.createTransport === 'function') return mod;
  if (mod.default && typeof mod.default.createTransport === 'function') {
    return mod.default;
  }
  throw new Error('Unable to resolve nodemailer.createTransport');
}

function extractEmail(value: string): string | null {
  const match = value.match(/<([^>]+)>/);
  if (match?.[1]) return match[1].trim().toLowerCase();
  if (value.includes('@')) return value.trim().toLowerCase();
  return null;
}

@Injectable()
export class SmtpEmailChannel implements EmailChannel {
  readonly channel = 'EMAIL' as const;
  private readonly config: MailConfig;
  private transporter: Transporter | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly brand: BrandService,
    private readonly logger: AppLogger,
  ) {
    this.logger.setContext(SmtpEmailChannel.name);
    this.config =
      this.configService.get<MailConfig>('mail') ?? mailConfigFactory();
    if (this.isConfigured()) {
      const nodemailer = resolveNodemailer();
      this.transporter = nodemailer.createTransport({
        host: this.config.host,
        port: this.config.port,
        secure: this.config.secure,
        requireTLS: !this.config.secure && this.config.port === 587,
        auth:
          this.config.user || this.config.pass
            ? { user: this.config.user, pass: this.config.pass }
            : undefined,
        // HELO/EHLO must be a hostname, never an email (Gmail → 501).
        name: 'localhost',
      });
    } else {
      this.logger.warn('SMTP not configured — email channel disabled');
    }
  }

  isConfigured(): boolean {
    return Boolean(this.config.host && this.config.from);
  }

  async send(message: OutboundMessage): Promise<void> {
    if (!this.transporter || !this.isConfigured()) {
      throw new ServiceUnavailableException({
        code: 'SMTP_NOT_CONFIGURED',
        message: 'SMTP is not configured',
      });
    }

    const brand = await this.brand.getConfig();
    const from = this.resolveFrom(brand.appName);
    const fromEmail = extractEmail(from) ?? this.config.user;
    const subject = this.sanitizeSubject(
      message.subject ?? `${brand.appName} — Notification`,
    );
    const text = this.toPlainText(message.body, brand.appName);
    const html = this.toTransactionalHtml(message.body, brand.appName);

    await this.transporter.sendMail({
      from,
      to: message.to,
      replyTo: from,
      subject,
      text,
      html,
      // Envelope MAIL FROM = mailbox authentifiée (pas le HELO).
      envelope: fromEmail ? { from: fromEmail, to: message.to } : undefined,
      // Signaux transactionnels (évite le scoring « newsletter »).
      headers: {
        'Auto-Submitted': 'auto-generated',
        'X-Auto-Response-Suppress': 'All',
        'X-Entity-Ref-ID': randomBytes(16).toString('hex'),
      },
      messageId: `<${randomBytes(12).toString('hex')}@${
        fromEmail?.split('@')[1] ?? 'localhost'
      }>`,
      date: new Date(),
      encoding: 'utf-8',
    });

    this.logger.log(`Email sent to=${message.to} subject=${subject}`);
  }

  /**
   * From must match the authenticated SMTP mailbox (Gmail otherwise → spam).
   */
  private resolveFrom(appName: string): string {
    const authUser = (this.config.user || '').trim().toLowerCase();
    const configured = this.config.from.trim();
    const configuredEmail = extractEmail(configured);

    if (authUser && configuredEmail && configuredEmail !== authUser) {
      this.logger.warn(
        `SMTP_FROM (${configuredEmail}) ≠ SMTP_USER (${authUser}) — using SMTP_USER for deliverability`,
      );
      return `"${appName}" <${authUser}>`;
    }

    if (configured.includes('<')) {
      // Keep display name, force auth mailbox if present.
      if (authUser) return `"${appName}" <${authUser}>`;
      return configured;
    }

    const address = authUser || configured;
    return `"${appName}" <${address}>`;
  }

  private sanitizeSubject(subject: string): string {
    return subject
      .replace(/[\r\n]+/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim()
      .slice(0, 150);
  }

  private toPlainText(body: string, appName: string): string {
    return `${body.trim()}

—
${appName}
Cet e-mail a été envoyé automatiquement suite à une action sur votre compte.
`;
  }

  /**
   * HTML transactionnel simple, sans images distantes (localhost/CDN → spam).
   */
  private toTransactionalHtml(body: string, appName: string): string {
    const escaped = body
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br/>');

    return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${appName}</title>
</head>
<body style="margin:0;padding:0;background:#f6f7f9;font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f6f7f9;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #e6e8eb;border-radius:8px;">
          <tr>
            <td style="padding:24px 28px 8px;font-size:18px;font-weight:700;color:#111;">
              ${appName}
            </td>
          </tr>
          <tr>
            <td style="padding:8px 28px 24px;font-size:15px;line-height:1.55;color:#222;">
              ${escaped}
            </td>
          </tr>
          <tr>
            <td style="padding:16px 28px 24px;border-top:1px solid #eef0f3;font-size:12px;line-height:1.4;color:#6b7280;">
              Message transactionnel automatique de ${appName}.<br/>
              Si vous n&apos;êtes pas à l&apos;origine de cette action, ignorez cet e-mail.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  }
}
