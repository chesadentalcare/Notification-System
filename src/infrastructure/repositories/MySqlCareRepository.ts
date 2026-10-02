import type { RowDataPacket } from 'mysql2/promise';
import type { DbPool } from '../db/pool.js';

export interface CareCampaignRow extends RowDataPacket {
  id: string;
  name: string;
  channel: string;
  template_key: string;
  filter_json: unknown;
  complaint_url: string | null;
  total: number;
  status: string;
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface CreateCampaignInput {
  id: string;
  name: string;
  channel: string;
  templateKey: string;
  filter: unknown;
  complaintUrl: string;
  total: number;
  createdBy?: string | null;
}

export interface RecipientInput {
  campaignId: string;
  company: string;
  cardCode: string;
  channel: string;
  recipient: string;
  name: string | null;
  notificationId: string | null;
  status: string;
  error?: string | null;
}

export interface CampaignView {
  id: string;
  name: string;
  channel: string;
  templateKey: string;
  complaintUrl: string | null;
  total: number;
  status: string;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  counts: Record<string, number>;
}

const toView = (r: CareCampaignRow, counts: Record<string, number>): CampaignView => ({
  id: r.id,
  name: r.name,
  channel: r.channel,
  templateKey: r.template_key,
  complaintUrl: r.complaint_url,
  total: r.total,
  status: r.status,
  createdBy: r.created_by,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
  counts,
});

export class MySqlCareRepository {
  constructor(private readonly pool: DbPool) {}

  async createCampaign(input: CreateCampaignInput): Promise<void> {
    await this.pool.execute(
      `INSERT INTO care_campaigns (id, name, channel, template_key, filter_json, complaint_url, total, status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'QUEUED', ?)`,
      [
        input.id,
        input.name,
        input.channel,
        input.templateKey,
        JSON.stringify(input.filter ?? {}),
        input.complaintUrl,
        input.total,
        input.createdBy ?? null,
      ]
    );
  }

  async addRecipients(rows: RecipientInput[]): Promise<void> {
    if (!rows.length) return;
    const values = rows.map((r) => [
      r.campaignId,
      r.company,
      r.cardCode,
      r.channel,
      r.recipient,
      r.name,
      r.notificationId,
      r.status,
      r.error ?? null,
    ]);
    await this.pool.query(
      `INSERT INTO care_campaign_recipients
         (campaign_id, company, card_code, channel, recipient, name, notification_id, status, error)
       VALUES ?
       ON DUPLICATE KEY UPDATE notification_id = VALUES(notification_id), status = VALUES(status), error = VALUES(error)`,
      [values]
    );
  }

  async setCampaignStatus(id: string, status: string): Promise<void> {
    await this.pool.execute(`UPDATE care_campaigns SET status = ? WHERE id = ?`, [status, id]);
  }

  // Live per-campaign status breakdown from the underlying notifications.
  private async countsFor(campaignId: string): Promise<Record<string, number>> {
    const [rows] = await this.pool.query<(RowDataPacket & { status: string; c: number })[]>(
      `SELECT COALESCE(n.status, r.status) AS status, COUNT(*) AS c
         FROM care_campaign_recipients r
         LEFT JOIN notifications n ON n.id = r.notification_id
        WHERE r.campaign_id = ?
        GROUP BY COALESCE(n.status, r.status)`,
      [campaignId]
    );
    const counts: Record<string, number> = {};
    for (const r of rows) counts[r.status] = Number(r.c);
    return counts;
  }

  async listCampaigns(limit = 50, offset = 0): Promise<CampaignView[]> {
    const lim = Math.min(Math.max(1, Math.trunc(limit) || 50), 200);
    const off = Math.max(0, Math.trunc(offset) || 0);
    const [rows] = await this.pool.query<CareCampaignRow[]>(
      `SELECT * FROM care_campaigns ORDER BY created_at DESC LIMIT ${lim} OFFSET ${off}`
    );
    const views: CampaignView[] = [];
    for (const r of rows) views.push(toView(r, await this.countsFor(r.id)));
    return views;
  }

  async getCampaign(id: string): Promise<CampaignView | null> {
    const [rows] = await this.pool.execute<CareCampaignRow[]>(
      `SELECT * FROM care_campaigns WHERE id = ? LIMIT 1`,
      [id]
    );
    const row = rows[0];
    if (!row) return null;
    return toView(row, await this.countsFor(id));
  }

  async listRecipients(
    campaignId: string,
    limit = 100,
    offset = 0
  ): Promise<{ recipient: string; name: string | null; company: string | null; status: string; error: string | null }[]> {
    const lim = Math.min(Math.max(1, Math.trunc(limit) || 100), 500);
    const off = Math.max(0, Math.trunc(offset) || 0);
    const [rows] = await this.pool.query<
      (RowDataPacket & { recipient: string; name: string | null; company: string | null; status: string; error: string | null })[]
    >(
      `SELECT r.recipient, r.name, r.company,
              COALESCE(n.status, r.status) AS status,
              COALESCE(n.last_error, r.error) AS error
         FROM care_campaign_recipients r
         LEFT JOIN notifications n ON n.id = r.notification_id
        WHERE r.campaign_id = ?
        ORDER BY r.id
        LIMIT ${lim} OFFSET ${off}`,
      [campaignId]
    );
    return rows.map((r) => ({
      recipient: r.recipient,
      name: r.name,
      company: r.company,
      status: r.status,
      error: r.error,
    }));
  }
}
