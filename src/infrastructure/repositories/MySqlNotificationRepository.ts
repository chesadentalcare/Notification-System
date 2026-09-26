import type { RowDataPacket } from 'mysql2/promise';
import { Notification, type NotificationProps } from '../../domain/entities/Notification.js';
import type { AttemptRecord, NotificationRepository } from '../../domain/ports/NotificationRepository.js';
import type { NotificationStatus } from '../../domain/value-objects/NotificationStatus.js';
import type { DbPool } from '../db/pool.js';

interface NotificationRow extends RowDataPacket {
  id: string;
  client_id: string;
  channel: string;
  recipient: string;
  template_key: string;
  data: string;
  idempotency_key: string | null;
  status: string;
  attempts: number;
  last_error: string | null;
  created_at: Date;
  updated_at: Date;
}

interface AttemptRow extends RowDataPacket {
  attempt_no: number;
  status: string;
  error: string | null;
  provider_message_id: string | null;
  created_at: Date;
}

export interface NotificationListFilters {
  status?: string;
  channel?: string;
  clientId?: string;
  templateKey?: string;
  q?: string;
  limit: number;
  offset: number;
}

export interface NotificationListItem {
  id: string;
  clientId: string;
  channel: string;
  recipient: Record<string, unknown>;
  templateKey: string;
  status: string;
  attempts: number;
  lastError: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationListResult {
  items: NotificationListItem[];
  total: number;
  limit: number;
  offset: number;
}

export interface NotificationStats {
  total: number;
  today: number;
  byStatus: Record<string, number>;
  byChannel: Record<string, number>;
  daily: { date: string; count: number }[];
}

const parseJson = (v: unknown): Record<string, unknown> => {
  if (v == null) return {};
  if (typeof v === 'object') return v as Record<string, unknown>;
  try {
    return JSON.parse(String(v));
  } catch {
    return {};
  }
};

// MySQL DATE() may surface as a JS Date or a 'YYYY-MM-DD' string depending on the driver config.
const formatDay = (d: unknown): string => {
  if (typeof d === 'string') return d.slice(0, 10);
  if (d && typeof d === 'object' && 'toISOString' in d) {
    return (d as Date).toISOString().slice(0, 10);
  }
  return String(d).slice(0, 10);
};

const toProps = (row: NotificationRow): NotificationProps => ({
  id: row.id,
  clientId: row.client_id,
  channel: row.channel as NotificationProps['channel'],
  recipient: parseJson(row.recipient) as unknown as NotificationProps['recipient'],
  templateKey: row.template_key,
  data: parseJson(row.data),
  idempotencyKey: row.idempotency_key,
  status: row.status as NotificationStatus,
  attempts: row.attempts,
  lastError: row.last_error,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export class MySqlNotificationRepository implements NotificationRepository {
  constructor(private readonly pool: DbPool) {}

  async save(notification: Notification): Promise<void> {
    const p = notification.props;
    await this.pool.execute(
      `INSERT INTO notifications
         (id, client_id, channel, recipient, template_key, data, idempotency_key, status, attempts, last_error)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        p.id,
        p.clientId,
        p.channel,
        JSON.stringify(p.recipient),
        p.templateKey,
        JSON.stringify(p.data),
        p.idempotencyKey,
        p.status,
        p.attempts,
        p.lastError,
      ]
    );
  }

  async findById(id: string): Promise<Notification | null> {
    const [rows] = await this.pool.execute<NotificationRow[]>(
      `SELECT * FROM notifications WHERE id = ? LIMIT 1`,
      [id]
    );
    const row = rows[0];
    return row ? Notification.restore(toProps(row)) : null;
  }

  async findByIdempotencyKey(clientId: string, key: string): Promise<Notification | null> {
    const [rows] = await this.pool.execute<NotificationRow[]>(
      `SELECT * FROM notifications WHERE client_id = ? AND idempotency_key = ? LIMIT 1`,
      [clientId, key]
    );
    const row = rows[0];
    return row ? Notification.restore(toProps(row)) : null;
  }

  async updateStatus(id: string, status: NotificationStatus, lastError: string | null = null): Promise<void> {
    await this.pool.execute(
      `UPDATE notifications
          SET status = ?,
              last_error = ?,
              attempts = attempts + IF(? = 'PROCESSING', 1, 0),
              updated_at = NOW()
        WHERE id = ?`,
      [status, lastError, status, id]
    );
  }

  async recordAttempt(id: string, attempt: AttemptRecord): Promise<void> {
    await this.pool.execute(
      `INSERT INTO notification_attempts (notification_id, attempt_no, status, error, provider_message_id)
       VALUES (?, ?, ?, ?, ?)`,
      [id, attempt.attemptNo, attempt.status, attempt.error, attempt.providerMessageId]
    );
  }

  async listAttempts(id: string): Promise<AttemptRecord[]> {
    const [rows] = await this.pool.execute<AttemptRow[]>(
      `SELECT attempt_no, status, error, provider_message_id, created_at
         FROM notification_attempts WHERE notification_id = ? ORDER BY attempt_no`,
      [id]
    );
    return rows.map((r) => ({
      attemptNo: r.attempt_no,
      status: r.status as AttemptRecord['status'],
      error: r.error,
      providerMessageId: r.provider_message_id,
      createdAt: r.created_at,
    }));
  }

  // ---- Admin queries (read models for the admin UI) ----

  async list(filters: NotificationListFilters): Promise<NotificationListResult> {
    const where: string[] = [];
    const params: unknown[] = [];
    if (filters.status) {
      where.push('status = ?');
      params.push(filters.status);
    }
    if (filters.channel) {
      where.push('channel = ?');
      params.push(filters.channel);
    }
    if (filters.clientId) {
      where.push('client_id = ?');
      params.push(filters.clientId);
    }
    if (filters.templateKey) {
      where.push('template_key = ?');
      params.push(filters.templateKey);
    }
    if (filters.q) {
      where.push('(id LIKE ? OR recipient LIKE ? OR template_key LIKE ?)');
      const like = `%${filters.q}%`;
      params.push(like, like, like);
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    // limit/offset are clamped integers we control, so inlining them is safe.
    const limit = Math.min(Math.max(1, Math.trunc(filters.limit) || 25), 200);
    const offset = Math.max(0, Math.trunc(filters.offset) || 0);

    const [countRows] = await this.pool.query<(RowDataPacket & { total: number })[]>(
      `SELECT COUNT(*) AS total FROM notifications ${whereSql}`,
      params
    );
    const total = Number(countRows[0]?.total ?? 0);

    const [rows] = await this.pool.query<NotificationRow[]>(
      `SELECT * FROM notifications ${whereSql} ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`,
      params
    );
    const items: NotificationListItem[] = rows.map((r) => ({
      id: r.id,
      clientId: r.client_id,
      channel: r.channel,
      recipient: parseJson(r.recipient),
      templateKey: r.template_key,
      status: r.status,
      attempts: r.attempts,
      lastError: r.last_error,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
    return { items, total, limit, offset };
  }

  async stats(): Promise<NotificationStats> {
    const [statusRows] = await this.pool.query<(RowDataPacket & { status: string; c: number })[]>(
      `SELECT status, COUNT(*) AS c FROM notifications GROUP BY status`
    );
    const [channelRows] = await this.pool.query<(RowDataPacket & { channel: string; c: number })[]>(
      `SELECT channel, COUNT(*) AS c FROM notifications GROUP BY channel`
    );
    const [totalRows] = await this.pool.query<(RowDataPacket & { total: number })[]>(
      `SELECT COUNT(*) AS total FROM notifications`
    );
    const [todayRows] = await this.pool.query<(RowDataPacket & { c: number })[]>(
      `SELECT COUNT(*) AS c FROM notifications WHERE created_at >= CURDATE()`
    );
    const [dailyRows] = await this.pool.query<(RowDataPacket & { d: unknown; c: number })[]>(
      `SELECT DATE(created_at) AS d, COUNT(*) AS c
         FROM notifications
        WHERE created_at >= (CURDATE() - INTERVAL 13 DAY)
        GROUP BY DATE(created_at)
        ORDER BY d`
    );

    const byStatus: Record<string, number> = {};
    for (const r of statusRows) byStatus[r.status] = Number(r.c);
    const byChannel: Record<string, number> = {};
    for (const r of channelRows) byChannel[r.channel] = Number(r.c);
    const daily = dailyRows.map((r) => ({
      date: formatDay(r.d),
      count: Number(r.c),
    }));

    return {
      total: Number(totalRows[0]?.total ?? 0),
      today: Number(todayRows[0]?.c ?? 0),
      byStatus,
      byChannel,
      daily,
    };
  }
}
