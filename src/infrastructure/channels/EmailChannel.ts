import nodemailer, { type Transporter, type SendMailOptions } from 'nodemailer';
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
        tls: { ciphers: 'SSLv3' }, // parity with the working chesa-microservices mailer (Office 365)
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
    // Optional attachments: callers pass a JSON array via data.__attachments, e.g.
    // [{ "filename": "E-Invoice.pdf", "path": "https://.../document.pdf" }] — nodemailer
    // fetches the URL/file and attaches it. Backward-compatible (ignored if absent/bad).
    let attachments: SendMailOptions['attachments'];
    const rawAttachments = message.data?.__attachments;
    if (rawAttachments) {
      try {
        const parsed = JSON.parse(rawAttachments);
        if (Array.isArray(parsed) && parsed.length) attachments = parsed as SendMailOptions['attachments'];
      } catch {
        logger.warn({ to: recipient.email }, 'ignored malformed data.__attachments');
      }
    }
    const info = await this.transporter.sendMail({
      from: this.env.SMTP_FROM,
      to: recipient.name ? `"${recipient.name}" <${recipient.email}>` : recipient.email,
      cc,
      subject: message.subject,
      html: message.body,
      attachments,
    });
    return { providerMessageId: info.messageId ?? null };
  }
}
