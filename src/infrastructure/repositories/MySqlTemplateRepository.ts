import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import type { NotificationTemplate, TemplateRepository } from '../../domain/ports/TemplateRepository.js';
import type { ChannelType } from '../../domain/value-objects/ChannelType.js';
import type { DbPool } from '../db/pool.js';

interface TemplateRow extends RowDataPacket {
  template_key: string;
  channel: string;
  subject: string;
  body: string;
}

interface AdminTemplateRow extends RowDataPacket {
  id: number;
  template_key: string;
  channel: string;
  subject: string;
  body: string;
  active: number;
  created_at: Date;
  updated_at: Date;
}

export interface AdminTemplate {
  id: number;
  templateKey: string;
  channel: string;
  subject: string;
  body: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface TemplateInput {
  templateKey: string;
  channel: string;
  subject: string;
  body: string;
  active?: boolean;
}

const toAdminTemplate = (r: AdminTemplateRow): AdminTemplate => ({
  id: r.id,
  templateKey: r.template_key,
  channel: r.channel,
  subject: r.subject,
  body: r.body,
  active: !!r.active,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export class MySqlTemplateRepository implements TemplateRepository {
  private cache = new Map<string, { value: NotificationTemplate; expires: number }>();

  constructor(
    private readonly pool: DbPool,
    private readonly ttlMs = 60_000
  ) {}

  async find(templateKey: string, channel: ChannelType): Promise<NotificationTemplate | null> {
    const cacheKey = `${templateKey}:${channel}`;
    const hit = this.cache.get(cacheKey);
    if (hit && hit.expires > Date.now()) return hit.value;

    const [rows] = await this.pool.execute<TemplateRow[]>(
      `SELECT template_key, channel, subject, body
         FROM templates WHERE template_key = ? AND channel = ? AND active = 1 LIMIT 1`,
      [templateKey, channel]
    );
    const row = rows[0];
    if (!row) return null;
    const value: NotificationTemplate = {
      templateKey: row.template_key,
      channel: row.channel as ChannelType,
      subject: row.subject,
      body: row.body,
    };
    this.cache.set(cacheKey, { value, expires: Date.now() + this.ttlMs });
    return value;
  }

  // ---- Admin CRUD (bypasses the read cache; invalidates it on writes) ----

  async listAll(): Promise<AdminTemplate[]> {
    const [rows] = await this.pool.query<AdminTemplateRow[]>(
      `SELECT id, template_key, channel, subject, body, active, created_at, updated_at
         FROM templates ORDER BY template_key, channel`
    );
    return rows.map(toAdminTemplate);
  }

  async getById(id: number): Promise<AdminTemplate | null> {
    const [rows] = await this.pool.execute<AdminTemplateRow[]>(
      `SELECT id, template_key, channel, subject, body, active, created_at, updated_at
         FROM templates WHERE id = ? LIMIT 1`,
      [id]
    );
    return rows[0] ? toAdminTemplate(rows[0]) : null;
  }

  async create(input: TemplateInput): Promise<AdminTemplate> {
    const [res] = await this.pool.execute<ResultSetHeader>(
      `INSERT INTO templates (template_key, channel, subject, body, active)
       VALUES (?, ?, ?, ?, ?)`,
      [input.templateKey, input.channel, input.subject, input.body, input.active === false ? 0 : 1]
    );
    this.cache.clear();
    const created = await this.getById(res.insertId);
    if (!created) throw new Error('Failed to load template after insert');
    return created;
  }

  async update(id: number, input: TemplateInput): Promise<AdminTemplate | null> {
    await this.pool.execute(
      `UPDATE templates
          SET template_key = ?, channel = ?, subject = ?, body = ?, active = ?, updated_at = NOW()
        WHERE id = ?`,
      [input.templateKey, input.channel, input.subject, input.body, input.active === false ? 0 : 1, id]
    );
    this.cache.clear();
    return this.getById(id);
  }

  async remove(id: number): Promise<boolean> {
    const [res] = await this.pool.execute<ResultSetHeader>(`DELETE FROM templates WHERE id = ?`, [id]);
    this.cache.clear();
    return res.affectedRows > 0;
  }
}
