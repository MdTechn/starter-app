import { registerAs } from '@nestjs/config';

export const mailConfigFactory = () => ({
  host: process.env.SMTP_HOST ?? '',
  port: Number(process.env.SMTP_PORT ?? 587),
  secure: process.env.SMTP_SECURE === 'true',
  user: process.env.SMTP_USER ?? '',
  pass: process.env.SMTP_PASS ?? '',
  from: process.env.SMTP_FROM ?? process.env.EMAIL_FROM ?? '',
});

export default registerAs('mail', mailConfigFactory);
