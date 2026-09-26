# Chesa Notification Service

Standalone, channel-pluggable notification service: **email** and **FCM push** today, **WhatsApp** next — one API for every Chesa frontend and backend.

Built with hexagonal architecture (ports & adapters) in TypeScript. See `docs/HLD.md`, `docs/LLD.md`, and `docs/adr/` for the design and the reasoning behind every major decision.

## Quick start (local)

```bash
cp .env.example .env          # fill in DB/Redis (or use docker compose)
npm install
npm run migrate               # creates DB, tables, seed template + dev API key
npm run dev                   # API on :4600
npm run dev:worker            # queue consumer (second terminal)
```

Or with Docker: `docker compose up --build` (brings its own MySQL + Redis).

## Try it

```bash
curl -X POST http://localhost:4600/api/v1/notifications \
  -H 'Content-Type: application/json' \
  -H 'X-API-Key: dev-local-key' \
  -d '{
        "channel": "email",
        "to": { "email": "someone@example.com", "name": "Dr. Test" },
        "templateKey": "test-message",
        "data": { "title": "Hello", "message": "It works." },
        "idempotencyKey": "demo-001"
      }'
# → 202 { "id": "…", "status": "PENDING" }

curl http://localhost:4600/api/v1/notifications/<id> -H 'X-API-Key: dev-local-key'
# → status, attempt history, provider message id
```

Set `NOTIFY_DRY_RUN=1` to exercise the full pipeline (queue, retries, status, audit) while channels only log instead of sending — ideal for testing and demos.

## Tests

```bash
npm test        # unit tests — pure domain + use-cases with fake ports, no DB/Redis needed
```

## Production deploy (Chesa EC2 — house playbook)

```bash
cd /var/www/html && git clone <repo> notification-service && cd notification-service
npm ci && npm run build
cp .env.example .env && nano .env          # prod DB/Redis/SMTP/FCM values
npm run migrate
pm2 start ecosystem.config.cjs && pm2 save
```

Apache (`api-gateway.conf`, above the :4000 catch-all):

```apache
ProxyPass        /notify/ http://localhost:4600/
ProxyPassReverse /notify/ http://localhost:4600/
```

`sudo apachectl configtest && sudo systemctl reload apache2` — clients then call
`https://api.chesadentalcare.com/notify/api/v1/notifications`.

Register a client app: `INSERT INTO api_clients (name, api_key_hash) VALUES ('sales-final', SHA2('<generated-key>', 256));`

## Adding the WhatsApp channel (the open/closed proof)

1. `src/infrastructure/channels/WhatsAppChannel.ts` implementing `NotificationChannel` against the existing provider (`WHATSAPP_URL`).
2. One line in `composition/container.ts`: `.register(new WhatsAppChannel(env))`.
3. Templates with `channel='whatsapp'`. No other file changes.

## Admin API (for `notification-system-ui`)

A separate, token-protected surface powers the admin console. It lives under
`/api/v1/admin/*`, is guarded by the `X-Admin-Token` header (env `ADMIN_TOKEN`),
and is CORS-enabled (`CORS_ORIGIN`). The existing client send API (`X-API-Key`)
is untouched.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/v1/admin/me` | Validate the admin token (login probe) |
| GET | `/api/v1/admin/stats` | Dashboard counters + daily volume |
| GET | `/api/v1/admin/channels` | Channels + config readiness |
| GET | `/api/v1/admin/notifications` | List (filters: `status,channel,clientId,templateKey,q,limit,offset`) |
| GET | `/api/v1/admin/notifications/:id` | Detail + attempt history |
| POST | `/api/v1/admin/notifications` | Admin-initiated send |
| GET/POST/PUT/DELETE | `/api/v1/admin/templates[/:id]` | Template CRUD |
| GET/POST/PATCH | `/api/v1/admin/clients[/:id]` | Client list / create (one-time key) / enable-disable |

New env vars (see `.env.example`):

```
ADMIN_TOKEN=dev-admin-token          # shared secret the admin UI signs in with
CORS_ORIGIN=http://localhost:5173    # allowed browser origin(s), or *
```
