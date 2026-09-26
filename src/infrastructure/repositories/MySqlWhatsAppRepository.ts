import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import type {
  WhatsAppConversation,
  WhatsAppConversationsQuery,
  WhatsAppOutboundInput,
  WhatsAppRepository,
  WhatsAppThreadItem,
  WhatsAppThreadQuery,
} from '../../domain/ports/WhatsAppRepository.js';
import type { DbPool } from '../db/pool.js';

// Match numbers on their last 10 digits so a stored "919876543210" and an
// inbound "9876543210" (or "+91 98765 43210") land in the same conversation.
const last10 = (phone: string): string => String(phone ?? '').replace(/\D/g, '').slice(-10);

interface ConversationRow extends RowDataPacket {
  phone: string;
  last_at: Date;
  last_direction: 'in' | 'out';
  last_body: string | null;
}

interface ThreadRow extends RowDataPacket {
  direction: 'in' | 'out';
  body: string | null;
  msg_type: string | null;
  status: string | null;
  sent_by: string | null;
  at: Date;
}

// Reads the shared WhatsApp log so every conversation is visible here: inbound from
// the telecaller store, outbound from chesa's store. Appends this service's own sends
// to the outbound table. Both are read-only except inserting our outbound rows.
export class MySqlWhatsAppRepository implements WhatsAppRepository {
  private readonly inbound: string;
  private readonly outbound: string;

  constructor(private readonly pool: DbPool, inboundDb: string, outboundDb: string) {
    const inDb = /^[A-Za-z0-9_]+$/.test(inboundDb) ? inboundDb : 'telecaller_crm_staging';
    const outDb = /^[A-Za-z0-9_]+$/.test(outboundDb) ? outboundDb : 'production_dashboard';
    this.inbound = `\`${inDb}\`.whatsapp_inbound`;
    this.outbound = `\`${outDb}\`.whatsapp_outbound`;
  }

  async saveOutbound(row: WhatsAppOutboundInput): Promise<number> {
    const [result] = await this.pool.execute<ResultSetHeader>(
      `INSERT INTO ${this.outbound} (to_phone, body, wa_message_id, status, sent_by)
       VALUES (?, ?, ?, ?, ?)`,
      [
        row.toPhone,
        row.body ?? null,
        row.waMessageId,
        row.status ?? 'sent',
        row.sentBy ?? 'notification-service',
      ]
    );
    return result.insertId;
  }

  async listConversations(query: WhatsAppConversationsQuery): Promise<WhatsAppConversation[]> {
    const limit = Math.min(Math.max(1, Math.trunc(query.limit) || 25), 200);
    const offset = Math.max(0, Math.trunc(query.offset) || 0);
    const params: unknown[] = [];
    let qFilter = '';
    if (query.q) {
      qFilter = 'WHERE phone LIKE ?';
      params.push(`%${last10(query.q)}%`);
    }

    const [rows] = await this.pool.query<ConversationRow[]>(
      `SELECT t.phone AS phone, t.at AS last_at, t.direction AS last_direction, t.body AS last_body
         FROM (
           SELECT RIGHT(REGEXP_REPLACE(from_phone, '[^0-9]', ''), 10) COLLATE utf8mb4_general_ci AS phone,
                  received_at AS at, 'in' AS direction, body COLLATE utf8mb4_general_ci AS body FROM ${this.inbound}
           UNION ALL
           SELECT RIGHT(REGEXP_REPLACE(to_phone, '[^0-9]', ''), 10) COLLATE utf8mb4_general_ci AS phone,
                  sent_at AS at, 'out' AS direction, body COLLATE utf8mb4_general_ci AS body FROM ${this.outbound}
         ) t
         JOIN (
           SELECT phone, MAX(at) AS max_at FROM (
             SELECT RIGHT(REGEXP_REPLACE(from_phone, '[^0-9]', ''), 10) COLLATE utf8mb4_general_ci AS phone, received_at AS at FROM ${this.inbound}
             UNION ALL
             SELECT RIGHT(REGEXP_REPLACE(to_phone, '[^0-9]', ''), 10) COLLATE utf8mb4_general_ci AS phone, sent_at AS at FROM ${this.outbound}
           ) u GROUP BY phone
         ) m ON m.phone = t.phone AND m.max_at = t.at
         ${qFilter}
         GROUP BY t.phone, t.at, t.direction, t.body
         ORDER BY last_at DESC
         LIMIT ${limit} OFFSET ${offset}`,
      params
    );

    return rows.map((r) => ({
      phone: r.phone,
      lastAt: r.last_at,
      lastDirection: r.last_direction,
      lastBody: r.last_body,
    }));
  }

  async getThread(phone: string, query: WhatsAppThreadQuery): Promise<WhatsAppThreadItem[]> {
    const limit = Math.min(Math.max(1, Math.trunc(query.limit) || 100), 500);
    const key = last10(phone);

    const [rows] = await this.pool.query<ThreadRow[]>(
      `SELECT * FROM (
         SELECT 'in' AS direction, body COLLATE utf8mb4_general_ci AS body, NULL AS msg_type,
                NULL AS status, NULL AS sent_by, received_at AS at
           FROM ${this.inbound}
          WHERE RIGHT(REGEXP_REPLACE(from_phone, '[^0-9]', ''), 10) = ?
         UNION ALL
         SELECT 'out' AS direction, body COLLATE utf8mb4_general_ci AS body, NULL AS msg_type,
                status COLLATE utf8mb4_general_ci AS status, sent_by COLLATE utf8mb4_general_ci AS sent_by, sent_at AS at
           FROM ${this.outbound}
          WHERE RIGHT(REGEXP_REPLACE(to_phone, '[^0-9]', ''), 10) = ?
       ) t
       ORDER BY at ASC
       LIMIT ${limit}`,
      [key, key]
    );

    return rows.map((r) => ({
      direction: r.direction,
      body: r.body,
      msgType: r.msg_type,
      status: r.status,
      sentBy: r.sent_by,
      at: r.at,
    }));
  }
}
