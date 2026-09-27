import type { Env } from '../../config/env.js';
import type { WhatsAppRepository } from '../../domain/ports/WhatsAppRepository.js';
import type { logger as Logger } from '../logger.js';

export interface WhatsAppTemplateComponent {
  type: string;
  parameters?: Array<Record<string, unknown>>;
  [key: string]: unknown;
}

export interface WhatsAppSendOptions {
  sentBy?: string;
}

export interface WhatsAppSendResult {
  waMessageId: string | null;
  outboundId: number;
}

export interface WhatsAppTemplateSummary {
  name: string;
  status: string;
  category: string;
  language: string;
  body: string;
}

export interface CreateTemplateInput {
  name: string;
  category: string;
  language: string;
  body: string;
  example?: string[];
}

interface MetaSendResponse {
  messages?: Array<{ id?: string }>;
}

// Carries the HTTP status the media proxy route should return (404 vs 502).
export class MediaFetchError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
    this.name = 'MediaFetchError';
  }
}

const extractBodyText = (components: unknown): string => {
  if (!Array.isArray(components)) return '';
  const body = components.find(
    (c) => c && typeof c === 'object' && (c as { type?: unknown }).type === 'BODY'
  ) as { text?: unknown } | undefined;
  return typeof body?.text === 'string' ? body.text : '';
};

export class WhatsAppService {
  constructor(
    private readonly env: Env,
    private readonly repo: WhatsAppRepository,
    private readonly log: typeof Logger
  ) {}

  // Ensure a country code: bare 10-digit numbers get WHATSAPP_DEFAULT_COUNTRY_CODE prepended.
  normalizePhone(phone: string): string {
    const digits = String(phone ?? '').replace(/\D/g, '');
    if (digits.length === 10) return `${this.env.WHATSAPP_DEFAULT_COUNTRY_CODE}${digits}`;
    return digits;
  }

  private get sendEndpoint(): string {
    const base = this.env.WHATSAPP_API_BASE.replace(/\/+$/, '');
    return `${base}/${this.env.WHATSAPP_API_VERSION}/${this.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
  }

  private get templatesEndpoint(): string {
    const base = this.env.WHATSAPP_API_BASE.replace(/\/+$/, '');
    return `${base}/${this.env.WHATSAPP_API_VERSION}/${this.env.WHATSAPP_WABA_ID}/message_templates`;
  }

  private authHeaders(): Record<string, string> {
    if (!this.env.WHATSAPP_ACCESS_TOKEN) {
      throw new Error('WhatsApp is not configured (WHATSAPP_ACCESS_TOKEN missing)');
    }
    return {
      Authorization: `Bearer ${this.env.WHATSAPP_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    };
  }

