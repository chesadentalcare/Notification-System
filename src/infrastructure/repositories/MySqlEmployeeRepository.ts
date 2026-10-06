import type { RowDataPacket } from 'mysql2/promise';
import type { DbPool } from '../db/pool.js';

export type StaffChannel = 'email' | 'whatsapp';

export interface EmployeeFilters {
  q?: string;
  company?: string;
  department?: string;
  /** Only employees reachable on this channel (email present / phone present). */
  channel?: StaffChannel;
  /** Exclude deactivated (left-the-company) employees. Defaults to true. */
  activeOnly?: boolean;
  limit: number;
  offset: number;
}

export interface StaffMember {
  id: string; // composite `${company}:${glCode}`
  company: string;
  glCode: string;
  hrCode: string | null;
  empId: number | null;
  name: string | null;
  phone: string | null;
  email: string | null;
  department: string | null;
  position: string | null;
  active: boolean;
  optedOut: boolean;
}

export interface EmployeeListResult {
  items: StaffMember[];
  total: number;
  limit: number;
  offset: number;
  available: boolean; // false when the synced table isn't reachable (e.g. local dev)
}

export interface EmployeeSegments {
  available: boolean;
  total: number;
  withEmail: number;
  withPhone: number;
  byDepartment: Record<string, number>;
  byCompany: Record<string, number>;
  syncedAt: string | null;
}

export interface StaffAudienceMember {
  company: string;
  glCode: string;
  empId: number | null;
  name: string | null;
  department: string | null;
  contact: string; // email or phone, depending on channel
  phone: string | null;
  email: string | null;
}

interface EmployeeRow extends RowDataPacket {
  company: string;
  gl_code: string;
  hr_code: string | null;
  emp_id: number | null;
  name: string | null;
  phone: string | null;
  email: string | null;
  department: string | null;
  position: string | null;
  active: number;
  opted_out: number;
}

const isMissingTable = (err: unknown): boolean => {
  const code = (err as { code?: string })?.code;
  return code === 'ER_NO_SUCH_TABLE' || code === 'ER_BAD_DB_ERROR' || code === 'ER_BAD_FIELD_ERROR';
};

const toEmployee = (r: EmployeeRow): StaffMember => ({
  id: `${r.company}:${r.gl_code}`,
  company: r.company,
  glCode: r.gl_code,
  hrCode: r.hr_code,
  empId: r.emp_id == null ? null : Number(r.emp_id),
  name: r.name,
  phone: r.phone,
  email: r.email,
  department: r.department,
  position: r.position,
  active: !!r.active,
  optedOut: !!r.opted_out,
});

export class MySqlEmployeeRepository {
  private readonly table: string;

  constructor(
    private readonly pool: DbPool,
    employeesDb: string
  ) {
    // employeesDb comes from env; validate before interpolating into SQL.
    const db = /^[A-Za-z0-9_]+$/.test(employeesDb) ? employeesDb : 'production_dashboard';
    this.table = `\`${db}\`.employees`;
  }

  private buildWhere(filters: Partial<EmployeeFilters>): { sql: string; params: unknown[] } {
    const where: string[] = [];
    const params: unknown[] = [];
    if (filters.channel === 'email') where.push("email IS NOT NULL AND email <> ''");
    if (filters.channel === 'whatsapp') where.push("phone IS NOT NULL AND phone <> ''");
    if (filters.company) {
      where.push('company = ?');
      params.push(filters.company);
    }
    if (filters.department) {
      where.push('department = ?');
      params.push(filters.department);
    }
    if (filters.activeOnly) where.push('active = 1');
    if (filters.q) {
      where.push('(name LIKE ? OR phone LIKE ? OR email LIKE ? OR gl_code LIKE ?)');
      const like = `%${filters.q}%`;
      params.push(like, like, like, like);
    }
    return { sql: where.length ? `WHERE ${where.join(' AND ')}` : '', params };
  }

