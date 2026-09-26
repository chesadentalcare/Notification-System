import nodemailer, { type Transporter } from 'nodemailer';
import type { DeliveryResult, NotificationChannel, RenderedMessage } from '../../domain/ports/NotificationChannel.js';
import type { EmailRecipient } from '../../domain/value-objects/Recipient.js';
import type { Env } from '../../config/env.js';
import { logger } from '../logger.js';

export class EmailChannel implements NotificationChannel {
  readonly type = 'email' as const;
  private transporter: Transporter | null = null;

  constructor(private readonly env: Env) {
    if (env.SMTP_HOST) {
      this.transporter = nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        secure: env.SMTP_SECURE,
        auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
      });
    }
  }

  async send(message: RenderedMessage): Promise<DeliveryResult> {
    const recipient = message.recipient as EmailRecipient;
    if (this.env.NOTIFY_DRY_RUN) {
      logger.info({ channel: 'email', to: recipient.email, subject: message.subject }, 'DRY RUN — email not sent');
      return { providerMessageId: `dry-run-${Date.now()}` };
    }
    if (!this.transporter) {
      throw new Error('Email channel is not configured (SMTP_HOST missing)');
    }
    // Optional CC: callers pass a comma-separated list via data.__cc (backward-compatible).
    const cc = message.data?.__cc || undefined;
    const info = await this.transporter.sendMail({
      from: this.env.SMTP_FROM,
      to: recipient.name ? `"${recipient.name}" <${recipient.email}>` : recipient.email,
      cc,
      subject: message.subject,
      html: message.body,
    });
    return { providerMessageId: info.messageId ?? null };
  }
}