  async sendText(phone: string, body: string, options: WhatsAppSendOptions = {}): Promise<WhatsAppSendResult> {
    const to = this.normalizePhone(phone);
    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'text',
      text: { body },
    };
    return this.dispatch({ to, payload, body, sentBy: options.sentBy });
  }

  async sendTemplate(
    phone: string,
    templateName: string,
    language: string,
    components?: WhatsAppTemplateComponent[],
    options: WhatsAppSendOptions = {}
  ): Promise<WhatsAppSendResult> {
    const to = this.normalizePhone(phone);
    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'template',
      template: {
        name: templateName,
        language: { code: language },
        ...(components && components.length ? { components } : {}),
      },
    };
    // Store a readable summary as the outbound body so it shows in the thread.
    const paramTexts = (components ?? [])
      .flatMap((c) => (Array.isArray(c.parameters) ? c.parameters : []))
      .map((p) => (p && typeof (p as { text?: unknown }).text === 'string' ? (p as { text: string }).text : ''))
      .filter(Boolean);
    const body = `[template: ${templateName}]${paramTexts.length ? ` ${paramTexts.join(' | ')}` : ''}`;
    return this.dispatch({ to, payload, body, sentBy: options.sentBy });
  }

  private async dispatch(args: {
    to: string;
    payload: Record<string, unknown>;
    body: string;
    sentBy?: string;
  }): Promise<WhatsAppSendResult> {
    const { to, payload, body } = args;
    const sentBy = args.sentBy ?? 'notification-service';

    if (this.env.NOTIFY_DRY_RUN) {
      this.log.info({ channel: 'whatsapp', to }, 'DRY RUN — WhatsApp not sent');
      const outboundId = await this.repo.saveOutbound({ waMessageId: 'dry-run', toPhone: to, body, status: 'sent', sentBy });
      return { waMessageId: 'dry-run', outboundId };
    }

    if (!this.env.WHATSAPP_ACCESS_TOKEN) {
      const message = 'WhatsApp channel is not configured (WHATSAPP_ACCESS_TOKEN missing)';
      await this.repo.saveOutbound({ waMessageId: null, toPhone: to, body, status: 'failed', sentBy });
      throw new Error(message);
    }

    let response: Response;
    let text = '';
    try {
      response = await fetch(this.sendEndpoint, {
        method: 'POST',
        headers: this.authHeaders(),
        body: JSON.stringify(payload),
      });
      text = await response.text();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await this.repo.saveOutbound({ waMessageId: null, toPhone: to, body, status: 'failed', sentBy });
      throw err instanceof Error ? err : new Error(message);
    }

    if (!response.ok) {
      const message = `WhatsApp send failed (HTTP ${response.status}): ${text}`;
      await this.repo.saveOutbound({ waMessageId: null, toPhone: to, body, status: 'failed', sentBy });
      this.log.error({ channel: 'whatsapp', to, status: response.status, body: text }, 'WhatsApp send failed');
      throw new Error(message);
    }

    let parsed: MetaSendResponse = {};
    try {
      parsed = text ? (JSON.parse(text) as MetaSendResponse) : {};
    } catch {
      parsed = {};
    }
    const waMessageId = parsed.messages?.[0]?.id ?? null;
    const outboundId = await this.repo.saveOutbound({ waMessageId, toPhone: to, body, status: 'sent', sentBy });
    return { waMessageId, outboundId };
  }

  // Meta media proxy: resolve a media id to its temporary CDN url, then fetch the
  // binary. Both calls use the same WABA access token this service already holds, so
  // <img src> in the UI never sees the token. Returns the bytes + resolved mime type.
  async fetchMedia(id: string): Promise<{ buffer: Buffer; mime: string }> {
    if (!this.env.WHATSAPP_ACCESS_TOKEN) {
      throw new Error('WhatsApp media not configured (WHATSAPP_ACCESS_TOKEN missing)');
    }
    const base = this.env.WHATSAPP_API_BASE.replace(/\/+$/, '');
    const graphBase = `${base}/${this.env.WHATSAPP_API_VERSION}`;
    const authHeader = { Authorization: `Bearer ${this.env.WHATSAPP_ACCESS_TOKEN}` };

    const metaRes = await fetch(`${graphBase}/${encodeURIComponent(id)}`, { headers: authHeader });
    const metaText = await metaRes.text();
    if (!metaRes.ok) {
      throw new MediaFetchError(metaRes.status === 404 ? 404 : 502, `Media lookup failed (HTTP ${metaRes.status})`);
    }
    let meta: { url?: string; mime_type?: string } = {};
    try {
      meta = metaText ? (JSON.parse(metaText) as { url?: string; mime_type?: string }) : {};
    } catch {
      meta = {};
    }
    const url = meta.url;
    const mime = meta.mime_type || 'application/octet-stream';
    if (!url) throw new MediaFetchError(404, 'Media not found');

    const binRes = await fetch(url, { headers: authHeader });
    if (!binRes.ok) {
      throw new MediaFetchError(502, `Media download failed (HTTP ${binRes.status})`);
    }
    const arrayBuffer = await binRes.arrayBuffer();
    return { buffer: Buffer.from(arrayBuffer), mime };
  }

  async listTemplates(): Promise<WhatsAppTemplateSummary[]> {
    const url = `${this.templatesEndpoint}?limit=200&fields=name,status,category,language,components`;
    const res = await fetch(url, { headers: this.authHeaders() });
    const text = await res.text();
    if (!res.ok) throw new Error(`List templates failed (HTTP ${res.status}): ${text}`);
    const json = text ? (JSON.parse(text) as { data?: unknown[] }) : {};
    const data = Array.isArray(json.data) ? json.data : [];
    return data.map((t) => {
      const row = t as Record<string, unknown>;
      return {
        name: String(row.name ?? ''),
        status: String(row.status ?? ''),
        category: String(row.category ?? ''),
        language: String(row.language ?? ''),
        body: extractBodyText(row.components),
      };
    });
  }

  async createTemplate(input: CreateTemplateInput): Promise<unknown> {
    const components = [
      {
        type: 'BODY',
        text: input.body,
        ...(input.example && input.example.length ? { example: { body_text: [input.example] } } : {}),
      },
    ];
    const res = await fetch(this.templatesEndpoint, {
      method: 'POST',
      headers: this.authHeaders(),
      body: JSON.stringify({
        name: input.name,
        category: input.category,
        language: input.language,
        components,
      }),
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`Create template failed (HTTP ${res.status}): ${text}`);
    return text ? JSON.parse(text) : {};
  }

  async deleteTemplate(name: string): Promise<void> {
    const url = `${this.templatesEndpoint}?name=${encodeURIComponent(name)}`;
    const res = await fetch(url, { method: 'DELETE', headers: this.authHeaders() });
    const text = await res.text();
    if (!res.ok) throw new Error(`Delete template failed (HTTP ${res.status}): ${text}`);
  }
}