  async list(filters: EmployeeFilters): Promise<EmployeeListResult> {
    const limit = Math.min(Math.max(1, Math.trunc(filters.limit) || 25), 200);
    const offset = Math.max(0, Math.trunc(filters.offset) || 0);
    const { sql: whereSql, params } = this.buildWhere(filters);
    try {
      const [countRows] = await this.pool.query<(RowDataPacket & { total: number })[]>(
        `SELECT COUNT(*) AS total FROM ${this.table} ${whereSql}`,
        params
      );
      const total = Number(countRows[0]?.total ?? 0);
      const [rows] = await this.pool.query<EmployeeRow[]>(
        `SELECT company, gl_code, hr_code, emp_id, name, phone, email, department, position, active, opted_out
           FROM ${this.table} ${whereSql}
          ORDER BY active DESC, department ASC, name ASC
          LIMIT ${limit} OFFSET ${offset}`,
        params
      );
      return { items: rows.map(toEmployee), total, limit, offset, available: true };
    } catch (err) {
      if (isMissingTable(err)) return { items: [], total: 0, limit, offset, available: false };
      throw err;
    }
  }

  async segments(): Promise<EmployeeSegments> {
    try {
      const [rows] = await this.pool.query<
        (RowDataPacket & { company: string; department: string | null; c: number; with_email: number; with_phone: number })[]
      >(
        `SELECT company,
                COALESCE(NULLIF(department, ''), 'Unspecified') AS department,
                COUNT(*) AS c,
                SUM(email IS NOT NULL AND email <> '') AS with_email,
                SUM(phone IS NOT NULL AND phone <> '') AS with_phone
           FROM ${this.table}
          WHERE opted_out = 0 AND active = 1
          GROUP BY company, department`
      );
      const [syncRows] = await this.pool.query<(RowDataPacket & { synced_at: string | null })[]>(
        `SELECT MAX(synced_at) AS synced_at FROM ${this.table}`
      );
      const byDepartment: Record<string, number> = {};
      const byCompany: Record<string, number> = {};
      let total = 0;
      let withEmail = 0;
      let withPhone = 0;
      for (const r of rows) {
        const dept = r.department ?? 'Unspecified';
        byDepartment[dept] = (byDepartment[dept] ?? 0) + Number(r.c);
        byCompany[r.company] = (byCompany[r.company] ?? 0) + Number(r.c);
        total += Number(r.c);
        withEmail += Number(r.with_email);
        withPhone += Number(r.with_phone);
      }
      return {
        available: true,
        total,
        withEmail,
        withPhone,
        byDepartment,
        byCompany,
        syncedAt: syncRows[0]?.synced_at ? String(syncRows[0].synced_at) : null,
      };
    } catch (err) {
      if (isMissingTable(err)) {
        return { available: false, total: 0, withEmail: 0, withPhone: 0, byDepartment: {}, byCompany: {}, syncedAt: null };
      }
      throw err;
    }
  }

  /**
   * Resolve the recipients for a staff campaign: active, reachable, not opted out,
   * matching the filter, deduped by the contact used for the chosen channel. Capped by `cap`.
   */
  async buildAudience(
    channel: StaffChannel,
    filters: { company?: string; department?: string },
    cap: number
  ): Promise<StaffAudienceMember[]> {
    const { sql: whereSql, params } = this.buildWhere({ ...filters, channel, activeOnly: true });
    const hardCap = Math.min(Math.max(1, Math.trunc(cap) || 1000), 50000);
    try {
      const [rows] = await this.pool.query<EmployeeRow[]>(
        `SELECT company, gl_code, emp_id, name, department, phone, email
           FROM ${this.table}
          ${whereSql ? `${whereSql} AND` : 'WHERE'} opted_out = 0
          ORDER BY department ASC, name ASC
          LIMIT ${hardCap}`,
        params
      );
      const seen = new Set<string>();
      const audience: StaffAudienceMember[] = [];
      for (const r of rows) {
        const contact = (channel === 'email' ? r.email : r.phone)?.trim();
        if (!contact) continue;
        const key = contact.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        audience.push({
          company: r.company,
          glCode: r.gl_code,
          empId: r.emp_id == null ? null : Number(r.emp_id),
          name: r.name,
          department: r.department,
          contact,
          phone: r.phone,
          email: r.email,
        });
      }
      return audience;
    } catch (err) {
      if (isMissingTable(err)) return [];
      throw err;
    }
  }

  async setOptOut(company: string, glCode: string, optedOut: boolean): Promise<boolean> {
    try {
      const [res] = await this.pool.query(
        `UPDATE ${this.table} SET opted_out = ? WHERE company = ? AND gl_code = ?`,
        [optedOut ? 1 : 0, company, glCode]
      );
      return (res as { affectedRows?: number }).affectedRows ? true : false;
    } catch (err) {
      if (isMissingTable(err)) return false;
      throw err;
    }
  }
}
