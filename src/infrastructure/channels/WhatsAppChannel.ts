import type { DeliveryResult, NotificationChannel, RenderedMessage } from '../../domain/ports/NotificationChannel.js';
import type { WhatsAppRecipient } from '../../domain/value-objects/Recipient.js';
import type { WhatsAppService, WhatsAppTemplateComponent } from '../whatsapp/WhatsAppService.js';

interface WhatsAppTemplateData {
  name: string;
  language?: string;
  components?: WhatsAppTemplateComponent[];
}

export class WhatsAppChannel implements NotificationChannel {
  readonly type = 'whatsapp' as const;

  constructor(private readonly service: WhatsAppService) {}

  async send(message: RenderedMessage): Promise<DeliveryResult> {
    const recipient = message.recipient as WhatsAppRecipient;
    const phone = recipient.phone;

    const rawTemplate = (message.data as Record<string, unknown> | undefined)?.whatsappTemplate;
    const template = this.parseTemplate(rawTemplate);

    const result = template
      ? await this.service.sendTemplate(
          phone,
          template.name,
          template.language ?? 'en',
          template.components,
          { sentBy: 'notification' }
        )
      : await this.service.sendText(phone, message.body, { sentBy: 'notification' });

    return { providerMessageId: result.waMessageId, meta: { outboundId: result.outboundId } };
  }

  // message.data is typed Record<string,string>, but callers may stuff a JSON
  // object/string under whatsappTemplate — tolerate both shapes.
  private parseTemplate(raw: unknown): WhatsAppTemplateData | null {
    if (!raw) return null;
    let value: unknown = raw;
    if (typeof raw === 'string') {
      try {
        value = JSON.parse(raw);
      } catch {
        return null;
      }
    }
    if (
      value &&
      typeof value === 'object' &&
      typeof (value as { name?: unknown }).name === 'string'
    ) {
      const t = value as { name: string; language?: unknown; components?: unknown };
      return {
        name: t.name,
        language: typeof t.language === 'string' ? t.language : undefined,
        components: Array.isArray(t.components)
          ? (t.components as WhatsAppTemplateComponent[])
          : undefined,
      };
    }
    return null;
  }
}
