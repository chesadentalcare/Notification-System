import type { RowDataPacket } from 'mysql2/promise';
import type { DbPool } from '../db/pool.js';

export type CareChannel = 'email' | 'whatsapp';

export interface CustomerFilters {
  q?: string;
  company?: string;
  /** Only customers reachable on this channel (email present / phone present). */
  channel?: CareChannel;
  /** Only customers whose last purchase is within this many years. */
  withinYears?: number;
  limit: number;
  offset: number;
}

export interface CareCustomer {
  id: string; // composite `${company}:${cardCode}`
  company: string;
  cardCode: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  lastPurchaseDate: string | null;
  purchaseCount: number;
  optedOut: boolean;
}

export interface CustomerListResult {
  items: CareCustomer[];
  total: number;
  limit: number;
  offset: number;
  available: boolean; // false when the synced table isn't reachable (e.g. local dev)
}

export interface CustomerSegments {
  available: boolean;
  total: number;
  withEmail: number;
  withPhone: number;
  byCompany: Record<string, number>;
  syncedAt: string | null;
}

export interface AudienceMember {
  company: string;
  cardCode: string;
  name: string | null;
  contact: string; // email or phone, depending on channel
  phone: string | null;
  email: string | null;
}

interface CustomerRow extends RowDataPacket {
  company: string;
  card_code: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  last_purchase_date: string | null;
  purchase_count: number;
  opted_out: number;
}

const isMissingTable = (err: unknown): boolean => {
  const code = (err as { code?: string })?.code;
  return code === 'ER_NO_SUCH_TABLE' || code === 'ER_BAD_DB_ERROR' || code === 'ER_BAD_FIELD_ERROR';
};

const toCustomer = (r: CustomerRow): CareCustomer => ({
  id: `${r.company}:${r.card_code}`,
  company: r.company,
  cardCode: r.card_code,
  name: r.name,
  phone: r.phone,
  email: r.email,
  lastPurchaseDate: r.last_purchase_date ? String(r.last_purchase_date).slice(0, 10) : null,
  purchaseCount: Number(r.purchase_count) || 0,
  optedOut: !!r.opted_out,
});

export class MySqlCustomerRepository {
  private readonly table: string;

  constructor(
    private readonly pool: DbPool,
    customersDb: string
  ) {
    // customersDb comes from env; validate before interpolating into SQL.
    const db = /^[A-Za-z0-9_]+$/.test(customersDb) ? customersDb : 'production_dashboard';
    this.table = `\`${db}\`.care_customers`;
  }

  private buildWhere(filters: Partial<CustomerFilters>): { sql: string; params: unknown[] } {
    const where: string[] = [];
    const params: unknown[] = [];
    if (filters.channel === 'email') where.push("email IS NOT NULL AND email <> ''");
    if (filters.channel === 'whatsapp') where.push("phone IS NOT NULL AND phone <> ''");
    if (filters.company) {
      where.push('company = ?');
      params.push(filters.company);
    }
    if (filters.withinYears && filters.withinYears > 0) {
      where.push('last_purchase_date >= (CURDATE() - INTERVAL ? YEAR)');
      params.push(Math.trunc(filters.withinYears));
    }
    if (filters.q) {
      where.push('(name LIKE ? OR phone LIKE ? OR email LIKE ?)');
      const like = `%${filters.q}%`;
      params.push(like, like, like);
    }
    return { sql: where.length ? `WHERE ${where.join(' AND ')}` : '', params };
  }

