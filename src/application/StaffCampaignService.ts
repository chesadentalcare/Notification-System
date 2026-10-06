import { randomUUID } from 'node:crypto';
import type { Env } from '../config/env.js';
import type { SendNotificationUseCase } from './SendNotificationUseCase.js';
import type {
  StaffAudienceMember,
  StaffChannel,
  MySqlEmployeeRepository,
} from '../infrastructure/repositories/MySqlEmployeeRepository.js';
import type { MySqlStaffRepository, StaffRecipientInput } from '../infrastructure/repositories/MySqlStaffRepository.js';

export interface StaffCampaignInput {
  name: string;
  channel: StaffChannel;
  templateKey: string;
  company?: string;
  department?: string;
  /** Optional per-campaign recipient cap (still bounded by STAFF_MAX_RECIPIENTS). */
  limit?: number;
  /** Send only to this address/number instead of the real audience (preview/test). */
  testContact?: string;
  /** Optional Meta-approved WhatsApp template payload (name/language/components). */
  whatsappTemplate?: unknown;
  createdBy?: string | null;
}

export interface StaffCampaignResult {
  campaignId: string;
  channel: StaffChannel;
  total: number;
  enqueued: number;
  failed: number;
  test: boolean;
}

export class StaffCampaignService {
  constructor(
    private readonly employees: MySqlEmployeeRepository,
    private readonly staff: MySqlStaffRepository,
    private readonly sendNotification: SendNotificationUseCase,
    private readonly env: Env
  ) {}

  /** True reachable-audience size for the given channel + filter (for the UI preview). */
  async estimate(channel: StaffChannel, filter: { company?: string; department?: string }): Promise<number> {
    const res = await this.employees.list({ ...filter, channel, activeOnly: true, limit: 1, offset: 0 });
    return res.total;
  }

  private portalLink(): string | null {
    const base = this.env.STAFF_PORTAL_URL;
    if (!base) return null;
    const url = new URL(base);
    url.searchParams.set('src', 'staff');
    return url.toString();
  }

  async createAndSend(input: StaffCampaignInput): Promise<StaffCampaignResult> {
    const channel = input.channel;
    const cap = Math.min(input.limit ?? this.env.STAFF_MAX_RECIPIENTS, this.env.STAFF_MAX_RECIPIENTS);

    let audience: StaffAudienceMember[];
    if (input.testContact) {
      audience = [
        {
          company: input.company ?? 'test',
          glCode: 'TEST',
          empId: null,
          name: 'Test',
          department: input.department ?? null,
          contact: input.testContact,
          phone: channel === 'whatsapp' ? input.testContact : null,
          email: channel === 'email' ? input.testContact : null,
        },
      ];
    } else {
      audience = await this.employees.buildAudience(channel, { company: input.company, department: input.department }, cap);
    }

    const portalUrl = this.portalLink();
    const campaignId = randomUUID();
    await this.staff.createCampaign({
      id: campaignId,
      name: input.name,
      channel,
      templateKey: input.templateKey,
      filter: {
        company: input.company ?? null,
        department: input.department ?? null,
        test: !!input.testContact,
      },
      portalUrl,
      total: audience.length,
      createdBy: input.createdBy ?? null,
    });

    const recipients: StaffRecipientInput[] = [];
    let enqueued = 0;
    let failed = 0;

    for (const m of audience) {
      const data: Record<string, unknown> = {
        company: companyLabel(m.company),
        department: m.department ?? '',
        campaignId,
      };
      if (portalUrl) data.portalUrl = portalUrl;
      if (channel === 'whatsapp' && input.whatsappTemplate) data.whatsappTemplate = input.whatsappTemplate;

      const recipient =
        channel === 'email'
          ? { email: m.contact, name: m.name ?? undefined }
          : { phone: m.contact };

      try {
        const res = await this.sendNotification.execute({
          clientId: this.env.STAFF_CLIENT_ID,
          channel,
          recipient,
          templateKey: input.templateKey,
          data,
          idempotencyKey: `staff-${campaignId}-${m.company}-${m.glCode}`.slice(0, 120),
        });
        recipients.push({
          campaignId,
          company: m.company,
          glCode: m.glCode,
          department: m.department,
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
          glCode: m.glCode,
          department: m.department,
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
      await this.staff.addRecipients(recipients.slice(i, i + 500));
    }
    await this.staff.setCampaignStatus(campaignId, failed === 0 ? 'SENT' : enqueued === 0 ? 'FAILED' : 'PARTIAL');

    return { campaignId, channel, total: audience.length, enqueued, failed, test: !!input.testContact };
  }
}

const COMPANY_LABELS: Record<string, string> = {
  cdcsl: 'Chesa Dental Care',
  chesa_inc: 'Chesa Inc',
  ashva: 'Ashva Health Tech',
};
const companyLabel = (code: string): string => COMPANY_LABELS[code] ?? 'Chesa';
