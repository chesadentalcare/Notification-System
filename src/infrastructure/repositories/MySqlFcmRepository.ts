import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import type { DbPool } from '../db/pool.js';

export type FcmAudience = 'employees' | 'dealers';
export type FcmPlatform = 'android' | 'ios' | 'web';

export interface FcmDeviceCounts {
  total: number;
  android: number;
  ios: number;
  web: number;
}

export interface FcmOverview {
  employees: FcmDeviceCounts;
  dealers: FcmDeviceCounts;
}

export interface FcmGetTokensQuery {
  audience: FcmAudience;
  platform?: FcmPlatform;
  ids?: string[];
}

export interface FcmLogSendInput {
  audience: FcmAudience;
  notificationType: string;
  title: string;
  body: string;
  data: unknown;
  recipients: unknown;
  successCount: number;
  failureCount: number;
  responseDetails: unknown;
  sentBy: string;
}

export interface FcmHistoryQuery {
  audience: FcmAudience;
  limit: number;
}

export interface FcmHistoryItem {
  id: number;
  title: string;
  body: string;
  notificationType: string;
  successCount: number;
  failureCount: number;
  sentBy: string;
  at: Date;
}

interface CountRow extends RowDataPacket {
  device_type: string;
  cnt: number;
}

interface TokenRow extends RowDataPacket {
  fcm_token: string;
}

interface HistoryRow extends RowDataPacket {
  id: number;
  notification_type: string;
  title: string;
  body: string;
  success_count: number;
  failure_count: number;
  sent_by: string;
  created_at: Date;
}

interface AudienceTables {
  db: string;
  tokenTable: string;
  idColumn: string;
  logTable: string;
}

// Reads the per-audience device-token tables and appends push-send audit rows.
// Employees and dealers each have their own DB, token table and log table. DB names
// are validated (identifiers can't be bound as parameters) and backtick-quoted.
export class MySqlFcmRepository {
  private readonly employees: AudienceTables;
  private readonly dealers: AudienceTables;

  constructor(private readonly pool: DbPool, empDb: string, dealerDb: string) {
    const emp = /^[A-Za-z0-9_]+$/.test(empDb) ? empDb : 'production_dashboard';
    const dealer = /^[A-Za-z0-9_]+$/.test(dealerDb) ? dealerDb : 'dealer_mobile_app';
    this.employees = {
      db: emp,
      tokenTable: `\`${emp}\`.fcm_tokens`,
      idColumn: 'emp_id',
      logTable: `\`${emp}\`.notification_logs`,
    };
    this.dealers = {
      db: dealer,
      tokenTable: `\`${dealer}\`.dealer_fcm_tokens`,
      idColumn: 'dealer_id',
      logTable: `\`${dealer}\`.dealer_notification_logs`,
    };
  }

  private tables(audience: FcmAudience): AudienceTables {
    return audience === 'dealers' ? this.dealers : this.employees;
  }

  private async countByDevice(tokenTable: string): Promise<FcmDeviceCounts> {
    const [rows] = await this.pool.query<CountRow[]>(
      `SELECT device_type, COUNT(*) AS cnt FROM ${tokenTable} WHERE is_active = 1 GROUP BY device_type`
    );
    const counts: FcmDeviceCounts = { total: 0, android: 0, ios: 0, web: 0 };
    for (const row of rows) {
      const n = Number(row.cnt) || 0;
      counts.total += n;
      const type = String(row.device_type ?? '').toLowerCase();
      if (type === 'android') counts.android += n;
      else if (type === 'ios') counts.ios += n;
      else if (type === 'web') counts.web += n;
    }
    return counts;
  }

  async overview(): Promise<FcmOverview> {
    const [employees, dealers] = await Promise.all([
      this.countByDevice(this.employees.tokenTable),
      this.countByDevice(this.dealers.tokenTable),
    ]);
    return { employees, dealers };
  }

  async getTokens(query: FcmGetTokensQuery): Promise<string[]> {
    const t = this.tables(query.audience);
    const clauses = ['is_active = 1'];
    const params: unknown[] = [];
    if (query.platform) {
      clauses.push('device_type = ?');
      params.push(query.platform);
    }
    if (query.ids && query.ids.length > 0) {
      clauses.push(`${t.idColumn} IN (${query.ids.map(() => '?').join(', ')})`);
      params.push(...query.ids);
    }
    const [rows] = await this.pool.query<TokenRow[]>(
      `SELECT DISTINCT fcm_token FROM ${t.tokenTable} WHERE ${clauses.join(' AND ')}`,
      params
    );
    return rows
      .map((r) => String(r.fcm_token ?? '').trim())
      .filter((token) => token.length > 0);
  }

  async logSend(input: FcmLogSendInput): Promise<number> {
    const t = this.tables(input.audience);
    const [result] = await this.pool.execute<ResultSetHeader>(
      `INSERT INTO ${t.logTable}
         (notification_type, title, body, data, recipients, success_count, failure_count, response_details, sent_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.notificationType,
        input.title,
        input.body,
        JSON.stringify(input.data ?? {}),
        JSON.stringify(input.recipients ?? []),
        input.successCount,
        input.failureCount,
        JSON.stringify(input.responseDetails ?? []),
        input.sentBy,
      ]
    );
    return result.insertId;
  }

  async history(query: FcmHistoryQuery): Promise<FcmHistoryItem[]> {
    const t = this.tables(query.audience);
    const limit = Math.min(Math.max(1, Math.trunc(query.limit) || 25), 200);
    const [rows] = await this.pool.query<HistoryRow[]>(
      `SELECT id, notification_type, title, body, success_count, failure_count, sent_by, created_at
         FROM ${t.logTable}
        ORDER BY created_at DESC
        LIMIT ${limit}`
    );
    return rows.map((r) => ({
      id: Number(r.id),
      title: r.title,
      body: r.body,
      notificationType: r.notification_type,
      successCount: Number(r.success_count) || 0,
      failureCount: Number(r.failure_count) || 0,
      sentBy: r.sent_by,
      at: r.created_at,
    }));
  }
}
