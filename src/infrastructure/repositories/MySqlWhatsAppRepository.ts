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

interface CloseServiceCallRow extends RowDataPacket {
  serviceCallId: string | number | null;
  created_date: Date | null;
  first_reminder_24hrs: Date | null;
  auto_call_closed: Date | null;
}

// Reads the shared WhatsApp log so every conversation is visible here: inbound from
// the telecaller store, outbound from chesa's store. Appends this service's own sends
// to the outbound table. Both are read-only except inserting our outbound rows.
export class MySqlWhatsAppRepository implements WhatsAppRepository {
  private readonly inbound: string;
  private readonly outbound: string;
  private readonly tcOutbound: string;
  private readonly custUpdate: string;
  private readonly waitingCalls: string;
  private readonly leadExt: string;
  private readonly closeServiceCalls: string;

  constructor(private readonly pool: DbPool, inboundDb: string, outboundDb: string) {
    const inDb = /^[A-Za-z0-9_]+$/.test(inboundDb) ? inboundDb : 'telecaller_crm_staging';
    const outDb = /^[A-Za-z0-9_]+$/.test(outboundDb) ? outboundDb : 'production_dashboard';
    this.inbound = `\`${inDb}\`.whatsapp_inbound`;
    this.outbound = `\`${outDb}\`.whatsapp_outbound`;
    this.tcOutbound = `\`${inDb}\`.whatsapp_messages`;
    this.custUpdate = `\`${outDb}\`.customer_update`;
    this.waitingCalls = `\`${outDb}\`.waiting_calls`;
    this.leadExt = `\`${inDb}\`.lead_extensions`;
    this.closeServiceCalls = `\`${outDb}\`.close_service_calls`;
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
    const limit = Math.min(Math.max(1, Math.trunc(query.limit) || 100), 500);
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
           UNION ALL
           SELECT RIGHT(REGEXP_REPLACE(phone, '[^0-9]', ''), 10) COLLATE utf8mb4_general_ci AS phone,
                  sent_at AS at, 'out' AS direction,
                  COALESCE(
                    JSON_UNQUOTE(JSON_EXTRACT(payload, '$.message.body')),
                    CASE WHEN JSON_TYPE(JSON_EXTRACT(payload, '$.message')) = 'STRING'
                         THEN JSON_UNQUOTE(JSON_EXTRACT(payload, '$.message'))
                         ELSE NULL END,
                    CONCAT('Drip: ', template_name)
                  ) COLLATE utf8mb4_general_ci AS body FROM ${this.tcOutbound}
         ) t
         JOIN (
           SELECT phone, MAX(at) AS max_at FROM (
             SELECT RIGHT(REGEXP_REPLACE(from_phone, '[^0-9]', ''), 10) COLLATE utf8mb4_general_ci AS phone, received_at AS at FROM ${this.inbound}
             UNION ALL
             SELECT RIGHT(REGEXP_REPLACE(to_phone, '[^0-9]', ''), 10) COLLATE utf8mb4_general_ci AS phone, sent_at AS at FROM ${this.outbound}
             UNION ALL
             SELECT RIGHT(REGEXP_REPLACE(phone, '[^0-9]', ''), 10) COLLATE utf8mb4_general_ci AS phone, sent_at AS at FROM ${this.tcOutbound}
           ) u GROUP BY phone
         ) m ON m.phone = t.phone AND m.max_at = t.at
         ${qFilter}
         GROUP BY t.phone, t.at, t.direction, t.body
         ORDER BY last_at DESC
         LIMIT ${limit} OFFSET ${offset}`,
      params
    );

    const conversations = rows.map((r) => ({
      phone: r.phone,
      lastAt: r.last_at,
      lastDirection: r.last_direction,
      lastBody: r.last_body,
      name: null as string | null,
    }));

    const keys = [...new Set(conversations.map((c) => c.phone).filter(Boolean))];
    const names = await this.resolveNames(keys);
    for (const c of conversations) {
      c.name = names.get(c.phone) ?? null;
    }

    return conversations;
  }

  // Resolve last-10 phone keys to a contact name, preferring the service stores
  // (customer_update.customer_name || doctor_name, then waiting_calls.name) and
  // finally the telecaller lead (lead_extensions.customer_name, matched on the
  // lead's phone or whatsapp_number). Read-only, one scan per table; degrades to
  // no-name if a table/column differs.
  private async resolveNames(keys: string[]): Promise<Map<string, string>> {
    const result = new Map<string, string>();
    if (keys.length === 0) return result;

    const placeholders = keys.map(() => '?').join(', ');

    try {
      const [cuRows] = await this.pool.query<Array<{ k: string; name: string | null } & RowDataPacket>>(
        `SELECT RIGHT(REGEXP_REPLACE(mobile_number, '[^0-9]', ''), 10) AS k,
                COALESCE(NULLIF(TRIM(customer_name), ''), NULLIF(TRIM(doctor_name), '')) AS name
           FROM ${this.custUpdate}
          WHERE RIGHT(REGEXP_REPLACE(mobile_number, '[^0-9]', ''), 10) IN (${placeholders})
          ORDER BY id DESC`,
        keys
      );
      for (const row of cuRows) {
        if (row.k && row.name && !result.has(row.k)) result.set(row.k, row.name);
      }
    } catch {
      // Table/column may differ on some environments; degrade to no-name.
    }

    const missing = keys.filter((k) => !result.has(k));
    if (missing.length > 0) {
      const wcPlaceholders = missing.map(() => '?').join(', ');
      try {
        const [wcRows] = await this.pool.query<Array<{ k: string; name: string | null } & RowDataPacket>>(
          `SELECT RIGHT(REGEXP_REPLACE(phone, '[^0-9]', ''), 10) AS k, name
             FROM ${this.waitingCalls}
            WHERE RIGHT(REGEXP_REPLACE(phone, '[^0-9]', ''), 10) IN (${wcPlaceholders})
            ORDER BY id DESC`,
          missing
        );
        for (const row of wcRows) {
          const name = row.name ? String(row.name).trim() : '';
          if (row.k && name && !result.has(row.k)) result.set(row.k, name);
        }
      } catch {
        // Degrade to no-name.
      }
    }

    const stillMissing = keys.filter((k) => !result.has(k));
    if (stillMissing.length > 0) {
      const lePlaceholders = stillMissing.map(() => '?').join(', ');
      try {
        const [leRows] = await this.pool.query<Array<{ k: string; name: string | null } & RowDataPacket>>(
          `SELECT k, name FROM (
             SELECT RIGHT(REGEXP_REPLACE(phone, '[^0-9]', ''), 10) AS k,
                    NULLIF(TRIM(customer_name), '') AS name, updated_at AS at
               FROM ${this.leadExt}
              WHERE RIGHT(REGEXP_REPLACE(phone, '[^0-9]', ''), 10) IN (${lePlaceholders})
             UNION ALL
             SELECT RIGHT(REGEXP_REPLACE(whatsapp_number, '[^0-9]', ''), 10) AS k,
                    NULLIF(TRIM(customer_name), '') AS name, updated_at AS at
               FROM ${this.leadExt}
              WHERE RIGHT(REGEXP_REPLACE(whatsapp_number, '[^0-9]', ''), 10) IN (${lePlaceholders})
           ) le
           WHERE name IS NOT NULL
           ORDER BY at DESC`,
          [...stillMissing, ...stillMissing]
        );
        for (const row of leRows) {
          const name = row.name ? String(row.name).trim() : '';
          if (row.k && name && !result.has(row.k)) result.set(row.k, name);
        }
      } catch {
        // Telecaller schema may differ; degrade to no-name.
      }
    }

    return result;
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
         UNION ALL
         SELECT 'out' AS direction,
                CONCAT(
                  COALESCE(
                    JSON_UNQUOTE(JSON_EXTRACT(payload, '$.message.body')),
                    CASE WHEN JSON_TYPE(JSON_EXTRACT(payload, '$.message')) = 'STRING'
                         THEN JSON_UNQUOTE(JSON_EXTRACT(payload, '$.message'))
                         ELSE NULL END,
                    CONCAT('Drip: ', template_name)
                  ),
                  CASE WHEN JSON_UNQUOTE(JSON_EXTRACT(payload, '$.message.documentName')) IS NOT NULL
                       THEN CONCAT(' 📎 ', JSON_UNQUOTE(JSON_EXTRACT(payload, '$.message.documentName')))
                       ELSE '' END
                ) COLLATE utf8mb4_general_ci AS body,
                template_name COLLATE utf8mb4_general_ci AS msg_type,
                NULL AS status, NULL AS sent_by, sent_at AS at
           FROM ${this.tcOutbound}
          WHERE RIGHT(REGEXP_REPLACE(phone, '[^0-9]', ''), 10) = ?
       ) t
       ORDER BY at ASC
       LIMIT ${limit}`,
      [key, key, key]
    );

    const items: WhatsAppThreadItem[] = rows.map((r) => ({
      direction: r.direction,
      body: r.body,
      msgType: r.msg_type,
      status: r.status,
      sentBy: r.sent_by,
      at: r.at,
    }));

    // The service dashboard synthesizes "out" system bubbles from the closure/CSAT
    // lifecycle (close_service_calls) rather than storing them in the WhatsApp log.
    // Reproduce those here so hub threads match. Degrade to nothing if the table is
    // missing so a schema difference never breaks the thread.
    try {
      const [scRows] = await this.pool.query<CloseServiceCallRow[]>(
        `SELECT serviceCallId, created_date, first_reminder_24hrs, auto_call_closed
           FROM ${this.closeServiceCalls}
          WHERE RIGHT(REGEXP_REPLACE(customerPhone, '[^0-9]', ''), 10) = ?
          ORDER BY created_date ASC`,
        [key]
      );

      for (const r of scRows) {
        const sc = r.serviceCallId;
        if (r.created_date) {
          items.push({
            direction: 'out',
            body: `🔔 Satisfaction check for service call #${sc}: "Are you satisfied with the resolution of your issue?" — reply “Yes, I'm satisfied” or “No, I need more help”.`,
            msgType: 'system',
            status: 'template',
            sentBy: 'System · Closure request',
            at: r.created_date,
          });
        }
        if (r.first_reminder_24hrs) {
          items.push({
            direction: 'out',
            body: `⏰ Reminder (24h) for service call #${sc}: please confirm if your issue is resolved — reply “Yes, I'm satisfied” or “No, I need more help”.`,
            msgType: 'system',
            status: 'template',
            sentBy: 'System · 24h reminder',
            at: r.first_reminder_24hrs,
          });
        }
        if (r.auto_call_closed) {
          items.push({
            direction: 'out',
            body: `🔒 Service call #${sc} was closed automatically (no response to the satisfaction check).`,
            msgType: 'system',
            status: 'template',
            sentBy: 'System · Auto-closed',
            at: r.auto_call_closed,
          });
        }
      }
    } catch {
      // close_service_calls may be absent on some environments; degrade to nothing.
    }

    items.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

    return items.slice(0, limit);
  }
}
