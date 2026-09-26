import { createHash, randomBytes } from 'node:crypto';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import type { DbPool } from '../db/pool.js';

export interface ApiClient {
  id: string;
  name: string;
}

interface ClientRow extends RowDataPacket {
  id: number;
  name: string;
}

interface AdminClientRow extends RowDataPacket {
  id: number;
  name: string;
  active: number;
  created_at: Date;
}

export interface AdminApiClient {
  id: string;
  name: string;
  active: boolean;
  createdAt: Date;
}

export interface CreatedApiClient extends AdminApiClient {
  /** Plaintext key — shown once, on creation, then never retrievable (only the hash is stored). */
  apiKey: string;
}

export class MySqlApiClientRepository {
  private cache = new Map<string, { value: ApiClient | null; expires: number }>();

  constructor(
    private readonly pool: DbPool,
    private readonly ttlMs = 60_000
  ) {}

  async findByApiKey(apiKey: string): Promise<ApiClient | null> {
    const hash = createHash('sha256').update(apiKey).digest('hex');
    const hit = this.cache.get(hash);
    if (hit && hit.expires > Date.now()) return hit.value;

    const [rows] = await this.pool.execute<ClientRow[]>(
      `SELECT id, name FROM api_clients WHERE api_key_hash = ? AND active = 1 LIMIT 1`,
      [hash]
    );
    const row = rows[0];
    const value = row ? { id: String(row.id), name: row.name } : null;
    this.cache.set(hash, { value, expires: Date.now() + this.ttlMs });
    return value;
  }

  // ---- Admin CRUD ----

  async list(): Promise<AdminApiClient[]> {
    const [rows] = await this.pool.query<AdminClientRow[]>(
      `SELECT id, name, active, created_at FROM api_clients ORDER BY created_at DESC`
    );
    return rows.map((r) => ({
      id: String(r.id),
      name: r.name,
      active: !!r.active,
      createdAt: r.created_at,
    }));
  }

  /** Creates a client with a freshly generated key. The plaintext key is returned once and never stored. */
  async create(name: string): Promise<CreatedApiClient> {
    const apiKey = `nk_${randomBytes(24).toString('hex')}`;
    const hash = createHash('sha256').update(apiKey).digest('hex');
    const [res] = await this.pool.execute<ResultSetHeader>(
      `INSERT INTO api_clients (name, api_key_hash) VALUES (?, ?)`,
      [name, hash]
    );
    const [rows] = await this.pool.execute<AdminClientRow[]>(
      `SELECT id, name, active, created_at FROM api_clients WHERE id = ? LIMIT 1`,
      [res.insertId]
    );
    const row = rows[0];
    if (!row) throw new Error('Failed to load API client after insert');
    return {
      id: String(row.id),
      name: row.name,
      active: !!row.active,
      createdAt: row.created_at,
      apiKey,
    };
  }

  async setActive(id: number, active: boolean): Promise<boolean> {
    const [res] = await this.pool.execute<ResultSetHeader>(
      `UPDATE api_clients SET active = ? WHERE id = ?`,
      [active ? 1 : 0, id]
    );
    this.cache.clear();
    return res.affectedRows > 0;
  }
}
