import { randomUUID } from 'node:crypto';
import type { Env } from '../config/env.js';
import type { SendNotificationUseCase } from './SendNotificationUseCase.js';
import type {
  AudienceMember,
  CareChannel,
  MySqlCustomerRepository,
} from '../infrastructure/repositories/MySqlCustomerRepository.js';
import type { MySqlCareRepository, RecipientInput } from '../infrastructure/repositories/MySqlCareRepository.js';

export interface CareCampaignInput {
  name: string;
  channel: CareChannel;
  templateKey: string;
  company?: string;
  withinYears?: number;
  /** Optional per-campaign recipient cap (still bounded by CARE_MAX_RECIPIENTS). */
  limit?: number;
  /** Send only to this address/number instead of the real audience (preview/test). */
  testContact?: string;
  /** Optional Meta-approved WhatsApp template payload (name/language/components). */
  whatsappTemplate?: unknown;
  createdBy?: string | null;
}

export interface CareCampaignResult {
  campaignId: string;
  channel: CareChannel;
  total: number;
  enqueued: number;
  failed: number;
  test: boolean;
}

export class CareCampaignService {
  constructor(
    private readonly customers: MySqlCustomerRepository,
    private readonly care: MySqlCareRepository,
    private readonly sendNotification: SendNotificationUseCase,
    private readonly env: Env
  ) {}

  /** True reachable-audience size for the given channel + filter (for the UI preview). */
  async estimate(channel: CareChannel, filter: { company?: string; withinYears?: number }): Promise<number> {
    const res = await this.customers.list({ ...filter, channel, limit: 1, offset: 0 });
    return res.total;
  }

  /** Build the per-recipient deep link into the complaint site, prefilled with phone. */
  private complaintLink(phone: string | null): string {
    const base = this.env.COMPLAINT_URL;
    const url = new URL(base);
    if (phone) url.searchParams.set('phone', phone);
    url.searchParams.set('src', 'care');
    return url.toString();
  }

  async createAndSend(input: CareCampaignInput): Promise<CareCampaignResult> {
    const channel = input.channel;
    const cap = Math.min(input.limit ?? this.env.CARE_MAX_RECIPIENTS, this.env.CARE_MAX_RECIPIENTS);

    let audience: AudienceMember[];
    if (input.testContact) {
      audience = [{ company: input.company ?? 'test', cardCode: 'TEST', name: 'Test', contact: input.testContact, phone: channel === 'whatsapp' ? input.testContact : null, email: channel === 'email' ? input.testContact : null }];
    } else {
      audience = await this.customers.buildAudience(channel, { company: input.company, withinYears: input.withinYears }, cap);
    }

    const campaignId = randomUUID();
    await this.care.createCampaign({
      id: campaignId,
      name: input.name,
      channel,
      templateKey: input.templateKey,
      filter: { company: input.company ?? null, withinYears: input.withinYears ?? null, test: !!input.testContact },
      complaintUrl: this.env.COMPLAINT_URL,
      total: audience.length,
      createdBy: input.createdBy ?? null,
    });

    const recipients: RecipientInput[] = [];
    let enqueued = 0;
    let failed = 0;

    for (const m of audience) {
      const complaintUrl = this.complaintLink(m.phone ?? (channel === 'whatsapp' ? m.contact : null));
      const data: Record<string, unknown> = {
        complaintUrl,
        company: companyLabel(m.company),
        campaignId,
      };
      if (channel === 'whatsapp' && input.whatsappTemplate) data.whatsappTemplate = input.whatsappTemplate;

      const recipient =
        channel === 'email'
          ? { email: m.contact, name: m.name ?? undefined }
          : { phone: m.contact };

      try {
        const res = await this.sendNotification.execute({
          clientId: this.env.CARE_CLIENT_ID,
          channel,
          recipient,
          templateKey: input.templateKey,
          data,
          idempotencyKey: `care-${campaignId}-${m.company}-${m.cardCode}`.slice(0, 120),
        });
        recipients.push({
          campaignId,
          company: m.company,
          cardCode: m.cardCode,
          channel,
          recipient: m.contact,
          name: m.name,
          notificationId: res.id,
          status: 'QUEUED',
        });
        enqueued++;
      } catch (err) {
        recipients.push({
          campaignId,
          company: m.company,
          cardCode: m.cardCode,
          channel,
          recipient: m.contact,
          name: m.name,
          notificationId: null,
          status: 'FAILED',
          error: err instanceof Error ? err.message : 'enqueue failed',
        });
        failed++;
      }
    }

    // Persist recipient rows in batches.
    for (let i = 0; i < recipients.length; i += 500) {
      await this.care.addRecipients(recipients.slice(i, i + 500));
    }
    await this.care.setCampaignStatus(campaignId, failed === 0 ? 'SENT' : enqueued === 0 ? 'FAILED' : 'PARTIAL');

    return { campaignId, channel, total: audience.length, enqueued, failed, test: !!input.testContact };
  }
}

const COMPANY_LABELS: Record<string, string> = {
  cdcsl: 'Chesa Dental Care',
  chesa_inc: 'Chesa Inc',
  ashva: 'Ashva Health Tech',
};
const companyLabel = (code: string): string => COMPANY_LABELS[code] ?? 'Chesa';