  async list(filters: CustomerFilters): Promise<CustomerListResult> {
    const limit = Math.min(Math.max(1, Math.trunc(filters.limit) || 25), 200);
    const offset = Math.max(0, Math.trunc(filters.offset) || 0);
    const { sql: whereSql, params } = this.buildWhere(filters);
    try {
      const [countRows] = await this.pool.query<(RowDataPacket & { total: number })[]>(
        `SELECT COUNT(*) AS total FROM ${this.table} ${whereSql}`,
        params
      );
      const total = Number(countRows[0]?.total ?? 0);
      const [rows] = await this.pool.query<CustomerRow[]>(
        `SELECT company, card_code, name, phone, email, last_purchase_date, purchase_count, opted_out
           FROM ${this.table} ${whereSql}
          ORDER BY last_purchase_date DESC, name ASC
          LIMIT ${limit} OFFSET ${offset}`,
        params
      );
      return { items: rows.map(toCustomer), total, limit, offset, available: true };
    } catch (err) {
      if (isMissingTable(err)) return { items: [], total: 0, limit, offset, available: false };
      throw err;
    }
  }

  async segments(): Promise<CustomerSegments> {
    try {
      const [rows] = await this.pool.query<(RowDataPacket & { company: string; c: number; with_email: number; with_phone: number })[]>(
        `SELECT company,
                COUNT(*) AS c,
                SUM(email IS NOT NULL AND email <> '') AS with_email,
                SUM(phone IS NOT NULL AND phone <> '') AS with_phone
           FROM ${this.table}
          WHERE opted_out = 0
          GROUP BY company`
      );
      const [syncRows] = await this.pool.query<(RowDataPacket & { synced_at: string | null })[]>(
        `SELECT MAX(synced_at) AS synced_at FROM ${this.table}`
      );
      const byCompany: Record<string, number> = {};
      let total = 0;
      let withEmail = 0;
      let withPhone = 0;
      for (const r of rows) {
        byCompany[r.company] = Number(r.c);
        total += Number(r.c);
        withEmail += Number(r.with_email);
        withPhone += Number(r.with_phone);
      }
      return {
        available: true,
        total,
        withEmail,
        withPhone,
        byCompany,
        syncedAt: syncRows[0]?.synced_at ? String(syncRows[0].synced_at) : null,
      };
    } catch (err) {
      if (isMissingTable(err)) {
        return { available: false, total: 0, withEmail: 0, withPhone: 0, byCompany: {}, syncedAt: null };
      }
      throw err;
    }
  }

  /**
   * Resolve the recipients for a campaign: reachable, not opted out, matching the
   * filter, deduped by the contact used for the chosen channel. Capped by `cap`.
   */
  async buildAudience(
    channel: CareChannel,
    filters: { company?: string; withinYears?: number },
    cap: number
  ): Promise<AudienceMember[]> {
    const { sql: whereSql, params } = this.buildWhere({ ...filters, channel });
    const hardCap = Math.min(Math.max(1, Math.trunc(cap) || 1000), 50000);
    try {
      const [rows] = await this.pool.query<CustomerRow[]>(
        `SELECT company, card_code, name, phone, email
           FROM ${this.table}
          ${whereSql ? `${whereSql} AND` : 'WHERE'} opted_out = 0
          ORDER BY last_purchase_date DESC
          LIMIT ${hardCap}`,
        params
      );
      const seen = new Set<string>();
      const audience: AudienceMember[] = [];
      for (const r of rows) {
        const contact = (channel === 'email' ? r.email : r.phone)?.trim();
        if (!contact) continue;
        const key = contact.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        audience.push({ company: r.company, cardCode: r.card_code, name: r.name, contact, phone: r.phone, email: r.email });
      }
      return audience;
    } catch (err) {
      if (isMissingTable(err)) return [];
      throw err;
    }
  }

  async setOptOut(company: string, cardCode: string, optedOut: boolean): Promise<boolean> {
    try {
      const [res] = await this.pool.query(
        `UPDATE ${this.table} SET opted_out = ? WHERE company = ? AND card_code = ?`,
        [optedOut ? 1 : 0, company, cardCode]
      );
      return (res as { affectedRows?: number }).affectedRows ? true : false;
    } catch (err) {
      if (isMissingTable(err)) return false;
      throw err;
    }
  }
}
