# WhatsApp in the Notification Service

The notification service is a **central place to see all WhatsApp conversations, send
messages, and manage/submit templates** — without changing `chesa_api_gateway` or the
telecaller service.

## Architecture (why nothing else had to change)

WhatsApp for the whole company runs on one Meta WABA (phone id `500138309848954`).
`chesa_api_gateway` is the single Meta webhook receiver. Outbound is logged to
`production_dashboard.whatsapp_outbound`; inbound is forwarded to the telecaller service
and persisted in `telecaller_crm_staging.whatsapp_inbound`.

This service plugs in **read-mostly**:

- **See all conversations** — the admin inbox reads inbound from
  `telecaller_crm_staging.whatsapp_inbound` and outbound from
  `production_dashboard.whatsapp_outbound` (read-only; DBs set via `WHATSAPP_INBOUND_DB`
  / `WHATSAPP_OUTBOUND_DB`). No forwarder, no webhook here.
- **Send** — outbound goes straight to the Meta Cloud API (same WABA), and each send is
  appended to the shared `whatsapp_outbound`. Because chesa's existing webhook updates
  `whatsapp_outbound` by `wa_message_id`, our sends get **delivered/read status for free**
  and also show up in chesa's own inbox. Zero chesa code touched.
- **Templates / Go-Live** — list/create/delete Meta message templates via the Graph API
  on the WABA. Creating a template submits it to Meta for approval (that's "going live").

New outbound `whatsapp` notification channel is registered too, so the normal
`POST /api/v1/notifications` with `channel: "whatsapp"` also works (text = rendered body;
pass `data.whatsappTemplate = { name, language, components }` to send an approved template).

## Endpoints (all under the X-Admin-Token admin guard)

| Method | Path | Purpose |
|--------|------|---------|
| GET  | `/api/v1/admin/whatsapp/conversations?limit&offset&q` | conversation list (newest per phone) |
| GET  | `/api/v1/admin/whatsapp/thread?phone=&limit=` | merged inbound+outbound thread |
| POST | `/api/v1/admin/whatsapp/send` | `{ phone, text }` or `{ phone, templateName, templateLanguage, params[] }` |
| GET  | `/api/v1/admin/whatsapp/templates` | list Meta templates (name/status/category/language/body) |
| POST | `/api/v1/admin/whatsapp/templates` | create/submit a template `{ name, category, language, body, example? }` |
| DELETE | `/api/v1/admin/whatsapp/templates?name=` | delete a template |

UI pages (notification-system-ui): **WhatsApp** (inbox), **WA Templates**, **Go Live**.

## Go-live checklist (production)

1. **Env** — in `/var/www/html/notification-service/.env` set:
   ```
   WHATSAPP_ACCESS_TOKEN=<Meta system-user token — same one chesa uses>
   WHATSAPP_INBOUND_DB=telecaller_crm_staging
   WHATSAPP_OUTBOUND_DB=production_dashboard
   # phone id / WABA id / version already default to the live values; override only if they change
   ```
2. **DB grant** — the notify DB user must be able to read the shared log and append sends:
   ```sql
   GRANT SELECT ON telecaller_crm_staging.whatsapp_inbound TO '<notify_db_user>'@'localhost';
   GRANT SELECT, INSERT ON production_dashboard.whatsapp_outbound TO '<notify_db_user>'@'localhost';
   FLUSH PRIVILEGES;
   ```
   (Find `<notify_db_user>` in the service's `.env` `DB_USER`. If it already has broad access to
   `production_dashboard`, nothing to do.)
3. **Deploy** — on the app server:
   ```bash
   cd /var/www/html/notification-service
   git pull
   npm ci
   npm run build          # no new migration — uses the shared tables
   pm2 restart notify-api notify-worker
   ```
4. **Verify**:
   ```bash
   # conversations should return recent chats (needs the DB grant above)
   curl -s -H "X-Admin-Token: <ADMIN_TOKEN>" "https://api.chesadentalcare.com/notify/api/v1/admin/whatsapp/conversations?limit=5"
   # templates should list the WABA templates (needs WHATSAPP_ACCESS_TOKEN)
   curl -s -H "X-Admin-Token: <ADMIN_TOKEN>" "https://api.chesadentalcare.com/notify/api/v1/admin/whatsapp/templates"
   ```
   Then open the console → WhatsApp / WA Templates / Go Live.

## Deliberately NOT included (kept in chesa / telecaller — can be layered later)

- The Meta inbound **webhook** stays in `chesa_api_gateway` (single receiver). We only read
  the log it writes.
- Rich inbox extras from Admin-Next (SSE live stream, agent assignment, customer context
  sidebar, quick-reply chips, WABA-health, media proxy), **bulk send / campaigns**,
  **analytics**, and the curated ~70-template **drip pack + simulate** (those are defined in
  the telecaller service). They can be ported on top of this base without touching chesa.
