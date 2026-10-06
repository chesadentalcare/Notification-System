import { describe, expect, it } from 'vitest';
import { StaffCampaignService } from '../../src/application/StaffCampaignService.js';
import type { Env } from '../../src/config/env.js';
import type {
  EmployeeListResult,
  StaffAudienceMember,
  StaffChannel,
  MySqlEmployeeRepository,
} from '../../src/infrastructure/repositories/MySqlEmployeeRepository.js';
import type { MySqlStaffRepository, StaffRecipientInput } from '../../src/infrastructure/repositories/MySqlStaffRepository.js';
import type { SendNotificationUseCase } from '../../src/application/SendNotificationUseCase.js';

const audience: StaffAudienceMember[] = [
  { company: 'ashva', glCode: '36001', empId: 7, name: 'Asha', department: 'Service', contact: 'asha@chesa.in', phone: '9000000001', email: 'asha@chesa.in' },
  { company: 'ashva', glCode: '36002', empId: null, name: 'Vikram', department: 'Sales', contact: 'vik@chesa.in', phone: '9000000002', email: 'vik@chesa.in' },
];

class FakeEmployees {
  constructor(private readonly list: StaffAudienceMember[]) {}
  async buildAudience(): Promise<StaffAudienceMember[]> {
    return this.list;
  }
  async list(): Promise<EmployeeListResult> {
    return { items: [], total: this.list.length, limit: 1, offset: 0, available: true };
  }
}

class FakeStaff {
  campaigns: unknown[] = [];
  recipients: StaffRecipientInput[] = [];
  statuses: string[] = [];
  async createCampaign(input: unknown): Promise<void> {
    this.campaigns.push(input);
  }
  async addRecipients(rows: StaffRecipientInput[]): Promise<void> {
    this.recipients.push(...rows);
  }
  async setCampaignStatus(_id: string, status: string): Promise<void> {
    this.statuses.push(status);
  }
}

class FakeSend {
  sent: unknown[] = [];
  async execute(input: unknown): Promise<{ id: string; status: string; deduplicated: boolean }> {
    this.sent.push(input);
    return { id: `notif-${this.sent.length}`, status: 'PENDING', deduplicated: false };
  }
}

const env = {
  STAFF_MAX_RECIPIENTS: 5000,
  STAFF_CLIENT_ID: 'staff',
  STAFF_PORTAL_URL: 'https://portal.chesadentalcare.com/',
} as unknown as Env;

const build = (emp = new FakeEmployees(audience), staff = new FakeStaff(), send = new FakeSend()) => ({
  staff,
  send,
  service: new StaffCampaignService(
    emp as unknown as MySqlEmployeeRepository,
    staff as unknown as MySqlStaffRepository,
    send as unknown as SendNotificationUseCase,
    env
  ),
});

describe('StaffCampaignService', () => {
  it('enqueues one send per employee and marks the campaign SENT', async () => {
    const { service, staff, send } = build();

    const result = await service.createAndSend({
      name: 'Office closed Friday',
      channel: 'email' as StaffChannel,
      templateKey: 'staff-announcement',
    });

    expect(result.total).toBe(2);
    expect(result.enqueued).toBe(2);
    expect(result.failed).toBe(0);
    expect(send.sent).toHaveLength(2);
    expect(staff.recipients).toHaveLength(2);
    expect(staff.statuses).toContain('SENT');
  });

  it('includes the portal link and recipient data in each send', async () => {
    const { service, send } = build();
    await service.createAndSend({ name: 'x', channel: 'email' as StaffChannel, templateKey: 'staff-announcement' });

    const first = send.sent[0] as { clientId: string; data: Record<string, unknown>; recipient: Record<string, unknown> };
    expect(first.clientId).toBe('staff');
    expect(first.data.portalUrl).toContain('portal.chesadentalcare.com');
    expect(first.data.company).toBe('Ashva Health Tech');
    expect(first.recipient.email).toBe('asha@chesa.in');
  });

  it('a test send targets only the test contact', async () => {
    const { service, send } = build();
    const result = await service.createAndSend({
      name: 'Test',
      channel: 'email' as StaffChannel,
      templateKey: 'staff-announcement',
      testContact: 'me@example.com',
    });

    expect(result.test).toBe(true);
    expect(result.total).toBe(1);
    expect(send.sent).toHaveLength(1);
    expect((send.sent[0] as { recipient: { email: string } }).recipient.email).toBe('me@example.com');
  });

  it('marks the campaign FAILED when every send throws', async () => {
    const throwingSend = {
      async execute() {
        throw new Error('queue down');
      },
    };
    const { service, staff } = build(new FakeEmployees(audience), new FakeStaff(), throwingSend as unknown as FakeSend);

    const result = await service.createAndSend({ name: 'x', channel: 'email' as StaffChannel, templateKey: 'staff-announcement' });

    expect(result.enqueued).toBe(0);
    expect(result.failed).toBe(2);
    expect(staff.statuses).toContain('FAILED');
  });
});
